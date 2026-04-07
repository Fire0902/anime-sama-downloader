import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

class DatabaseService {
    private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
    private dbPath: string;

    constructor() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        this.dbPath = path.join(__dirname, '../sql/anime_downloader.db');
        console.log('Database will be at:', this.dbPath);
    }

    async initialize(): Promise<void> {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            console.log('Creating directory:', dbDir);
            fs.mkdirSync(dbDir, { recursive: true });
        }

        console.log('Connecting to database...');
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec('PRAGMA foreign_keys = ON;');

        const schemaPath = path.join(__dirname, '../sql/schema.sql');
        console.log('Loading schema from:', schemaPath);
        
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            await this.db.exec(schema);
        }

        const userCount = await this.db.get('SELECT COUNT(*) as count FROM users');
        console.log('Database initialized - Users count:', userCount);
    }

    getDb(): Database<sqlite3.Database, sqlite3.Statement> {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('Database closed');
        }
    }
}

export default new DatabaseService();