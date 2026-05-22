import DatabaseService from './DatabaseService.ts';
import DownloadPathService from './DownloadPathService.ts';
import { Database } from 'sqlite';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export interface Download {
    id: number;
    user_id: number | null;
    anime_name: string;
    season_name: string | null;
    episode_name: string;
    file_path: string;
    file_size: number | null;
    status: 'queued' | 'downloading' | 'encoding' | 'ready' | 'error';
    progress: number;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
}

export interface DownloadHierarchy {
    anime_name: string;
    seasons: {
        season_name: string;
        episodes: Download[];
    }[];
}

class DownloadService {
    private db: Database<any, any> | null;
    private downloadsDir: string;

    constructor() {
        this.db = null;
        this.downloadsDir = DownloadPathService.getDownloadsDir();
    }

    private getDb(): Database<any, any> {
        if (!this.db) {
            this.db = DatabaseService.getDb();
        }

        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return this.db;
    }

    async createDownload(
        animeName: string,
        seasonName: string | null,
        episodeName: string,
        filePath: string,
        userId?: number
    ): Promise<Download> {
        const db = this.getDb();
        console.log("Creating the download of: ", userId);
        console.log("Anime name: ", animeName);
        console.log("Season name: ", seasonName);
        console.log("File path: ", filePath);

        const result = await db.run(
            `INSERT INTO downloads (anime_name, season_name, episode_name, file_path, user_id, status)
             VALUES (?, ?, ?, ?, ?, 'queued')`,
            [animeName, seasonName, episodeName, filePath, userId || null]
        );

        if (!result.lastID) {
            throw new Error('Failed to create download');
        }

        const download = await db.get<Download>(
            'SELECT * FROM downloads WHERE id = ?',
            [result.lastID]
        );

        if (!download) {
            throw new Error('Failed to retrieve created download');
        }

        return download;
    }

