import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const token = searchParams.get("token");

    if (!url || !token) {
        return new Response("Missing url or token", { status: 400 });
    }

    try {
        console.log(`[Image Proxy] Fetching image: ${url.substring(0, 50)}...`);
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            console.error(`[Image Proxy] Failed to fetch image: ${response.statusText}`);
            return new Response(`Failed to fetch image: ${response.statusText}`, { status: response.status });
        }

        const blob = await response.blob();
        const contentType = response.headers.get("Content-Type") || "image/png";

        return new NextResponse(blob, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=60", // Cache for 1 min
            },
        });
    } catch (error: any) {
        console.error("[Image Proxy] Error:", error.message);
        return new Response("Internal Server Error", { status: 500 });
    }
}
