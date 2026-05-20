import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../../../../engine/scrapper/sql/anime.db');

class LocalDbService {
    private db: Database.Database | null = null;

    private getDb(): Database.Database {
        if (!this.db) {
            if (!fs.existsSync(DB_PATH)) {
                throw new Error('Base de données locale introuvable. Lancez le scrapper d\'abord.');
            }
            this.db = new Database(DB_PATH, { readonly: true });
        }
        return this.db;
    }

    getStats(): Record<string, { animes: number; seasons: number; episodes: number }> {
        if (!this.isAvailable()) return {};
        const db = this.getDb();
        const providers = ['anime-sama', 'voir-anime', 'voir-drama'];
        const result: Record<string, { animes: number; seasons: number; episodes: number }> = {};
        for (const provider of providers) {
            const animes = (db.prepare(`SELECT COUNT(*) as count FROM anime WHERE provider = ?`).get(provider) as { count: number }).count;
            const seasons = (db.prepare(`SELECT COUNT(*) as count FROM season s INNER JOIN anime a ON s.anime_id = a.id WHERE a.provider = ?`).get(provider) as { count: number }).count;
            const episodes = (db.prepare(`SELECT COUNT(*) as count FROM episode e INNER JOIN season s ON e.season_id = s.id INNER JOIN anime a ON s.anime_id = a.id WHERE a.provider = ?`).get(provider) as { count: number }).count;
            result[provider] = { animes, seasons, episodes };
        }
        return result;
    }

    isAvailable(): boolean {
        return fs.existsSync(DB_PATH);
    }

    getDbPath(): string {
        return DB_PATH;
    }

    searchAnimes(query: string, provider?: string): Record<string, string> {
        const db = this.getDb();
        let rows: { name: string; link: string }[];

        if (provider) {
            rows = db.prepare(`
                SELECT name, link FROM anime
                WHERE name LIKE ? AND provider = ?
                ORDER BY name LIMIT 20
            `).all(`%${query}%`, provider) as { name: string; link: string }[];
        } else {
            rows = db.prepare(`
                SELECT name, link FROM anime
                WHERE name LIKE ?
                ORDER BY name LIMIT 20
            `).all(`%${query}%`) as { name: string; link: string }[];
        }

        const result: Record<string, string> = {};
        rows.forEach(row => { result[row.name] = row.link; });
        return result;
    }

    getSeasons(animeUrl: string): { name: string; link: string }[] {
        const db = this.getDb();
        const anime = db.prepare(`SELECT id FROM anime WHERE link = ?`).get(animeUrl) as { id: number } | undefined;
        if (!anime) return [];

        return db.prepare(`
            SELECT name, link FROM season
            WHERE anime_id = ?
            ORDER BY season_index
        `).all(anime.id) as { name: string; link: string }[];
    }

    getEpisodes(seasonUrl: string): { readerUrls: string[][]; episodeNames: string[] } {
        const db = this.getDb();
        const season = db.prepare(`SELECT id FROM season WHERE link = ?`).get(seasonUrl) as { id: number } | undefined;
        if (!season) return { readerUrls: [], episodeNames: [] };

        const episodes = db.prepare(`
            SELECT id, episode_index, name FROM episode
            WHERE season_id = ?
            ORDER BY episode_index
        `).all(season.id) as { id: number; episode_index: number; name: string | null }[];

        if (episodes.length === 0) return { readerUrls: [], episodeNames: [] };

        const readers = db.prepare(`SELECT id, name FROM reader ORDER BY name`).all() as { id: number; name: string }[];
        if (readers.length === 0) return { readerUrls: [], episodeNames: [] };

        // Build readerUrls[readerIndex][episodeIndex]
        const readerUrls: string[][] = readers.map(() => new Array(episodes.length).fill(''));

        for (let i = 0; i < episodes.length; i++) {
            const epReaders = db.prepare(`
                SELECT r.name as reader_name, er.url
                FROM episode_reader er
                JOIN reader r ON er.reader_id = r.id
                WHERE er.episode_id = ?
            `).all(episodes[i].id) as { reader_name: string; url: string }[];

            for (const er of epReaders) {
                const rIdx = readers.findIndex(r => r.name === er.reader_name);
                if (rIdx !== -1) readerUrls[rIdx][i] = er.url;
            }
        }

        const episodeNames = episodes.map((ep, i) =>
            ep.name || `Episode-${String(i + 1).padStart(2, '0')}.mp4`
        );

        // Only return reader arrays that have at least one URL
        return {
            readerUrls: readerUrls.filter(arr => arr.some(u => u)),
            episodeNames,
        };
    }
}

export default new LocalDbService();
