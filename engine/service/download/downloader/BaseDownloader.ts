import Config from "../../../config/Config.ts";
import Log from "../../../utils/log/Log.ts";
import type { EpisodeDownloaderStrategy } from "../strategy/EpisodeDownloaderStrategy.ts";
import type { TaskStrategy } from "../strategy/TaskStrategy.ts";

export abstract class BaseDownloader implements EpisodeDownloaderStrategy{
    protected readonly logger = Log.create(this.constructor.name);
    protected taskHandler: TaskStrategy | undefined = undefined;

    abstract canHandle(
        url: string
    ): Promise<boolean>;

    abstract createDownloadTask(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        retry?: number,
        customPath?: string
    ): Promise<TaskStrategy | undefined>
    
    abstract downloadEpisode(
        rawVideoUrl: string,
        episodeNumber: number,
        seasonName: string,
        animeName: string,
        retry?: number,
        customPath?: string
    ): Promise<void>;

    abstract extractM3U8(
        rawVideoUrl: string
    ): Promise<string | null>;

    abstract isStrike(
        url: string
    ): Promise<boolean>;

    abstract getDownloaderName(): string;

    protected buildFilePath(
        animeName: string,
        seasonName: string,
        episodeNumber: number,
        customPath?: string
    ): { filePath: string; seasonFormatedName: string; } {
        const episodeFormatedName = `Episode-${episodeNumber}`;
        const seasonFormatedName = `${seasonName}/${episodeFormatedName}`;
        const animeFormatedName = `${animeName}/${seasonFormatedName}`;

        const filePath =
            customPath ??
            `${Config.downloadPath}/${animeFormatedName}.${Config.downloadVideoFormat}`;

        return { filePath, seasonFormatedName };
    }
    public getTaskHandler(): TaskStrategy | undefined {
        return this.taskHandler;
    }
    protected setTaskHandler(taskHandler: TaskStrategy | undefined): void{
        this.taskHandler = taskHandler
    }
}