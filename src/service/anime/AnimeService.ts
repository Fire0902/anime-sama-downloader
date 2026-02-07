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
    static async getAnimesFromSearch(name: string) {
        this.logger.info(`Searching anime titles web page from: ${name}`);
        const page = await this.getAnimeSearchPage(name);
        return await Scrapper.extractAnimeTitles(page);
    }

    /**
     * @param name Anime name to web search
     * @returns page
     */
    private static async getAnimeSearchPage(name: string) {
        this.logger.info(`Fetching anime search page for: ${name}`);

        const websiteUrl = await Scrapper.extractHostAdress() ?? Config.websiteAdress;
        const url = `${websiteUrl}/catalogue?search=${this.toQuery(name)}`;

        return Puppeteer.goto(
            url, 
            Config.animeSearchPageSelector, 
            Config.animeSearchWaitUntil
        );
    }

    // ----- SEASONS -----

    /**
     * Search for season titles similar to one given.
     * @param url
     * @returns a season dictionnary with following format: {name => link}
     */
    static async getSeasonsFromUrl(url: string) {
        this.logger.info(`Searching seasons from: ${url}`);

        const page = await this.getSeasonsPage(url);
        const seasons = await Scrapper.extractSeasonsWithScans(page);
        if (!seasons) return null;

        let seasonMap: Record<string, string> = {};
        for (const season of seasons) {
            seasonMap[season.name] = season.link!;
        }
        if (!seasonMap) return null;

        return seasonMap;
    }

    /**
     * @param url Season url to web search
     * @returns page
     */
    private static async getSeasonsPage(url: string) {
        this.logger.info(`Fetching seasons page for: ${url}`);
        return Puppeteer.goto(url, Config.seasonsPageSelector, Config.seasonSearchWaitUntil);
    }

    // ----- EPISODES -----

    /**
     * @param seasonUrl
     */
    static async getEpisodesFromSearch(seasonUrl: string){
        this.logger.info(`Searching episodes from: ${seasonUrl}`);
        return await Scrapper.extractEpisodes(seasonUrl);
    }

    // ----- UTILS -----

    /**
     * Format and returns a value to be usable in a HTTP query string.
     * @example 
     * ```text
     * "One Piece" -> "one+piece"
     * It can then be used in href: "https://website.com?query=one+piece"
     * ```
     * @param value Value to format
     * @returns A value to be usable in a HTTP query string
     */
    static toQuery(value: string) {
        return value.toLowerCase().replace(" ", "+");
    }

    /**
     * Remove any specified element from given array.
     * @param array Array to remove element from
     * @returns processed array
     */
    static remove(array: string[], value: string) {
        this.logger.info(`Removing scans from seasons`);
        return array.filter((element: string) => !element.toLowerCase().includes(value));
    }

    /**
     * Verifiy if a array only contains a specific name, like movie or scans.
     * 
     * It can help to easily skips some steps during process.
     * @param array Array to verify
     * @param value Value which can be contains in seasons
     * @returns true if it only contains given value
     */
    static includesOnly(array: any, value: string): boolean {
        return array.length == 1 &&
        array[0].toLowerCase().includes(value);
    }

}

