
class AnimeService {
    /**
     * @param animeName 
     * @param seasonName 
     * @param episodesNumbers 
     */
    static displayAnime(animeName, seasonName, episodesNumbers){
        console.log(`\n- Anime -`);
        console.log(`Name: ${animeName}`);
        console.log(`Season: ${seasonName}`);
        console.table(`Episodes: ${episodesNumbers}\n`);
    }

    static displayAnimeNames(animes) {
        console.log("\n- Animes -");
        animes.forEach((name, index) => {
            console.log(`[${index + 1}] ${name}`);
        });
    }

    static displaySeasons(seasons) {
        console.log("\n- Seasons -");
        seasons.forEach((season, index) => {
            console.log(`[${index + 1}] ${season.name}`);
        });
    }
}

module.exports = AnimeService;