import DownloadService from "../src/service/download/DownloadService.ts";
import AnimeService from "../src/service/anime/AnimeService.ts";
import Puppeteer from "../src/utils/web/Puppeteer.ts";
import Inquirer from "../src/utils/input/Inquirer.ts";
import Log from "../src/utils/log/Log.ts";
import Config from "../src/config/Config.ts";
import { cwd, stdin, exit } from 'node:process';

/**
 * Console-Lign Interface class.
 */
export default class Cli {
	private static readonly logger = Log.create(this.name, "pretty");

	/**
	 * Select all user inputs and fetch anime content from website,
	 * then download selected episodes.
	 */
	static async run() {
		console.log('~ Anime-sama Downloader CLI ~\n');
		console.log(`(Logs: ${cwd()}/${Config.logPath})\n`);
		Config.isCLIMode = true;

		try {
			// ----- ANIMES -----

			let search: string = await Inquirer.input('Search an anime');
			const animes = await AnimeService.getAnimeTitlesFromSearch(search);
			const animeNames = Object.keys(animes);

			if (animeNames.length == 0) {
				this.logger.fatal(new Error(`No anime found from: ${search}`));
				return;
			}

			let name = await Inquirer.select('Choose an anime', animeNames);
			const anime = new Anime(name);

			// ----- SEASONS ----- 

			const seasonsPageUrl: string = animes[anime.name];
			let seasons = await AnimeService.getSeasonsFromUrl(seasonsPageUrl);

			if (!seasons) {
				this.logger.fatal(new Error(`No season found from: ${seasonsPageUrl}`));
				return;
			}
			anime.seasons = seasons;
			console.log(anime);
			let seasonNames: string[] = Object.keys(seasons);

			let seasonUrl, seasonCompleteUrl, seasonName: string;
			let chosenEpisodesNumbers: number[];
			let episodesUrls: any;

			if (AnimeService.containsOnly(seasonNames, 'movie')) {
				this.logger.info(`${name} is a movie, skipping following steps.`);

				const animeCompleteUrl = animes[name] + "film/vostfr";
				episodesUrls = await AnimeService.getEpisodesFromSearch(animeCompleteUrl);
				await DownloadService.startDownload(name, "Film", [1], episodesUrls);
				return;
			}

			seasonNames = AnimeService.remove(seasonNames, 'scans');
			const removeMovies = await Inquirer.confirm('Remove movies ?');
			if (removeMovies) {
				seasonNames = AnimeService.remove(seasonNames, 'films');
			}
			seasonName = await Inquirer.select('Choose a season', seasonNames);

			seasonUrl = seasons[seasonName];
			seasonCompleteUrl = `${animes[name]}/${seasonUrl}`;
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

			this.display(name, seasonName, chosenEpisodesNumbers);
			if (!await Inquirer.confirm('Download ?')) return;

			console.log(`Start downloads (${cwd()}/${Config.downloadPath})`);
			await DownloadService.startDownload(
				name,
				seasonName,
				chosenEpisodesNumbers,
				episodesUrls
			);
		} catch (error) {
			this.logger.error(`${error}`); // must be in console interface
		} finally {
			await Puppeteer.close();
			stdin.pause();
			stdin.removeAllListeners();

			setTimeout(() => exit(0), 100);
			console.log('CLI process end.');
		}
	}

	/**
     * @param name 
     * @param season 
     * @param episodes 
     */
    private static display(name: string, season: string, episodes: number[]) {
        console.log(`\n----- ${name} -----\n`);
        console.log(season);
        console.table(`Episodes [${episodes}]`);
        console.log(`\n------------------\n`);
    }
}

function main(){
	Cli.run();
}

main();