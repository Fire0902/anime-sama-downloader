const { requestTimeout } = require('./EpisodeDownloader');
const Browser = require('./Browser');

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
async function extractAnimeTitles(page) {
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

    const page = await Browser.newPage();
    await page.goto(seasonUrl, {
        waitUntil: 'networkidle2'
    });

    await requestTimeout(500);
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

/**
 * Extract seasons from a given page.
 * @param page web page
 * @returns array of found seasons.
 */
async function extractSeasonsWithScans(page) {
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
        console.error("Failed to find season");
        console.err(err);
        return [];
    }
}

module.exports = { extractEpisodes, extractAnimeTitles, extractSeasonsWithScans}
