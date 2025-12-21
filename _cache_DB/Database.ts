import fs from "node:fs";
import BetterSqlite3 from "better-sqlite3";

export default class Database {
    private static instance: BetterSqlite3.Database;

    private constructor() {}

    static getInstance(): BetterSqlite3.Database {
        if (!Database.instance) {
            fs.mkdirSync("./_cache_DB/db", { recursive: true });
            Database.instance = new BetterSqlite3("./_cache_DB/db/anime.db");

            const schema = fs.readFileSync("./_cache_DB/sql/tables.sql", "utf8");
            Database.instance.exec(schema);
        }

        return Database.instance;
    }
}
