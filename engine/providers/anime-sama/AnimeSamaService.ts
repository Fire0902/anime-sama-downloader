import AnimeSamaConfig from './AnimeSamaConfig.ts';
import Puppeteer from '../../utils/web/Puppeteer.ts';
import AnimeSamaScrapper from './AnimeSamaScrapper.ts';
import Log from '../../utils/log/Log.ts';

/**
 * High-level service for anime-sama: search, seasons, and episodes.
 * Orchestrates AnimeSamaScrapper with anime-sama URL patterns and business rules.
 */
export default class AnimeSamaService {
    private static readonly logger = Log.create(this.name);

    // ----- ANIME -----

    /**
     * Search for anime titles matching the given name.
     * @param name partial anime name to search
     * @returns map of title → catalogue URL
     */
    static async getAnimesFromSearch(name: string) {
        this.logger.info(`Searching anime titles web page from: ${name}`);
        const page = await this.getAnimeSearchPage(name);
        const result = await AnimeSamaScrapper.extractAnimeTitles(page);
        Puppeteer.closePage(page);
        return result;
    }

    private static async getAnimeSearchPage(name: string) {
        this.logger.info(`Fetching anime search page for: ${name}`);
        const websiteUrl = await AnimeSamaScrapper.extractHostAdress() ?? AnimeSamaConfig.websiteAdress;
        const url = `${websiteUrl}/catalogue?search=${this.toQuery(name)}`;
        return Puppeteer.goto(url, AnimeSamaConfig.animeSearchPageSelector, AnimeSamaConfig.animeSearchWaitUntil);
    }

    // ----- SEASONS -----

    /**
     * Get all seasons (including scans) from an anime page URL.
     * @param url anime page URL
     * @returns map of season name → relative link, or null if none found
     */
    static async getSeasonsFromUrl(url: string): Promise<Record<string, string> | null> {
        this.logger.info(`Searching seasons from: ${url}`);
        const page = await this.getSeasonsPage(url);
        const seasons = await AnimeSamaScrapper.extractSeasonsWithScans(page);
        Puppeteer.closePage(page);
        if (!seasons) return null;

        const seasonMap: Record<string, string> = {};
        for (const season of seasons) {
            seasonMap[season.name] = season.link!;
        }
        return Object.keys(seasonMap).length ? seasonMap : null;
    }

    /**
     * Get seasons from an anime page URL, excluding scan seasons.
     * @param url anime page URL
     */
    static async extractSeasonWithoutScans(url: string): Promise<Record<string, string> | undefined> {
        const seasonsScans = await this.getSeasonsFromUrl(url);
        if (!seasonsScans) return;
        const arrayFiltered = Object.entries(seasonsScans).filter(([key]) =>
            !key.toLowerCase().includes('scans')
        );
        return Object.fromEntries(arrayFiltered);
    }

    private static async getSeasonsPage(url: string) {
        this.logger.info(`Fetching seasons page for: ${url}`);
        return Puppeteer.goto(url, AnimeSamaConfig.seasonsPageSelector, AnimeSamaConfig.seasonSearchWaitUntil);
    }

    // ----- EPISODES -----

    /**
     * Get episode reader URLs and names from a season URL.
     * @param seasonUrl full URL of the season page
     */
    static async getEpisodesFromSearch(seasonUrl: string) {
        this.logger.info(`Searching episodes from: ${seasonUrl}`);
        return AnimeSamaScrapper.extractEpisodes(seasonUrl);
    }

    // ----- UTILS -----

    /**
     * Format a string for use in an HTTP query parameter.
     * @example "One Piece" → "one+piece"
     */
    static toQuery(value: string) {
        return value.toLowerCase().replace(" ", "+");
    }

    /**
     * Remove entries that contain a given substring (case-insensitive).
     */
    static remove(array: string[], value: string) {
        return array.filter((element: string) => !element.toLowerCase().includes(value));
    }

    /**
     * Return true if the array has exactly one entry and it contains the given value.
     * Useful to detect e.g. movie-only or scans-only season lists.
     */
    static includesOnly(array: any[], value: string): boolean {
        return array.length === 1 && array[0].toLowerCase().includes(value);
    }
}
