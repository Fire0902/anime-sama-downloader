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
     * @param animeName
     * @returns animes titles
     */
    static async getAnimeTitlesFromSearch(animeName: string) {
        this.logger.info(`Searching anime titles web page from: ${animeName}`);
        const page = await this.getAnimeSearchPage(animeName);
        return await Scrapper.extractAnimeTitles(page);
    }

    /**
     * @param animeName anime name to web search
     * @returns page
     */
    private static async getAnimeSearchPage(animeName: string) {
        this.logger.info(`Fetching anime search page for: ${animeName}`);
        
        animeName = animeName.toLowerCase().replace(" ", "+"); // Format for href
        const searchUrl = `${Config.websiteAdress}/catalogue?search=${animeName}`;
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


    /**
     * Remove scans from given seasons array
     * @param seasons array of season names
     * @returns the array without scans
     */
    static removeScansFromSeasons(seasons: any) {
        this.logger.info(`Removing scans from seasons`);
        return seasons.filter((season: string) => !season.toLowerCase().includes('scans'));
    }

    /**
     * Remove movies from given seasons array
     * @param seasons array of season names
     * @returns the array without movies
     */
    static removeMoviesFromSeasons(seasons: any) {
        this.logger.info('Removing movies from seasons');
        return seasons.filter((season: string) => !season.toLowerCase().includes('films'));
    }

    // ----- EPISODES -----

    /**
     * 
     * @param seasonUrl
     * @returns
     */
    static async getEpisodesFromSearch(seasonUrl: string){
        this.logger.info(`Searching episodes from: ${seasonUrl}`);
        return await Scrapper.extractEpisodes(seasonUrl);
    }

    // ----- UTILS -----

    /**
     * @param seasons 
     * @returns 
     */
    static isMovie(seasons: any): boolean {
        return seasons.length == 1 && seasons[0].toLowerCase().includes('film');
    }

    /**
     * @param animeName 
     * @param seasonName 
     * @param episodesNumbers 
     */
    static displayAnime(animeName: string, seasonName: string, episodesNumbers: number[]) {
        console.log(`\n----- ${animeName} -----\n`);
        console.log(seasonName);
        console.table(`Episodes [${episodesNumbers}]`);
        console.log(`\n------------------\n`);
    }
}

