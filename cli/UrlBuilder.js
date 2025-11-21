const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { extractEpisodes, extractAnimes, extractSeasons } = require('./Scrapper');
const Semaphore = require('./Semaphore');
const { downloadEpisode, requestTimeout } = require('./EpisodeDownloader');
const { askName, askNumber, askNumbers, closeReader } = require('./Asker');

puppeteer.use(StealthPlugin());

const websiteUrl = 'https://anime-sama.org/catalogue';

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 */
async function request() {

    // ----- SELECT ANIME NAME -----

    const animeName = await askName();
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

        const animeNumber = await askNumber(`\nChoose an anime [1-${animesNames.length}]`,true);
        const animeName = animesNames[animeNumber];
        console.log(`Select anime : ${animeName}`);

        await page.goto(animes[animeName], {
            waitUntil: 'networkidle2'
        });

        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        // ----- EXTRACT SEASONS -----

        const seasons = await extractSeasons(page);
        if (seasons.length == 0) {
            console.warn('No season found, restarting process...');
            request();
        }
        else displaySeasons(seasons);

        // ----- SELECT SEASON -----

        const seasonNumber = await askNumber(`\nChoose a season [1-${seasons.length}]`, true);
        const seasonName = seasons[seasonNumber].name;

        console.log(`\nSelected season : ${seasonName}`);
        const seasonUrl = animes[animeName] + seasons[seasonNumber].link;

        // ----- EXTRACT EPISODES NUMBERS -----

        const extractedEpisodesUrl = await extractEpisodes(seasonUrl);
        if (extractedEpisodesUrl.length == 0) {
            console.warn('No episode found, restarting process...');
            request();
        }

        // ----- SELECT EPISODES -----

        console.log("\n- Episodes -");
        const chosenEpisodesNumbers = await askNumbers(
            `Choose one or multiple episodes [1-${extractedEpisodesUrl.length}]`
        );

        // ----- START DOWNLOAD PROCESS -----

        await startDownload(animeName, seasonName, chosenEpisodesNumbers, extractedEpisodesUrl);
        console.log("\nEnd of download !");
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
 * @param episodesUrl 
 */
async function startDownload(animeName, seasonName, episodesNumbers, episodesUrl) {
    console.log('Starting download process for:');
    console.log(`\n${animeName}`);
    console.log(`\n${seasonName}`);
    console.table(`\n${episodesNumbers}`);
    console.table(`\n${episodesUrl}`);
    
    const tasks = [];
    for (const episodeNumber of episodesNumbers) {
        console.log(`Pushing download for EP-${episodeNumber}`);
        tasks.push(downloadWorker(episodeNumber, episodesUrl, seasonName, animeName));
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
    console.log("\n- Animes -");
    animes.forEach((name, index) => {
        console.log(`[${index + 1}] ${name}`);
    });
}

function displaySeasons(seasons) {
    console.log("\n- Seasons -");
    seasons.forEach((season, index) => {
        console.log(`[${index + 1}] ${season.name}`);
    });
}

module.exports = { request };