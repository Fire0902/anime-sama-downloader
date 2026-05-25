import type { EpisodeDownloaderStrategy } from "../../../../engine/service/download/strategy/EpisodeDownloaderStrategy.ts";
import { DownloaderFactory } from "../../../../engine/service/download/factory/DownloaderFactory.ts";
import { EventEmitter } from "events";

export class DownloaderManager extends EventEmitter {
    private downloader: EpisodeDownloaderStrategy;
    constructor(downloader: EpisodeDownloaderStrategy) {
        super();
        this.downloader = downloader;
    }

    async downloadEpisodePerUrl(
        urls: string[],
        episodeNumber: number,
        season: string,
        anime: string,
        outputPath: string
    ): Promise<void> {
        // URLs from the local DB are embed-page URLs (sibnet, vidmoly, …), not raw m3u8.
        // Pick the right downloader per URL via the factory; fall back to this.downloader
        // (e.g. DirectM3U8) only if a URL already contains a manifest.
        console.log(`[PerUrl] Trying ${urls.length} URLs independently for episode ${episodeNumber}`);
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const d = (await DownloaderFactory.get(url)) ?? this.downloader;
            if (!d) {
                console.log(`[PerUrl] No downloader for URL ${i + 1}/${urls.length}: ${url.substring(0, 60)}`);
                continue;
            }
            console.log(`[PerUrl] URL ${i + 1}/${urls.length} → ${d.getDownloaderName()}: ${url.substring(0, 60)}`);
            const success = await this.attemptDownload(url, episodeNumber, season, anime, outputPath, d);
            if (success) {
                console.log(`[PerUrl] Success with ${d.getDownloaderName()} for episode ${episodeNumber}`);
                return;
            }
            console.log(`[PerUrl] Failed, trying next URL...`);
        }
        const errorMsg = `All per-URL strategies failed for episode ${episodeNumber}`;
        console.log(`[ERROR] ${errorMsg}`);
        this.emit("error", new Error(errorMsg));
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
                    console.log(`[${downloader.getDownloaderName()}] extractM3U8 returned null for: ${url.substring(0, 100)}`);
                    resolveOnce(false);
                    return;
                }

                const downloaderName = downloader.getDownloaderName();
                console.log(`[${downloaderName}] Starting download for episode ${episodeNumber}: ${url}`);

                task.on("duration", dur => this.emit("duration", dur));
                task.on("progress", (current, total) => this.emit("progress", current, total));
                task.on("streamInfo", (info) => this.emit("streamInfo", info));

                task.on("done", success => {
                    console.log(`[${downloaderName}] Download completed for episode ${episodeNumber}`);
                    // Ne propager "done" que si le téléchargement a réellement réussi.
                    // En cas d'échec (FFmpeg non-zero ou "error" précédent), on laisse
                    // la boucle de retry tenter les URLs/downloaders suivants.
                    if (!resolved && success) {
                        this.emit("done", true);
                    }
                    resolveOnce(success);
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
