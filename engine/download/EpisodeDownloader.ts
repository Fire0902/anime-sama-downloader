import fs from "node:fs/promises";
import fsSync from "node:fs";
import { spawn } from "node:child_process";
import cliProgress from "cli-progress";
import axios from "axios";
import BrowserPuppet from "../utils/BrowserPuppet.ts";
import Config from "../config/Config.ts";
import Log from "../utils/Log.ts";

/**
 *
 */
export default class EpisodeDownloader {
	private static readonly logger = Log.create(this.name);
	private static readonly multiBar = new cliProgress.MultiBar(
		{
			clearOnComplete: false,
			hideCursor: true,
			format: "{name} [{bar}] {percentage}%",
		},
		cliProgress.Presets.shades_classic
	);

	/**
   * Execute FFmpeg command to locally download a file from an URL.
	 * @param m3u8Url
	 * @param output
	 * @param bar
	 * @see https://ffmpeg.org/
	 */
	static runFFmpeg(m3u8Url: string, output: any, bar: any) {
		this.logger.info(`Running FFmpeg for: ${m3u8Url}`);

		return new Promise((resolve, reject) => {
			const ff = spawn("ffmpeg", ["-i", m3u8Url, "-codec", "copy", output]);

			ff.stderr.on("data", (data) => {
				const line = data.toString();
				const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);

				if (timeMatch && bar) {
					const hours = Number.parseInt(timeMatch[1]);
					const minutes = Number.parseInt(timeMatch[2]);
					const seconds = Number.parseFloat(timeMatch[3]);
					const current = hours * 3600 + minutes * 60 + seconds;
					bar.update(Math.floor(current));
				}
			});

			ff.on("close", () => {
				if (bar) bar.update(bar.getTotal());
				bar.stop();
				resolve(() => {});
			});

			ff.on("error", (err) => reject(err));
		});
	}

	/**
	 * Download an episode from vidmoly host
	 * @param rawVideoUrl
	 * @param episodeNumber
	 * @param seasonName
	 * @param animeName
	 */
	static async downloadEpisodeVidmoly(
		rawVideoUrl: string,
		episodeNumber: number,
		seasonName: string,
		animeName: string,
		retry: number = 0
	) {
		this.logger.info(
			`Downloading episode ${episodeNumber} from Vidmoly: ${rawVideoUrl}, retry n°${retry}`
		);

		const page = await BrowserPuppet.goto(rawVideoUrl);
		const htmlContent = await page.content();

		const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}/`;
		await fs.mkdir(folderPath, { recursive: true });

		const regex = /sources:\s*\[\{file:"([^"]+)"/;
		const match = htmlContent.match(regex);

		if (!match) {
			const episodeFormatedName = `Episode-${episodeNumber}`;
			    const filePath = `${Config.downloadPath}/${animeName}/${seasonName}/${episodeFormatedName}-${Date.now()}.${Config.downloadDefaultFormat}`;

			await fs.writeFile(filePath, htmlContent);
			await BrowserPuppet.requestTimeout(1000);
			BrowserPuppet.closePage(page);
			if (retry <= 5) {
				this.downloadEpisodeVidmoly(
					rawVideoUrl,
					episodeNumber,
					seasonName,
					animeName,
					retry + 1
				);
			}
			return;
		}

		const m3u8Url = match[1];

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

		const episodeFormatedName = `Episode-${episodeNumber}`;
		const seasonFormatedName = `${seasonName}/${episodeFormatedName}`;
		const animeFormatedName = `${animeName}/${seasonFormatedName}`;
		const filePath = `${Config.downloadPath}/${animeFormatedName}.${Config.downloadVideoFormat}`;

		const bar = this.multiBar.create(Math.floor(duration), 0, {
			name: seasonFormatedName,
		});
		await this.runFFmpeg(m3u8Url, filePath, bar);

		BrowserPuppet.closePage(page);
	}

	/**
	 * Download an episode from video-sibnet host
	 * @param rawVideoUrl
	 * @param episodeNumber
	 * @param seasonName
	 * @param animeName
	 */
	static async downloadEpisodeSibnet(
		rawVideoUrl: string,
		episodeNumber: number,
		seasonName: string,
		animeName: string
	) {
		this.logger.info(
			`Downloading episode ${episodeNumber} from Sibnet: ${rawVideoUrl}`
		);

		const page = await BrowserPuppet.goto(rawVideoUrl);

		const videoUrl = await page.evaluate(() => {
			const scripts = [...document.querySelectorAll("script")];
			for (let sc of scripts) {
				if (sc.textContent.includes("player.src")) {
					const match = sc.textContent.match(/src:\s*"\s*(.*?)\s*"/);
					if (match) return match[1];
				}
			}
			return null;
		});
		if (!videoUrl) {
			this.logger.error(`${Config.downloadDefaultFormat} video not found.`);
			BrowserPuppet.closePage(page);
			return;
		}
		BrowserPuppet.closePage(page);

		const finalUrl = Config.sibnetUrl + videoUrl;

		const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}`;

		const episodeFormatedName = `Episode-${episodeNumber}.${Config.downloadDefaultFormat}`;
		const seasonFormatedName = `${seasonName}/${episodeFormatedName}`;
		const animeFormatedName = `${animeName}/${seasonFormatedName}`;

		const filePath = `${folderPath}/${animeFormatedName}`;

		await fs.mkdir(`${folderPath}`, { recursive: true });
		await this.requestMP4(finalUrl, filePath, seasonFormatedName);
	}

	/**
	 *
	 * @param url
	 * @param outPath
	 * @param barName
	 * @returns
	 */
	static async requestMP4(url: string, outPath: string, barName = "Download") {
		const res = await axios.get(url, {
			responseType: "stream",
			headers: {
				"User-Agent": Config.userAgent,
				Referer: Config.sibnetUrl,
			},
		});

		const total = Number.parseInt(res.headers["content-length"], 10);

		let downloaded = 0;
		const bar = this.multiBar.create(total, 0, { name: barName });
		const writer = fsSync.createWriteStream(outPath);

		res.data.on("data", (chunk: any) => {
			downloaded += chunk.length;
			bar.update(downloaded);
		});
		res.data.pipe(writer);

		return new Promise((resolve) => {
			writer.on("finish", () => {
				bar.update(total);
				resolve(() => {});
			});
		});
	}
}
