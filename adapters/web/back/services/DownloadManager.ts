import type { EpisodeDownloaderStrategy } from "../../../../engine/service/download/strategy/EpisodeDownloaderStrategy.ts";
import { DownloaderFactory } from "../../../../engine/service/download/factory/DownloaderFactory.ts";
import { EventEmitter } from "events";

export class DownloaderManager extends EventEmitter {
    private downloader: EpisodeDownloaderStrategy;
    constructor(downloader: EpisodeDownloaderStrategy) {
        super();
        this.downloader = downloader;
    }

    async downloadEpisode(
        urls: string | string[],
        episodeNumber: number,
        season: string,
        anime: string,
        outputPath: string
    ): Promise<void> {
        // Accept both single URL (backward compatibility) and array of URLs
        const urlArray = Array.isArray(urls) ? urls : [urls];
        await this.tryDownloadWithFallback(urlArray, episodeNumber, season, anime, outputPath, this.downloader);
    }

    private async tryDownloadWithFallback(
        urls: string[],
        episodeNumber: number,
        season: string,
        anime: string,
        outputPath: string,
        currentDownloader: EpisodeDownloaderStrategy
    ): Promise<void> {
        const downloaderName = currentDownloader.getDownloaderName();
        console.log(`[${downloaderName}] Attempting download for episode ${episodeNumber} with ${urls.length} URLs`);

        // Try each URL with the current downloader
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];

            try {
                // Check if this downloader can handle this URL
                const canHandle = await currentDownloader.canHandle(url);
                if (!canHandle) {
                    console.log(`[${downloaderName}] Cannot handle URL ${i + 1}/${urls.length}: ${url.substring(0, 50)}...`);
                    continue;
                }

                console.log(`[${downloaderName}] Trying URL ${i + 1}/${urls.length}: ${url.substring(0, 50)}...`);

                // Try to download with this downloader
                const success = await this.attemptDownload(
                    url,
                    episodeNumber,
                    season,
                    anime,
                    outputPath,
                    currentDownloader
                );

                if (success) {
                    console.log(`[${downloaderName}] Successfully downloaded episode ${episodeNumber}`);
                    return;
                }

                console.log(`[${downloaderName}] Failed to download with URL ${i + 1}/${urls.length}, trying next URL...`);
            } catch (err) {
                console.log(`[${downloaderName}] Exception with URL ${i + 1}/${urls.length}: ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }
        }

        // If we got here with current downloader, try the next one
        const nextDownloader = await DownloaderFactory.getNext(currentDownloader);
        if (nextDownloader) {
            console.log(`[${downloaderName}] All URLs failed, trying next downloader: ${nextDownloader.getDownloaderName()}`);
            return this.tryDownloadWithFallback(urls, episodeNumber, season, anime, outputPath, nextDownloader);
        }

        // No more URLs or downloaders to try
        const errorMsg = `All downloader strategies and URLs failed for episode ${episodeNumber}`;
        console.log(`[ERROR] ${errorMsg}`);
        this.emit("error", new Error(errorMsg));
    }

    private attemptDownload(
        url: string,
        episodeNumber: number,
        season: string,
        anime: string,
        outputPath: string,
        downloader: EpisodeDownloaderStrategy
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            let resolved = false;
            const resolveOnce = (value: boolean) => {
                if (!resolved) {
                    resolved = true;
                    resolve(value);
                }
            };

            try {
                const task = await downloader.createDownloadTask(
                    url,
                    episodeNumber,
                    season,
                    anime,
                    0,
                    outputPath
                );

                if (!task) {
                    resolveOnce(false);
                    return;
                }

                const downloaderName = downloader.getDownloaderName();
                console.log(`[${downloaderName}] Starting download for episode ${episodeNumber}: ${url}`);

                task.on("duration", dur => this.emit("duration", dur));
                task.on("progress", (current, total) => this.emit("progress", current, total));

                task.on("done", success => {
                    console.log(`[${downloaderName}] Download completed for episode ${episodeNumber}`);
                    this.emit("done", success);
                    resolveOnce(true);
                });

                task.on("error", (err) => {
                    console.log(`[${downloaderName}] Download error for episode ${episodeNumber}: ${err.message}`);
                    resolveOnce(false);
                });

                task.start();

            } catch (err) {
                console.log(`[${downloader.getDownloaderName()}] Failed to create download task for episode ${episodeNumber}: ${err instanceof Error ? err.message : String(err)}`);
                resolveOnce(false);
            }
        });
    }
}
