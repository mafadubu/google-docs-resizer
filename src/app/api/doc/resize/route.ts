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

        // 3. Batch Update in Chunks to avoid "Internal error" or timeouts
        const CHUNK_SIZE = 100; // 50 images (each has 2 requests)
        const newIdMapping: Record<string, string> = {};
        let totalInsertCount = 0;

        for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
            const chunk = requests.slice(i, i + CHUNK_SIZE);
            try {
                const response = await docs.documents.batchUpdate({
                    documentId: docId,
                    requestBody: {
                        requests: chunk,
                    },
                });

                // Extract New IDs for this chunk
                let chunkInsertCount = 0;
                const originalIdsForThisChunk = originalIds.slice(totalInsertCount, totalInsertCount + (chunk.filter(r => r.insertInlineImage).length));

                response.data.replies?.forEach((reply) => {
                    if (reply.insertInlineImage) {
                        const oldId = originalIdsForThisChunk[chunkInsertCount];
                        const newId = reply.insertInlineImage.objectId;
                        if (oldId && newId) {
                            newIdMapping[oldId] = newId;
                        }
                        chunkInsertCount++;
                    }
                });
                totalInsertCount += chunkInsertCount;

                // Small delay between chunks for safety
                if (i + CHUNK_SIZE < requests.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (chunkError: any) {
                console.error(`Chunk error at index ${i}:`, chunkError);
                if (chunkError.response?.data) {
                    console.error("Chunk error details:", JSON.stringify(chunkError.response.data, null, 2));
                }
                throw chunkError; // Re-throw to be caught by the outer catch
            }
        }

        // Update stats (fire and forget)
        incrementStats(requests.length).catch(e => console.error("Stats Error:", e));

        return NextResponse.json({
            success: true,
            count: totalInsertCount,
            newIdMapping,
            message: `Successfully resized ${totalInsertCount} images.`
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
