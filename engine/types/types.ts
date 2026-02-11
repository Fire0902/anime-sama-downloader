/**
 * Anime data structure
 */
export class Anime {
    name: string;
    url: string;

    /** Seasons */
    seasons!: Record<string, string>;
    seasonNames!: string[];

    /** Chosen season */
    season!: Season;

    // episodes
    episodesUrls!: [][];
    chosenEpisodes!: number[];

    isMovie: boolean = false;

    /**
     * Creates a new Anime instance.
     * @param name
     */
    public constructor(name: string, url: string) {
        this.name = name;
        this.url = url;
    }

    public toString(): string {
        if (this.isMovie){ 
            return '\n'
            + `|-----------------------|\n`
            + `         ${this.name}\n`
            + `|-----------------------|\n`
        }

        return '\n'
        + `|--------------------------------------|\n`
        + `            ${this.name}\n`
        + `            ${this.season.name}\n`
        + `            Episodes [${this.chosenEpisodes}]\n`
        + `|--------------------------------------|\n`        
        
        return ''
        + `\n----- ${this.name} -----\n`
        + this.season.name + '\n'
        + `Episodes [${this.chosenEpisodes}]`
        + `\n------------------\n`;
    }

    public setIsMovie(isMovie: boolean){
        this.isMovie = isMovie;
    }
}

/**
 * 
 */
export type Season = {
    name: string;
    url: string
};