import BaseEntity from "./BaseEntity.ts";

export type Episode = {
    id: number;
    season_id: number;
    episode_index: number;
    url: string;
};

export default class EpisodeEntity extends BaseEntity<Episode> {
    protected table = "episode";
    protected columns: (keyof Episode)[] = [
        "id",
        "season_id",
        "episode_index",
        "url"
    ];
}
