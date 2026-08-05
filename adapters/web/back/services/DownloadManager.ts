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
        await this.tryUrls(urls, episodeNumber, season, anime, outputPath, "PerUrl");
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
        await this.tryUrls(urlArray, episodeNumber, season, anime, outputPath, "DOWNLOAD");
    }

    /**
     * Essaie les URLs d'un épisode l'une après l'autre, chacune confiée au
     * downloader qui sait la lire.
     *
     * Les deux modes d'appel partagent cette logique : qu'elles viennent du
     * scraping live ou de la base locale, les URLs désignent des pages
     * d'hébergeur (sibnet, vidmoly, …) et c'est l'hébergeur qui détermine le
     * downloader, pas l'ordre de la liste des stratégies.
     */
    private async tryUrls(
        urls: string[],
        episodeNumber: number,
        season: string,
        anime: string,
        outputPath: string,
        tag: string
    ): Promise<void> {
        console.log(`[${tag}] Épisode ${episodeNumber} : ${urls.length} URL(s) à essayer`);

        // Chaque URL est confiée au downloader qui sait la lire, plutôt que de
        // dérouler la liste des stratégies. L'ancienne cascade partait du
        // downloader de la première URL et n'avançait que vers les suivants :
        // une URL Sibnet n'était jamais tentée si la première URL désignait un
        // downloader situé plus loin dans la liste.
        const tried: string[] = [];

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const position = `${i + 1}/${urls.length}`;

            let downloader: EpisodeDownloaderStrategy | null;
            try {
                // Repli sur le downloader fourni au constructeur : une URL déjà
                // résolue en manifeste n'est reconnue par aucune stratégie
                // d'hébergeur mais reste lisible par DirectM3U8.
                downloader = (await DownloaderFactory.get(url)) ?? this.downloader;
            } catch (err) {
                console.log(`[${tag}] URL ${position} : sélection du downloader impossible (${err instanceof Error ? err.message : String(err)})`);
                continue;
            }

            if (!downloader) {
                console.log(`[${tag}] URL ${position} : aucun downloader ne reconnaît ${url.substring(0, 60)}`);
                continue;
            }

            const downloaderName = downloader.getDownloaderName();
            tried.push(downloaderName);
            console.log(`[${downloaderName}] URL ${position} : tentative sur ${url.substring(0, 60)}`);

            try {
                const success = await this.attemptDownload(
                    url,
                    episodeNumber,
                    season,
                    anime,
                    outputPath,
                    downloader
                );

                if (success) {
                    console.log(`[${downloaderName}] Épisode ${episodeNumber} téléchargé`);
                    return;
                }

                console.log(`[${downloaderName}] Échec sur l'URL ${position}, passage à la suivante`);
            } catch (err) {
                console.log(`[${downloaderName}] Exception sur l'URL ${position} : ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }
        }

        const detail = tried.length ? ` (essayés : ${[...new Set(tried)].join(', ')})` : '';
        const errorMsg = `All downloader strategies and URLs failed for episode ${episodeNumber}${detail}`;
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
