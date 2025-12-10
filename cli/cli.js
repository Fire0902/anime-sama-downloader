const { extractEpisodes, extractAnimeTitles, extractSeasonsWithScans } = require('../engine/Scrapper');
const { requestTimeout } = require('../engine/EpisodeDownloader');
const { startDownload, removeScans } = require("../engine/DownloadService");
const { websiteUrl, waitForSelectorTimeout } = require("../config/config");
const Browser = require('../engine/Browser');
const AnimeService = require('../engine/anime/AnimeService');
const AnimeAsker = require('../engine/input/AnimeAsker');

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 */
async function main() {

    console.log(`~ Anime-sama Downloader CLI ~\n`);
    
    // ----- SELECT ANIME NAME -----

    const animeName = await AnimeAsker.askAnime();
    const searchUrl = `${websiteUrl}/?search=${animeName}`;
    
    const page = await Browser.newPage();
    try {
        console.log(`[LOG] Extracting research from : ${searchUrl}`);
        await page.goto(searchUrl, {
            waitUntil: 'networkidle2'
        });

        await requestTimeout(500); // maybe useless now i will try asap
        page.waitForSelector("#list_catalog", { timeout: waitForSelectorTimeout });

        // ----- EXTRACT ANIMES FROM SEARCH -----
    
        const animes = await extractAnimeTitles(page);
        const animeNames = Object.keys(animes);

        if (animeNames.length == 0) {
            console.error('[ERROR] No animes found');
            return;
        }
  
        // ----- SELECT SPECIFIC ANIME -----

        const animeName = await AnimeAsker.askAnimeFromList(animeNames);

        // ----- EXTRACT SEASONS -----

        await page.goto(animes[animeName], {
            waitUntil: 'networkidle2'
        });

        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: waitForSelectorTimeout }
        );

        const seasonsWithScans = await extractSeasonsWithScans(page);
        const seasons = removeScans(seasonsWithScans);

        if (seasons.length == 0) {
            console.error('[ERROR] No season found...');
            return;
        }

        // ----- SELECT SEASON -----

        let seasonMap = {};
        for(const season of seasons){
            seasonMap[season.name] = season.link; 
        }

        const seasonNames = Object.keys(seasonMap);
        const seasonName = await AnimeAsker.askSeasonFromList(seasonNames);
        const seasonUrl = seasonMap[seasonName];

        const seasonCompleteUrl = animes[animeName] + seasonUrl;
        console.log(seasonCompleteUrl);
        
        // ----- EXTRACT EPISODES NUMBERS -----

        const episodes = await extractEpisodes(seasonCompleteUrl);

        if (episodes[0].length == 0) {
            console.error('[ERROR] No episode found from extraction');
            return;
        }

        // ----- SELECT EPISODES -----

        const chosenEpisodesNumbers = await AnimeAsker.askEpisodesFromList(episodes);

        // ----- START DOWNLOAD PROCESS -----
        
        await Browser.close();
        AnimeService.displayAnime(animeName, seasonName, chosenEpisodesNumbers);
        await startDownload(animeName, seasonName, chosenEpisodesNumbers, episodes);
    }
    catch (error){
        console.log("[ERROR] Failed to continue CLI process");
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