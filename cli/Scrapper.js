const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { requestTimeout } = require('./EpisodeDownloader');

puppeteer.use(StealthPlugin());

/**
 * Extract animes titles and catalogue URL from a given html page.
 * @param page web page
 * @returns array of found animes titles.
 * 
 * Example of result: 
 * 
 * {
 *   "One Piece": "https://anime-sama.org/catalogue/one-piece/",
 *   "One Punch Man": "https://anime-sama.org/catalogue/one-punch-man/"
 * }
 */
async function extractAnimesTitles(page) {
    console.log('Extracting animes title');

    const titles = await page.evaluate(() => {
        const animes = {};
        const container = document.getElementById("list_catalog");
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
    });
    return titles;
}

/**
 * Extract episode from a given season url.
 * @param seasonUrl 
 * @returns array of found episodes.
 */
async function extractEpisodes(seasonUrl) {
    console.log(`Extracting episodes from : ${seasonUrl}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.goto(seasonUrl, {
        waitUntil: 'networkidle2'
    });

    await requestTimeout(500);
    const episodes = await page.evaluate(() => {
        return typeof eps1 !== 'undefined' ? eps1 : [];
    });

    await browser.close();
    return episodes;
};

/**
 * Extract seasons from a given page.
 * @param page web page
 * @returns array of found seasons.
 */
async function extractSeasons(page) {
    console.log('Extracting seasons...');
    try {
        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        const seasons = await page.evaluate(() => {
            const links = document.querySelectorAll(
                "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a"
            );
            return Array.from(links).map(a => ({
                name: a.textContent.trim(),
                link: a.getAttribute("href")
            }));
        });
        return seasons;
    } catch (err) {
        console.log("No season found or timeout");
        return [];
    }
}

module.exports = { extractEpisodes, extractAnimes: extractAnimesTitles, extractSeasons }
