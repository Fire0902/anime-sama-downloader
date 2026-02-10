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
	private static async updateAnime(): Promise<Anime> {
		const search: string = await Inquirer.input("Search an anime");

		const animesUrls = await AnimeService.getBySearch(search);
		const animeTitles = Object.keys(animesUrls);
		if (animeTitles.length == 0) {
			const error = new Error(`No result found for: ${search}`);
			this.logger.fatal(error);
			throw error;
		}

		const name = await Inquirer.select("Select an anime", animeTitles);
		const url = animesUrls[name];

		return new Anime(name, url);
	}

	/**
	 */
	private static async updateSeason(anime: Anime): Promise<Anime> {

		const seasons = await AnimeService.getSeasonsByUrl(anime);
		if (!seasons) {
			const error = new Error(`No season found from: ${anime.url}`);
			this.logger.fatal(error);
			throw error;
		}

		if (AnimeService.isMovie(anime)) {
			await this.startMovieDownload(anime);
		}
		
		if (await Inquirer.confirm("Remove movies ?")) {
			anime.seasonNames = AnimeService.remove(anime.seasonNames, "films");
		}

		anime.chosenSeason = await Inquirer.select("Choose a season", anime.seasonNames);
		anime.chosenSeasonUrl = anime.seasons[anime.chosenSeason];
		return anime;
	}

	private static async updateEpisodes(anime: Anime): Promise<Anime> {
		const seasonUrl = anime.url + anime.chosenSeasonUrl;
		anime.episodesUrls = await AnimeService.getEpisodesByUrl(seasonUrl);

		if (anime.episodesUrls[0].length == 0) {
			const error = new Error(`No episode found from season url: ${seasonUrl}`);
			this.logger.fatal(error);
			throw error;
		}

		anime.chosenEpisodes = await Inquirer.numbers(
			`Choose one or multiple episodes (Ex: 1,2,3-7,8) [1-${anime.episodesUrls[0].length}]`,
		);
		return anime;
	}

	private static async startMovieDownload(anime: Anime){
		console.log("Movie detected");
		anime.episodesUrls = await AnimeService.getEpisodesByUrl(anime.url + "film/vostfr");
		anime.chosenSeason = "Film";
		anime.chosenEpisodes = [1];

		await this.startDownload(anime);
		exit();
	}

	private static async startDownload(anime: Anime){
		console.log(anime.toString());
		if (!await Inquirer.confirm("Download ?")) return;

		console.log(`Downloading... (${cwd()}/${Config.downloadPath})`);
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
