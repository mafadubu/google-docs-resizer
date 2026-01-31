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
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "google-docs-resizer.vercel.app";
        const { requests, originalIds } = calculateImageResizeRequests(doc, {
            targetWidthCm,
            scopes: Array.isArray(scopes) ? scopes : undefined,
            selectedImageIds: Array.isArray(selectedImageIds) ? selectedImageIds : undefined
        }, accessToken, host);

        if (requests.length === 0) {
            return NextResponse.json({ message: "No images found to resize", count: 0 });
        }

        // 3. Batch Update in chunks (optimized for Vercel 10s limit)
        // Delete+Insert strategy changes IDs, so mapping is crucial.
        const CHUNK_SIZE = 40; // 40 images (80 requests) is safe and fast
        const newIdMapping: Record<string, string> = {};
        let processedInsertCount = 0;

        for (let i = 0; i < requests.length; i += (CHUNK_SIZE * 2)) {
            const chunk = requests.slice(i, i + (CHUNK_SIZE * 2));
            let retryCount = 0;
            const MAX_RETRIES = 2;

            while (retryCount <= MAX_RETRIES) {
                try {
                    const response = await docs.documents.batchUpdate({
                        documentId: docId,
                        requestBody: {
                            requests: chunk,
                        },
                    });

                    // Update ID Mapping for frontend
                    const replies = response.data.replies || [];
                    let chunkInsertCount = 0;
                    chunk.forEach((req, cIdx) => {
                        if (req.insertInlineImage) {
                            const reply = replies[cIdx];
                            const oldId = originalIds[processedInsertCount + chunkInsertCount];
                            const newId = reply.insertInlineImage?.objectId;
                            if (oldId && newId) newIdMapping[oldId] = newId;
                            chunkInsertCount++;
                        }
                    });
                    processedInsertCount += chunkInsertCount;
                    break;
                } catch (chunkError: any) {
                    console.error(`[Resize Error] Batch starting at ${i}, Retry ${retryCount}:`, chunkError.message);
                    if (chunkError.message?.includes("Internal error") && retryCount < MAX_RETRIES) {
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                        continue;
                    }
                    throw chunkError;
                }
            }

            if (i + (CHUNK_SIZE * 2) < requests.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Update stats (fire and forget)
        incrementStats(processedInsertCount).catch(e => console.error("Stats Error:", e));

        return NextResponse.json({
            success: true,
            count: processedInsertCount,
            newIdMapping,
            message: `Successfully resized ${processedInsertCount} images.`
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
