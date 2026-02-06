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
		Config.isCLI = true;

		try {
			// ----- ANIMES -----

			let animeName: string = await Inquirer.input('Search an anime');

			const animes = await AnimeService.getAnimeTitlesFromSearch(animeName);
			const animeNames = Object.keys(animes);

			if (animeNames.length == 0) {
				this.logger.fatal(new Error(`No anime found from: ${animeName}`));
				return;
			}

			animeName = await Inquirer.select('Choose an anime', animeNames);

			// ----- SEASONS -----

			const seasonsPageUrl: string = animes[animeName];
			let seasons: any = await AnimeService.getSeasonsFromSearch(seasonsPageUrl);
			let seasonNames = Object.keys(seasons);

			if (seasons.length == 0 || seasonNames.length == 0) {
				this.logger.fatal(new Error(`No season found from: ${seasonsPageUrl}`));
				return;
			}

			let episodesUrls: any;
			let seasonUrl, seasonCompleteUrl, seasonName: string;
			let chosenEpisodesNumbers: number[];

			if (AnimeService.containsOnly(seasonNames, 'movie')) {
				this.logger.info(`${animeName} is a movie, skipping following steps.`);

				const animeCompleteUrl = animes[animeName] + "film/vostfr";
				episodesUrls = await AnimeService.getEpisodesFromSearch(animeCompleteUrl);
				await DownloadService.startDownload(animeName, "Film", [1], episodesUrls);
				return;
			}

			seasonNames = AnimeService.remove(seasonNames, 'scans');
			const removeMovies = await Inquirer.confirm('Remove movies ?');
			if (removeMovies) {
				seasonNames = AnimeService.remove(seasonNames, 'films');
			}

			seasonName = await Inquirer.select('Choose a season', seasonNames);

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

			this.display(animeName, seasonName, chosenEpisodesNumbers);
			if (!await Inquirer.confirm('Download ?')) return;

			console.log(`Start downloads (${cwd()}/${Config.downloadPath})`);
			await DownloadService.startDownload(
				animeName,
				seasonName,
				chosenEpisodesNumbers,
				episodesUrls
			);	
		} catch (error) {
			console.error(error); // must be in console interface
		} finally {
			await Puppeteer.close();
			stdin.pause();
			stdin.removeAllListeners();

			setTimeout(() => exit(0), 100);
			console.log('End of process');
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