const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { extractEpisodes, extractAnimes, extractSeasons } = require('./Scrapper');
const Semaphore = require('./Semaphore');
const { parseNumbers } = require('./Parser');
const { downloadEpisode, requestTimeout } = require('./EpisodeDownloader');
const { ask, closeReader } = require('./Asker');

puppeteer.use(StealthPlugin());

const websiteUrl = 'https://anime-sama.org/catalogue';

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 */
async function request() {

    let animeName = await ask("Enter an anime name");
    animeName = animeName.replace(" ", "+");

    const searchUrl = `${websiteUrl}/?search=${animeName}`;
    console.log(`Research url : ${searchUrl}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {

        const page = await browser.newPage();

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2'
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        page.waitForSelector("#list_catalog", { timeout: 10000 });

        const animes = await extractAnimes(page);
        const animesNames = Object.keys(animes);

        animesNames.forEach((name, index) => {
            console.log(`[${index + 1}] : ${name}`);
        });

        const chosenAnime = await ask("Select a search result");
        const animeName = animesNames[parseInt(chosenAnime) - 1];

        await page.goto(animes[animeName], {
            waitUntil: 'networkidle2'
        });

        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        const seasons = await extractSeasons(page);
        Array.isArray(seasons) ? console.log("Seasons :") : console.log("No seasons found");
        seasons.forEach((season, index) => {
            console.log(`[${index + 1}] : ${season.name}`);
        });
        const chosenSeason = await ask(`Chose season [1-${seasons.length}]`);

        const stringChosenSeason = seasons[parseInt(chosenSeason) - 1].name;
        const seasonInt = parseInt(chosenSeason) - 1;

        const seasonUrl = animes[animeName] + seasons[seasonInt].link;

        const episodes = await extractEpisodes(seasonUrl);
        const chosenEpisodes = await ask(`Chose episode(s) [1-${episodes.length}]`);

        const episodeArray = parseNumbers(chosenEpisodes);
        const tasks = [];
        for (const episodeNumber of episodeArray) {
            tasks.push(downloadWorker(episodeNumber, episodes, stringChosenSeason, animeName));
            await requestTimeout(300)
        }

        await Promise.all(tasks);
        console.log("\nEnd of downloads !");
    }
    catch (e) {
        console.error("Failed to process request:" + e)
    }
    finally {
        closeReader();
        await browser.close();

        process.stdin.pause();
        process.stdin.removeAllListeners();

        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
};

const semaphore = new Semaphore(2);

/**
 * Acquire a worker and make it download a given episode.
 * @param episodeNumber 
 * @param episodes 
 * @param stringChosenSeason 
 * @param url 
 */
async function downloadWorker(episodeNumber, episodes, stringChosenSeason, url) {
    await semaphore.acquire();

    try {
        const episodeUrl = episodes[episodeNumber - 1];
        const rawUrl = episodeUrl.replace('to', 'net');

        await downloadEpisode(rawUrl, episodeNumber, stringChosenSeason, url);
    } finally {
        semaphore.release();
    }
}

module.exports = { request };