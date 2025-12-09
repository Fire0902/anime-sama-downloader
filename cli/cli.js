const { extractEpisodes, extractAnimeTitles, extractSeasonsWithScans } = require('../engine/Scrapper');
const { requestTimeout } = require('../engine/EpisodeDownloader');
const { startDownload, removeScans } = require("../engine/DownloadService");
const { websiteUrl, waitForSelectorTimeout } = require("../config/config");
const Browser = require('../engine/Browser');
const AnimeService = require('../engine/anime/AnimeService');
const Asker = require('../engine/input/Asker');

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 */
async function main() {

    console.log(`~ Anime-sama Downloader CLI ~\n`);
    // ----- SELECT ANIME NAME -----

    const animeName = await Asker.askAnime();
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
        AnimeService.displayAnimeNames(animeNames);

        // ----- SELECT SPECIFIC ANIME -----

        const animeName = await Asker.askAnimeFromList(animeNames);

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
        AnimeService.displaySeasons(seasons);

        // ----- SELECT SEASON -----

        const seasonNumber = await Asker.askSeasonNumberFromList(seasons);
        const seasonName = seasons[seasonNumber].name;

        console.log(`\nSelected season : ${seasonName}`);
        const seasonUrl = animes[animeName] + seasons[seasonNumber].link;

        // ----- EXTRACT EPISODES NUMBERS -----

        const episodes = await extractEpisodes(seasonUrl)
        if (episodes[0].length == 0) {
            console.error('No episode found');
            return;
        }

        // ----- SELECT EPISODES -----

        const chosenEpisodesNumbers = await Asker.askEpisodesFromList(episodes);

        // ----- START DOWNLOAD PROCESS -----
        
        await Browser.close();
        AnimeService.displayAnime(animeName, seasonName, chosenEpisodesNumbers);
        await startDownload(animeName, seasonName, chosenEpisodesNumbers, episodes);
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