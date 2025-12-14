import Browser from '../utils/web/Browser.js';
import Config from '../config/Config.js';
import Scrapper from '../utils/web/Scrapper.js';
import DownloadService from '../download/DownloadService.js';

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
    static async getAnimeTitlesFromSearch(animeName) {
        console.log(`\n[LOG] Searching anime titles web page from: ${animeName}`);

        const page = await this.#goToAnimeSearchPage(animeName);
        return await Scrapper.extractAnimeTitles(page);
    }

    /**
     * @param animeName anime name to web search
     * @returns page
     */
    static async #goToAnimeSearchPage(animeName) {
        console.log(`\n[LOG] Fetching anime search page for: ${animeName}`);

        // Format for href
        animeName = animeName.replace(" ", "+");
        const searchUrl = `${Config.websiteUrl}/?search=${animeName}`;
        return Browser.goTo(searchUrl, Config.animeSearchPageSelector);
    }

    // /-----/ SEASONS /-----/

    /**
     * Search for anime titles similar to one given.
     * @param seasonsUrl
     * @returns a season dictionnary with following format: {name => link}
     */
    static async getSeasonsFromSearchUrl(seasonsUrl) {
        console.log(`\n[LOG] Searching seasons from: ${seasonsUrl}`);
        const page = await this.#goToSeasonsPage(seasonsUrl);

        const seasonsWithScans = await Scrapper.extractSeasonsWithScans(page);
        const seasons = DownloadService.removeScans(seasonsWithScans);

        if (seasons.length == 0) {
            console.error('[ERROR] No season found...');
            return [];
        }

        let seasonMap = {};
        for (const season of seasons) {
            seasonMap[season.name] = season.link;
        }
        return seasonMap;
    }

    /**
     * @param url
     * @returns page
     */
    static async #goToSeasonsPage(url) {
        console.log(`\n[LOG] Fetching seasons page for: ${url}`);
        return Browser.goTo(url, Config.seasonsPageSelector);
    }

    // /-----/ UTILS /-----/

    /**
     * @param animeName 
     * @param seasonName 
     * @param {*} episodesNumbers 
     */
    static displayAnime(animeName, seasonName, episodesNumbers) {
        console.log(`\n- Anime -`);
        console.log(`Name: ${animeName}`);
        console.log(`Season: ${seasonName}`);
        console.table(`Episodes: ${episodesNumbers}\n`);
    }

    /**
     * 
     * @param {*} animes 
     */
    static displayAnimeNames(animes) {
        console.log("\n- Animes -");
        animes.forEach((name, index) => {
            console.log(`[${index + 1}] ${name}`);
        });
    }

    /**
     * 
     * @param {*} seasons 
     */
    static displaySeasons(seasons) {
        console.log("\n- Seasons -");
        seasons.forEach((season, index) => {
            console.log(`[${index + 1}] ${season.name}`);
        });
    }
}

