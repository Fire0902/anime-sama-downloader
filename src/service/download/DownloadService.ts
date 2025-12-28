import Config from "../../config/Config.ts";
import Semaphore from "../../utils/web/Semaphore.ts";
import Puppeteer from "../../utils/web/Puppeteer.ts";
import Log from "../../utils/log/Log.ts";
import EpisodeDownloader from "./EpisodeDownloader.ts";

/**
 * Service for handling episode downloads
 */
export default class DownloadService {
	private static readonly logger = Log.create(this.name);
	
	private static readonly semaphore = new Semaphore(
		Config.maxSimultVideos
	);

	/**
	 * Start downloading anime episodes.
	 * @param animeName
	 * @param seasonName
	 * @param episodes
	 * @param urls
	 */
	static async startDownload(
		animeName: string,
		seasonName: string,
		episodes: number[],
		urls: [][]
	) {
		this.logger.info("Starting downloads");

		const tasks = [];
		for (const episode of episodes) {
			const episodeUrls: [] = [];
			for (const url of urls) {
				episodeUrls.push(url[episode - 1]);
			}
			tasks.push(
				this.download(episode, episodeUrls, seasonName, animeName)
			);
			await Puppeteer.timeout(Config.defaultTimeout);
		}
		await Promise.all(tasks);
		this.logger.info("End of downloads");
	}

	/**
	 * Acquire a worker and make it download a given episode.
	 * @param episodeNumber
	 * @param episodesUrls
	 * @param season
	 * @param anime
	 */
	static async download(
		episodeNumber: number,
		episodesUrls: any,
		season: string,
		anime: string
	) {
		await this.semaphore.acquire();
		try {
			const downloadCallback = await this.getEpisodeDownloader(episodesUrls);
			await downloadCallback(episodeNumber, season, anime);
		} catch (error) {
			this.logger.fatal(new Error(`Failed to download episode ${episodeNumber}: ${error}`));
		} finally {
			this.semaphore.release();
		}
	}

	/**
	 * Find the appropriate and not striked episode download method callback.
	 * @param {*} readers
	 * @returns a appropriate callback download method
	 */
	static async getEpisodeDownloader(readers: any) {
		for (const episode of readers) {
			const episodeUrl = episode.replace("to/", "net/");

			if (
				episodeUrl.includes("vidmoly") &&
				!(await this.isStrike(episodeUrl))
			) {
				return async (episodeNumber: number, season: string, anime: string) =>
					await EpisodeDownloader.downloadEpisodeVidmoly(
						episodeUrl,
						episodeNumber,
						season,
						anime
					);
			} else if (episodeUrl.includes("sibnet")) {
				return async (episodeNumber: number, season: string, anime: string) =>
					await EpisodeDownloader.downloadEpisodeSibnet(
						episodeUrl,
						episodeNumber,
						season,
						anime
					);
			}
			return () =>
				console.warn(
					`No appropriate media player found for episode: ${episodeUrl}`
				);
		}
		return () => console.warn("No appropriate media player found");
	}

	/**
	 * Verify if given url is striked.
	 * For Vidmoly only.
	 * @param url
	 */
	static async isStrike(url: string) {
		try {
			const page = await Puppeteer.goto(url);

			const strikeSelector = ".error-banner";
			const okSelectors = [".jw-video", ".jw-reset"];

			const result = await Promise.race([
				page
					.waitForSelector(strikeSelector, {
						timeout: Config.waitForSelectorTimeout,
					})
					.then(() => "strike")
					.catch(() => null),

				Promise.all(
					okSelectors.map((selector) =>
						page.waitForSelector(selector, {
							timeout: Config.waitForSelectorTimeout,
						})
					)
				)
                .then(() => "ok")
				.catch(() => null),
			]);
			return result !== "ok" && result === "strike";
		} catch (error) {
			this.logger.fatal(new Error(`${error}`));
			return true;
		}
	}
}
