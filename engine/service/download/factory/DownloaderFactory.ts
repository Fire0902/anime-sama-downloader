import SibnetDownloader from "../downloader/SibnetDownloader.ts";
import VidmolyDownloader from "../downloader/VidmolyDownloader.ts";
import type { EpisodeDownloaderStrategy } from "../strategy/EpisodeDownloaderStrategy.ts";

export class DownloaderFactory {
    static async get(url: string): Promise<EpisodeDownloaderStrategy | null> {
        const strategies = [
            new VidmolyDownloader(),
            new SibnetDownloader()
        ];

        for (const strategy of strategies) {
            if (await strategy.canHandle(url)) {
                return strategy;
            }
        }

        return null;
    }
}