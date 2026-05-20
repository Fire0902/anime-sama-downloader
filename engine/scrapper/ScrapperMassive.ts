import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Puppeteer from "../utils/web/Puppeteer.ts";
import AnimeSamaScrapper from "../providers/anime-sama/AnimeSamaScrapper.ts";
import AnimeSamaConfig from "../providers/anime-sama/AnimeSamaConfig.ts";
import AnimeSamaService from "../providers/anime-sama/AnimeSamaService.ts";
import VoirAnimeService from "../providers/voir-anime/VoirAnimeService.ts";
import VoirAnimeConfig from "../providers/voir-anime/VoirAnimeConfig.ts";
import AnimeDB from "./db/Database.ts";
import AnimeEntity from "./services/AnimeEntity.ts";
import SeasonEntity from "./services/SeasonEntity.ts";
import EpisodeEntity from "./services/EpisodeEntity.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ScrapperProvider = 'anime-sama' | 'voir-anime' | 'voir-drama';

export interface ScrapperOpts {
    resolveM3u8?: boolean;
    startFrom?: 'catalogue' | 'seasons' | 'episodes';
}

type ProgressCallback = (step: string, current: number, total: number) => void;
type StopSignal = { stopped: boolean };

interface ScraperConfig {
    timeouts: Record<string, { episodeMs: number }>;
    catalogue: Record<string, { pages: number }>;
}

function loadConfig(): ScraperConfig {
    const configPath = path.join(__dirname, 'scraper-config.json');
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
        return {
            timeouts: {
                'anime-sama': { episodeMs: 15000 },
                'voir-anime': { episodeMs: 20000 },
                'voir-drama': { episodeMs: 20000 },
            },
            catalogue: {
                'anime-sama': { pages: 43 },
                'voir-anime': { pages: 94 },
                'voir-drama': { pages: 15 },
            },
        };
    }
}

export default class ScrapperMassive {

    static async scrapProvider(
        provider: ScrapperProvider | 'all',
        opts: ScrapperOpts = {},
        onProgress?: ProgressCallback,
        stopSignal?: StopSignal
    ): Promise<void> {
        const providers: ScrapperProvider[] = provider === 'all'
            ? ['anime-sama', 'voir-anime', 'voir-drama']
            : [provider];

        AnimeDB.init();
        await Puppeteer.getInstance();

        try {
            for (const p of providers) {
                if (stopSignal?.stopped) break;
                onProgress?.(`Démarrage scraping ${p}`, 0, 0);
                await this.scrapOne(p, opts, onProgress, stopSignal);
            }
        } finally {
            await Puppeteer.close();
            AnimeDB.close();
        }
    }

