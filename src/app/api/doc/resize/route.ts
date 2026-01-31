import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGoogleDocsClient } from "@/lib/google-docs";
import { incrementStats, storeImageTicket } from "@/lib/redis";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const accessToken = session?.accessToken;
    if (!session || !accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { docId, targetWidthCm, selectedImageIds } = await req.json();
        if (!docId || !targetWidthCm || !selectedImageIds) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

        const docs = getGoogleDocsClient(accessToken);
        const docRes = await docs.documents.get({ documentId: docId });
        const doc = docRes.data;

        // Collect actions with current indices
        const actions: any[] = [];
        const targetWidthPt = targetWidthCm * 28.3465;

        const findImageIdx = (id: string) => {
            const inlineObj = doc.inlineObjects?.[id];
            if (inlineObj) {
                // Find in body
                let foundAt = -1;
                const search = (els: any[]) => {
                    for (const el of els) {
                        if (el.paragraph) {
                            for (const element of el.paragraph.elements || []) {
                                if (element.inlineObjectElement?.inlineObjectId === id) { foundAt = element.startIndex; return true; }
                            }
                        }
                        if (el.table) {
                            for (const r of el.table.tableRows || []) {
                                for (const c of r.tableCells || []) { if (search(c.content || [])) return true; }
                            }
                        }
                    }
                    return false;
                };
                search(doc.body?.content || []);
                if (foundAt !== -1) {
                    const props = inlineObj.inlineObjectProperties?.embeddedObject;
                    return { type: 'inline', index: foundAt, uri: props?.imageProperties?.contentUri, w: props?.size?.width?.magnitude, h: props?.size?.height?.magnitude };
                }
            }
            const positionedObj = doc.positionedObjects?.[id];
            if (positionedObj) {
                let foundAt = -1;
                const search = (els: any[]) => {
                    for (const el of els) {
                        if (el.paragraph?.positionedObjectIds?.includes(id)) { foundAt = el.startIndex; return true; }
                        if (el.table) {
                            for (const r of el.table.tableRows || []) {
                                for (const c of r.tableCells || []) { if (search(c.content || [])) return true; }
                            }
                        }
                    }
                    return false;
                };
                search(doc.body?.content || []);
                const props = positionedObj.positionedObjectProperties?.embeddedObject;
                return { type: 'positioned', index: foundAt, uri: props?.imageProperties?.contentUri, w: props?.size?.width?.magnitude, h: props?.size?.height?.magnitude };
            }
            return null;
        };

        for (const id of selectedImageIds) {
            const meta = findImageIdx(id);
            if (meta && meta.uri) {
                const scale = targetWidthPt / (meta.w || targetWidthPt);
                actions.push({ ...meta, id, newH: (meta.h || targetWidthPt) * scale });
            }
        }

        // --- CRITICAL: SORT DESCENDING BY INDEX ---
        // This ensures moving/deleting an image doesn't shift indices of images we haven't processed yet.
        actions.sort((a, b) => b.index - a.index);

        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "google-docs-resizer.vercel.app";
        const newIdMapping: Record<string, string> = {};
        let success = 0;
        let failed = 0;

        // Process in Micro-Batches of 5 to avoid timeouts
        const CHUNK_SIZE = 5;
        for (let i = 0; i < actions.length; i += CHUNK_SIZE) {
            const chunk = actions.slice(i, i + CHUNK_SIZE);
            const requests: any[] = [];
            const chunkIds: string[] = [];

            for (const action of chunk) {
                const tkId = uuidv4().substring(0, 8) + Date.now().toString(36);
                await storeImageTicket(tkId, { url: action.uri, token: accessToken });
                const proxyUri = `https://${host}/api/image-proxy?id=${tkId}`;

                if (action.type === 'inline') {
                    requests.push({ deleteContentRange: { range: { startIndex: action.index, endIndex: action.index + 1 } } });
                    requests.push({ insertInlineImage: { uri: proxyUri, location: { index: action.index }, objectSize: { width: { magnitude: targetWidthPt, unit: 'PT' }, height: { magnitude: action.newH, unit: 'PT' } } } });
                } else {
                    requests.push({ deletePositionedObject: { objectId: action.id } });
                    requests.push({ insertInlineImage: { uri: proxyUri, location: { index: action.index }, objectSize: { width: { magnitude: targetWidthPt, unit: 'PT' }, height: { magnitude: action.newH, unit: 'PT' } } } });
                }
                chunkIds.push(action.id);
            }

            try {
                const res = await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
                res.data.replies?.forEach((reply, rIdx) => {
                    const newId = reply.insertInlineImage?.objectId;
                    if (newId) {
                        // Find which action this reply belongs to (insert request is every 2nd in requests array)
                        const actionIdx = Math.floor(rIdx / 2);
                        if (chunkIds[actionIdx]) newIdMapping[chunkIds[actionIdx]] = newId;
                        success++;
                    }
                });
            } catch (e) {
                console.error("Batch Error:", e);
                failed += chunk.length;
            }
        }

        incrementStats(success).catch(() => { });
        return NextResponse.json({ success: true, results: { success, failed, total: actions.length }, newIdMapping });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
