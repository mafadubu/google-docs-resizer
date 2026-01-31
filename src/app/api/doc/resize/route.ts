import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { findImageMetadata, getGoogleDocsClient } from "@/lib/google-docs";
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
        const { docId, targetWidthCm, imageId } = await req.json();

        if (!docId || !targetWidthCm || !imageId) {
            return NextResponse.json({ error: "Missing required parameters (Atomic v7.0)" }, { status: 400 });
        }

        const docs = getGoogleDocsClient(accessToken);

        // 1. Fetch FRESH document state
        const docRes = await docs.documents.get({ documentId: docId });
        const doc = docRes.data;

        // 2. Find CURRENT position and metadata for this specific image
        const metadata = findImageMetadata(doc, imageId);
        if (!metadata) {
            return NextResponse.json({ error: "Image not found in latest document state", imageId }, { status: 404 });
        }

        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "google-docs-resizer.vercel.app";
        const targetWidthPt = targetWidthCm * 28.3465;
        const scale = targetWidthPt / (metadata.width || targetWidthPt);
        const newHeightPt = (metadata.height || targetWidthPt) * scale;

        // 3. Prepare Proxy
        const ticketId = uuidv4().substring(0, 8) + Date.now().toString(36);
        await storeImageTicket(ticketId, { url: metadata.uri!, token: accessToken });
        const proxyUri = `https://${host}/api/image-proxy?id=${ticketId}`;

        // 4. Atomic Mutation (Delete and Re-insert)
        const requests: any[] = [];

        if (metadata.type === 'inline') {
            requests.push({
                deleteContentRange: {
                    range: {
                        startIndex: metadata.index!,
                        endIndex: metadata.index! + 1
                    }
                }
            });
            requests.push({
                insertInlineImage: {
                    uri: proxyUri,
                    location: { index: metadata.index! },
                    objectSize: {
                        width: { magnitude: targetWidthPt, unit: 'PT' },
                        height: { magnitude: newHeightPt, unit: 'PT' }
                    }
                }
            });
        } else {
            // Positioned
            requests.push({
                deletePositionedObject: { objectId: metadata.id }
            });
            requests.push({
                insertInlineImage: {
                    uri: proxyUri,
                    location: { index: metadata.anchorIndex! },
                    objectSize: {
                        width: { magnitude: targetWidthPt, unit: 'PT' },
                        height: { magnitude: newHeightPt, unit: 'PT' }
                    }
                }
            });
        }

        const response = await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: { requests },
        });

        const replies = response.data.replies || [];
        let newObjectId = imageId;

        // Find the new ID from the reply
        replies.forEach(reply => {
            if (reply.insertInlineImage?.objectId) {
                newObjectId = reply.insertInlineImage.objectId;
            }
        });

        incrementStats(1).catch(e => console.error("Stats Error:", e));

        return NextResponse.json({
            success: true,
            oldId: imageId,
            newId: newObjectId,
            message: "Atomic swap completed"
        });

    } catch (error: any) {
        console.error("Atomic Resize Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to resize image", imageId: req.json().then(j => j.imageId).catch(() => 'unknown') },
            { status: 500 }
        );
    }
}
