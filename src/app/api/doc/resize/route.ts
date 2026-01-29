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

        // 3. Batch Update
        const response = await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: requests,
            },
        });

        // 4. Extract New IDs and create mapping
        // BatchUpdate replies contain the result of each request in order.
        // We only care about insertInlineImage replies.
        const newIdMapping: Record<string, string> = {};
        let insertCount = 0;

        response.data.replies?.forEach((reply) => {
            if (reply.insertInlineImage) {
                const oldId = originalIds[insertCount];
                const newId = reply.insertInlineImage.objectId;
                if (oldId && newId) {
                    newIdMapping[oldId] = newId;
                }
                insertCount++;
            }
        });

        // Update stats (fire and forget)
        incrementStats(requests.length).catch(e => console.error("Stats Error:", e));

        return NextResponse.json({
            success: true,
            count: insertCount,
            newIdMapping,
            message: `Successfully resized ${insertCount} images.`
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
