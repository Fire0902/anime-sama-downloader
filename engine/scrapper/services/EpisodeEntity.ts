import AnimeDB from "../db/Database.ts";

export type Episode = {
    id: number;
    season_id: number;
    episode_index: number;
    name: string | null;
};

export type Reader = {
    id: number;
    name: string;
};

export type EpisodeReader = {
    id: number;
    episode_id: number;
    reader_id: number;
    url: string;
};

export type EpisodeWithReaders = Episode & {
    readers: Array<{
        reader_name: string;
        url: string;
    }>;
};

export default class EpisodeEntity {

    static extractReaderName(url: string): string {
        try {
            const hostname = new URL(url).hostname.replace(/^www\./, '');
            const parts = hostname.split('.');
            return parts[0];
        } catch {
            return 'unknown';
        }
    }

    private static getOrCreateReader(name: string): number {
        const db = AnimeDB.getDB();
        const existing = db.prepare(`SELECT id FROM reader WHERE name = ?`).get(name) as { id: number } | undefined;
        if (existing) return existing.id;
        const result = db.prepare(`INSERT INTO reader(name) VALUES (?)`).run(name);
        return Number(result.lastInsertRowid);
    }

    static insert(seasonId: number, episodeIndex: number, readerUrls: string[], name?: string): number {
        const db = AnimeDB.getDB();

        const episodeResult = db.prepare(`
            INSERT OR IGNORE INTO episode(season_id, episode_index, name)
            VALUES (?, ?, ?)
        `).run(seasonId, episodeIndex, name ?? null);

        let episodeId = Number(episodeResult.lastInsertRowid);
        if (episodeResult.changes === 0) {
            const existing = db.prepare(`
                SELECT id FROM episode WHERE season_id = ? AND episode_index = ?
            `).get(seasonId, episodeIndex) as { id: number } | undefined;
            if (!existing) return -1; // season_id FK violation or unknown issue
            episodeId = existing.id;
            if (name) {
                db.prepare(`UPDATE episode SET name = ? WHERE id = ?`).run(name, episodeId);
            }
        }

        const validUrls = readerUrls.filter(url => url && url.trim().length > 0);
        if (validUrls.length === 0 || episodeId < 1) {
            if (episodeId < 1) console.warn(`Episode insert skipped for season ${seasonId} index ${episodeIndex} (FK or unknown issue)`);
            return episodeId;
        }

        const insertEpisodeReader = db.prepare(`
            INSERT INTO episode_reader(episode_id, reader_id, url)
            VALUES (?, ?, ?)
            ON CONFLICT(episode_id, reader_id) DO UPDATE SET url = excluded.url
        `);

        for (const url of validUrls) {
            const readerName = this.extractReaderName(url);
            const readerId = this.getOrCreateReader(readerName);
            insertEpisodeReader.run(episodeId, readerId, url);
        }

        return episodeId;
    }

    static delete(id: number): void {
        AnimeDB.getDB().prepare(`DELETE FROM episode WHERE id = ?`).run(id);
    }

    static getAll(): Episode[] {
        return AnimeDB.getDB().prepare(`
            SELECT id, season_id, episode_index, name
            FROM episode
            ORDER BY season_id, episode_index
        `).all() as Episode[];
    }

    static getBySeason(seasonId: number): EpisodeWithReaders[] {
        const db = AnimeDB.getDB();
        const episodes = db.prepare(`
            SELECT id, season_id, episode_index, name
            FROM episode
            WHERE season_id = ?
            ORDER BY episode_index
        `).all(seasonId) as Episode[];

        return episodes.map(episode => {
            const readers = db.prepare(`
                SELECT r.name as reader_name, er.url
                FROM episode_reader er
                JOIN reader r ON er.reader_id = r.id
                WHERE er.episode_id = ?
            `).all(episode.id) as Array<{ reader_name: string; url: string }>;
            return { ...episode, readers };
        });
    }

    static addReader(episodeId: number, url: string): void {
        if (!url || url.trim().length === 0) return;
        const db = AnimeDB.getDB();
        const readerName = this.extractReaderName(url);
        const readerId = this.getOrCreateReader(readerName);
        db.prepare(`
            INSERT INTO episode_reader(episode_id, reader_id, url)
            VALUES (?, ?, ?)
            ON CONFLICT(episode_id, reader_id) DO UPDATE SET url = excluded.url
        `).run(episodeId, readerId, url);
    }

    static getAllReaders(): Reader[] {
        return AnimeDB.getDB().prepare(`SELECT id, name FROM reader ORDER BY name`).all() as Reader[];
    }
}
