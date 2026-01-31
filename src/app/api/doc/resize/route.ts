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

        // 3. Batch Update in MICRO chunks (v4.0 Stability)
        // Smaller chunks (5 images = 10 requests) are MUCH more stable and avoid timeouts.
        const MICRO_CHUNK_SIZE = 5;
        const newIdMapping: Record<string, string> = {};
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < requests.length; i += (MICRO_CHUNK_SIZE * 2)) {
            const chunk = requests.slice(i, i + (MICRO_CHUNK_SIZE * 2));
            try {
                const response = await docs.documents.batchUpdate({
                    documentId: docId,
                    requestBody: {
                        requests: chunk,
                    },
                });

                const replies = response.data.replies || [];
                let chunkInsertCount = 0;
                chunk.forEach((req, cIdx) => {
                    if (req.insertInlineImage) {
                        const reply = replies[cIdx];
                        const oldId = originalIds[successCount + failCount + chunkInsertCount];
                        const newId = reply.insertInlineImage?.objectId;
                        if (oldId && newId) newIdMapping[oldId] = newId;
                        chunkInsertCount++;
                    }
                });
                successCount += chunkInsertCount;
            } catch (chunkError: any) {
                console.error(`[Resize Micro-Batch Error] At index ${i}:`, chunkError.message);
                failCount += (chunk.filter(c => c.insertInlineImage).length);
            }
        }

        // Update stats (only for successful ones)
        if (successCount > 0) {
            incrementStats(successCount).catch(e => console.error("Stats Error:", e));
        }

        return NextResponse.json({
            success: true,
            results: {
                total: successCount + failCount,
                success: successCount,
                failed: failCount
            },
            newIdMapping,
            message: `Processed ${successCount} images successfully, ${failCount} failed.`
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