    private static async scrapOne(
        provider: ScrapperProvider,
        opts: ScrapperOpts,
        onProgress?: ProgressCallback,
        stopSignal?: StopSignal
    ): Promise<void> {
        const config = loadConfig();
        const startFrom = opts.startFrom ?? 'catalogue';

        // Step 1: scrape catalogue
        if (startFrom === 'catalogue') {
            const pages = config.catalogue[provider]?.pages ?? 0;
            if (pages === 0) {
                console.log(`[${provider}] Catalogue pages = 0, skipping.`);
                return;
            }
            onProgress?.(`[${provider}] Scraping catalogue (${pages} pages)`, 0, pages);
            const animeMap: Record<string, string> = {};
            for (let i = 1; i <= pages; i++) {
                if (stopSignal?.stopped) return;
                const url = this.getCatalogueUrl(provider, i);
                try {
                    const page = await Puppeteer.goto(url);
                    let found: Record<string, string> = {};
                    if (provider === 'anime-sama') {
                        found = await AnimeSamaScrapper.extractAnimeTitles(page);
                    } else {
                        found = await page.evaluate((selector: string) => {
                            const results: Record<string, string> = {};
                            document.querySelectorAll(selector).forEach(row => {
                                const a = row.querySelector('.post-title h3 a') as HTMLAnchorElement | null;
                                if (a?.textContent && a.href) results[a.textContent.trim()] = a.href;
                            });
                            return results;
                        }, VoirAnimeConfig.searchResultSelector);
                    }
                    Object.assign(animeMap, found);
                    await Puppeteer.closePage(page);
                } catch (e) {
                    console.warn(`[${provider}] Catalogue page ${i} failed:`, e);
                }
                onProgress?.(`[${provider}] Catalogue page ${i}/${pages}`, i, pages);
            }
            const animeEntries = Object.entries(animeMap);
            for (const [name, link] of animeEntries) {
                AnimeEntity.insert(name, link, provider);
            }
            console.log(`[${provider}] Inserted ${animeEntries.length} animes`);
        } else {
            console.log(`[${provider}] Skipping catalogue (startFrom=${startFrom})`);
        }

        // Step 2: scrape seasons
        const dbAnimes = AnimeEntity.getAll().filter(a => a.provider === provider);
        if (startFrom !== 'episodes') {
            onProgress?.(`[${provider}] Scraping saisons (${dbAnimes.length} animes)`, 0, dbAnimes.length);
            for (let i = 0; i < dbAnimes.length; i++) {
                if (stopSignal?.stopped) return;
                const anime = dbAnimes[i];
                await this.scrapSeasonsForAnime(provider, anime.id, anime.link);
                onProgress?.(`[${provider}] Saisons ${i + 1}/${dbAnimes.length} — ${anime.name}`, i + 1, dbAnimes.length);
            }
        } else {
            console.log(`[${provider}] Skipping seasons (startFrom=episodes)`);
        }

        // Step 3: scrape episodes
        const providerAnimeIds = new Set(dbAnimes.map(a => a.id));
        const allSeasons = SeasonEntity.getAll().filter(s => providerAnimeIds.has(s.anime_id));
        onProgress?.(`[${provider}] Scraping épisodes (${allSeasons.length} saisons)`, 0, allSeasons.length);
        for (let i = 0; i < allSeasons.length; i++) {
            if (stopSignal?.stopped) return;
            const season = allSeasons[i];
            await this.scrapEpisodesForSeason(provider, season.id, season.link, opts, config);
            onProgress?.(`[${provider}] Épisodes saison ${i + 1}/${allSeasons.length}`, i + 1, allSeasons.length);
        }
    }

    private static getCatalogueUrl(provider: ScrapperProvider, page: number): string {
        if (provider === 'anime-sama') {
            return page === 1
                ? `${AnimeSamaConfig.websiteAdress}/catalogue/`
                : `${AnimeSamaConfig.websiteAdress}/catalogue/?page=${page}`;
        }
        const base = provider === 'voir-anime'
            ? VoirAnimeConfig.voirAnimeBaseUrl
            : VoirAnimeConfig.voirDramaBaseUrl;
        return page === 1 ? base : `${base}/page/${page}/`;
    }

    private static async scrapSeasonsForAnime(
        provider: ScrapperProvider,
        animeId: number,
        animeLink: string
    ): Promise<void> {
        try {
            if (provider === 'anime-sama') {
                const seasons = await AnimeSamaService.extractSeasonWithoutScans(animeLink);
                if (!seasons) return;
                Object.entries(seasons).forEach(([name, relLink], index) => {
                    const fullLink = this.joinUrl(animeLink, relLink);
                    SeasonEntity.insert(name, animeId, index, fullLink);
                });
            } else {
                // VoirAnime/VoirDrama: no separate season layer — anime page IS the season
                SeasonEntity.insert('Épisodes', animeId, 0, animeLink);
            }
        } catch (e) {
            console.warn(`Failed to scrape seasons for anime ${animeId}:`, e);
        }
    }

