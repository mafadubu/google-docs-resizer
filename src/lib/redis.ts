import { Redis } from '@upstash/redis'

// Check if env vars are present, otherwise mocked client (for build time / local without env)
const redis = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
    })
    : null;

export const incrementStats = async (count: number) => {
    if (!redis) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        await Promise.all([
            redis.incrby('stats:total_resizes', count),
            redis.incrby(`stats:daily:${today}`, count)
        ]);
    } catch (e) {
        console.error("Redis Error:", e);
    }
}

export const getStats = async () => {
    if (!redis) return { total: 0, today: 0 }; // Default fallback (0) if not connected

    const today = new Date().toISOString().split('T')[0];

    try {
        const [total, todayCount] = await Promise.all([
            redis.get<number>('stats:total_resizes'),
            redis.get<number>(`stats:daily:${today}`)
        ]);

        return {
            total: total || 0,
            today: todayCount || 0
        };
    } catch (e) {
        console.error("Redis Fetch Error:", e);
        return { total: 0, today: 0 };
    }
}

export const storeImageTicket = async (id: string, data: { url: string, token: string }) => {
    if (!redis) return;
    try {
        await redis.set(`img_tk:${id}`, JSON.stringify(data), { ex: 300 }); // 5 minutes TTL
    } catch (e) {
        console.error("Redis Store Ticket Error:", e);
    }
}

export const getImageTicket = async (id: string): Promise<{ url: string, token: string } | null> => {
    if (!redis) return null;
    try {
        const data = await redis.get<string>(`img_tk:${id}`);
        if (!data) return null;
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        console.error("Redis Get Ticket Error:", e);
        return null;
    }
}
