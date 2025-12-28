import DownloadService from "../src/service/download/DownloadService.ts";
import AnimeService from "../src/service/anime/AnimeService.ts";
import Puppeteer from "../src/utils/web/Puppeteer.ts";
import Inquirer from "../src/utils/input/Inquirer.ts";
import Log from "../src/utils/log/Log.ts";
import Config from "../src/config/Config.ts";

/**
 * Client-Lign Interface class.
 */
export default class Cli {
	private static readonly logger = Log.create(this.name, "pretty");

	/**
	 * Select all user inputs and fetch anime content from website,
	 * then download selected videos.
	 */
	static async run() {
		console.log(`~ Anime-sama Downloader CLI ~\n`);
		console.log(`(Logs stored at ${process.cwd()}/${Config.logPath})\n`);

		try {
			// ----- ANIMES -----

			let animeName: string = await Inquirer.input(`Search an anime`);

			const animes = await AnimeService.getAnimeTitlesFromSearch(animeName);
			const animeNames = Object.keys(animes);

			if (animeNames.length == 0) {
				this.logger.fatal(new Error(`No anime found from name: ${animeName}`));
				return;
			}

			animeName = await Inquirer.select(`Choose an anime`, animeNames);

			// ----- SEASONS -----

			const seasonsPageUrl: string = animes[animeName];
			let seasons: any = await AnimeService.getSeasonsFromSearch(seasonsPageUrl);
			let seasonNames = Object.keys(seasons);

			if (seasons.length == 0 || seasonNames.length == 0) {
				this.logger.fatal(new Error(`No season found from search url: ${seasonsPageUrl}`));
				return;
			}

			let episodesUrls: any;
			let seasonUrl, seasonCompleteUrl, seasonName: string;
			let chosenEpisodesNumbers: number[];

			if (AnimeService.isMovie(seasonNames)) {
				this.logger.info(`${animeName} is a movie, skipping seasons and episodes steps.`);

				const animeCompleteUrl = animes[animeName] + "film/vostfr";
				episodesUrls = await AnimeService.getEpisodesFromSearch(animeCompleteUrl);
				await DownloadService.startDownload(animeName, "Film", [1], episodesUrls);
				return;
			}

			seasonNames = AnimeService.removeScansFromSeasons(seasonNames);
			const removeMovies = await Inquirer.confirm(`Remove movies ?`);
			if (removeMovies) {
				seasonNames = AnimeService.removeMoviesFromSeasons(seasonNames);
			}

			seasonName = await Inquirer.select(`Choose a season`, seasonNames);

			seasonUrl = seasons[seasonName];
			seasonCompleteUrl = `${animes[animeName]}/${seasonUrl}`;
			episodesUrls = await AnimeService.getEpisodesFromSearch(seasonCompleteUrl);

			if (episodesUrls[0].length == 0) {
				this.logger.fatal(new Error(`No episode found from season url: ${seasonCompleteUrl}`));
				return;
			}

			// ----- EPISODES -----

			chosenEpisodesNumbers = await Inquirer.numbers(
				`Choose one or multiple episodes (Ex: 1,2,3-7,8) [1-${episodesUrls[0].length}]`
			);

			// ----- DOWNLOAD -----

			AnimeService.displayAnime(animeName, seasonName, chosenEpisodesNumbers);
			const isDownloadAgreed = await Inquirer.confirm(`Start download ?`);
			if (!isDownloadAgreed) return;

			console.log(`Starting downloads, located at: ${process.cwd()}/${Config.downloadPath}`);
			await DownloadService.startDownload(
				animeName,
				seasonName,
				chosenEpisodesNumbers,
				episodesUrls
			);
			console.log(`End of downloads !`);
		} catch (error) {
			console.error(`${error}`); // This error must be seen by user, don't use logger
		} finally {
			await Puppeteer.close();
			process.stdin.pause();
			process.stdin.removeAllListeners();

			setTimeout(() => {
				process.exit(0);
			}, 100);
		}
	}
}

function main(){
	Cli.run();
}

main();