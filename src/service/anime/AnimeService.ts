import Config from '../../config/Config.ts';
import Puppeteer from '../../utils/web/Puppeteer.ts';
import Scrapper from '../../utils/web/Scrapper.ts';
import Log from '../../utils/log/Log.ts';

/**
 * Service for handling animes and movies. 
 */
export default class AnimeService {
    private static readonly logger = Log.create(this.name);

    // ----- ANIME -----

    /**
     * Search for anime titles similar to one given.
     * @param name
     * @returns animes titles
     */
    static async getAnimeTitlesFromSearch(name: string) {
        this.logger.info(`Searching anime titles web page from: ${name}`);
        const page = await this.getAnimeSearchPage(name);
        return await Scrapper.extractAnimeTitles(page);
    }

    /**
     * @param name anime name to web search
     * @returns page
     */
    private static async getAnimeSearchPage(name: string) {
        this.logger.info(`Fetching anime search page for: ${name}`);
        
        name = name.toLowerCase().replace(" ", "+"); // Format for href
        const searchUrl = `${Config.websiteAdress}/catalogue?search=${name}`;
        return Puppeteer.goto(searchUrl, Config.animeSearchPageSelector, Config.animeSearchWaitUntil);
    }

    // ----- SEASONS -----

    /**
     * Search for season titles similar to one given.
     * @param seasonsUrl
     * @returns a season dictionnary with following format: {name => link}
     */
    static async getSeasonsFromSearch(seasonsUrl: string) {
        this.logger.info(`Searching seasons from: ${seasonsUrl}`);

        const page = await this.getSeasonsPage(seasonsUrl);
        const seasons = await Scrapper.extractSeasonsWithScans(page);
        if (!seasons) return [];

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
    private static async getSeasonsPage(url: string) {
        this.logger.info(`Fetching seasons page for: ${url}`);
        return Puppeteer.goto(url, Config.seasonsPageSelector, Config.seasonSearchWaitUntil);
    }

    // ----- UTILS -----

    /**
     * Remove any specified element from given array.
     * @param array array of season names to remove element from
     * @returns processed array
     */
    static remove(array: Array<string>, element: string) {
        this.logger.info(`Removing scans from seasons`);
        return array.filter((season: string) => !season.toLowerCase().includes(element));
    }

    /**
     * Verifiy if a array only contains a specific name, like movie or scans.
     * 
     * It can help to easily skips some steps during process.
     * @param array the season array
     * @param element the name which can be contains in seasons
     * @returns true if it contains given name
     */
    static containsOnly(array: any, element: string): boolean {
        return array.length == 1 &&
        array[0].toLowerCase().includes(element);
    }

    /**
     * @param seasonUrl
     * @returns
     */
    static async getEpisodesFromSearch(seasonUrl: string){
        this.logger.info(`Searching episodes from: ${seasonUrl}`);
        return await Scrapper.extractEpisodes(seasonUrl);
    }
}