    private static async scrapEpisodesForSeason(
        provider: ScrapperProvider,
        seasonId: number,
        seasonLink: string,
        opts: ScrapperOpts,
        config: ScraperConfig
    ): Promise<void> {
        const timeoutMs = config.timeouts[provider]?.episodeMs ?? 15000;

        try {
            if (provider === 'anime-sama') {
                await this.scrapAnimeSamaEpisodes(seasonId, seasonLink, opts, timeoutMs);
            } else {
                await this.scrapVoirAnimeEpisodes(provider as 'voir-anime' | 'voir-drama', seasonId, seasonLink);
            }
        } catch (e) {
            console.warn(`Failed to scrape episodes for season ${seasonId}:`, e);
        }
    }

    private static async scrapAnimeSamaEpisodes(
        seasonId: number,
        seasonLink: string,
        opts: ScrapperOpts,
        timeoutMs: number
    ): Promise<void> {
        let result: { readers: string[][], episodeNames: string[] } | undefined;
        try {
            result = await AnimeSamaService.getEpisodesFromSearch(seasonLink) as any;
        } catch {
            console.warn(`[anime-sama] getEpisodesFromSearch failed for ${seasonLink}`);
            return;
        }

        if (!result?.readers) return;

        const { readers, episodeNames } = result;
        const episodeCount = Math.max(...readers.map(r => r?.length ?? 0));

        const batchSize = 50;
        for (let batchStart = 0; batchStart < episodeCount; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, episodeCount);

            await Promise.all(
                Array.from({ length: batchEnd - batchStart }, async (_, j) => {
                    const i = batchStart + j;
                    // Collect all available URLs for this episode index
                    const episodeUrls: string[] = readers
                        .map(readerList => readerList?.[i])
                        .filter((url): url is string => !!url && url.trim().length > 0);

                    if (episodeUrls.length === 0) return;

                    let urlsToStore: string[];

                    if (opts.resolveM3u8) {
                        // Resolve m3u8 only for vidmoly URLs (eps1)
                        const vidmolyUrl = readers[0]?.[i];
                        if (vidmolyUrl?.includes('vidmoly')) {
                            const m3u8 = await this.withTimeout(
                                this.resolveVidmolyM3u8(vidmolyUrl.replace('to/', 'net/')),
                                timeoutMs
                            );
                            urlsToStore = m3u8 ? [m3u8, ...episodeUrls.slice(1)] : episodeUrls;
                        } else {
                            urlsToStore = episodeUrls;
                        }
                    } else {
                        urlsToStore = episodeUrls;
                    }

                    const name = episodeNames?.[i];
                    EpisodeEntity.insert(seasonId, i, urlsToStore, name);
                })
            );
        }
    }

    private static async scrapVoirAnimeEpisodes(
        provider: 'voir-anime' | 'voir-drama',
        seasonId: number,
        animeLink: string
    ): Promise<void> {
        const { urls, names } = await VoirAnimeService.getEpisodes(animeLink);
        urls.forEach((url, i) => {
            if (url) EpisodeEntity.insert(seasonId, i, [url], names[i]);
        });
    }

    private static async resolveVidmolyM3u8(link: string): Promise<string | null> {
        const page = await Puppeteer.goto(link);
        try {
            const url = await page.evaluate(() => {
                if ((window as any).jwplayer) {
                    const player = (window as any).jwplayer("vplayer");
                    const sources = player.getPlaylist?.()[0]?.sources;
                    if (sources?.length > 0) return sources[0].file;
                }
                return null;
            });
            return url;
        } finally {
            await Puppeteer.closePage(page);
        }
    }

    static withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
        return new Promise(resolve => {
            const timer = setTimeout(() => resolve(null), ms);
            promise
                .then(res => { clearTimeout(timer); resolve(res); })
                .catch(() => { clearTimeout(timer); resolve(null); });
        });
    }

    private static joinUrl(base: string, relPath: string): string {
        return base.replace(/\/+$/, '') + '/' + relPath.replace(/^\/+/, '');
    }
}
