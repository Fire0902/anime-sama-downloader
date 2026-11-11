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
	 * Hôtes servis par le lecteur Vidmoly. `ansembed.net` est le domaine qu'il
	 * utilise sur anime-sama, qui l'annonce lui-même comme « Vidmoly ».
	 */
	private static readonly HOSTS = ["vidmoly", "ansembed.net"];

	/** Le manifeste, tel que la page d'embed rend sa configuration JWPlayer. */
	private static readonly SOURCE_PATTERN = /sources:\s*\[\s*\{[^}]*?file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i;

	/** Repli : n'importe quelle URL de manifeste présente dans la page. */
	private static readonly M3U8_PATTERN = /https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i;

	/**
	 * Vrai si le lecteur Vidmoly sert cette URL.
	 *
	 * Exposé en statique pour les appelants qui testaient « vidmoly » au
	 * hasard d'un includes() et laissaient donc filer les URLs ansembed.net.
	 */
	static handles(url: string): boolean {
		return typeof url === "string"
			&& VidmolyDownloader.HOSTS.some(host => url.toLowerCase().includes(host));
	}

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
		return VidmolyDownloader.handles(url);
	}

	/**
	 * Récupère le manifeste m3u8 de l'épisode.
	 *
	 * La page d'embed rend sa configuration JWPlayer côté serveur : une simple
	 * requête HTTP suffit, sans en-tête particulier, et c'est désormais la
	 * seule voie qui aboutisse. L'hôte répond à un navigateur automatisé par
	 * une page creuse — un conteneur d'iframe vide, sans JWPlayer ni balise
	 * vidéo — donc la lecture de `jwplayer("vplayer").getPlaylist()` ne rendait
	 * plus rien. Elle reste en recours si le rendu redevenait dynamique.
	 */
	async extractM3U8(readerUrl: string): Promise<string | null> {
		if (!VidmolyDownloader.handles(readerUrl)) {
			throw new Error("Only Vidmoly supported");
		}

		const fromHtml = await this.extractFromHtml(readerUrl);
		if (fromHtml) return fromHtml;

		this.logger.warn(`Aucun m3u8 dans le HTML de ${readerUrl}, tentative via le lecteur`);
		return this.extractFromPlayer(readerUrl);
	}

	/** Lecture du manifeste dans le HTML de la page d'embed, sans navigateur. */
	private async extractFromHtml(readerUrl: string): Promise<string | null> {
		try {
			const response = await fetch(readerUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
				},
				signal: AbortSignal.timeout(20000),
			});

			if (!response.ok) {
				this.logger.warn(`HTTP ${response.status} sur la page d'embed : ${readerUrl}`);
				return null;
			}

			const html = await response.text();
			const file = html.match(VidmolyDownloader.SOURCE_PATTERN)?.[1]
				?? html.match(VidmolyDownloader.M3U8_PATTERN)?.[0];

			// Le lien vit dans un <script>, donc non échappé ; par précaution
			// si la page venait à le rendre dans un attribut.
			return file ? file.replace(/&amp;/g, "&") : null;
		} catch (e) {
			this.logger.warn(`Requête HTTP échouée sur ${readerUrl} : ${e instanceof Error ? e.message : e}`);
			return null;
		}
	}

	/** Ancienne voie : interroger l'instance JWPlayer dans la page. */
	private async extractFromPlayer(readerUrl: string): Promise<string | null> {
		// networkidle2 requis : JWPlayer est chargé via script externe,
		// il ne sera disponible qu'après que le réseau se soit calmé
		const page = await Puppeteer.goto(readerUrl);
		try {
			return await page.evaluate(() => {
				if ((window as any).jwplayer) {
					const player = (window as any).jwplayer("vplayer");
					const sources = player.getPlaylist?.()?.[0]?.sources;
					return sources?.[0]?.file || null;
				}
				return null;
			});
		} finally {
			await Puppeteer.closePage(page);
		}
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