import SendVidDownloader from "../downloader/SendVidDownloader.ts";
import SibnetDownloader from "../downloader/SibnetDownloader.ts";
import VidmolyDownloader from "../downloader/VidmolyDownloader.ts";
import VoirAnimeDownloader from "../downloader/VoirAnimeDownloader.ts";
import DirectM3U8Downloader from "../downloader/DirectM3U8Downloader.ts";
import type { EpisodeDownloaderStrategy } from "../strategy/EpisodeDownloaderStrategy.ts";

export class DownloaderFactory {
    static async get(url: string): Promise<EpisodeDownloaderStrategy | null> {
        const strategies = [
            new VoirAnimeDownloader(),
            new VidmolyDownloader(),
            new SibnetDownloader(),
            new SendVidDownloader(),
            new DirectM3U8Downloader(),
        ];

        for (const strategy of strategies) {
            if (await strategy.canHandle(url)) {
                return strategy;
            }
        }

        return null;
    }
    static async getNext(downloader: EpisodeDownloaderStrategy): Promise<EpisodeDownloaderStrategy | null> {
        const strategies = [
            new VoirAnimeDownloader(),
            new VidmolyDownloader(),
            new SibnetDownloader(),
            new SendVidDownloader(),
            new DirectM3U8Downloader(),
        ];

        const currentIndex = strategies.findIndex((strategy) => strategy.getDownloaderName() === downloader.getDownloaderName());
        if (currentIndex === -1 || currentIndex === strategies.length - 1) {
            return null;
        }

        return strategies[currentIndex + 1];
    }
}