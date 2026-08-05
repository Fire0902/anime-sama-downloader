import Config from "../../../config/Config.ts";
import Puppeteer from "../../../utils/web/Puppeteer.ts";
import fs from "node:fs/promises";
import FFmpegTask from "../task/FFmpegTask.ts";
import Log from "../../../utils/log/Log.ts";
import cliProgress from "cli-progress";
import { spawn } from "node:child_process";
import ProgressManager from "../ProgressManager.ts";
import { BaseDownloader } from "./BaseDownloader.ts";


export default class VidmolyDownloader extends BaseDownloader {

	/**
	 * Test purement syntaxique, sans accès réseau.
	 *
	 * Cette méthode répond à « sais-tu traiter cette URL ? », pas à « cette
	 * vidéo est-elle disponible ? ». Elle appelait auparavant isStrike(), qui
	 * ouvre une page Puppeteer : un timeout ou une page lente faisait alors
	 * écarter une URL parfaitement valide, de façon variable selon la charge
	 * du serveur. Un strike réel reste détecté à l'extraction, qui ne rend
	 * aucun m3u8 et laisse la main à l'URL suivante.
	 */
	async canHandle(url: string): Promise<boolean> {
		return url.includes("vidmoly");
	}

	async extractM3U8(readerUrl: string): Promise<string | null> {
		if (!readerUrl.includes("vidmoly")) {
			throw new Error("Only Vidmoly supported");
		}

		// networkidle2 requis : JWPlayer est chargé via script externe,
		// il ne sera disponible qu'après que le réseau se soit calmé
		const page = await Puppeteer.goto(readerUrl);

		const m3u8Url = await page.evaluate(() => {
			if ((window as any).jwplayer) {
				const player = (window as any).jwplayer("vplayer");
				const sources = player.getPlaylist?.()?.[0]?.sources;
				return sources?.[0]?.file || null;
			}
			return null;
		});

		await Puppeteer.closePage(page);
		return m3u8Url;
	}

	/**
	 * Download an episode from vidmoly host
	 * @param rawVideoUrl
	 * @param episodeNumber
	 * @param seasonName
	 * @param animeName
	 */
	async createDownloadTask(
		rawVideoUrl: string,
		episodeNumber: number,
		seasonName: string,
		animeName: string,
		retry: number = 0,
		customPath?: string
	): Promise<FFmpegTask | undefined> {
		this.logger.info(
			`Downloading episode ${episodeNumber} from Vidmoly: ${rawVideoUrl}, retry n°${retry}`
		);

		const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}/`;
		await fs.mkdir(folderPath, { recursive: true });

		const m3u8Url = await this.extractM3U8(rawVideoUrl);

		if (!m3u8Url) {
			const episodeFormatedName = `Episode-${episodeNumber}`;
			const filePath = `${Config.downloadPath}/${animeName}/${seasonName}/${episodeFormatedName}-${Date.now()}.${Config.downloadDefaultFormat}`;

			await fs.writeFile(filePath, "error while attempting to get url");
			await Puppeteer.timeout(retry * 100);
			if (retry <= 5) {
				return await this.createDownloadTask(
					rawVideoUrl,
					episodeNumber,
					seasonName,
					animeName,
					retry + 1
				);
			}
			return;
		}

		const { filePath, seasonFormatedName } = this.buildFilePath(
			animeName,
			seasonName,
			episodeNumber,
			customPath
		);

		return new FFmpegTask(m3u8Url, filePath);
	}

	/**
	 * Download an episode from vidmoly host
	 * @param rawVideoUrl
	 * @param episodeNumber
	 * @param seasonName
	 * @param animeName
	 */
	async downloadEpisode(
		rawVideoUrl: string,
		episodeNumber: number,
		seasonName: string,
		animeName: string,
		retry: number = 0,
		customPath?: string
	): Promise<void> {
		this.logger.info(
			`Downloading episode ${episodeNumber} from Vidmoly: ${rawVideoUrl}, retry n°${retry}`
		);

		const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}/`;
		await fs.mkdir(folderPath, { recursive: true });

		const m3u8Url = await this.extractM3U8(rawVideoUrl);

		if (!m3u8Url) {
			const episodeFormatedName = `Episode-${episodeNumber}`;
			const filePath = `${Config.downloadPath}/${animeName}/${seasonName}/${episodeFormatedName}-${Date.now()}.${Config.downloadDefaultFormat}`;

			await fs.writeFile(filePath, "error while attempting to get url");
			await Puppeteer.timeout(retry * 100);
			if (retry <= 5) {
				return await this.downloadEpisode(
					rawVideoUrl,
					episodeNumber,
					seasonName,
					animeName,
					retry + 1
				);
			}
			return;
		}

		const totalDuration = await this.getTotalDuration(m3u8Url);

		const { filePath, seasonFormatedName } = this.buildFilePath(
			animeName,
			seasonName,
			episodeNumber,
			customPath
		);

		const bar = ProgressManager.create(totalDuration, seasonFormatedName);

		await this.runFFmpeg(m3u8Url, filePath, bar);

	}

	/**
   * Execute FFmpeg command to locally download a file from an URL.
	 * @param m3u8Url
	 * @param output
	 * @param bar
	 * @see https://ffmpeg.org/
	 */
	runFFmpeg(
		m3u8Url: string,
		output: string,
		bar: any
	) {
		this.logger.info(`Running FFmpeg for: ${m3u8Url}`);

		return new Promise((resolve, reject) => {
			const task = new FFmpegTask(m3u8Url, output);

			task.on("duration", (totalDuration: number) => {
				if (bar) bar.setTotal(Math.floor(totalDuration));
			});

			task.on("progress", (current: number, total: number) => {
				if (bar) bar.update(Math.floor(current));
			});

			task.on("done", (success: boolean) => {
				if (bar) bar.update(bar.getTotal());
				if (bar) bar.stop();
				success ? resolve(undefined) : reject(new Error("FFmpeg failed"));
			});

			task.on("error", (err: any) => {
				if (bar) bar.stop();
				reject(err);
			});

			task.start();
		});
	}

	private async getTotalDuration(m3u8Url: string) {
		const ffprobe = spawn("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"default=noprint_wrappers=1:nokey=1",
			m3u8Url,
		]);

		let duration = 0;
		ffprobe.stdout.on("data", (data) => {
			duration = Number.parseFloat(data.toString());
		});

		await new Promise((resolve) => ffprobe.on("close", resolve));

		if (!duration || isNaN(duration) || duration <= 0) {
			this.logger.warn(`Invalid duration: ${duration}, using default`);
			duration = 1;
		}
		return duration;
	}

	/**
	* Verify if given url is striked.
	* For Vidmoly only.
	* @param url
	*/
	async isStrike(url: string) {
		// networkidle2 requis — les sélecteurs JWPlayer sont générés par un script externe
		const page = await Puppeteer.goto(url);
		try {
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
		} finally {
			await Puppeteer.closePage(page);
		}
	}

	getDownloaderName(): string{
        return "Vidmoly";
    }
}