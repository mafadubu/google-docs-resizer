import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { calculateImageResizeRequests, getGoogleDocsClient } from "@/lib/google-docs";
import { incrementStats, storeImageTicket } from "@/lib/redis";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

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
        const docRes = await docs.documents.get({ documentId: docId });
        const doc = docRes.data;

        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "google-docs-resizer.vercel.app";

        // 1. Get Actions
        const { actions } = calculateImageResizeRequests(doc, {
            targetWidthCm,
            scopes: Array.isArray(scopes) ? scopes : undefined,
            selectedImageIds: Array.isArray(selectedImageIds) ? selectedImageIds : undefined
        }, accessToken, host);

        if (actions.length === 0) {
            return NextResponse.json({ message: "No images found to resize", count: 0, results: { success: 0, total: 0, failed: 0 } });
        }

        // 2. Build requests using Redis tickets for short URIs
        const requests: any[] = [];
        const originalIds: string[] = [];

        for (const action of actions) {
            // Generate a short ID for the URI to stay well under 2KB limit
            const ticketId = uuidv4().substring(0, 8) + Date.now().toString(36);
            await storeImageTicket(ticketId, { url: action.uri, token: accessToken });

            const proxyUri = `https://${host}/api/image-proxy?id=${ticketId}`;

            if (action.type === 'inline') {
                requests.push({
                    deleteContentRange: {
                        range: {
                            startIndex: action.index,
                            endIndex: action.index + 1
                        }
                    }
                });
                requests.push({
                    insertInlineImage: {
                        uri: proxyUri,
                        location: { index: action.index },
                        objectSize: {
                            width: { magnitude: action.width, unit: 'PT' },
                            height: { magnitude: action.height, unit: 'PT' }
                        }
                    }
                });
                originalIds.push(action.id);
            } else if (action.type === 'positioned') {
                requests.push({
                    deletePositionedObject: {
                        objectId: action.id
                    }
                });
                requests.push({
                    insertInlineImage: {
                        uri: proxyUri,
                        location: { index: action.anchorIndex },
                        objectSize: {
                            width: { magnitude: action.width, unit: 'PT' },
                            height: { magnitude: action.height, unit: 'PT' }
                        }
                    }
                });
                originalIds.push(action.id);
            }
        }

        // 3. Process batches (Micro-Batch v4.0 Engine)
        const MICRO_CHUNK_SIZE = 5;
        const newIdMapping: Record<string, string> = {};
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < requests.length; i += (MICRO_CHUNK_SIZE * 2)) {
            const chunk = requests.slice(i, i + (MICRO_CHUNK_SIZE * 2));
            try {
                const response = await docs.documents.batchUpdate({
                    documentId: docId,
                    requestBody: { requests: chunk },
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
                console.error(`[Resize Error] Batch starting at ${i}:`, chunkError.message);
                if (chunkError.response) console.error("API ERROR DETAILS:", JSON.stringify(chunkError.response.data, null, 2));
                failCount += (chunk.filter(c => c.insertInlineImage).length);
            }
        }

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
        console.error("Critical Resize error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to resize images", results: { success: 0, total: 0, failed: 1 } },
            { status: 500 }
        );
    }
}
