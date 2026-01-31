import { NextResponse } from "next/server";

export const runtime = "edge"; // 속도 극대화를 위해 에지 런타임 사용

/**
 * v9.0 BLUEPRINT Stateless Proxy
 * Redis 의존성 없이 URL에 포함된 토큰을 통해 즉시 이미지를 중계합니다.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("u"); // Base64 encoded target URL
    const token = searchParams.get("t");    // Access Token

    if (!targetUrl || !token) {
        return new Response("Missing parameters", { status: 400 });
    }

    try {
        const decodedUrl = Buffer.from(targetUrl, 'base64').toString();

        const response = await fetch(decodedUrl, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });

        if (!response.ok) {
            return new Response("Failed to fetch image from Google", { status: response.status });
        }

        const blob = await response.blob();

        // 구글 서버가 이미지로 인식하도록 강제 헤더 설정
        return new NextResponse(blob, {
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "image/png",
                "Cache-Control": "public, max-age=3600, s-maxage=3600",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (error) {
        console.error("Proxy Error:", error);
        return new Response("Internal Proxy Error", { status: 500 });
    }
}
