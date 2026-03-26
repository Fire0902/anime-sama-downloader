import type { EpisodeDownloaderStrategy } from "../../../../engine/service/download/strategy/EpisodeDownloaderStrategy.ts";
import { EventEmitter } from "events";

export class DownloaderManager extends EventEmitter {
    private downloader: EpisodeDownloaderStrategy;
    constructor(downloader: EpisodeDownloaderStrategy) {
        super();
        this.downloader = downloader;
    }

    async downloadEpisode(
        url: string,
        episodeNumber: number,
        season: string,
        anime: string,
        outputPath: string
    ) {
        try {
            const task = await this.downloader.createDownloadTask(
                url,
                episodeNumber,
                season,
                anime,
                0,
                outputPath
            );

            if(!task){
                this.emit("error", "server error");
                return;
            }
            task.on("duration", dur => this.emit("duration", dur));
            task.on("progress", (current, total) => this.emit("progress", current, total));
            task.on("done", success => this.emit("done", success));
            task.on("error", err => this.emit("error", err));

            task.start();
        } catch (err) {
            this.emit("error", err);
        }
    }
}