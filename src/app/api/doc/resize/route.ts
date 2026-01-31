import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGoogleDocsClient } from "@/lib/google-docs";
import { incrementStats } from "@/lib/redis";
import { NextResponse } from "next/server";

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

        const targetWidthPt = targetWidthCm * 28.3465;
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "google-docs-resizer.vercel.app";
        const protocol = req.headers.get("x-forwarded-proto") || "https";

        const findImageInfo = (id: string) => {
            const inlineObj = doc.inlineObjects?.[id];
            if (inlineObj) {
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

        const actions: any[] = [];
        for (const id of selectedImageIds) {
            const info = findImageInfo(id);
            if (info && info.uri) {
                const scale = targetWidthPt / (info.w || targetWidthPt);
                actions.push({ ...info, id, newH: (info.h || targetWidthPt) * scale });
            }
        }

        // --- Descending Sort for Index Stability ---
        actions.sort((a, b) => b.index - a.index);

        const newIdMapping: Record<string, string> = {};
        const CHUNK_SIZE = 5;
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < actions.length; i += CHUNK_SIZE) {
            const chunk = actions.slice(i, i + CHUNK_SIZE);
            const requests: any[] = [];
            const idsInChunk: string[] = [];

            for (const action of chunk) {
                // BLUEPRINT Proxy Link Generation with Base64 & Fake Extension
                const b64Url = Buffer.from(action.uri).toString('base64');
                const proxyUri = `${protocol}://${host}/api/image-proxy?u=${encodeURIComponent(b64Url)}&t=${accessToken}&v=${Date.now()}.png`;

                if (action.type === 'inline') {
                    requests.push({ deleteContentRange: { range: { startIndex: action.index, endIndex: action.index + 1 } } });
                    requests.push({ insertInlineImage: { uri: proxyUri, location: { index: action.index }, objectSize: { width: { magnitude: targetWidthPt, unit: 'PT' }, height: { magnitude: action.newH, unit: 'PT' } } } });
                } else {
                    requests.push({ deletePositionedObject: { objectId: action.id } });
                    requests.push({ insertInlineImage: { uri: proxyUri, location: { index: action.index }, objectSize: { width: { magnitude: targetWidthPt, unit: 'PT' }, height: { magnitude: action.newH, unit: 'PT' } } } });
                }
                idsInChunk.push(action.id);
            }

            try {
                const res = await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
                res.data.replies?.forEach((reply, rIdx) => {
                    const newId = reply.insertInlineImage?.objectId;
                    if (newId) {
                        const originalActionIdx = Math.floor(rIdx / 2);
                        newIdMapping[idsInChunk[originalActionIdx]] = newId;
                        successCount++;
                    }
                });
            } catch (e: any) {
                console.error("BLUEPRINT Batch Error:", e);
                failedCount += chunk.length;
            }
        }

        incrementStats(successCount).catch(() => { });
        return NextResponse.json({ success: true, results: { success: successCount, failed: failedCount, total: actions.length }, newIdMapping });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
