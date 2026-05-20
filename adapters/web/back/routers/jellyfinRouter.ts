import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.ts';

export const jellyfinRouter = Router();

const PAGE_SIZE = 10;

function computeMissing(
    items: { IndexNumber: number; ParentIndexNumber: number }[]
): { season: number; episodes: number[] }[] {
    const byS: Record<number, Set<number>> = {};
    for (const e of items) {
        if (!e.ParentIndexNumber || e.ParentIndexNumber === 0) continue;
        (byS[e.ParentIndexNumber] ??= new Set()).add(e.IndexNumber);
    }
    const result: { season: number; episodes: number[] }[] = [];
    for (const [s, eps] of Object.entries(byS)) {
        const max = Math.max(...eps);
        const missing: number[] = [];
        for (let i = 1; i <= max; i++) if (!eps.has(i)) missing.push(i);
        if (missing.length) result.push({ season: +s, episodes: missing });
    }
    return result.sort((a, b) => a.season - b.season);
}

jellyfinRouter.get('/libraries', authMiddleware, async (req, res) => {
    const baseUrl = process.env.JELLYFIN_URL;
    const token = process.env.JELLYFIN_TOKEN;

    if (!baseUrl || !token) {
        return res.status(503).json({ error: 'Jellyfin non configuré (JELLYFIN_URL / JELLYFIN_TOKEN manquants)' });
    }

    const headers = { 'X-Emby-Token': token };
    try {
        const response = await fetch(`${baseUrl}/Library/VirtualFolders`, { headers });
        if (!response.ok) {
            return res.status(response.status).json({ error: `Erreur Jellyfin: ${response.statusText}` });
        }
        const data: any[] = await response.json();
        const libraries = data.map((lib: any) => ({ id: lib.ItemId, name: lib.Name }));
        res.json({ libraries });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

jellyfinRouter.get('/anime', authMiddleware, async (req, res) => {
    const baseUrl = process.env.JELLYFIN_URL;
    const token = process.env.JELLYFIN_TOKEN;
    const libraryId = process.env.JELLYFIN_ANIME_LIBRARY_ID;

    if (!baseUrl || !token) {
        return res.status(503).json({ error: 'Jellyfin non configuré (JELLYFIN_URL / JELLYFIN_TOKEN manquants)' });
    }
    if (!libraryId) {
        return res.status(503).json({ error: 'Bibliothèque anime non configurée (JELLYFIN_ANIME_LIBRARY_ID manquant)' });
    }

    const page = Math.max(0, parseInt((req.query.page as string) ?? '0', 10) || 0);
    const startIndex = page * PAGE_SIZE;
    const headers = { 'X-Emby-Token': token };

    try {
        const seriesUrl = `${baseUrl}/Items?ParentId=${libraryId}&IncludeItemTypes=Series&Recursive=true` +
            `&StartIndex=${startIndex}&Limit=${PAGE_SIZE}&Fields=Name,ProductionYear,ImageTags,Overview`;

        const seriesRes = await fetch(seriesUrl, { headers });
        if (!seriesRes.ok) {
            return res.status(seriesRes.status).json({ error: `Erreur Jellyfin: ${seriesRes.statusText}` });
        }

        const seriesData = await seriesRes.json();
        const totalResults: number = seriesData.TotalRecordCount ?? 0;
        const items: any[] = seriesData.Items ?? [];

        const results = await Promise.all(items.map(async (series: any) => {
            let missingEpisodes: { season: number; episodes: number[] }[] = [];
            try {
                const epRes = await fetch(
                    `${baseUrl}/Shows/${series.Id}/Episodes?Fields=IndexNumber,ParentIndexNumber`,
                    { headers }
                );
                if (epRes.ok) {
                    const epData = await epRes.json();
                    missingEpisodes = computeMissing(epData.Items ?? []);
                }
            } catch { /* ignore episode fetch errors */ }

            const hasPoster = series.ImageTags?.Primary;
            const posterUrl = hasPoster
                ? `${baseUrl}/Items/${series.Id}/Images/Primary?maxHeight=300&api_key=${token}`
                : null;

            return {
                id: series.Id,
                name: series.Name,
                year: series.ProductionYear ?? null,
                posterUrl,
                missingEpisodes,
            };
        }));

        res.json({ results, totalResults });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
