const Browser = require('./Browser');
const Config = require('../../config/Config');

/**
 * Tool class for automated web scrapping
 */
class Scrapper {
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
    static async extractAnimeTitles(page) {
        console.log('[LOG] Extracting anime titles...\n');
        const animeSearchPageId = Config.animeSearchPageId;
        const titles = await page.evaluate( (animeSearchPageId) => {
            console.log(animeSearchPageId);
            const animes = {};
            const container = document.getElementById(animeSearchPageId);
            if (!container) return animes;

            const htmlFindAnimes = Array.from(container.getElementsByTagName("div"));
            htmlFindAnimes.forEach(animeDiv => {
                const a = animeDiv.getElementsByTagName("a");
                if (a.length > 0) {
                    const content = a[0].querySelector('.card-content');
                    if (content) {
                        const titleEl = content.getElementsByTagName("h2")[0];
                        if (titleEl) {
                            animes[titleEl.textContent.trim()] = a[0].href;
                        }
                    }
                }
            });
            return animes;
        }, animeSearchPageId);

        return titles;
    }

    /**
     * Extract seasons from a given page.
     * @param page web page
     * @returns array of found seasons.
     */
    static async extractSeasonsWithScans(page) {
        console.log('[LOG] Extracting seasons...\n');
        try {
            const seasonsPageSelector = Config.seasonsPageSelector;
            const seasons = await page.evaluate((seasonsPageSelector) => {
                const links = document.querySelectorAll(seasonsPageSelector);
                return Array.from(links).map(a => ({
                    name: a.textContent.trim(),
                    link: a.getAttribute("href")
                }));
            }, seasonsPageSelector);
            return seasons;
        } catch (err) {
            console.error("[Error] Failed to find season");
            console.error(err);
            return [];
        }
    }

    /**
     * Extract episode from a given season url.
     * @param seasonUrl 
     * @returns array of found episodes.
     */
    static async extractEpisodes(seasonUrl) {
        console.log(`[LOG] Extracting episodes from : ${seasonUrl}\n`);
        const page = await Browser.goTo(seasonUrl);

        const episodes = await page.evaluate(() => {
            const readers = [];
            readers.push(typeof eps1 !== 'undefined' ? eps1 : []);
            readers.push(typeof eps2 !== 'undefined' ? eps2 : []);
            readers.push(typeof eps3 !== 'undefined' ? eps3 : []);
            return readers;
        });

        await Browser.closePage(page);
        return episodes;
    };
}

module.exports = Scrapper;
