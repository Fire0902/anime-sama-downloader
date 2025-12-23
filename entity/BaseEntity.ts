import Database from "../_cache_DB/Database.ts";

export type Where<T> = Partial<{
    [K in keyof T]: T[K] extends string | number ? T[K] : never;
}>;

export default abstract class BaseEntity<T> {

    protected db = Database.getInstance();

    protected abstract table: string;
    protected abstract columns: (keyof T)[];

    find(where: Where<T> = {}): T[] {
        const conditions: string[] = [];
        const values: (string | number)[] = [];

        for (const [key, value] of Object.entries(where)) {
            if (value === undefined) continue;
            if (!this.columns.includes(key as keyof T)) {
                throw new Error(`Colonne non autorisée: ${key}`);
            }

            if (typeof value === "string") {
                conditions.push(`${key} LIKE ?`);
                values.push(`%${value}%`);
            } else {
                conditions.push(`${key} = ?`);
                values.push(value as number);
            }
        }

        const whereSQL = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const stmt = this.db.prepare(
            `SELECT * FROM ${this.table} ${whereSQL}`
        );

        return stmt.all(...values) as T[];
    }


    insert(data: Partial<T>): void {
        const keys = Object.keys(data) as (keyof T)[];
        const values = Object.values(data);

        const columns = keys.join(", ");
        const placeholders = keys.map(() => "?").join(", ");

        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO ${this.table} (${columns})
            VALUES (${placeholders})
        `);

        stmt.run(...values);
    }

    arrayToRecord<
        K extends keyof T,
        V extends keyof T
    >(items: T[], key: K, value: V): Record<string, string> {
        return Object.fromEntries(
            items.map(item => [
                String(item[key]),
                String(item[value])
            ])
        );
    }

    recordToArray<
        K extends keyof T,
        V extends keyof T
    >(
        record: Record<string, string>,
        key: K,
        value: V,
        extra?: Omit<T, K | V>
    ): T[] {
        let id = 1;

        return Object.entries(record).map(([k, v]) => ({
            ...(extra ?? {}),
            [key]: isNaN(Number(k)) ? k : Number(k),
            [value]: v,
            id: id++
        } as T));
    }
}
