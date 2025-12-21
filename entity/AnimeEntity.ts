import BaseEntity from "./BaseEntity.ts";

export type Anime = {
    id: number;
    name: string;
    url: string;
};

export default class AnimeEntity extends BaseEntity<Anime> {
    protected table = "anime";
    protected columns: (keyof Anime)[] = ["id", "name", "url"];

    recordToAnimeArray(record: Record<string, string>): Anime[] {
        let id = 1; // générer des ids simples
        return Object.entries(record).map(([name, url]) => ({
            id: id++, // incrémente pour chaque anime
            name,
            url
        }));
    }

}
