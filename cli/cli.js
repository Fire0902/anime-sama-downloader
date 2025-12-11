const Scrapper = require('../engine/utils/web/Scrapper');
const DownloadService = require("../engine/download/DownloadService");
const Browser = require('../engine/utils/web/Browser');
const AnimeManager = require('../engine/anime/AnimeManager');
const AnimeAsker = require('../engine/anime/AnimeAsker');

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 */
async function main() {

    console.log(`~ Anime-sama Downloader CLI ~\n`);

    // ----- SELECT ANIME NAME -----

    try {
        let animeName = await AnimeAsker.askAnime();

        // ----- EXTRACT ANIMES FROM SEARCH -----

        const animes = await AnimeManager.getAnimeTitlesFromSearch(animeName);
        const animeNames = Object.keys(animes);

        if (animeNames.length == 0) {
            console.error('[ERROR] No animes found');
            return;
        }

        // ----- SELECT SPECIFIC ANIME -----

        animeName = await AnimeAsker.askAnimeFromList(animeNames);

        // ----- EXTRACT SEASONS -----

        const seasonsPageUrl = animes[animeName];
        const seasons = await AnimeManager.getSeasonsFromSearchUrl(seasonsPageUrl);

        if (seasons.length == 0) {
            console.error(`[ERROR] Failed to find season from search url: ${seasonsPageUrl}`);
            return;
        }

        // ----- SELECT SEASON -----

        const seasonNames = Object.keys(seasons);
        const seasonName = await AnimeAsker.askSeasonFromList(seasonNames);

        // ----- EXTRACT EPISODES NUMBERS -----

        const seasonUrl = seasons[seasonName];
        const seasonCompleteUrl = animes[animeName] + seasonUrl;

        const episodes = await Scrapper.extractEpisodes(seasonCompleteUrl);

        if (episodes[0].length == 0) {
            console.error('[ERROR] No episode found from extraction');
            return;
        }

        // ----- SELECT EPISODES -----

        const chosenEpisodesNumbers = await AnimeAsker.askEpisodesFromList(episodes);

        // ----- START DOWNLOAD PROCESS -----

        await Browser.close();
        AnimeManager.displayAnime(animeName, seasonName, chosenEpisodesNumbers);
        await DownloadService.startDownload(animeName, seasonName, chosenEpisodesNumbers, episodes);
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