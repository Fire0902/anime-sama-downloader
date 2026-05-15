import Puppeteer from "../../engine/utils/web/Puppeteer.ts";
import AnimeSamaScrapper from "../../engine/providers/anime-sama/AnimeSamaScrapper.ts";
import AnimeEntity from "./services/AnimeEntity.ts";
import Database from "./db/Database.ts";
import AnimeSamaService from "../../engine/providers/anime-sama/AnimeSamaService.ts";
import SeasonEntity from "./services/SeasonEntity.ts";
import EpisodeEntity from "./services/EpisodeEntity.ts";
import AnimeSamaConfig from "../../engine/providers/anime-sama/AnimeSamaConfig.ts";

class ScrapperMassive {
    static async scrapAnimeList() {
        const skipAnimes = true;
        const skipSeasons = true;
        Database.init();
        await Puppeteer.getInstance();
        if (!skipAnimes) {
            const animes = Array.from({ length: 43 }, async (_, i) =>
                await this.scrapOneCataloguePage(i)
            );
            await Promise.all(animes);
        }
        if (!skipSeasons) {
            const dbAnimes = AnimeEntity.getAll();
            for (const anime of dbAnimes) {
                await this.scrapOneAnime(anime.id, anime.link);
                //await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        const dbSeasons = SeasonEntity.getAll();

        for (const season of dbSeasons) {
            await this.scrapSeasonEpisodes(season.id, season.link);
            //await new Promise(resolve => setTimeout(resolve, 10));
        }

        await Puppeteer.close();
    }

    static async scrapOneCataloguePage(pagination: number) {
        const page = await Puppeteer.goto(
            `${AnimeSamaConfig.websiteAdress}/catalogue/?page=${pagination + 1}`
        );

        const animes = await AnimeSamaScrapper.extractAnimeTitles(page);
        Object.entries(animes).forEach(([name, link]: Array<string>) => AnimeEntity.insert(name, link));
        await Puppeteer.closePage(page);
    }
    static async scrapOneAnime(animeId: number, animeLink: string) {
        const seasons: Record<string, string> | undefined = await AnimeSamaService.extractSeasonWithoutScans(animeLink);
        if (!seasons) return;
        const seasonsArray = Object.entries(seasons);
        seasonsArray.forEach(([name, link]: Array<string>, index: number) => SeasonEntity.insert(name, animeId, index, this.joinUrl(animeLink, link)));
    }
    static joinUrl(base: string, path: string) {
        return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
    }

    static async scrapSeasonEpisodes(seasonId: number, seasonLink: string) {

        let episodes;
        try {
            episodes = await AnimeSamaService.getEpisodesFromSearch(seasonLink);
        } catch {
            console.log("TO");
        }

        if (episodes) {
            const batchSize = 50;

            const validEpisodes = episodes.readers[0]
                .map((ep: string, index: number) => ({ ep, index }))
                .filter(({ ep }) => ep && ep.includes("vidmoly"));

            const total = validEpisodes.length;
            let processed = 0;
            for (let i = 0; i < validEpisodes.length; i += batchSize) {
                const batch = validEpisodes.slice(i, i + batchSize);

                console.log(`[Season ${seasonId}] Batch ${i / batchSize + 1} - processing ${batch.length} episodes...`);

                const results = await Promise.all(
                    batch.map(async ({ ep, index }) => {
                        const m3u8url = await ScrapperMassive.withTimeout(
                            this.scrapOneEpisode(ep.replace("to/", "net/")),
                            15000
                        );

                        if (!m3u8url) {
                            console.log(`Timeout episode ${index}`);
                        }

                        return { index, m3u8url };
                    })
                );

                for (const { index, m3u8url } of results) {
                    EpisodeEntity.insert(seasonId, index, [m3u8url]);
                    processed++;
                }
                console.log(`[Season ${seasonId}] Progress: ${processed}/${total} (${Math.round(processed / total * 100)}%)`);
            }
        }
    }

    static async scrapOneEpisode(link: string) {
        const page = await Puppeteer.goto(link);
        try {
            const url = await page.evaluate(() => {
                if (window.jwplayer) {
                    const player = jwplayer("vplayer");
                    const sources = player.getPlaylist?.()?.[0]?.sources;
                    if (sources && sources.length > 0) {
                        return sources[0].file;
                    }
                }
                return null;
            });
            return url
        } finally {
            await Puppeteer.closePage(page);
        }
    }

    static withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), ms);

            promise
                .then(res => {
                    clearTimeout(timer);
                    resolve(res);
                })
                .catch(() => {
                    clearTimeout(timer);
                    resolve(null);
                });
        });
    }
}

await ScrapperMassive.scrapAnimeList();