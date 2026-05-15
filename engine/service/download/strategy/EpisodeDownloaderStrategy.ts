import { TaskStrategy } from "./TaskStrategy.ts";

export interface EpisodeDownloaderStrategy {

    canHandle(
        url: string
    ): Promise<boolean>;

    createDownloadTask(
            rawVideoUrl: string,
            episodeNumber: number,
            seasonName: string,
            animeName: string,
            retry?: number,
            customPath?: string
    ): Promise<TaskStrategy | undefined>

    downloadEpisode(
        url: string,
        episodeNumber: number,
        season: string,
        anime: string
    ): Promise<void>;

    extractM3U8(
        rawVideoUrl: string
    ): Promise<string | null>;

    isStrike(
        url: string
    ): Promise<boolean>;

    getDownloaderName(): string;
}