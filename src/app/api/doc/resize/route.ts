import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGoogleDocsClient } from "@/lib/google-docs";
import { incrementStats } from "@/lib/redis";
import { NextResponse } from "next/server";

/**
 * v10.0 ULTRA Engine - Zero-Proxy Technology
 * 이미지를 삭제/삽입하지 않고 속성만 직접 수정하여 100% 안정성을 보장합니다.
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const accessToken = session?.accessToken;
    if (!session || !accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { docId, targetWidthCm, selectedImageIds } = await req.json();
        if (!docId || !targetWidthCm || !selectedImageIds || selectedImageIds.length === 0) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        const docs = getGoogleDocsClient(accessToken);
        const docRes = await docs.documents.get({ documentId: docId });
        const doc = docRes.data;

        const targetWidthPt = targetWidthCm * 28.3465;
        const requests: any[] = [];
        let skipped = 0;

        for (const id of selectedImageIds) {
            const inlineObj = doc.inlineObjects?.[id];
            const positionedObj = doc.positionedObjects?.[id];
            const embeddedObj = inlineObj?.inlineObjectProperties?.embeddedObject || positionedObj?.positionedObjectProperties?.embeddedObject;

            if (embeddedObj && embeddedObj.size) {
                const currentWidth = embeddedObj.size.width?.magnitude || targetWidthPt;
                const currentHeight = embeddedObj.size.height?.magnitude || targetWidthPt;
                const scale = targetWidthPt / currentWidth;
                const newHeightPt = currentHeight * scale;

                // 핵심: 이미지를 건드리지 않고 속성(size)만 업데이트 (Zero-Proxy)
                requests.push({
                    updateEmbeddedObjectProperties: {
                        objectId: id,
                        embeddedObjectProperties: {
                            size: {
                                width: { magnitude: targetWidthPt, unit: 'PT' },
                                height: { magnitude: newHeightPt, unit: 'PT' }
                            }
                        },
                        fields: 'size'
                    }
                });
            } else {
                skipped++;
            }
        }

        if (requests.length === 0) {
            return NextResponse.json({ success: false, error: "No valid images found for resizing" });
        }

        // 일괄 업데이트 실행 (인덱스 문제 없음)
        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: { requests }
        });

        incrementStats(requests.length).catch(() => { });

        return NextResponse.json({
            success: true,
            results: {
                success: requests.length,
                failed: 0,
                skipped,
                total: selectedImageIds.length
            }
        });

    } catch (error: any) {
        console.error("ULTRA Resize Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
