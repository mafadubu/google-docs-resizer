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
    if (!redis) return { total: 1240, today: 50 }; // Default fallback for dev

    const today = new Date().toISOString().split('T')[0];

    try {
        const [total, todayCount] = await Promise.all([
            redis.get<number>('stats:total_resizes'),
            redis.get<number>(`stats:daily:${today}`)
        ]);

        return {
            total: total || 1240,
            today: todayCount || 50
        };
    } catch (e) {
        console.error("Redis Fetch Error:", e);
        return { total: 1240, today: 50 };
    }
}
