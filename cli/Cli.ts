import DownloadService from "../engine/download/DownloadService.ts";
import AnimeService from "../engine/anime/AnimeService.ts";
import BrowserPuppet from "../engine/utils/BrowserPuppet.ts";
import Inquirer from "../engine/input/Inquirer.ts";
import Log from "../engine/utils/Log.ts";
import AnimeEntity from "../entity/AnimeEntity.ts";
import SeasonEntity from "../entity/SeasonEntity.ts";
import EpisodeEntity from "../entity/EpisodeEntity.ts";
import Comparator from "../engine/input/Comparator.ts";
import EpisodeUrlEntity from "../entity/EpisodeUrlEntity.ts";
import Config from "../engine/config/Config.ts";

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
		const EpisodeUrlRepo = new EpisodeUrlEntity();
		const useCache = Config.useCache;
		try {
			// ----- ANIMES -----

			let animeName: string = await Inquirer.input(`Search an anime`);

			const cacheAnimes = AnimeRepo.find({ name: animeName });

			// I can't be bothered to do it now but all this logic could be in AnimeService.ts
			let animes: Record<string, string> = {};

			if (cacheAnimes.length > 6 && useCache) {
				animes = AnimeRepo.arrayToRecord(cacheAnimes, "name", "url");
			} else {
				animes = await AnimeService.getAnimeTitlesFromSearch(animeName);
				if(useCache){
					for (const [anime, url] of Object.entries(animes)) {
						AnimeRepo.insert({
							name: anime,
							url: url
						})
					}
				}
			}
			// in the future we will make an algorithm to predict if use cache is worth it or useless
			// const temp = Comparator.compareAnimes(animeName, AnimeRepo.recordToAnimeArray(animes));
			// console.log(temp);
			const animeNames = Object.keys(animes);
			if (animeNames.length == 0) {
				this.logger.error(`No anime found from name: ${animeName}`);
				return;
			}

			animeName = await Inquirer.select(`Choose an anime`, animeNames);

			// ----- SEASONS -----
			const { id: idAnime } = AnimeRepo.find({ name: animeName })[0];

			const cacheSeasons = SeasonRepo.find({ anime_id: idAnime });

			const seasonsPageUrl: string = animes[animeName];

			let isExtractFromCache = false;

			let seasons: Record<string, string | null> | never[];

			if (cacheSeasons.length > 0 && useCache) {
				seasons = SeasonRepo.arrayToRecord(cacheSeasons, "name", "url");
				isExtractFromCache = true;
			} else {
				seasons = await AnimeService.getSeasonsFromSearch(seasonsPageUrl);
			}

			let seasonNames = Object.keys(seasons);

			if (seasons.length == 0 || seasonNames.length == 0) {
				this.logger.error(`No season found from search url: ${seasonsPageUrl}`);
				return;
			}

			let episodesUrls: any = [[], [], []];
			let seasonUrl, seasonCompleteUrl, seasonName: string | null;
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
			if (!isExtractFromCache && useCache) {
				for (const [seasonString, url] of Object.entries(seasons)) {
					if (!seasonString.toLowerCase().includes("scans")) {
						SeasonRepo.insert({
							anime_id: idAnime,
							name: seasonString,
							url: url ?? undefined,
							season_index: seasonNames.indexOf(seasonString)
						});
					}
				}
			} else {
				// TODO else where even if we used cache make a request to anime sama BUT DON'T await to refresh season's list just in case
			}


			const removeMovies = await Inquirer.confirm(`Remove movies ?`);
			if (removeMovies) {
				seasonNames = AnimeService.removeMoviesFromSeasons(seasonNames);
			}

			seasonName = await Inquirer.select(`Choose a season`, seasonNames);
			if (!Array.isArray(seasons)) {
				seasonUrl = seasons[seasonName];
			} else {
				throw new Error("Seasons is unexpectedly an array");
			}

			const isLastSeason = seasonNames[seasonNames.length - 1] == seasonName;
			seasonCompleteUrl = animes[animeName] + seasonUrl;
			console.log(seasonCompleteUrl);

			// ----- EPISODES -----

			/* 
			for the episodes the logic will change a bit, because new episodes can comes out every week it means cache is not worth it for last season
			if the user choose the last season then we request to anime sama else we use cache (if cache is fill)
			in the future we could make somethink even better like calling anime_list API to know if an anime is finish with that method if it's the last season
			but the anime is finish then we use the cache but for know we only do the first method
			*/

			const { id: idSeason } = SeasonRepo.find({ name: seasonName })[0];

			const cacheEpisodes = EpisodeRepo.find({ season_id: idSeason })
			if (cacheEpisodes.length > 0 && !isLastSeason && useCache) {
				for (const episode of cacheEpisodes) {
					const readersEpisode = EpisodeUrlRepo.find({ episode_id: episode.id });
					for (const readerEpisode of readersEpisode) {
						episodesUrls[readersEpisode.indexOf(readerEpisode)].push(readerEpisode.url);
					}
				}
			} else {
				episodesUrls = await AnimeService.getEpisodesFromSearch(seasonCompleteUrl);
				// hate this code but it works
				if(useCache){
					const tempReader = episodesUrls[0];
					for (const ep of tempReader) {
						EpisodeRepo.insert({
							season_id: idSeason,
							episode_index: tempReader.indexOf(ep),
						});
					}
					for (const reader of episodesUrls) {
						const episodesId = EpisodeRepo.find({ season_id: idSeason });
						let idReader: number;
						if (reader[0].toLowerCase().includes("vidmoly")) {
							idReader = 1;
						} else if (reader[0].toLowerCase().includes("sibnet")) {
							idReader = 2;
						} else {
							idReader = 3;
						}
						for (const episode of reader) {
							EpisodeUrlRepo.insert({
								episode_id: episodesId.at(reader.indexOf(episode))?.id,
								player_id: idReader,
								url: episode
							});
						}
					}
				}
			}
			if (episodesUrls[0].length == 0) {
				this.logger.error(`No episode found from season url: ${seasonCompleteUrl}`);
				return;
			}

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

function main() {
	Cli.run();
}

main();