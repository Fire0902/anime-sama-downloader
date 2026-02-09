import DownloadService from "../engine/service/download/DownloadService.ts";
import AnimeService from "../engine/service/anime/AnimeService.ts";
import Puppeteer from "../engine/utils/web/Puppeteer.ts";
import Inquirer from "../engine/utils/input/Inquirer.ts";
import Log from "../engine/utils/log/Log.ts";
import Config from "../engine/config/Config.ts";
import Anime from "../engine/types/Anime.ts";
import { cwd, stdin, exit } from "node:process";

/**
 * Console-Lign Interface class.
 */
export default class Cli {
	private static readonly logger = Log.create(this.name, "pretty");

	/**
	 * Start CLI process.
	 */
	static async run() {
		console.log("~ Anime-sama Downloader - CLI Mode ~");
		console.log(`Logs: (${cwd()}/${Config.logPath}/${Config.logFileName})\n`);

		try {
			let anime = await this.updateAnime();
			if (!anime) {
				const error = new Error(`No result found`);
				this.logger.fatal(error);
				throw error;
			}

			anime = await this.updateSeason(anime);
			if (!anime) {
				const error = new Error(`No season found`);
				this.logger.fatal(error);
				throw error;
			}

			anime = await this.updateEpisodes(anime);
			await this.startDownload(anime);
		}
		catch (error) {
			// must be shown
			this.logger.error(`${error}`); 
		} 
		finally {
			await Puppeteer.close();
			stdin.pause();
			stdin.removeAllListeners();

			setTimeout(() => exit(), 100);
			console.log("CLI process end.");
		}
	}

	/**
	 * Update anime name and search page.
	 */
	private static async updateAnime() {
		const search: string = await Inquirer.input("Search an anime");

		const animesUrls = await AnimeService.getAnimesFromSearch(search);
		if (Object.keys(animesUrls).length == 0) {
			const error = new Error(`No result found for: ${search}`);
			this.logger.fatal(error);
			throw error;
		}

		const name = await Inquirer.select("Select an anime", Object.keys(animesUrls));
		const url = animesUrls[name];

		return new Anime(name, url);
	}

	/**
	 */
	private static async updateSeason(anime: Anime) {

		const seasons = await AnimeService.getSeasonsFromUrl(anime.url);
		if (!seasons) {
			const error = new Error(`No season found from: ${anime.url}`);
			this.logger.fatal(error);
			throw error;
		}

		anime.seasons = seasons;
		anime.seasonNames = Object.keys(anime.seasons);

		if (AnimeService.includesOnly(anime.seasonNames, "movie")) {
			this.logger.info(`${anime.name} is a movie, skipping following steps.`);

			anime.episodesUrls = await AnimeService.getEpisodesFromSearch(anime.url + "film/vostfr");

			await DownloadService.startDownload(anime.name,"Film",[1], anime.episodesUrls);
			exit();
		}

		anime.seasonNames = AnimeService.remove(anime.seasonNames, "scans");
		const removeMovies = await Inquirer.confirm("Remove movies ?");
		if (removeMovies) {
			anime.seasonNames = AnimeService.remove(anime.seasonNames, "films");
		}

		anime.chosenSeason = await Inquirer.select("Choose a season", anime.seasonNames);
		anime.chosenSeasonUrl = anime.seasons[anime.chosenSeason];
		return anime;
	}

	private static async updateEpisodes(anime: Anime) {
		const seasonCompleteUrl = `${anime.url}/${anime.chosenSeasonUrl}`;
		anime.episodesUrls = await AnimeService.getEpisodesFromSearch(seasonCompleteUrl);

		if (anime.episodesUrls[0].length == 0) {
			const error = new Error(`No episode found from season url: ${seasonCompleteUrl}`);
			this.logger.fatal(error);
			throw error;
		}

		anime.chosenEpisodes = await Inquirer.numbers(
			`Choose one or multiple episodes (Ex: 1,2,3-7,8) [1-${anime.episodesUrls[0].length}]`,
		);
		return anime;
	}

	private static async startDownload(anime: Anime){
		console.log(anime.toString());
		if (!await Inquirer.confirm("Download ?")) return;

		console.log(`Start downloads (${cwd()}/${Config.downloadPath})`);
		await DownloadService.startDownload(
			anime.name,
			anime.chosenSeason,
			anime.chosenEpisodes,
			anime.episodesUrls,
		);
	}
}

function main() {
	Cli.run();
}

main();
