import Browser from '../utils/Browser.ts';
import Config from '../config/Config.ts';
import Scrapper from '../utils/Scrapper.ts';
import DownloadService from '../download/DownloadService.js';
import { Page } from 'puppeteer';

/**
 * 
 */
export default class AnimeManager {

    // /-----/ ANIME /-----/

    /**
     * Search for anime titles similar to one given.
     * @param animeName
     * @returns animes titles
     */
    static async getAnimeTitlesFromSearch(animeName: string) {
        console.log(`\n[LOG] Searching anime titles web page from: ${animeName}`);

        const page = await this.#getAnimeSearchPage(animeName);
        return await Scrapper.extractAnimeTitles(page);
    }

    /**
     * @param animeName anime name to web search
     * @returns page
     */
    static async #getAnimeSearchPage(animeName: string) {
        console.log(`\n[LOG] Fetching anime search page for: ${animeName}`);

        // Format for href
        animeName = animeName.replace(" ", "+");
        const searchUrl = `${Config.websiteUrl}/?search=${animeName}`;
        return Browser.goto(searchUrl, Config.animeSearchPageSelector);
    }

    // /-----/ SEASONS /-----/

    /**
     * Search for anime titles similar to one given.
     * @param seasonsUrl
     * @returns a season dictionnary with following format: {name => link}
     */
    static async getSeasonsFromSearch(seasonsUrl: string) {
        console.log(`\n[LOG] Searching seasons from: ${seasonsUrl}`);
        const page = await this.#getSeasonsPage(seasonsUrl);

        const seasonsWithScans = await Scrapper.extractSeasonsWithScans(page);
        const seasons = DownloadService.removeScans(seasonsWithScans);

        if (!seasons) {
            console.error('[ERROR] No season found...');
            return [];
        }

        const seasonMap: Record<string, string | null> = {};
        for (const season of seasons) {
            seasonMap[season.name] = season.link;
        }
        return seasonMap;
    }

    /**
     * @param url season url to web search
     * @returns page
     */
    static async #getSeasonsPage(url: string): Promise<Page> {
        console.log(`\n[LOG] Fetching seasons page for: ${url}`);
        return Browser.goto(url, Config.seasonsPageSelector);
    }

    // /-----/ UTILS /-----/

    /**
     * @param animeName 
     * @param seasonName 
     * @param episodesNumbers 
     */
    static displayAnime(animeName: string, seasonName: string, episodesNumbers: number[]) {
        console.log(`\n- Anime -`);
        console.log(`Name: ${animeName}`);
        console.log(`Season: ${seasonName}`);
        console.table(`Episodes: ${episodesNumbers}\n`);
    }

    /**
     * 
     * @param animes 
     */
    static displayAnimeNames(animes: string[]) {
        console.log("\n- Animes -");
        animes.forEach((name: string, index: number) => {
            console.log(`[${index + 1}] ${name}`);
        });
    }

    /**
     * 
     * @param seasons 
     */
    static displaySeasons(seasons: string[]) {
        console.log("\n- Seasons -");
        seasons.forEach((season: any, index: number) => {
            console.log(`[${index + 1}] ${season.name}`);
        });
    }
}

