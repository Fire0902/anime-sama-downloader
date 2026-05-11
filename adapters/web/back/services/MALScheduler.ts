import FavoriteService from './FavoriteService.ts';
import AnimeSamaScrapper from '../../../../engine/providers/anime-sama/AnimeSamaScrapper.ts';
import Puppeteer from '../../../../engine/utils/web/Puppeteer.ts';
import DownloadService from './DownloadService.ts';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface ScheduledDownload {
    favoriteId: number;
    episodeNumber: number;
    scheduledTime: Date;
    timeoutId: NodeJS.Timeout;
}

class MALScheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private checkInterval: number = 60 * 60 * 1000;
    private scheduledDownloads: Map<string, ScheduledDownload> = new Map();

    start(): void {
        if (this.isRunning) {
            console.log('MAL Scheduler déjà en cours d\'exécution');
            return;
        }

        console.log('Démarrage du MAL Scheduler (vérification toutes les 60 minutes)');
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
        }

        for (const [key, scheduled] of this.scheduledDownloads.entries()) {
            clearTimeout(scheduled.timeoutId);
            console.log(`Téléchargement programmé annulé: ${key}`);
        }
        this.scheduledDownloads.clear();

        this.isRunning = false;
        console.log('MAL Scheduler arrêté');
    }

    private async checkForNewEpisodes(): Promise<void> {
        try {
            console.log('=== Vérification des nouveaux épisodes ===');
            
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
                    
                    console.log(`\n[${favorite.anime_name}]`);
                    console.log(`  Status: ${malStatus.status}`);
                    console.log(`  Épisodes sur MAL: ${malStatus.num_episodes}`);
                    console.log(`  Dernier téléchargé: ${favorite.last_episode_downloaded}`);

                    if (malStatus.status !== 'currently_airing') {
                        console.log(`L'anime n'est plus en cours de diffusion`);
                        await FavoriteService.updateOngoingStatus(favorite.id, false);
                        await FavoriteService.updateLastChecked(favorite.id);
                        continue;
                    }

                    if (malStatus.broadcast) {
                        const nextEpisodeTime = this.calculateNextEpisodeTime(
                            malStatus.broadcast.day_of_the_week,
                            malStatus.broadcast.start_time
                        );

                        console.log(`Diffusion: ${malStatus.broadcast.day_of_the_week} à ${malStatus.broadcast.start_time} (JST)`);
                        console.log(`Prochain épisode prévu: ${nextEpisodeTime.toLocaleString('fr-FR')}`);

                        await FavoriteService.updateNextEpisodeTime(
                            favorite.id,
                            nextEpisodeTime.toISOString()
                        );

                        const downloadTime = new Date(nextEpisodeTime.getTime() + 10 * 60 * 1000);
                        const nextEpisodeNumber = favorite.last_episode_downloaded + 1;

                        this.scheduleDownload(
                            favorite,
                            nextEpisodeNumber,
                            downloadTime
                        );
                    }

                    if (malStatus.num_episodes > favorite.last_episode_downloaded) {
                        const newEpisodeCount = malStatus.num_episodes - favorite.last_episode_downloaded;
                        console.log(`${newEpisodeCount} nouvel(le)(s) épisode(s) détecté(s) - téléchargement immédiat`);

                        await this.downloadNewEpisodes(
                            favorite,
                            favorite.last_episode_downloaded + 1,
                            malStatus.num_episodes
                        );

                        await FavoriteService.updateLastEpisode(favorite.id, malStatus.num_episodes);
                    }

                    await FavoriteService.updateLastChecked(favorite.id);

                } catch (error: any) {
                    console.error(`Erreur lors de la vérification de ${favorite.anime_name}:`, error.message);
                    await FavoriteService.updateLastChecked(favorite.id);
                }
            }

            console.log('\n=== Vérification terminée ===\n');
        } catch (error) {
            console.error('Erreur globale du scheduler:', error);
        }
    }

    private calculateNextEpisodeTime(dayOfWeek: string, timeJST: string): Date {
        console.log(timeJST)
        const daysOfWeek: { [key: string]: number } = {
            'sunday': 0,
            'monday': 1,
            'tuesday': 2,
            'wednesday': 3,
            'thursday': 4,
            'friday': 5,
            'saturday': 6
        };

        const targetDay = daysOfWeek[dayOfWeek.toLowerCase()];
        if (targetDay === undefined) {
            throw new Error(`Jour de la semaine invalide: ${dayOfWeek}`);
        }

        const [hours, minutes] = timeJST.split(':').map(Number);
        
        const now = new Date();
        const nextEpisode = new Date();
        
        const jstOffset = 9 * 60;
        const localOffset = now.getTimezoneOffset();
        const totalOffset = jstOffset + localOffset;
        
        const currentDay = now.getDay();
        let daysUntilNext = targetDay - currentDay;
        
        if (daysUntilNext < 0 || (daysUntilNext === 0 && now.getHours() >= hours)) {
            daysUntilNext += 7;
        }
        
        nextEpisode.setDate(now.getDate() + daysUntilNext);
        nextEpisode.setHours(hours, minutes, 0, 0);
        
        nextEpisode.setMinutes(nextEpisode.getMinutes() - totalOffset);
        
        return nextEpisode;
    }

    private scheduleDownload(favorite: any, episodeNumber: number, downloadTime: Date): void {
        const key = `${favorite.id}-${episodeNumber}`;
        
        if (this.scheduledDownloads.has(key)) {
            const existing = this.scheduledDownloads.get(key)!;
            clearTimeout(existing.timeoutId);
            console.log(`Reprogrammation du téléchargement: ${key}`);
        }

        const now = new Date();
        const delay = downloadTime.getTime() - now.getTime();

        if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
            const timeoutId = setTimeout(async () => {
                console.log(`\nTéléchargement programmé démarré: ${favorite.anime_name} - Episode ${episodeNumber}`);
                
                try {
                    await this.downloadNewEpisodes(favorite, episodeNumber, episodeNumber);
                    await FavoriteService.updateLastEpisode(favorite.id, episodeNumber);
                } catch (error: any) {
                    console.error(`Erreur téléchargement programmé:`, error.message);
                }
                
                this.scheduledDownloads.delete(key);
            }, delay);

            this.scheduledDownloads.set(key, {
                favoriteId: favorite.id,
                episodeNumber,
                scheduledTime: downloadTime,
                timeoutId
            });

            console.log(`Téléchargement programmé pour ${downloadTime.toLocaleString('fr-FR')} (dans ${Math.round(delay / 1000 / 60)} min)`);
        } else if (delay <= 0) {
            console.log(`  Heure de téléchargement déjà passée, sera traité lors de la prochaine vérification`);
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

            const seasons = await AnimeSamaScrapper.extractSeasonsWithScans(page);
            
            if (seasons.length === 0) {
                throw new Error('Aucune saison trouvée');
            }

            const latestSeason = seasons[seasons.length - 1];
            const seasonUrl = `${favorite.anime_url}${latestSeason.link}`;

            console.log(`  Saison sélectionnée: ${latestSeason.name}`);

            const readers = await AnimeSamaScrapper.extractEpisodes(seasonUrl);
            const readersNet = readers.readers.map((episodeList: string[]) =>
                episodeList.map((episode: string) => episode.replace('to/', 'net/'))
            );

            for (let episodeNum = startEpisode; episodeNum <= endEpisode; episodeNum++) {
                const episodeIndex = episodeNum - 1;
                
                if (episodeIndex >= 0 && episodeIndex < readersNet[0].length) {
                    const episodeUrl = readersNet[0][episodeIndex];
                    
                    if (episodeUrl.includes('vidmoly')) {
                        console.log(`  Téléchargement épisode ${episodeNum}...`);
                        await this.downloadEpisode(
                            favorite,
                            latestSeason.name,
                            episodeUrl,
                            episodeNum
                        );
                    } else {
                        console.log(`  Épisode ${episodeNum} ignoré (non-vidmoly)`);
                    }
                }
            }

            await page.close();

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

            await page.close();

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

            console.log(`  Début du téléchargement: ${fileName}`);

            await this.runFFmpeg(m3u8, filePath, downloadId);

            console.log(`  ${fileName} téléchargé avec succès`);

        } catch (error: any) {
            console.error(`  Erreur lors du téléchargement de l'épisode ${episodeNumber}:`, error.message);
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

    getScheduledDownloads(): ScheduledDownload[] {
        return Array.from(this.scheduledDownloads.values());
    }
}

export default new MALScheduler();