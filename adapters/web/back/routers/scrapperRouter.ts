// routes/scrapperRouter.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.ts";
import AnimeSamaConfig from "../../../../engine/providers/anime-sama/AnimeSamaConfig.ts";
import Puppeteer from "../../../../engine/utils/web/Puppeteer.ts";
import AnimeSamaScrapper from "../../../../engine/providers/anime-sama/AnimeSamaScrapper.ts";
import AnimeSamaService from "../../../../engine/providers/anime-sama/AnimeSamaService.ts";
import VoirAnimeService, { type VoirAnimeProvider } from "../../../../engine/providers/voir-anime/VoirAnimeService.ts";
import VidmolyDownloader from "../../../../engine/service/download/downloader/VidmolyDownloader.ts";
import SibnetDownloader from "../../../../engine/service/download/downloader/SibnetDownloader.ts";
import SendVidDownloader from "../../../../engine/service/download/downloader/SendVidDownloader.ts";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { spawn } from "node:child_process";
import ScrapperRunnerService from "../services/ScrapperRunnerService.ts";
import LocalDbService from "../services/LocalDbService.ts";

export const scrapperRouter = Router();

type Provider = 'anime-sama' | 'voir-anime' | 'voir-drama';

function isVoirAnimeProvider(provider: string): provider is VoirAnimeProvider {
    return provider === 'voir-anime' || provider === 'voir-drama';
}

/**
 * POST /input
 * Recherche d'animes
 */
