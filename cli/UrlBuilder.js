const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getEpisodes } = require('./Scrapper');
const Semaphore = require('./Semaphore');
const { parseNumbers } = require('./Parser');
const { downloadEpisode, putTimeout } = require('./EpisodeDownloader');
const { ask } = require('./Asker');

puppeteer.use(StealthPlugin());

const websiteUrl = 'https://anime-sama.org/catalogue';

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 * TODO: Applies SINGLE RESP to this method
 */
async function request() {
    let url = await ask("Enter an anime name");
    url = url.replace(" ", "+");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        const searchUrl = `${websiteUrl}/?search=${url}`;

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2'
        });

        putTimeout(500);

        page.waitForSelector("#list_catalog", { timeout: 10000 });

        const animes = await extractAnime(page);

        const animesNames = Object.keys(animes);

        animesNames.forEach((title, index) => {
            console.log(`[${index + 1}] : ${title}`);
        });

        const chosenAnime = await ask("Select a search result");

        const animeName = animesNames[parseInt(chosenAnime) - 1];

        await page.goto(animes[animeName], { waitUntil: 'networkidle2' });

        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        const seasons = await extractSeason(page);
        Array.isArray(seasons) ? console.log("Seasons :") : console.log("No seasons found");
        seasons.forEach((season, index) => {
            console.log(`[${index + 1}] : ${season.name}`);
        });
        const chosenSeason = await ask(`Select season(s) [1-${seasons.length}] `);

        const stringChosenSeason = seasons[parseInt(chosenSeason) - 1].name;
        const seasonInt = parseInt(chosenSeason) - 1;

        const seasonUrl = animes[animeName] + seasons[seasonInt].link;

        const episodes = await getEpisodes(seasonUrl);
        const chosenEpisodes = await ask(`Select episode(s) [1-${episodes.length}] `);

        const episodesArray = parseNumbers(chosenEpisodes);
        const tasks = [];
        for (const ep of episodesArray) {
            tasks.push(downloadWorker(ep, episodes, stringChosenSeason, animeName));
            putTimeout(300);
        }

        await Promise.all(tasks);
        console.log("\nDownload completed !");
    }
    finally {
        await browser.close();

        rl.close();
        process.stdin.pause();
        process.stdin.removeAllListeners();

        setTimeout(() => { process.exit(0); }, 100);
    }
};

/**
 * Extract a season from a given html page.
 * @param page 
 * @returns array of found seasons.
 */
async function extractAnime(page) {
    const anime = await page.evaluate(() => {
        const result = {};
        const container = document.getElementById("list_catalog");
        if (!container) return result;

        const animeDivs = Array.from(container.getElementsByTagName("div"));
        animeDivs.forEach(animeDiv => {
            const a = animeDiv.getElementsByTagName("a");
            if (a.length > 0) {
                const content = a[0].querySelector('.card-content');
                if (content) {
                    const titleElement = content.getElementsByTagName("h2")[0];
                    if (titleElement) {
                        result[titleElement.textContent.trim()] = a[0].href;
                    }
                }
            }
        });
        return result;
    });
    return anime;
}

/**
 * Extract a season from a given page.
 * @param page 
 * @returns array of found seasons.
 */
async function extractSeason(page) {
    try {
        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        const saisons = await page.evaluate(() => {
            const links = document.querySelectorAll(
                "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a"
            );
            return Array.from(links).map(a => ({
                name: a.textContent.trim(),
                link: a.getAttribute("href")
            }));
        });
        return saisons;
    } catch (err) {
        console.error("No season found or delay expirated.");
        return [];
    }
}

const semaphore = new Semaphore(2);

/**
 * Acquire a worker and make it download a given episode.
 * @param episodeNumber 
 * @param episodes 
 * @param stringChosenSeason 
 * @param url 
 */
async function downloadWorker(episodeNumber, episodes, stringChosenSeason, url) {
    await semaphore.acquidownloadWorkerre();
    try {
        const episodeUrl = episodes[episodeNumber - 1];
        const rawUrl = episodeUrl.replace('to', 'net');
        await downloadEpisode(rawUrl, episodeNumber, stringChosenSeason, url);
    }
    catch (e) {
        console.error("Error when trying to download episode : " + e);
    }
    finally {
        semaphore.release();
    }
}

module.exports = { request };