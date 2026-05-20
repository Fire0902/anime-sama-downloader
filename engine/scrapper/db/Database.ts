import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class AnimeDB {

    private static db: Database.Database | null = null;

    private static readonly DB_PATH = path.resolve(__dirname, '../sql/anime.db');
    private static readonly SCHEMA_PATH = path.resolve(__dirname, '../sql/schema.sql');
    private static readonly DROP_PATH = path.resolve(__dirname, '../sql/drop.sql');

    static init(): void {
        if (!fs.existsSync(this.SCHEMA_PATH)) {
            throw new Error("schema.sql not found");
        }

        this.db = new Database(this.DB_PATH);
        const schema = fs.readFileSync(this.SCHEMA_PATH, "utf-8");
        this.db.exec(schema);
        console.log("Scrapper database initialized");
    }

    static drop(): void {
        if (!fs.existsSync(this.DROP_PATH)) {
            throw new Error("drop.sql not found");
        }
        if (!this.db) {
            this.db = new Database(this.DB_PATH);
        }
        const dropSQL = fs.readFileSync(this.DROP_PATH, "utf-8");
        this.db.exec(dropSQL);
        console.log("Scrapper database dropped");
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

    static getDbPath(): string {
        return this.DB_PATH;
    }
}