scrapperRouter.post("/input", authMiddleware, async (req, res) => {
    try {
        const { value, provider = 'anime-sama' } = req.body;
        if (!value) return res.status(400).json({ error: "Missing search value" });

        console.log("Reçu du frontend:", value, "| provider:", provider);

        if (isVoirAnimeProvider(provider)) {
            const animesTitle = await VoirAnimeService.getAnimesFromSearch(value, provider);
            return res.json({ animesTitle });
        }

        // Default: anime-sama
        const url = `${AnimeSamaConfig.websiteAdress}/catalogue/?search=${value.replaceAll(" ", "+")}`;
        console.log("Search url: ", url);
        const page = await Puppeteer.goto(url);
        const animesTitle = await AnimeSamaScrapper.extractAnimeTitles(page);
        await page.close();

        res.json({ animesTitle });
    } catch (error: any) {
        console.error("Anime search error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /seasons
 * Récupération des saisons d'un anime
 */
scrapperRouter.post("/seasons", authMiddleware, async (req, res) => {
    try {
        const { animeUrl, provider = 'anime-sama' } = req.body;
        if (!animeUrl) return res.status(400).json({ error: "Missing anime URL" });

        if (isVoirAnimeProvider(provider)) {
            // VoirAnime has no separate season layer — the anime page IS the episode list.
            // Return a single pseudo-season with empty link so the frontend computes:
            //   fullLink = animeUrl + '' = animeUrl
            return res.json({ animeSeasons: [{ name: 'Épisodes', link: '' }] });
        }

        // Default: anime-sama
        const seasons = await AnimeSamaService.extractSeasonWithoutScans(animeUrl);

        if (seasons) {
            const entries = Object.entries(seasons);
            const filtered = entries.map(season => ({
                name: season[0],
                link: season[1]
            }));
            res.json({ animeSeasons: [...filtered] });
        }
    } catch (error: any) {
        console.error("Seasons fetch error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /episodes
 * Récupération des épisodes d'une saison
 */
scrapperRouter.post("/episodes", authMiddleware, async (req, res) => {
    try {
        const { seasonUrl, provider = 'anime-sama' } = req.body;
        if (!seasonUrl) return res.status(400).json({ error: "Missing season URL" });

        if (isVoirAnimeProvider(provider)) {
            // seasonUrl is the anime page URL — scrape the episode list directly
            const { urls, names } = await VoirAnimeService.getEpisodes(seasonUrl);
            // Wrap in array to match the readerUrls[source][episode] format (1 source)
            return res.status(200).json({ readerUrls: [urls], episodeNames: names });
        }

        // Default: anime-sama
        const result = await AnimeSamaScrapper.extractEpisodes(seasonUrl);

        // Handle both old format (array) and new format (object with readers + episodeNames)
        const readers = Array.isArray(result) ? result : result.readers;
        const episodeNames = Array.isArray(result) ? [] : (result.episodeNames || []);

        const readersNet = readers.map((readerList: string[]) =>
            readerList.map((episode: string) => episode.replace('to/', 'net/'))
        );
        res.status(200).json({ readerUrls: readersNet, episodeNames });
    } catch (error: any) {
        console.error("Episodes fetch error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /probe
 * Fetch an m3u8 URL and extract quality/codec info from the master playlist.
 */
scrapperRouter.post("/probe", authMiddleware, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "Missing URL" });

        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const text = await response.text();

        if (!text.includes('#EXTM3U')) return res.json({ streams: [] });

        const streams: Array<{ resolution?: string; codecs?: string; bandwidth?: number }> = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                const attrs = line.substring('#EXT-X-STREAM-INF:'.length);
                const resolution = attrs.match(/RESOLUTION=(\d+x\d+)/i)?.[1];
                const codecs = attrs.match(/CODECS="([^"]+)"/i)?.[1];
                const bandwidth = parseInt(attrs.match(/BANDWIDTH=(\d+)/i)?.[1] || '0');
                streams.push({ resolution, codecs, bandwidth });
            }
        }
        res.json({ streams });
    } catch (error: any) {
        console.error("Probe error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /m3u8/upload
 * Sauvegarde le contenu d'un fichier .m3u8 uploadé dans un répertoire temporaire
 * et retourne le chemin absolu pour que FFmpeg puisse le lire côté serveur.
 */
scrapperRouter.post("/m3u8/upload", authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: "Contenu m3u8 manquant" });
        }
        if (!content.trim().startsWith('#EXTM3U')) {
            return res.status(400).json({ error: "Fichier m3u8 invalide (doit commencer par #EXTM3U)" });
        }

        const tmpDir = path.join(os.tmpdir(), 'anime-dl-m3u8');
        await fs.mkdir(tmpDir, { recursive: true });

        const filename = `upload-${Date.now()}.m3u8`;
        const filePath = path.join(tmpDir, filename);
        await fs.writeFile(filePath, content, 'utf-8');

        console.log(`[M3U8 upload] Saved to: ${filePath}`);
        res.json({ filePath });
    } catch (error: any) {
        console.error("M3U8 upload error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Quality resolution helpers ─────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
}

function getDownloaderForUrl(url: string) {
    if (url.includes('sibnet')) return new SibnetDownloader();
    if (url.includes('vidmoly')) return new VidmolyDownloader();
    if (url.includes('sendvid')) return new SendVidDownloader();
    return null;
}

async function parseMasterPlaylistQuality(m3u8Url: string): Promise<{ resolution: string; codec: string } | null> {
    const resp = await withTimeout(fetch(m3u8Url, { headers: { 'User-Agent': 'Mozilla/5.0' } }), 8000);
    const text = await resp.text();
    if (!text.includes('#EXTM3U')) return null;

    // Find highest-bandwidth stream
    let best: { resolution: string; codec: string } | null = null;
    let bestBandwidth = 0;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
        const bandwidth = parseInt(line.match(/BANDWIDTH=(\d+)/i)?.[1] || '0');
        const resRaw = line.match(/RESOLUTION=(\d+x\d+)/i)?.[1];
        const codecsRaw = line.match(/CODECS="([^"]+)"/i)?.[1] ?? '';
        if (!resRaw) continue;
        if (bandwidth > bestBandwidth) {
            bestBandwidth = bandwidth;
            const [w, h] = resRaw.split('x').map(Number);
            const px = Math.min(w, h);
            const resolution = px >= 2160 ? '4K' : px >= 1080 ? '1080p' : px >= 720 ? '720p' : px >= 480 ? '480p' : `${px}p`;
            const c = codecsRaw.toLowerCase();
            const codec = (c.includes('hvc') || c.includes('hevc') || c.includes('265')) ? 'H.265'
                : (c.includes('avc') || c.includes('264')) ? 'H.264'
                : c.includes('vp9') ? 'VP9'
                : c.includes('av01') ? 'AV1'
                : codecsRaw.split(',')[0].toUpperCase();
            best = { resolution, codec };
        }
    }
    // If single-stream m3u8 (no EXT-X-STREAM-INF) return null to try further
    return best;
}

async function ffprobeQuality(url: string): Promise<{ resolution: string; codec: string } | null> {
    return new Promise((resolve) => {
        const ff = spawn('ffprobe', [
            '-v', 'quiet', '-print_format', 'json', '-show_streams',
            '-select_streams', 'v:0', url
        ]);
        let out = '';
        ff.stdout.on('data', (d: Buffer) => out += d.toString());
        ff.on('close', () => {
            try {
                const json = JSON.parse(out);
                const stream = json.streams?.[0];
                if (!stream) return resolve(null);
                const w: number = stream.width ?? 0;
                const h: number = stream.height ?? 0;
                const px = Math.min(w, h);
                const resolution = px >= 2160 ? '4K' : px >= 1080 ? '1080p' : px >= 720 ? '720p' : px >= 480 ? '480p' : `${px}p`;
                const rawCodec = (stream.codec_name ?? '').toLowerCase();
                const codec = rawCodec.includes('hevc') || rawCodec.includes('265') ? 'H.265'
                    : rawCodec === 'h264' || rawCodec.includes('264') || rawCodec.includes('avc') ? 'H.264'
                    : rawCodec === 'vp9' ? 'VP9'
                    : rawCodec.includes('av1') ? 'AV1'
                    : rawCodec.toUpperCase();
                resolve({ resolution, codec });
            } catch { resolve(null); }
        });
        ff.on('error', () => resolve(null));
        setTimeout(() => { try { ff.kill(); } catch {} resolve(null); }, 20000);
    });
}

async function probeUrlSet(urls: string[]): Promise<{ resolution: string; codec: string } | null> {
    const nonSibnet = urls.filter(u => !u.includes('sibnet'));
    const sibnet    = urls.filter(u => u.includes('sibnet'));

    // Try non-sibnet URLs concurrently
    if (nonSibnet.length > 0) {
        const result = await Promise.any(nonSibnet.map(async (url) => {
            const dl = getDownloaderForUrl(url);
            if (!dl) throw new Error('no downloader');
            const streamUrl = await withTimeout(dl.extractM3U8(url), 30000);
            if (!streamUrl) throw new Error('no stream');
            const q = await withTimeout(parseMasterPlaylistQuality(streamUrl), 10000);
            if (!q) throw new Error('no quality');
            return q;
        })).catch(() => null);
        if (result) return result;
    }

    // Fallback: sibnet (MP4 → ffprobe)
    for (const url of sibnet) {
        const dl = getDownloaderForUrl(url);
        if (!dl) continue;
        try {
            const streamUrl = await withTimeout(dl.extractM3U8(url), 30000);
            if (!streamUrl) continue;
            const q = await withTimeout(ffprobeQuality(streamUrl), 25000);
            if (q) return q;
        } catch { continue; }
    }

    return null;
}

/**
 * POST /resolve-quality
 * Probe up to 3 episode URL sets concurrently to determine season quality.
 */
scrapperRouter.post("/resolve-quality", authMiddleware, async (req, res) => {
    try {
        const { episodeUrlSets } = req.body as { episodeUrlSets: string[][] };
        if (!Array.isArray(episodeUrlSets) || episodeUrlSets.length === 0) {
            return res.status(400).json({ error: 'Missing episodeUrlSets' });
        }

        const sets = episodeUrlSets.slice(0, 3);
        const result = await Promise.any(sets.map(urls => {
            const p = probeUrlSet(urls);
            return p.then(q => { if (!q) throw new Error('no quality'); return q; });
        })).catch(() => null);

        if (!result) return res.json({ error: 'Qualité indéterminée' });
        res.json({ resolution: result.resolution, codec: result.codec });
    } catch (error: any) {
        console.error('resolve-quality error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Scrapper management ────────────────────────────────────────────────────

/**
 * POST /scrapper/start
 * Lance le scrapper en arrière-plan.
 */
scrapperRouter.post("/scrapper/start", authMiddleware, (req, res) => {
    try {
        const { provider = 'anime-sama', resolveM3u8 = false, startFrom = 'catalogue' } = req.body;
        const validProviders = ['anime-sama', 'voir-anime', 'voir-drama', 'all'];
        const validStartFrom = ['catalogue', 'seasons', 'episodes'];
        if (!validProviders.includes(provider)) {
            return res.status(400).json({ error: `Provider invalide. Valeurs: ${validProviders.join(', ')}` });
        }
        if (!validStartFrom.includes(startFrom)) {
            return res.status(400).json({ error: `startFrom invalide. Valeurs: ${validStartFrom.join(', ')}` });
        }
        ScrapperRunnerService.start(provider, { resolveM3u8, startFrom });
        res.json({ started: true, provider });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /scrapper/stats
 */
scrapperRouter.get("/scrapper/stats", authMiddleware, (_req, res) => {
    res.json({ stats: LocalDbService.getStats() });
});

/**
 * GET /scrapper/status
 */
scrapperRouter.get("/scrapper/status", authMiddleware, (_req, res) => {
    res.json(ScrapperRunnerService.getStatus());
});

/**
 * POST /scrapper/stop
 */
scrapperRouter.post("/scrapper/stop", authMiddleware, (_req, res) => {
    ScrapperRunnerService.stop();
    res.json({ success: true });
});

/**
 * GET /scrapper/db/download
 * Télécharger le fichier anime.db
 */
scrapperRouter.get("/scrapper/db/download", authMiddleware, (req, res) => {
    const dbPath = LocalDbService.getDbPath();
    if (!fsSync.existsSync(dbPath)) {
        return res.status(404).json({ error: 'Base de données non trouvée. Lancez le scrapper d\'abord.' });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="anime.db"');
    res.setHeader('Content-Type', 'application/octet-stream');
    fsSync.createReadStream(dbPath).pipe(res);
});

// ─── Local DB search ────────────────────────────────────────────────────────

/**
 * POST /db/input
 * Recherche dans la BD locale.
 */
scrapperRouter.post("/db/input", authMiddleware, (req, res) => {
    try {
        const { value, provider } = req.body;
        if (!value) return res.status(400).json({ error: "Missing search value" });
        const animesTitle = LocalDbService.searchAnimes(value, provider);
        res.json({ animesTitle });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /db/seasons
 * Saisons depuis la BD locale.
 */
scrapperRouter.post("/db/seasons", authMiddleware, (req, res) => {
    try {
        const { animeUrl } = req.body;
        if (!animeUrl) return res.status(400).json({ error: "Missing anime URL" });
        const seasons = LocalDbService.getSeasons(animeUrl);
        res.json({ animeSeasons: seasons });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /db/episodes
 * Épisodes depuis la BD locale.
 */
scrapperRouter.post("/db/episodes", authMiddleware, (req, res) => {
    try {
        const { seasonUrl } = req.body;
        if (!seasonUrl) return res.status(400).json({ error: "Missing season URL" });
        const { readerUrls, episodeNames } = LocalDbService.getEpisodes(seasonUrl);
        res.json({ readerUrls, episodeNames });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /db/available
 * Vérifie si la BD locale existe.
 */
scrapperRouter.get("/db/available", authMiddleware, (_req, res) => {
    res.json({ available: LocalDbService.isAvailable() });
});

