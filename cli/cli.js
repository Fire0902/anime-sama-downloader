const { extractEpisodes, extractAnimeTitles, extractSeasonsWithScans } = require('../engine/Scrapper');
const { askName, askNumber, askNumbers, closeReader } = require('../engine/Asker');
const { requestTimeout } = require('../engine/EpisodeDownloader');
const { startDownload, removeScans } = require("../engine/DownloadService");
const { websiteUrl, waitForSelectorTimeout } = require("../config/config");
const Browser = require('../engine/Browser');

/**
 * @param animeName 
 * @param seasonName 
 * @param episodesNumbers 
 */
function displayAnime(animeName, seasonName, episodesNumbers){
    console.log(`\n- Anime -`);
    console.log(`Name: ${animeName}`);
    console.log(`Season: ${seasonName}`);
    console.table(`Episodes: ${episodesNumbers}\n`);
}

function displayAnimeNames(animes) {
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

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 */
async function main() {

    console.log(`~ Anime-sama Downloader CLI ~`);
    // ----- SELECT ANIME NAME -----

    const animeName = await askName();
    const searchUrl = `${websiteUrl}/?search=${animeName}`;
    
    const page = await Browser.newPage();
    try {
        console.log(`Extracting research from : ${searchUrl}`);
        await page.goto(searchUrl, {
            waitUntil: 'networkidle2'
        });

        await requestTimeout(500); // maybe useless now i will try asap

        page.waitForSelector("#list_catalog", { timeout: waitForSelectorTimeout });

        // ----- EXTRACT ANIMES FROM SEARCH -----

        const animes = await extractAnimeTitles(page);
        const animeNames = Object.keys(animes);
        displayAnimeNames(animeNames);

        // ----- SELECT SPECIFIC ANIME -----

        const animeNumber = await askNumber(`\nChoose an anime [1-${animeNames.length}]`,true);
        const animeName = animeNames[animeNumber];
        console.log(`Selected anime : ${animeName}`);

        await page.goto(animes[animeName], {
            waitUntil: 'networkidle2'
        });

        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: waitForSelectorTimeout }
        );

        // ----- EXTRACT SEASONS -----

        const seasonsWithScans = await extractSeasonsWithScans(page);
        const seasons = removeScans(seasonsWithScans);
        if (seasons.length == 0) {
            console.warn('No season found...');
            return;
        }
        displaySeasons(seasons);

        // ----- SELECT SEASON -----

        const seasonNumber = await askNumber(`\nChoose a season [1-${seasons.length}]`, true);
        const seasonName = seasons[seasonNumber].name;

        console.log(`\nSelected season : ${seasonName}`);
        const seasonUrl = animes[animeName] + seasons[seasonNumber].link;

        // ----- EXTRACT EPISODES NUMBERS -----
        const readers = await extractEpisodes(seasonUrl)
        //const extractedEpisodesUrl = await extractEpisodes(seasonUrl);
        if (readers[0].length == 0) {
            console.warn('No episode found');
            return;
        }

        // ----- SELECT EPISODES -----

        console.log("\n- Episodes -");
        const chosenEpisodesNumbers = await askNumbers(
            `Choose one or multiple episodes [1-${readers[0].length}]`
        );

        // ----- START DOWNLOAD PROCESS -----
        
        closeReader();
        await Browser.close();
        
        displayAnime(animeName, seasonName, chosenEpisodesNumbers);
        await startDownload(animeName, seasonName, chosenEpisodesNumbers, readers);
    }
    catch (error){
        console.log("Failed to continue CLI process");
        console.error(error);
    }
    finally {
        process.stdin.pause();
        process.stdin.removeAllListeners();

        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
};


main();