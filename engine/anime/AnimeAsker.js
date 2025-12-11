const Inquirer = require('../input/Inquirer');

/**
 * Service for handling specific input for anime questions.
 */
class AnimeAsker {

    /**
     * 
     * @param {*} msg 
     * @param {*} choices 
     * @returns 
     */
    static async askSelect(msg, choices){
        return await Inquirer.select(msg, choices);
    }    

    /**
     * 
     * @returns 
     */
    static async askAnime() {
        return await Inquirer.input(`Enter an anime name`);
    }

    /**
     * 
     * @param {*} animes 
     * @returns 
     */
    static async askAnimeFromList(animes) {
        return await this.askSelect(`Choose an anime`, animes);
    }

    /**
     * 
     * @param {*} seasons 
     * @returns 
     */
    static async askSeasonFromList(seasons) {
        return await this.askSelect(`Choose a season`, seasons);
    }

    /**
     * 
     * @param {*} animes 
     * @returns 
     */
    static async askAnimeNumberFromList(animes) {
        const animeNumber = await Inquirer.number(`Choose an anime [1-${animes.length}]`, true);
        const animeName = animes[animeNumber];
        return animeName;
    }

    /**
     * 
     * @param {*} seasons 
     * @returns 
     */
    static async askSeasonNumberFromList(seasons) {
        return await Inquirer.number(`Choose a season [1-${seasons.length}]`, true);
    }

    /**
     * 
     * @param {*} episodes 
     * @returns 
     */
    static async askEpisodesFromList(episodes) {
        return await Inquirer.numbers(`Choose one or multiple episodes [1-${episodes[0].length}] OR [1, 3, 7, ...]`);
    }
}

module.exports = AnimeAsker;