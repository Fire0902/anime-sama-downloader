import Fuse from "fuse.js";

type Anime = { id: number; name: string; url: string };

export default class Comparator {
    static compareAnimes(query: string, data: Anime[]) {
        if (query.length < 3) return [];

        const fuse = new Fuse<Anime>(data, {
            keys: ["name"],
            threshold: 0.35,
            ignoreLocation: true,
            includeScore: true,
            minMatchCharLength: 2,
        });

        return fuse.search(query)
            .map(r => {
                const baseScore = r.score ?? 1;

                const lengthFactor =
                    Math.min(query.length / r.item.name.length, 1);

                return {
                    item: r.item,
                    score: baseScore / lengthFactor,
                };
            })
            .filter(r => r.score < 0.6) // 🔥 filtre les faux positifs
            .sort((a, b) => a.score - b.score);
    }
}
