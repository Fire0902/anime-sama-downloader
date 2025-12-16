import Browser from './BrowserPuppet.ts';
import Config from '../config/Config.ts';
import { Page } from 'puppeteer';
import Log from './Log.ts';

/**
 * Tool class for automated web scrapping
 */
export default class Scrapper {

    private static readonly logger = Log.create(Scrapper.name);
    /**
     * Extract animes titles and catalogue URL from a given html page.
     * @param page web page
     * @returns array of found animes titles.
     * 
     * Example of result: 
     * 
     * {
     *   "One Piece": "https://anime-sama.eu/catalogue/one-piece/",
     *   "One Punch Man": "https://anime-sama.eu/catalogue/one-punch-man/"
     * }
     */
    static async extractAnimeTitles(page: Page) {
        this.logger.info('Extracting anime titles');
        const animeSearchPageId = Config.animeSearchPageId;

        return await page.evaluate((animeSearchPageId: string) => {
            const animes: Record<string, string> = {};
            const container = document.getElementById(animeSearchPageId);
            if (!container) return animes;

            const htmlFindAnimes = Array.from(container.getElementsByTagName("div"));
            htmlFindAnimes.forEach(animeDiv => {
                const a = animeDiv.getElementsByTagName("a");
                if (a.length > 0) {
                    const content = a[0].querySelector('.card-content');
                    if (content) {
                        const titleEl = content.getElementsByTagName("h2")[0];
                        if (titleEl?.textContent) {
                            animes[titleEl.textContent.trim()] = a[0].href;
                        }
                    }
                }
            });
            return animes;
        }, animeSearchPageId);
    }

    /**
     * Extract seasons from a given page.
     * @param page web page
     * @returns array of found seasons.
     */
    static async extractSeasonsWithScans(page: Page): Promise<Array<{ name: string, link: string | null }>> {
        this.logger.info('Extracting seasons');
        const seasonsPageSelector = Config.seasonsPageSelector;

        return await page.evaluate((seasonsPageSelector: string) => {
            const links = document.querySelectorAll(seasonsPageSelector);
            if (!links || links.length === 0) return [];

            return Array.from(links).map(a => ({
                name: a.textContent?.trim() || '',
                link: a.getAttribute("href")
            }));
        }, seasonsPageSelector);
    }

    /**
     * Extract episode from a given season url.
     * @param seasonUrl 
     * @returns array of found episodes.
     */
    static async extractEpisodes(seasonUrl: string) {
        this.logger.info(`Extracting episodes from : ${seasonUrl}`);
        const page = await Browser.goto(seasonUrl);

        const episodes = await page.evaluate(() => {
            const readers = [];
            readers.push(typeof eps1 !== 'undefined' ? eps1 : []);
            readers.push(typeof eps2 !== 'undefined' ? eps2 : []);
            readers.push(typeof eps3 !== 'undefined' ? eps3 : []);
            return readers;
        });

        Browser.closePage(page);
        return episodes;
    };
}
