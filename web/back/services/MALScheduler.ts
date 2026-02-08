import FavoriteService from './FavoriteService.ts';
import Scrapper from '../../../src/utils/web/Scrapper.ts';
import Puppeteer from '../../../src/utils/web/Puppeteer.ts';
import DownloadService from './DownloadService.ts';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

class MALScheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private checkInterval: number = 10 * 60 * 1000;

    start(): void {
        if (this.isRunning) {
            console.log('MAL Scheduler déjà en cours d\'exécution');
            return;
        }

        console.log('Démarrage du MAL Scheduler (vérification toutes les 10 minutes)');
        this.isRunning = true;

        this.checkForNewEpisodes();
        this.intervalId = setInterval(() => {
            this.checkForNewEpisodes();
        }, this.checkInterval);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            console.log('MAL Scheduler arrêté');
        }
    }

    private async checkForNewEpisodes(): Promise<void> {
        try {
            console.log('Vérification des nouveaux épisodes...');
            
            const ongoingFavorites = await FavoriteService.getOngoingFavorites();
            
            if (ongoingFavorites.length === 0) {
                console.log('Aucun anime en cours dans les favoris');
                return;
            }

            console.log(`${ongoingFavorites.length} anime(s) en cours à vérifier`);

            for (const favorite of ongoingFavorites) {
                try {
                    if (!favorite.mal_id) {
                        continue;
                    }

                    const malStatus = await FavoriteService.getMALAnimeStatus(favorite.mal_id);
                    
                    console.log(`${favorite.anime_name}: ${malStatus.num_episodes} épisodes sur MAL`);

                    if (malStatus.num_episodes > favorite.last_episode_downloaded) {
                        const newEpisodeCount = malStatus.num_episodes - favorite.last_episode_downloaded;
                        console.log(`${newEpisodeCount} nouvel(le)(s) épisode(s) détecté(s) pour ${favorite.anime_name}`);

                        await this.downloadNewEpisodes(
                            favorite,
                            favorite.last_episode_downloaded + 1,
                            malStatus.num_episodes
                        );

                        await FavoriteService.updateLastEpisode(favorite.id, malStatus.num_episodes);
                    } else {
                        console.log(`${favorite.anime_name} est à jour (${favorite.last_episode_downloaded} épisodes)`);
                    }

                    await FavoriteService.updateLastChecked(favorite.id);

                    if (malStatus.status !== 'currently_airing') {
                        console.log(`${favorite.anime_name} n'est plus en cours de diffusion`);
                    }

                } catch (error: any) {
                    console.error(`Erreur lors de la vérification de ${favorite.anime_name}:`, error.message);
                    await FavoriteService.updateLastChecked(favorite.id);
                }
            }

            console.log('Vérification terminée');
        } catch (error) {
            console.error('Erreur globale du scheduler:', error);
        }
    }

    private async downloadNewEpisodes(
        favorite: any,
        startEpisode: number,
        endEpisode: number
    ): Promise<void> {
        try {
            console.log(`Téléchargement des épisodes ${startEpisode} à ${endEpisode} de ${favorite.anime_name}`);

            const page = await Puppeteer.newPage();
            await page.goto(favorite.anime_url, { waitUntil: 'networkidle2' });

            const seasons = await Scrapper.extractSeasonsWithScans(page);
            
            if (seasons.length === 0) {
                throw new Error('Aucune saison trouvée');
            }

            const latestSeason = seasons[seasons.length - 1];
            const seasonUrl = `${favorite.anime_url}${latestSeason.link}`;

            console.log(`Saison sélectionnée: ${latestSeason.name}`);

            const readers = await Scrapper.extractEpisodes(seasonUrl);
            const readersNet = readers.map((episodeList: string[]) => 
                episodeList.map((episode: string) => episode.replace('to/', 'net/'))
            );

            for (let episodeNum = startEpisode; episodeNum <= endEpisode; episodeNum++) {
                const episodeIndex = episodeNum - 1;
                
                if (episodeIndex >= 0 && episodeIndex < readersNet[0].length) {
                    const episodeUrl = readersNet[0][episodeIndex];
                    
                    if (episodeUrl.includes('vidmoly')) {
                        await this.downloadEpisode(
                            favorite,
                            latestSeason.name,
                            episodeUrl,
                            episodeNum
                        );
                    }
                }
            }

        } catch (error: any) {
            console.error(`Erreur lors du téléchargement des épisodes:`, error.message);
            throw error;
        }
    }

    private async downloadEpisode(
        favorite: any,
        seasonName: string,
        episodeUrl: string,
        episodeNumber: number
    ): Promise<void> {
        try {
            const page = await Puppeteer.newPage();
            await page.goto(episodeUrl);

            const m3u8 = await page.evaluate(() => {
                if ((window as any).jwplayer) {
                    const player = (window as any).jwplayer("vplayer");
                    const sources = player.getPlaylist?.()?.[0]?.sources;
                    if (sources && sources.length > 0) {
                        return sources[0].file;
                    }
                }
                return null;
            });

            if (!m3u8) {
                throw new Error('URL M3U8 introuvable');
            }

            const downloadId = `auto-${Date.now()}-${episodeNumber}`;
            const fileName = `${favorite.anime_name}-${seasonName}-Episode-${episodeNumber}.mp4`;
            const filePath = path.join(
                DownloadService.getDownloadsDir(),
                favorite.anime_name,
                seasonName,
                fileName
            );

            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            await DownloadService.createDownload(
                favorite.anime_name,
                seasonName,
                fileName,
                filePath,
                favorite.user_id
            );

            console.log(`Téléchargement de ${fileName}...`);

            await this.runFFmpeg(m3u8, filePath, downloadId);

            console.log(`${fileName} téléchargé avec succès`);

        } catch (error: any) {
            console.error(`Erreur lors du téléchargement de l'épisode ${episodeNumber}:`, error.message);
        }
    }

    private async runFFmpeg(m3u8Url: string, outputPath: string, downloadId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const ff = spawn("ffmpeg", [
                "-i", m3u8Url,
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc",
                "-y",
                outputPath
            ]);

            ff.stderr.on("data", async (data) => {
                const line = data.toString();
                const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const current = hours * 3600 + minutes * 60 + seconds;

                    await DownloadService.updateDownloadStatus(downloadId, 'encoding', current);
                }
            });

            ff.on("close", async (code) => {
                if (code === 0) {
                    const fileSize = fs.statSync(outputPath).size;
                    await DownloadService.updateDownloadStatus(downloadId, 'ready');
                    await DownloadService.updateDownloadFileSize(downloadId, fileSize);
                    resolve();
                } else {
                    await DownloadService.updateDownloadStatus(
                        downloadId,
                        'error',
                        0,
                        `FFmpeg failed with code ${code}`
                    );
                    reject(new Error(`FFmpeg failed with code ${code}`));
                }
            });

            ff.on("error", async (err) => {
                await DownloadService.updateDownloadStatus(downloadId, 'error', 0, err.message);
                reject(err);
            });
        });
    }
}

export default new MALScheduler();