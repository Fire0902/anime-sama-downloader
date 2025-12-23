import BaseEntity from "./BaseEntity.ts";

export type EpisodeUrl = {
    id: number;
    episode_id: number;
    player_id: number;
    url: string;
};

export default class EpisodeUrlEntity extends BaseEntity<EpisodeUrl> {
    protected table = "episode_url";
    protected columns: (keyof EpisodeUrl)[] = [
        "id",
        "episode_id",
        "player_id",
        "url"
    ];

    findByEpisode(episode_id: number): EpisodeUrl[] {
        return this.find({ episode_id });
    }

    addUrl(episode_id: number, player_id: number, url: string): void {
        this.insert({ episode_id, player_id, url });
    }
}
