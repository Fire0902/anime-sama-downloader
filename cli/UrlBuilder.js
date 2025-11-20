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

    // ----- SELECT ANIME NAME -----

    let animeName = await ask("Enter an anime name");
    animeName = animeName.replace(" ", "+");
    const searchUrl = `${websiteUrl}/?search=${animeName}`;
    
    console.log(`Launching puppet browser...`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {

        const page = await browser.newPage();
    
        console.log(`Extracting research from : ${searchUrl}`);
        await page.goto(searchUrl, {
            waitUntil: 'networkidle2'
        });

        await requestTimeout(500);

        page.waitForSelector("#list_catalog", { timeout: 10000 });

        // ----- EXTRACT ANIMES FROM SEARCH -----

        const animes = await extractAnimes(page);
        const animesNames = Object.keys(animes);
        displayAnimes(animesNames);

        // ----- SELECT SPECIFIC ANIME -----

        let chosenAnimeNumber = await ask("Choose a result");
        chosenAnimeNumber = parseInt(chosenAnimeNumber) - 1;
        const animeName = animesNames[chosenAnimeNumber];

        await page.goto(animes[animeName], {
            waitUntil: 'networkidle2'
        });

        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        // ----- EXTRACT SEASONS -----

        const seasons = await extractSeasons(page);
        if (seasons.length == 0) console.warn('No season found');
        else displaySeasons(seasons);

        // ----- SELECT SEASON -----

        const chosenSeasonNumber = await ask(`Choose a season [1-${seasons.length}]`);
        const seasonNumber = parseInt(chosenSeasonNumber) - 1;
        const seasonName = seasons[seasonNumber].name;

        console.log(`Selected season : ${seasonName}`);
        const seasonUrl = animes[animeName] + seasons[seasonNumber].link;

        // ----- EXTRACT EPISODES NUMBERS -----

        const extractedEpisodes = await extractEpisodes(seasonUrl);

        // ----- SELECT EPISODES -----

        let chosenEpisodesNumbers = await ask(`Choose one or multiple episodes [1-${extractedEpisodes.length}]`);
        chosenEpisodesNumbers = parseNumbers(chosenEpisodesNumbers);

        // ----- START DOWNLOAD PROCESS -----

        await startDownload(animeName, seasonName, chosenEpisodesNumbers, extractedEpisodes);
        console.log("\nEnd of downloads !");
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

/**
 * Start downloading anime episodes.
 * @param animeName 
 * @param seasonName 
 * @param episodesNumbers 
 * @param episodesArray 
 */
async function startDownload(animeName, seasonName, episodesNumbers, episodesArray) {
    console.log('Starting download process');
    
    const tasks = [];
    let episodeUrl;
    for (const episodeNumber of episodesNumbers) {
        console.log(`Pushing download for EP-${episodeNumber}`);
        episodeUrl = episodesArray[episodeNumber - 1];
        tasks.push(downloadWorker(episodeNumber, episodesArray, seasonName, animeName));
        await requestTimeout(300);
    }
    await Promise.all(tasks);
}

const semaphore = new Semaphore(2);

/**
 * Acquire a worker and make it download a given episode.
 * @param episodeNumber 
 * @param episodes 
 * @param season 
 * @param url 
 */
async function downloadWorker(episodeNumber, episodes, season, url) {
    await semaphore.acquire();
    try {
        const episodeUrl = episodes[episodeNumber - 1];
        const rawUrl = episodeUrl.replace('to', 'net');
        await downloadEpisode(rawUrl, episodeNumber, season, url);
    } 
    catch(e){
        console.error(`Failed to download episode ${episodeNumber}`);
        semaphore.release();
    }
    finally {
        semaphore.release();
    }
}

function displayAnimes(animes) {
    animes.forEach((name, index) => {
        console.log(`[${index + 1}] : ${name}`);
    });
}

function displaySeasons(seasons) {
    console.log("- Seasons -");
    seasons.forEach((season, index) => {
        console.log(`[${index + 1}] : ${season.name}`);
    });
}

module.exports = { request };