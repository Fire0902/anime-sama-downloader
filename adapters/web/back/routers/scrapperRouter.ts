// routes/scrapperRouter.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.ts";
import AnimeSamaConfig from "../../../../engine/providers/anime-sama/AnimeSamaConfig.ts";
import Puppeteer from "../../../../engine/utils/web/Puppeteer.ts";
import AnimeSamaScrapper from "../../../../engine/providers/anime-sama/AnimeSamaScrapper.ts";
import AnimeSamaService from "../../../../engine/providers/anime-sama/AnimeSamaService.ts";
import VoirAnimeService, { type VoirAnimeProvider } from "../../../../engine/providers/voir-anime/VoirAnimeService.ts";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
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

