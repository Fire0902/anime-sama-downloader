import Config from '../../../config/Config.ts';
import FFmpegTask from '../task/FFmpegTask.ts';
import Log from '../../../utils/log/Log.ts';
import ProgressManager from '../ProgressManager.ts';
import { BaseDownloader } from './BaseDownloader.ts';
import VidmolyDownloader from './VidmolyDownloader.ts';
import fs from 'node:fs/promises';

/**
 * Downloader for raw m3u8 / HLS stream URLs entered manually.
 * Passes the URL directly to FFmpeg without any intermediate scraping step.
 */
export default class DirectM3U8Downloader extends BaseDownloader {

    async canHandle(url: string): Promise<boolean> {
        return url.includes('.m3u8');
    }

    async extractM3U8(rawVideoUrl: string): Promise<string | null> {
        return rawVideoUrl;
    }

    async createDownloadTask(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        _retry: number = 0,
        customPath?: string
    ): Promise<FFmpegTask | undefined> {
        this.logger.info(`Creating direct m3u8 task for episode ${episodeNumber}: ${rawVideoUrl}`);

        const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}/`;
        await fs.mkdir(folderPath, { recursive: true });

        const { filePath } = this.buildFilePath(animeName, seasonName, episodeNumber, customPath);
        return new FFmpegTask(rawVideoUrl, filePath);
    }

    async downloadEpisode(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        _retry: number = 0,
        customPath?: string
    ): Promise<void> {
        this.logger.info(`Direct m3u8 download episode ${episodeNumber}: ${rawVideoUrl}`);

        const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}/`;
        await fs.mkdir(folderPath, { recursive: true });

        const { filePath, seasonFormatedName } = this.buildFilePath(animeName, seasonName, episodeNumber, customPath);
        const bar = ProgressManager.create(1, seasonFormatedName);
        await new VidmolyDownloader().runFFmpeg(rawVideoUrl, filePath, bar);
    }

    async isStrike(_url: string): Promise<boolean> {
        return false;
    }

    getDownloaderName(): string {
        return 'DirectM3U8';
    }
}
