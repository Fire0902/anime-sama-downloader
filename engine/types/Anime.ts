/**
 * Anime data structure
 */
export default class Anime {
    name: string;

    seasons!: Record<string, string>;
    seasonNames!: string[];
    seasonsPageUrl!: string;

    seasonName!: string;
    seasonUrl!: string

    episodesUrls!: any;
    episodes!: number[];

    /**
     * Creates a new Anime instance.
     * @param name
     */
    public constructor(name: string, seasonsPageUrl: string) {
        this.name = name;
        this.seasonsPageUrl = seasonsPageUrl;
    }

    public toString(): string {
        return `\n----- ${this.name} -----\n`
        + this.seasonName 
        + `Episodes [${this.episodes}]`
        + `\n------------------\n`;
    }
}