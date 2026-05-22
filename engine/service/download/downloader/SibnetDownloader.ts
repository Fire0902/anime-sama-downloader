import fs from "node:fs/promises";
import Puppeteer from "../../../utils/web/Puppeteer.ts";
import Config from "../../../config/Config.ts";
import axios from "axios";
import fsSync from "node:fs";
import { BaseDownloader } from "./BaseDownloader.ts";
import ProgressManager from "../ProgressManager.ts";
import AxiosTask from "../task/AxiosTask.ts";



export default class SibnetDownloader extends BaseDownloader {

	static readonly videoHostAdress = "https://video.sibnet.ru";

	async canHandle(url: string): Promise<boolean> {
		return url.includes("sibnet");
	}

	async extractM3U8(rawVideoUrl: string): Promise<string | null> {
		// gotoFast bloque images/CSS/fonts — le script player.src est inline dans le HTML
		const page = await Puppeteer.gotoFast(rawVideoUrl, "domcontentloaded");

		const videoUrl = await page.evaluate(() => {
			const scripts = [...document.querySelectorAll("script")];
			for (const sc of scripts) {
				if (sc.textContent?.includes("player.src")) {
					const match = sc.textContent.match(/src:\s*"\s*(.*?)\s*"/);
					if (match) return match[1];
				}
			}
			return null;
		});

		if (!videoUrl) {
			const title = await page.title();
			console.log(`[Sibnet] extractM3U8 failed — page title: "${title}", url: ${rawVideoUrl}`);
		}

		await Puppeteer.closePage(page);
		return videoUrl;
	}

	/**
	 * Download an episode from video-sibnet host
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
	): Promise<AxiosTask | undefined> {
		this.logger.info(
			`Downloading episode ${episodeNumber} from Sibnet: ${rawVideoUrl}`
		);

		const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}`;
		await fs.mkdir(`${folderPath}`, { recursive: true });

		const m3u8Url = await this.extractM3U8(rawVideoUrl);

		if (!m3u8Url) {
			this.logger.fatal(new Error(`${Config.downloadDefaultFormat} video not found.`));
			return;
		}

		const finalUrl = SibnetDownloader.videoHostAdress + m3u8Url;


		const { filePath, seasonFormatedName } = this.buildFilePath(
			animeName,
			seasonName,
			episodeNumber,
			customPath
		);

		return new AxiosTask(finalUrl, filePath, SibnetDownloader.videoHostAdress);
	}

	/**
	 * Download an episode from video-sibnet host
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
	) {
		this.logger.info(
			`Downloading episode ${episodeNumber} from Sibnet: ${rawVideoUrl}`
		);

		const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}`;
		await fs.mkdir(`${folderPath}`, { recursive: true });

		const m3u8Url = await this.extractM3U8(rawVideoUrl);

		if (!m3u8Url) {
			this.logger.fatal(new Error(`${Config.downloadDefaultFormat} video not found.`));
			return;
		}

		const finalUrl = SibnetDownloader.videoHostAdress + m3u8Url;


		const { filePath, seasonFormatedName } = this.buildFilePath(
			animeName,
			seasonName,
			episodeNumber,
			customPath
		);

		await this.downloadWithTask(finalUrl, filePath, seasonFormatedName);
	}

	async downloadWithTask(
		url: string, 
		outputPath: string, 
		barName: string
	): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const task = new AxiosTask(url, outputPath, SibnetDownloader.videoHostAdress);

			let bar: any;

			task.on("start", ({ total }) => {
				bar = ProgressManager.create(total, barName);
			});

			task.on("progress", (downloaded: number, total: number) => {
				if (bar) bar.update(downloaded);
			});

			task.on("done", () => {
				if (bar) bar.update(bar.total);
				resolve();
			});

			task.on("error", (err) => {
				this.logger.error(err);
				reject(err);
			});

			task.start();
		});
	}

	async isStrike(url: string): Promise<boolean> {
		"TODO"
		return false;
	}

	getDownloaderName(): string {
		return "Sibnet";
	}
}