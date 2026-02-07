/**
 * Anime data structure
 */
export default class Anime {
    name: string;
    seasons!: Record<string, string>;
    selectedSeason!: string;
    episodesUrls!: any;

    /**
     * Creates a new Anime instance.
     * @param name
     */
    public constructor(name: string) {
        this.name = name;
    }
}