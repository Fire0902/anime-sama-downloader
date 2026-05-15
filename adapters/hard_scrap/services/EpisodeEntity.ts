import AnimeDB from "../db/Database.ts";

export type Episode = {
    id: number;
    season_id: number;
    episode_index: number;
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

    private static extractReaderName(url: string): string {
        try {
            const hostname = new URL(url).hostname;
            const parts = hostname.replace(/^www\./, '').split('.');
            return parts[0];
        } catch {
            return 'unknown';
        }
    }
    private static getOrCreateReader(name: string): number {
        const db = AnimeDB.getDB();

        const existing = db.prepare(`
            SELECT id FROM reader WHERE name = ?
        `).get(name) as { id: number } | undefined;

        if (existing) {
            return existing.id;
        }

        const result = db.prepare(`
            INSERT INTO reader(name)
            VALUES (?)
        `).run(name);

        return Number(result.lastInsertRowid);
    }

    static insert(
        seasonId: number,
        episodeIndex: number,
        readerUrls: string[]
    ): number {
        const db = AnimeDB.getDB();

        const episodeResult = db.prepare(`
            INSERT OR IGNORE INTO episode(season_id, episode_index)
            VALUES (?, ?)
        `).run(seasonId, episodeIndex);

        let episodeId = Number(episodeResult.lastInsertRowid);

        if (episodeId === 0) {
            const existing = db.prepare(`
            SELECT id FROM episode WHERE season_id = ? AND episode_index = ?
        `).get(seasonId, episodeIndex) as { id: number };
            episodeId = existing.id;
        }

        const validUrls = readerUrls.filter(url => url && url.trim().length > 0);

        if (validUrls.length === 0) {
            console.warn(`Episode ${episodeId} inserted without any valid reader URLs`);
            return episodeId;
        }

        const insertEpisodeReader = db.prepare(`
            INSERT INTO episode_reader(episode_id, reader_id, url)
            VALUES (?, ?, ?)
            ON CONFLICT(episode_id, reader_id) DO UPDATE SET url = excluded.url
        `);

        for (const url of validUrls) {
            //const readerName = this.extractReaderName(url);
            const readerId = this.getOrCreateReader("vidmoly");
            insertEpisodeReader.run(episodeId, readerId, url);
        }

        return episodeId;
    }

    static delete(id: number): void {
        const db = AnimeDB.getDB();
        db.prepare(`
            DELETE FROM episode
            WHERE id = ?
        `).run(id);
    }

    static getAll(): Episode[] {
        const db = AnimeDB.getDB();
        return db.prepare(`
            SELECT id, season_id, episode_index
            FROM episode
            ORDER BY season_id, episode_index
        `).all() as Episode[];
    }

    static getById(id: number): EpisodeWithReaders | null {
        const db = AnimeDB.getDB();

        const episode = db.prepare(`
            SELECT id, season_id, episode_index
            FROM episode
            WHERE id = ?
        `).get(id) as Episode | undefined;

        if (!episode) {
            return null;
        }

        const readers = db.prepare(`
            SELECT r.name as reader_name, er.url
            FROM episode_reader er
            JOIN reader r ON er.reader_id = r.id
            WHERE er.episode_id = ?
        `).all(id) as Array<{ reader_name: string; url: string }>;

        return {
            ...episode,
            readers
        };
    }

    static getBySeason(seasonId: number): EpisodeWithReaders[] {
        const db = AnimeDB.getDB();

        const episodes = db.prepare(`
            SELECT id, season_id, episode_index
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

            return {
                ...episode,
                readers
            };
        });
    }

    static addReader(episodeId: number, url: string): void {
        if (!url || url.trim().length === 0) {
            console.warn(`Attempted to add empty URL to episode ${episodeId}`);
            return;
        }

        const db = AnimeDB.getDB();
        const readerName = this.extractReaderName(url);
        const readerId = this.getOrCreateReader(readerName);

        db.prepare(`
            INSERT INTO episode_reader(episode_id, reader_id, url)
            VALUES (?, ?, ?)
            ON CONFLICT(episode_id, reader_id) DO UPDATE SET url = excluded.url
        `).run(episodeId, readerId, url);
    }

    static removeReader(episodeId: number, readerName: string): void {
        const db = AnimeDB.getDB();

        db.prepare(`
            DELETE FROM episode_reader
            WHERE episode_id = ?
            AND reader_id = (SELECT id FROM reader WHERE name = ?)
        `).run(episodeId, readerName);
    }

    static getAllReaders(): Reader[] {
        const db = AnimeDB.getDB();
        return db.prepare(`
            SELECT id, name
            FROM reader
            ORDER BY name
        `).all() as Reader[];
    }
}