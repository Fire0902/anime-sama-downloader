import Config from '../../../config/Config.ts';
import Puppeteer from '../../../utils/web/Puppeteer.ts';
import VoirAnimeScrapper from '../../../providers/voir-anime/VoirAnimeScrapper.ts';
import VidmolyDownloader from './VidmolyDownloader.ts';
import FFmpegTask from '../task/FFmpegTask.ts';
import Log from '../../../utils/log/Log.ts';
import ProgressManager from '../ProgressManager.ts';
import { BaseDownloader } from './BaseDownloader.ts';
import fs from 'node:fs/promises';

/**
 * Downloader for voir-anime.to and voir-drama.to episode pages.
 *
 * Flow:
 *   1. Navigate to the voir-anime episode page URL
 *   2. Extract the vidmoly embed iframe src
 *   3. Delegate to VidmolyDownloader to get the m3u8 and download via FFmpeg
 */
export default class VoirAnimeDownloader extends BaseDownloader {

    async canHandle(url: string): Promise<boolean> {
        // Handles voir-anime.to episode pages AND voirdrama.to episode pages
        return url.includes('voir-anime.to') || url.includes('voir-drama') || url.includes('voirdrama');
    }

    /**
     * Navigate to a voir-anime/voir-drama episode page, extract the vidmoly iframe src,
     * then return the m3u8 URL extracted from that vidmoly page.
     * Used by the CLI flow and as a fallback when vidmoly URLs weren't pre-resolved.
     * @param rawVideoUrl voir-anime/voir-drama episode page URL
     */
    async extractM3U8(rawVideoUrl: string): Promise<string | null> {
        const vidmolyUrl = await VoirAnimeScrapper.fetchVidmolyUrl(rawVideoUrl);
        if (!vidmolyUrl) {
            this.logger.warn(`No vidmoly iframe found on: ${rawVideoUrl}`);
            return null;
        }

        const vidmolyDownloader = new VidmolyDownloader();
        return vidmolyDownloader.extractM3U8(vidmolyUrl);
    }

    async createDownloadTask(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        retry: number = 0,
        customPath?: string
    ): Promise<FFmpegTask | undefined> {
        this.logger.info(`Creating download task for episode ${episodeNumber} from VoirAnime: ${rawVideoUrl}, retry n°${retry}`);

        const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}/`;
        await fs.mkdir(folderPath, { recursive: true });

        const m3u8Url = await this.extractM3U8(rawVideoUrl);

        if (!m3u8Url) {
            await Puppeteer.timeout(retry * 100);
            if (retry <= 5) {
                return this.createDownloadTask(rawVideoUrl, episodeNumber, seasonName, animeName, retry + 1, customPath);
            }
            return undefined;
        }

        const { filePath } = this.buildFilePath(animeName, seasonName, episodeNumber, customPath);
        return new FFmpegTask(m3u8Url, filePath);
    }

    async downloadEpisode(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        retry: number = 0,
        customPath?: string
    ): Promise<void> {
        this.logger.info(`Downloading episode ${episodeNumber} from VoirAnime: ${rawVideoUrl}, retry n°${retry}`);

        const folderPath = `${Config.downloadPath}/${animeName}/${seasonName}/`;
        await fs.mkdir(folderPath, { recursive: true });

        const m3u8Url = await this.extractM3U8(rawVideoUrl);

        if (!m3u8Url) {
            await Puppeteer.timeout(retry * 100);
            if (retry <= 5) {
                return this.downloadEpisode(rawVideoUrl, episodeNumber, seasonName, animeName, retry + 1, customPath);
            }
            return;
        }

        const { filePath, seasonFormatedName } = this.buildFilePath(animeName, seasonName, episodeNumber, customPath);

        const vidmolyDownloader = new VidmolyDownloader();
        const bar = ProgressManager.create(1, seasonFormatedName);
        await vidmolyDownloader.runFFmpeg(m3u8Url, filePath, bar);
    }

    async isStrike(_url: string): Promise<boolean> {
        return false;
    }

    getDownloaderName(): string {
        return 'VoirAnime';
    }
}
