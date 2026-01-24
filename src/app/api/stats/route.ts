import { getStats } from "@/lib/redis";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET() {
    const stats = await getStats();
    return NextResponse.json(stats);
}
