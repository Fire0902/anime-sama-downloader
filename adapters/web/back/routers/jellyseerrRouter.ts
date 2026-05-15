import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.ts';

export const jellyseerrRouter = Router();

jellyseerrRouter.get('/requests', authMiddleware, async (req, res) => {
    const baseUrl = process.env.JELLYSEERR_URL;
    const token = process.env.JELLYSEERR_TOKEN;

    if (!baseUrl || !token) {
        return res.status(503).json({ error: 'Jellyseerr non configuré (JELLYSEERR_URL / JELLYSEERR_TOKEN manquants)' });
    }

    const headers = { 'X-Api-Key': token };
    const url = `${baseUrl}/api/v1/request?filter=approved&take=100&skip=0`;
    console.log('[Jellyseerr] Fetching:', url);

    try {
        const response = await fetch(url, { headers });
        console.log('[Jellyseerr] Response status:', response.status, response.statusText);

        if (!response.ok) {
            const body = await response.text();
            console.error('[Jellyseerr] Error body:', body);
            return res.status(response.status).json({ error: `Erreur Jellyseerr API: ${response.statusText}` });
        }

        const data = await response.json();
        const results: any[] = data?.results ?? [];
        console.log('[Jellyseerr] Results count:', results.length);

        const enriched = await Promise.all(results.map(async (item: any) => {
            try {
                const mediaType = item.media?.mediaType ?? item.type;
                const tmdbId = item.media?.tmdbId;
                if (!tmdbId) return item;

                const mediaRes = await fetch(`${baseUrl}/api/v1/${mediaType}/${tmdbId}`, { headers });
                if (!mediaRes.ok) return item;

                const mediaData = await mediaRes.json();
                const title = mediaData.title ?? mediaData.name ?? mediaData.originalTitle ?? mediaData.originalName ?? null;
                return { ...item, media: { ...item.media, title } };
            } catch {
                return item;
            }
        }));

        res.json({ ...data, results: enriched });
    } catch (error: any) {
        console.error('[Jellyseerr] Fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});
