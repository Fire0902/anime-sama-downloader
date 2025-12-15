import Scrapper from "../engine/utils/Scrapper.ts";
import DownloadService from "../engine/download/DownloadService.ts";
import Browser from "../engine/utils/Browser.ts";
import AnimeManager from "../engine/anime/AnimeManager.ts";
import Inquirer from "./input/Inquirer.ts";

/**
 * Select all user input and fetch anime content from anime-sama website.
 * Download the result at the end of process.
 */
async function main() {
	console.log(`~ Anime-sama Downloader CLI ~\n`);

	try {
		let animeName: string = await Inquirer.input(`Enter an anime name`);

		// ----- EXTRACT ANIMES FROM SEARCH -----

		const animes = await AnimeManager.getAnimeTitlesFromSearch(animeName);
		const animeNames = Object.keys(animes);

		if (animeNames.length == 0) {
			console.error("[ERROR] No animes found");
			return;
		}

		// ----- SELECT SPECIFIC ANIME -----

		animeName = await Inquirer.select(`Choose an anime`, animeNames);

		// ----- EXTRACT SEASONS -----

		const seasonsPageUrl: string = animes[animeName];
		const seasons: any = await AnimeManager.getSeasonsFromSearch(
			seasonsPageUrl
		);

		if (seasons.length == 0) {
			console.error(
				`[ERROR] Failed to find season from search url: ${seasonsPageUrl}`
			);
			return;
		}

		let episodesUrls: any;
		let seasonUrl, seasonCompleteUrl, seasonName: string;
		let chosenEpisodesNumbers: number[];
		const seasonNames = Object.keys(seasons);

		if (AnimeManager.isMovie(seasonNames)) {
			console.log(`[LOG] ${animeName} is a movie.`);

			const animeCompleteUrl = animes[animeName] + "film/vostfr";
			episodesUrls = await Scrapper.extractEpisodes(animeCompleteUrl);

			await Browser.close();
			await DownloadService.startDownload(animeName, "Film", [1], episodesUrls);
			return;
		}

		seasonName = await Inquirer.select(`Choose a season`, seasonNames);

		seasonUrl = seasons[seasonName];
		seasonCompleteUrl = animes[animeName] + seasonUrl;
		episodesUrls = await Scrapper.extractEpisodes(seasonCompleteUrl);

		if (episodesUrls[0].length == 0) {
			console.error("[ERROR] No episode found from extraction");
			return;
		}

		chosenEpisodesNumbers = await Inquirer.numbers(
			`Choose one or multiple episodes [1-${episodesUrls[0].length}]`
		);

		await Browser.close();
		AnimeManager.displayAnime(animeName, seasonName, chosenEpisodesNumbers);
		await DownloadService.startDownload(
			animeName,
			seasonName,
			chosenEpisodesNumbers,
			episodesUrls
		);
	} catch (error) {
		console.log("[ERROR] Failed to continue CLI process: ");
		console.error(error);
	} finally {
		process.stdin.pause();
		process.stdin.removeAllListeners();

		setTimeout(() => {
			process.exit(0);
		}, 100);
	}
}

await main();
