import Config from "../../config/Config.ts";
import Semaphore from "../../utils/web/Semaphore.ts";
import Puppeteer from "../../utils/web/Puppeteer.ts";
import Log from "../../utils/log/Log.ts";
import { DownloaderFactory } from "./factory/DownloaderFactory.ts";

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
			const episodeUrls: string[] = [];
			for (const url of urls) {
				episodeUrls.push(url[episode - 1]);
			}
			tasks.push(
				this.download(episode, episodeUrls, seasonName, animeName)
			);
			await Puppeteer.timeout(Config.downloadTimeout);
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
			await this.tryDownloadFromSources(
				episodesUrls,
				episodeNumber,
				season,
				anime
			);
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
	static async tryDownloadFromSources(
		readers: any,
		episodeNumber: number,
		season: string,
		anime: string
	) {
		for (const episode of readers) {
			const episodeUrl = episode.replace("to/", "net/");

			const downloader = await DownloaderFactory.get(episodeUrl);

			if(downloader){
				await downloader
					.downloadEpisode(
						episodeUrl,
						episodeNumber,
						season,
						anime
					);
				return;
			}else{
				this.logger.fatal(`No appropriate media player found for episode: ${episodeUrl}`);
			}
		}
	}
}
