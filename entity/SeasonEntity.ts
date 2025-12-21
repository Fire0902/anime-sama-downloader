import BaseEntity from "./BaseEntity.ts";

export type Season = {
    id: number;
    anime_id: number;
    name: string;
    url: string;
    season_index: number;
};

export default class SeasonEntity extends BaseEntity<Season> {
    protected table = "season";
    protected columns: (keyof Season)[] = [
        "id",
        "anime_id",
        "name",
        "url",
        "season_index"
    ];
}
