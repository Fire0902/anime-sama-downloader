import BaseEntity from "./BaseEntity.ts";

export type Anime = {
    id: number;
    name: string;
    url: string;
};

export default class AnimeEntity extends BaseEntity<Anime> {
    protected table = "anime";
    protected columns: (keyof Anime)[] = ["id", "name", "url"];

    animeArrayToRecord(animes: Anime[]): Record<string, string> {
        return Object.fromEntries(
            animes.map(a => [a.name, a.url])
        );
    }

    recordToAnimeArray(record: Record<string, string>): Anime[] {
        let id = 1;
        return Object.entries(record).map(([name, url]) => ({
            id: id++,
            name,
            url
        }));
    }

}
