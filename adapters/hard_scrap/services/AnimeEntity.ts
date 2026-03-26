import AnimeDB from "../db/Database.ts";


export type Anime = {
    id: number;
    name: string;
    link: string;
};

export default class AnimeEntity {


    static insert(
        name: string, 
        link: string
    ): number {
        const db = AnimeDB.getDB();
        const result = db.prepare(`
        INSERT OR IGNORE INTO anime(name, link)
        VALUES (?, ?)
    `).run([name, link]);
        return Number(result.lastInsertRowid);
    }

    static delete(id: number): void {

        const db = AnimeDB.getDB();

        db.prepare(`
            DELETE FROM anime
            WHERE id = ?
        `).run(id);
    }
    static getAll(): Anime[] {
        const db = AnimeDB.getDB();

        return db.prepare(`
            SELECT id, name, link
            FROM anime
            ORDER BY name
        `).all() as Anime[];
    }
}
