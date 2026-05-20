import AnimeDB from "../db/Database.ts";

export type Anime = {
    id: number;
    name: string;
    link: string;
    provider: string;
};

export default class AnimeEntity {

    static insert(name: string, link: string, provider: string = 'anime-sama'): number {
        const db = AnimeDB.getDB();
        const result = db.prepare(`
            INSERT OR IGNORE INTO anime(name, link, provider)
            VALUES (?, ?, ?)
        `).run(name, link, provider);
        return Number(result.lastInsertRowid);
    }

    static delete(id: number): void {
        const db = AnimeDB.getDB();
        db.prepare(`DELETE FROM anime WHERE id = ?`).run(id);
    }

    static getAll(): Anime[] {
        const db = AnimeDB.getDB();
        return db.prepare(`
            SELECT id, name, link, provider
            FROM anime
            ORDER BY name
        `).all() as Anime[];
    }

    static search(query: string, provider?: string): Anime[] {
        const db = AnimeDB.getDB();
        if (provider) {
            return db.prepare(`
                SELECT id, name, link, provider
                FROM anime
                WHERE name LIKE ? AND provider = ?
                ORDER BY name
                LIMIT 20
            `).all(`%${query}%`, provider) as Anime[];
        }
        return db.prepare(`
            SELECT id, name, link, provider
            FROM anime
            WHERE name LIKE ?
            ORDER BY name
            LIMIT 20
        `).all(`%${query}%`) as Anime[];
    }

    static getByLink(link: string): Anime | null {
        const db = AnimeDB.getDB();
        return db.prepare(`
            SELECT id, name, link, provider
            FROM anime
            WHERE link = ?
        `).get(link) as Anime | null;
    }
}
