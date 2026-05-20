import AnimeDB from "../db/Database.ts";

export type Season = {
    id: number;
    name: string | null;
    anime_id: number;
    season_index: number;
    link: string;
};

export default class SeasonEntity {

    static insert(name: string | null, animeId: number, seasonIndex: number, link: string): number {
        const db = AnimeDB.getDB();
        const result = db.prepare(`
            INSERT OR IGNORE INTO season(name, anime_id, season_index, link)
            VALUES (?, ?, ?, ?)
        `).run(name, animeId, seasonIndex, link);
        return Number(result.lastInsertRowid);
    }

    static delete(id: number): void {
        const db = AnimeDB.getDB();
        db.prepare(`DELETE FROM season WHERE id = ?`).run(id);
    }

    static getAll(): Season[] {
        const db = AnimeDB.getDB();
        return db.prepare(`
            SELECT id, name, anime_id, season_index, link
            FROM season
            ORDER BY anime_id, season_index
        `).all() as Season[];
    }

    static getByAnime(animeId: number): Season[] {
        const db = AnimeDB.getDB();
        return db.prepare(`
            SELECT id, name, anime_id, season_index, link
            FROM season
            WHERE anime_id = ?
            ORDER BY season_index
        `).all(animeId) as Season[];
    }

    static getByLink(link: string): Season | null {
        const db = AnimeDB.getDB();
        return db.prepare(`
            SELECT id, name, anime_id, season_index, link
            FROM season
            WHERE link = ?
        `).get(link) as Season | null;
    }
}
