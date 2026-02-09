/**
 * Anime data structure
 */
export default class Anime {
    name: string;
    url!: string;

    // seasons
    seasons!: Record<string, string>;
    seasonNames!: string[];

    // chosen season
    chosenSeason!: string;
    chosenSeasonUrl!: string

    // episodes
    episodesUrls!: any;
    chosenEpisodes!: number[];

    /**
     * Creates a new Anime instance.
     * @param name
     */
    public constructor(name: string, url: string) {
        this.name = name;
        this.url = url;
    }

    public toString(): string {
        return ''
        + `\n----- ${this.name} -----\n`
        + this.chosenSeason 
        + `Episodes [${this.chosenEpisodes}]`
        + `\n------------------\n`;
    }
}