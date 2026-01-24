import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { fetchDocumentStructure } from "@/lib/google-docs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    // @ts-ignore
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { docId } = await req.json();
        if (!docId) {
            return NextResponse.json({ error: "Missing docId" }, { status: 400 });
        }

        const structure = await fetchDocumentStructure(docId, accessToken);
        return NextResponse.json(structure);
    } catch (error: any) {
        console.error("Error fetching doc structure:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch document" },
            { status: 500 }
        );
    }
}
