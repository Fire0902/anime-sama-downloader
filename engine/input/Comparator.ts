import Fuse from "fuse.js";

type Anime = { name: string; url: string; id: number };

export default class Comparator {
    static compareAnimes(query: string, data: Anime[]) {
        const fuse = new Fuse<Anime>(data, {
            keys: ["name"],
            threshold: 0.1,
            ignoreLocation: true,
        });

        const results = fuse.search(query);

        return results
            .map(r => {
                const originalScore = r.score ?? 1;
                const lenFactor = Math.min(query.length / 10, 1);
                return {
                    item: r.item,
                    score: originalScore * lenFactor,
                };
            })
            .sort((a, b) => a.score - b.score);
    }
}
