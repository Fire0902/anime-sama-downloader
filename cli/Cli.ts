import DownloadService from "../src/service/download/DownloadService.ts";
import AnimeService from "../src/service/anime/AnimeService.ts";
import Puppeteer from "../src/utils/web/Puppeteer.ts";
import Inquirer from "../src/utils/input/Inquirer.ts";
import Log from "../src/utils/log/Log.ts";
import Config from "../src/config/Config.ts";
import Anime from "../src/types/Anime.ts";
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
		console.log(`Logs: (${cwd()}/${Config.logPath})\n`);

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
	 */
	private static async updateAnime() {
		const search: string = await Inquirer.input("Search an anime");
		const animesUrls = await AnimeService.getAnimesFromSearch(search);

		if (Object.keys(animesUrls).length == 0) {
			const error = new Error(`No result found for: ${search}`);
			this.logger.fatal(error);
			throw error;
		}

		const name = await Inquirer.select("Choose an anime", Object.keys(animesUrls));
		const seasonsPageUrl = animesUrls[name];

		return new Anime(name, seasonsPageUrl);
	}

	/**
	 */
	private static async updateSeason(anime: Anime) {

		const seasons = await AnimeService.getSeasonsFromUrl(anime.seasonsPageUrl);
		if (!seasons) {
			const error = new Error(`No season found from: ${anime.seasonsPageUrl}`);
			this.logger.fatal(error);
			throw error;
		}

		anime.seasons = seasons;
		anime.seasonNames = Object.keys(seasons);

		if (AnimeService.includesOnly(anime.seasonNames, "movie")) {
			this.logger.info(`${anime.name} is a movie, skipping following steps.`);

			const animeCompleteUrl = anime.seasonsPageUrl + "film/vostfr";
			anime.episodesUrls = await AnimeService.getEpisodesFromSearch(animeCompleteUrl);
			await DownloadService.startDownload(anime.name,"Film",[1], anime.episodesUrls);
			exit();
		}

		anime.seasonNames = AnimeService.remove(anime.seasonNames, "scans");
		const removeMovies = await Inquirer.confirm("Remove movies ?");
		if (removeMovies) {
			anime.seasonNames = AnimeService.remove(anime.seasonNames, "films");
		}

		anime.seasonName = await Inquirer.select("Choose a season", anime.seasonNames);
		anime.seasonUrl = seasons[anime.seasonName];
		return anime;
	}

	private static async updateEpisodes(anime: Anime) {
		const seasonCompleteUrl = `${anime.seasonsPageUrl}/${anime.seasonUrl}`;
		anime.episodesUrls = await AnimeService.getEpisodesFromSearch(seasonCompleteUrl);

		if (anime.episodesUrls[0].length == 0) {
			const error = new Error(`No episode found from season url: ${seasonCompleteUrl}`);
			this.logger.fatal(error);
			throw error;
		}

		anime.episodes = await Inquirer.numbers(
			`Choose one or multiple episodes (Ex: 1,2,3-7,8) [1-${anime.episodesUrls[0].length}]`,
		);
		return anime;
	}

	private static async startDownload(anime: Anime){
		console.log(anime.toString());
		if (!(await Inquirer.confirm("Download ?"))) return;

		console.log(`Start downloads (${cwd()}/${Config.downloadPath})`);
		await DownloadService.startDownload(
			anime.name,
			anime.seasonName,
			anime.episodes,
			anime.episodesUrls,
		);
	}
}

function main() {
	Cli.run();
}

main();
