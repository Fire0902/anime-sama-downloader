import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

class DatabaseService {
    private db: Database | null = null;
    private dbPath: string;

    constructor() {
        this.dbPath = './sql/anime_downloader.db';
    }

    async initialize(): Promise<void> {
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec('PRAGMA foreign_keys = ON;');

        const schemaPath = './sql/schema.sql';
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        await this.db.exec(schema);

        console.log('Base de données initialisée');
    }

    getDb(): Database<sqlite3.Database, sqlite3.Statement> | null {
        return this.db;
    }

    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

export default new DatabaseService();