    async updateDownloadStatus(
        downloadId: string,
        status: Download['status'],
        progress?: number,
        errorMessage?: string
    ): Promise<void> {
        const db = this.getDb();

        const updates: string[] = ['status = ?'];
        const params: any[] = [status];

        if (progress !== undefined) {
            updates.push('progress = ?');
            params.push(progress);
        }

        if (errorMessage !== undefined) {
            updates.push('error_message = ?');
            params.push(errorMessage);
        }

        if (status === 'ready') {
            updates.push("completed_at = datetime('now')");
        }

        params.push(downloadId);

        await db.run(
            `UPDATE downloads SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
    }

    async updateDownloadFileSize(downloadId: string, fileSize: number): Promise<void> {
        const db = this.getDb();

        await db.run(
            'UPDATE downloads SET file_size = ? WHERE id = ?',
            [fileSize, downloadId]
        );
    }

    async updateDownloadPath(downloadId: string, filePath: string): Promise<void> {
        const db = this.getDb();

        await db.run(
            'UPDATE downloads SET file_path = ? WHERE id = ?',
            [filePath, downloadId]
        );
    }

    async getDownloadByDownloadId(downloadId: string): Promise<Download | undefined> {
        const db = this.getDb();

        return await db.get<Download>(
            'SELECT * FROM downloads WHERE id = ?',
            [downloadId]
        );
    }

    async getUserDownloads(userId: number): Promise<Download[]> {
        const db = this.getDb();
        const downloads = await db.all<Download[]>(
            'SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        const existing: Download[] = [];
        for (const dl of downloads) {
            if (dl.status === 'ready' && !fs.existsSync(dl.file_path)) {
                await db.run('DELETE FROM downloads WHERE id = ?', [dl.id]);
            } else {
                existing.push(dl);
            }
        }
        return existing;
    }

    async getUserErroredDownloads(userId: number): Promise<Download[]> {
        const db = this.getDb();
        return await db.all<Download[]>(
            "SELECT * FROM downloads WHERE user_id = ? AND status = 'error' ORDER BY created_at DESC",
            [userId]
        );
    }

    async clearUserErroredDownloads(userId: number): Promise<number> {
        const db = this.getDb();
        const result = await db.run(
            "DELETE FROM downloads WHERE user_id = ? AND status = 'error'",
            [userId]
        );
        return result.changes ?? 0;
    }

    async getAllDownloads(): Promise<Download[]> {
        const db = this.getDb();

        return await db.all<Download[]>(
            'SELECT * FROM downloads ORDER BY created_at DESC'
        );
    }

    async getDownloadsByStatus(status: Download['status']): Promise<Download[]> {
        const db = this.getDb();

        return await db.all<Download[]>(
            'SELECT * FROM downloads WHERE status = ? ORDER BY created_at ASC',
            [status]
        );
    }

    async deleteDownload(downloadId: string): Promise<void> {
        const db = this.getDb();

        const download = await this.getDownloadByDownloadId(downloadId);

        if (download && fs.existsSync(download.file_path)) {
            fs.unlinkSync(download.file_path);
        }

        await db.run('DELETE FROM downloads WHERE id = ?', [downloadId]);
    }

    async getDownloadHierarchy(userId?: number): Promise<DownloadHierarchy[]> {
        const db = this.getDb();

        const query = userId
            ? 'SELECT * FROM downloads WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
            : 'SELECT * FROM downloads WHERE status = ? ORDER BY created_at DESC';

        const params = userId ? [userId, 'ready'] : ['ready'];
        const downloads = await db.all<Download[]>(query, params);

        const hierarchyMap = new Map<string, DownloadHierarchy>();

        for (const download of downloads) {
            if (!hierarchyMap.has(download.anime_name)) {
                hierarchyMap.set(download.anime_name, {
                    anime_name: download.anime_name,
                    seasons: []
                });
            }

            const anime = hierarchyMap.get(download.anime_name)!;
            const seasonName = download.season_name || 'Episodes';

            let season = anime.seasons.find(s => s.season_name === seasonName);
            if (!season) {
                season = { season_name: seasonName, episodes: [] };
                anime.seasons.push(season);
            }

            season.episodes.push(download);
        }

        return Array.from(hierarchyMap.values());
    }

    async zipAnime(animeName: string, userId?: number): Promise<string> {
        const db = this.getDb();

        const query = userId
            ? 'SELECT * FROM downloads WHERE anime_name = ? AND user_id = ? AND status = ?'
            : 'SELECT * FROM downloads WHERE anime_name = ? AND status = ?';

        const params = userId ? [animeName, userId, 'ready'] : [animeName, 'ready'];
        const downloads = await db.all<Download[]>(query, params);

        if (downloads.length === 0) {
            throw new Error('No downloads found for this anime');
        }

        const zipPath = path.join(this.downloadsDir, `${animeName}-${Date.now()}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => resolve(zipPath));
            archive.on('error', reject);

            archive.pipe(output);

            for (const download of downloads) {
                if (fs.existsSync(download.file_path)) {
                    const relativePath = path.join(
                        download.season_name || 'Episodes',
                        path.basename(download.file_path)
                    );
                    archive.file(download.file_path, { name: relativePath });
                }
            }

            archive.finalize();
        });
    }

    async zipSeason(animeName: string, seasonName: string, userId?: number): Promise<string> {
        const db = this.getDb();

        const query = userId
            ? 'SELECT * FROM downloads WHERE anime_name = ? AND season_name = ? AND user_id = ? AND status = ?'
            : 'SELECT * FROM downloads WHERE anime_name = ? AND season_name = ? AND status = ?';

        const params = userId
            ? [animeName, seasonName, userId, 'ready']
            : [animeName, seasonName, 'ready'];

        const downloads = await db.all<Download[]>(query, params);

        if (downloads.length === 0) {
            throw new Error('No downloads found for this season');
        }

        const zipPath = path.join(this.downloadsDir, `${animeName}-${seasonName}-${Date.now()}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => resolve(zipPath));
            archive.on('error', reject);

            archive.pipe(output);

            for (const download of downloads) {
                if (fs.existsSync(download.file_path)) {
                    archive.file(download.file_path, { name: path.basename(download.file_path) });
                }
            }

            archive.finalize();
        });
    }

    startFileWatcher(intervalMs = 10_000): void {
        if (this.watcherInterval) return;
        this.watcherInterval = setInterval(async () => {
            try {
                const db = this.getDb();
                const readyDownloads = await db.all<Download[]>(
                    "SELECT * FROM downloads WHERE status = 'ready'"
                );
                for (const dl of readyDownloads) {
                    if (!fs.existsSync(dl.file_path)) {
                        console.log(`[FileWatcher] Suppression BD: ${dl.file_path}`);
                        await db.run('DELETE FROM downloads WHERE id = ?', [dl.id]);
                    }
                }
            } catch (err) {
                console.error('[FileWatcher] Erreur:', err);
            }
        }, intervalMs);
    }

    stopFileWatcher(): void {
        if (this.watcherInterval) {
            clearInterval(this.watcherInterval);
            this.watcherInterval = null;
        }
    }
    private watcherInterval: ReturnType<typeof setInterval> | null = null;

    setDownloadsDir(downloadPath: string): void {
        DownloadPathService.setDownloadsDir(downloadPath);
        this.downloadsDir = DownloadPathService.getDownloadsDir();
    }

    getDownloadsDir(): string {
        return this.downloadsDir;
    }

    async resetStaleDownloads(): Promise<number> {
        const db = this.getDb();
        const result = await db.run(
            `UPDATE downloads SET status = 'error', error_message = 'Interrompu (redémarrage serveur)'
             WHERE status IN ('downloading', 'encoding')`
        );
        return result.changes ?? 0;
    }
}

export default new DownloadService();