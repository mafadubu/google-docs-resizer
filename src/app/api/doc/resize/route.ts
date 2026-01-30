import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { calculateImageResizeRequests, getGoogleDocsClient } from "@/lib/google-docs";
import { incrementStats } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { docId, targetWidthCm, scopes, selectedImageIds } = await req.json();

        if (!docId || !targetWidthCm) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const docs = getGoogleDocsClient(accessToken);

        // 1. Fetch current doc state (to get current image sizes)
        const docRes = await docs.documents.get({ documentId: docId });
        const doc = docRes.data;

        // 2. Calculate requests
        const { requests, originalIds } = calculateImageResizeRequests(doc, {
            targetWidthCm,
            scopes: Array.isArray(scopes) ? scopes : undefined,
            selectedImageIds: Array.isArray(selectedImageIds) ? selectedImageIds : undefined
        });

        if (requests.length === 0) {
            return NextResponse.json({ message: "No images found to resize", count: 0 });
        }

        // 3. Batch Update ONE BY ONE for extreme stability (Avoid "Internal error")
        const CHUNK_SIZE = 2; // Exactly 1 image (1 insert + 1 delete)
        const newIdMapping: Record<string, string> = {};
        let totalInsertCount = 0;

        for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
            const chunk = requests.slice(i, i + CHUNK_SIZE);
            let retryCount = 0;
            const MAX_RETRIES = 3; // Even more retries

            while (retryCount <= MAX_RETRIES) {
                try {
                    const response = await docs.documents.batchUpdate({
                        documentId: docId,
                        requestBody: {
                            requests: chunk,
                        },
                    });

                    // Extract New ID for the inserted image in this chunk
                    const insertReply = response.data.replies?.find((r: any) => r.insertInlineImage);
                    if (insertReply) {
                        const oldId = originalIds[totalInsertCount];
                        const newId = insertReply.insertInlineImage?.objectId;
                        if (oldId && newId) newIdMapping[oldId] = newId;
                        totalInsertCount++;
                    }

                    break;
                } catch (chunkError: any) {
                    console.error(`Error on chunk ${i}:`, chunkError.message);

                    const isRetryable = chunkError.message?.includes("Internal error") || chunkError.code === 500;
                    if (isRetryable && retryCount < MAX_RETRIES) {
                        retryCount++;
                        console.warn(`Retrying image ${totalInsertCount + 1} (${retryCount}/${MAX_RETRIES})...`);
                        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                        continue;
                    }
                    throw chunkError;
                }
            }

            // Forced delay between EVERY image
            if (i + CHUNK_SIZE < requests.length) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        // Final counts
        const totalCount = totalInsertCount;

        // Update stats (fire and forget)
        incrementStats(requests.length).catch(e => console.error("Stats Error:", e));

        return NextResponse.json({
            success: true,
            count: totalCount,
            newIdMapping,
            message: `Successfully resized ${totalCount} images.`
        });

    } catch (error: any) {
        console.error("Error resizing images:", error);
        if (error.response) {
            // Keep error details for production debugging if needed, or remove if strictly cleaning up
            console.error("API ERROR DETAILS:", JSON.stringify(error.response.data, null, 2));
        }
        return NextResponse.json(
            { error: error.message || "Failed to resize images" },
            { status: 500 }
        );
    }
}
