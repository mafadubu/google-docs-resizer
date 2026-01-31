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

        // 3. Batch Update in chunks
        // Since we use property update, IDs DON'T change. Very stable.
        const CHUNK_SIZE = 50;
        let updatedCount = 0;

        for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
            const chunk = requests.slice(i, i + CHUNK_SIZE);
            let retryCount = 0;
            const MAX_RETRIES = 2;

            while (retryCount <= MAX_RETRIES) {
                try {
                    await docs.documents.batchUpdate({
                        documentId: docId,
                        requestBody: {
                            requests: chunk,
                        },
                    });
                    updatedCount += chunk.length;
                    break;
                } catch (chunkError: any) {
                    console.error(`[Resize Error] Batch starting at ${i}, Retry ${retryCount}:`, chunkError.message);

                    const isRetryable = chunkError.message?.includes("Internal error") || chunkError.code >= 500;
                    if (isRetryable && retryCount < MAX_RETRIES) {
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
                        continue;
                    }
                    throw chunkError;
                }
            }

            if (i + CHUNK_SIZE < requests.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Update stats (fire and forget)
        incrementStats(updatedCount).catch(e => console.error("Stats Error:", e));

        return NextResponse.json({
            success: true,
            count: updatedCount,
            message: `Successfully resized ${updatedCount} images.`
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
