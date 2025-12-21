import DownloadService from "../engine/download/DownloadService.ts";
import AnimeService from "../engine/anime/AnimeService.ts";
import BrowserPuppet from "../engine/utils/BrowserPuppet.ts";
import Inquirer from "../engine/input/Inquirer.ts";
import Log from "../engine/utils/Log.ts";
import AnimeEntity from "../entity/AnimeEntity.ts";
import SeasonEntity from "../entity/SeasonEntity.ts";
import EpisodeEntity from "../entity/EpisodeEntity.ts";
import Comparator from "../engine/input/Comparator.ts";

/**
 * Client-Lign Interface class.
 */
class Cli {
	private static readonly logger = Log.create(this.name);

	/**
	 * Select all user inputs and fetch anime content from website,
	 * then download selected videos.
	 */
	static async run() {
		this.logger.info(`Starting CLI at: ${new Date().toDateString()}`);
		console.log(`~ Anime-sama Downloader CLI ~\n`);

		const AnimeRepo = new AnimeEntity();
		const SeasonRepo = new SeasonEntity();
		const EpisodeRepo = new EpisodeEntity();

		try {
			// ----- ANIMES -----

			let animeName: string = await Inquirer.input(`Search an anime`);

			const animes = await AnimeService.getAnimeTitlesFromSearch(animeName);

			for(const [anime, url] of Object.entries(animes)){
				AnimeRepo.insert({
					name: anime,
					url: url
				})
			}
			const temp = Comparator.compareAnimes(animeName, AnimeRepo.recordToAnimeArray(animes));
			console.log(temp);
			const animeNames = Object.keys(animes);

			if (animeNames.length == 0) {
				this.logger.error(`No anime found from name: ${animeName}`);
				return;
			}

			animeName = await Inquirer.select(`Choose an anime`, animeNames);

			// ----- SEASONS -----

			const seasonsPageUrl: string = animes[animeName];
			let seasons: any = await AnimeService.getSeasonsFromSearch(seasonsPageUrl);
			let seasonNames = Object.keys(seasons);

			if (seasons.length == 0 || seasonNames.length == 0) {
				this.logger.error(`No season found from search url: ${seasonsPageUrl}`);
				return;
			}

			let episodesUrls: any;
			let seasonUrl, seasonCompleteUrl, seasonName: string;
			let chosenEpisodesNumbers: number[];

			if (AnimeService.isMovie(seasonNames)) {
				this.logger.info(`${animeName} is a movie, skipping seasons and episodes steps.`);

				const animeCompleteUrl = animes[animeName] + "film/vostfr";
				episodesUrls = await AnimeService.getEpisodesFromSearch(animeCompleteUrl);

				await BrowserPuppet.close();
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
			seasonCompleteUrl = animes[animeName] + seasonUrl;
			episodesUrls = await AnimeService.getEpisodesFromSearch(seasonCompleteUrl);

			if (episodesUrls[0].length == 0) {
				this.logger.error(`No episode found from season url: ${seasonCompleteUrl}`);
				return;
			}

			// ----- EPISODES -----

			chosenEpisodesNumbers = await Inquirer.numbers(
				`Choose one or multiple episodes (Ex: 1,2,4-5,8,9-12) [1-${episodesUrls[0].length}]`
			);

			AnimeService.displayAnime(animeName, seasonName, chosenEpisodesNumbers);
			const isDownloadAgreed = await Inquirer.confirm(`Start download ?`);
			if (!isDownloadAgreed) return;

			await DownloadService.startDownload(
				animeName,
				seasonName,
				chosenEpisodesNumbers,
				episodesUrls
			);
		} catch (error) {
			this.logger.error(`Error during CLI process: ${error}`);
		} finally {
			await BrowserPuppet.close();
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