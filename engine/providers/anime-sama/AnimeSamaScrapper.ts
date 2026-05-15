import { Page } from 'puppeteer';
import Puppeteer from '../../utils/web/Puppeteer.ts';
import AnimeSamaConfig from './AnimeSamaConfig.ts';
import Log from '../../utils/log/Log.ts';

/**
 * Anime-sama specific scraping methods.
 * Handles all HTML extraction logic tied to anime-sama's page structure.
 */
export default class AnimeSamaScrapper {
    private static readonly logger = Log.create(this.name);

    /**
     * Extract the active website host from the domains list page.
     * Also updates AnimeSamaConfig.websiteAdress with the resolved value.
     */
    static async extractHostAdress(): Promise<string> {
        this.logger.info('Extracting website host adress');
        const page = await Puppeteer.goto(AnimeSamaConfig.websiteDomainsAdress);
        const websiteDomainsClass = AnimeSamaConfig.websiteDomainsClass;

        let adress = await page.evaluate(domainClass => {
            const domainContainer = document.querySelector(domainClass);
            return domainContainer?.textContent!;
        }, websiteDomainsClass);

        adress = 'https://' + adress;
        AnimeSamaConfig.websiteAdress = adress;
        return adress;
    }

    /**
     * Extract anime titles and their catalogue URLs from a search result page.
     * @param page web page
     * @returns map of title → catalogue URL
     *
     * @example
     * ```json
     * {
     *   "One Piece": "https://anime-sama.eu/catalogue/one-piece/",
     *   "One Punch Man": "https://anime-sama.eu/catalogue/one-punch-man/"
     * }
     * ```
     */
    static async extractAnimeTitles(page: Page): Promise<Record<string, string>> {
        this.logger.info('Extracting anime titles');
        const animeSearchPageId = AnimeSamaConfig.animeSearchPageId;
        return await page.evaluate(animeSearchPageId => {
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
     * Extract all seasons (including scans) from an anime page.
     * @param page web page
     * @returns array of { name, link }
     */
    static async extractSeasonsWithScans(page: Page): Promise<Array<{ name: string, link: string | null }>> {
        this.logger.info('Extracting seasons');
        return await page.evaluate(() => {
            const animeLinks = document.querySelectorAll('a.border-blue-500');
            if (!animeLinks || animeLinks.length === 0) return [];
            return Array.from(animeLinks).map(a => ({
                name: a.textContent?.trim() || '',
                link: "/" + a.getAttribute("href")
            }));
        });
    }

    /**
     * Extract episode reader URLs and episode names from a season page.
     *
     * Reads the anime-sama globals eps1/eps2/eps3 and the #selectEpisodes element.
     * @param seasonUrl full URL of the season page
     */
    static async extractEpisodes(seasonUrl: string) {
        this.logger.info(`Extracting episodes from : ${seasonUrl}`);
        const page = await Puppeteer.goto(seasonUrl);

        const result = await page.evaluate(() => {
            const readers = [];
            readers.push(typeof eps1 !== 'undefined' ? eps1 : []);
            readers.push(typeof eps2 !== 'undefined' ? eps2 : []);
            readers.push(typeof eps3 !== 'undefined' ? eps3 : []);

            const selectElement = document.getElementById('selectEpisodes') as HTMLSelectElement;
            const episodeNames: string[] = [];
            if (selectElement) {
                Array.from(selectElement.options).forEach(option => {
                    episodeNames.push(option.value || option.text);
                });
            }

            return { readers, episodeNames };
        });

        Puppeteer.closePage(page);
        return result;
    }
}
