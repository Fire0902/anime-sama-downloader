import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export default class AnimeDB {

    private static db: Database.Database | null = null;

    private static readonly DB_PATH = path.resolve("./sql/anime.db");
    private static readonly SCHEMA_PATH = path.resolve("./sql/schema.sql");
    private static readonly DROP_PATH = path.resolve("./sql/drop.sql");

    /**
     * Initialise la DB :
     * - crée le fichier si nécessaire
     * - exécute schema.sql
     */
    static init(): void {

        if (!fs.existsSync(this.SCHEMA_PATH)) {
            throw new Error("schema.sql not found");
        }

        this.db = new Database(this.DB_PATH);

        const schema = fs.readFileSync(this.SCHEMA_PATH, "utf-8");

        this.db.exec(schema);

        console.log("Database initialized via schema.sql");
    }

    /**
     * Drop tables via drop.sql
     */
    static drop(): void {

        if (!fs.existsSync(this.DROP_PATH)) {
            throw new Error("drop.sql not found");
        }

        if (!this.db) {
            this.db = new Database(this.DB_PATH);
        }

        const dropSQL = fs.readFileSync(this.DROP_PATH, "utf-8");

        this.db.exec(dropSQL);

        console.log("Database dropped via drop.sql");
    }

    static close(): void {
        this.db?.close();
        this.db = null;
    }
    static getDB(): Database.Database {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        return this.db;
    }

}
