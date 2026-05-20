import fs from "node:fs/promises";
import { BaseDownloader } from "./BaseDownloader.ts";
import Config from "../../../config/Config.ts";
import ProgressManager from "../ProgressManager.ts";
import AxiosTask from "../task/AxiosTask.ts";
import Puppeteer from "../../../utils/web/Puppeteer.ts";

export default class SendVidDownloader extends BaseDownloader {
    async canHandle(url: string): Promise<boolean> {
        return /sendvid\.com|videos\d*\.sendvid\.com/i.test(url);
    }

    private decodeHtmlEntities(value: string): string {
        return value.replace(/&amp;/g, "&");
    }

    async extractM3U8(rawVideoUrl: string): Promise<string | null> {
        if (/^https?:\/\/videos\d*\.sendvid\.com\/.+\.mp4(\?.*)?$/i.test(rawVideoUrl)) {
            return rawVideoUrl;
        }

        const page = await Puppeteer.goto(rawVideoUrl);

        const videoUrl = await page.evaluate(() => {
            const sourceById = document.querySelector('source[id="video_source"]') as HTMLSourceElement;
            if (sourceById?.src) return sourceById.src;

            const sourceGeneric = document.querySelector('source[src*=".mp4"]') as HTMLSourceElement;
            if (sourceGeneric?.src) return sourceGeneric.src;

            const ogVideo = document.querySelector('meta[property="og:video"], meta[property="og:video:secure_url"]');
            if (ogVideo?.getAttribute("content")) return ogVideo.getAttribute("content");

            return null;
        });

        if (!videoUrl) {
            const title = await page.title().catch(() => 'unknown');
            console.log(`[SendVid] extractM3U8 failed — page title: "${title}", url: ${rawVideoUrl}`);
        }

        await Puppeteer.closePage(page);
        return videoUrl ? this.decodeHtmlEntities(videoUrl) : null;
    }

    async createDownloadTask(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        retry: number = 0,
        customPath?: string
    ): Promise<AxiosTask | undefined> {
        this.logger.info(`Downloading episode ${episodeNumber} from SendVid: ${rawVideoUrl}`);

        const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}`;
        await fs.mkdir(folderPath, { recursive: true });

        const finalUrl = await this.extractM3U8(rawVideoUrl);

        if (!finalUrl) {
            this.logger.fatal(new Error("SendVid video not found."));
            return;
        }

        const { filePath } = this.buildFilePath(animeName, seasonName, episodeNumber, customPath);

        return new AxiosTask(finalUrl, filePath);
    }

    async downloadWithTask(
        url: string,
        outputPath: string,
        barName: string
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const task = new AxiosTask(url, outputPath);

            let bar: any;

            task.on("start", ({ total }) => {
                bar = ProgressManager.create(total, barName);
            });

            task.on("progress", (downloaded: number) => {
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

    async downloadEpisode(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        retry: number = 0,
        customPath?: string
    ): Promise<void> {
        this.logger.info(`Downloading episode ${episodeNumber} from SendVid: ${rawVideoUrl}`);

        const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}`;
        await fs.mkdir(folderPath, { recursive: true });

        const finalUrl = await this.extractM3U8(rawVideoUrl);

        if (!finalUrl) {
            this.logger.fatal(new Error("SendVid video not found."));
            return;
        }

        const { filePath, seasonFormatedName } = this.buildFilePath(animeName, seasonName, episodeNumber, customPath);

        await this.downloadWithTask(finalUrl, filePath, seasonFormatedName);
    }

    async isStrike(url: string): Promise<boolean> {
        return false;
    }

    getDownloaderName(): string {
        return "SendVid";
    }
}