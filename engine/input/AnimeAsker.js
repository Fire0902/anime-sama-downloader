const Inquirer = require('./Inquirer');
const { websiteUrl } = require('../../config/config');

/**
 * Service for handling specific input for anime format.
 */
class AnimeAsker {

    static async askSelect(msg, choices){
        return await Inquirer.select(msg, choices);
    }    

    static async askAnime() {
        let animeName = await Inquirer.input('Enter an anime name', websiteUrl);
        animeName = animeName.replace(" ", "+");
        return animeName
    }

    static async askAnimeFromList(animes) {
        return await this.askSelect(`Choose an anime`, animes);
    }

    static async askSeasonFromList(seasons) {
        return await this.askSelect(`Choose a season`, seasons);
    }

    static async askAnimeNumberFromList(animes) {
        const animeNumber = await Inquirer.number(`Choose an anime [1-${animes.length}]`, true);
        const animeName = animes[animeNumber];
        return animeName;
    }

    static async askSeasonNumberFromList(seasons) {
        return await Inquirer.number(`Choose a season [1-${seasons.length}]`, true);
    }

    static async askEpisodesFromList(episodes) {
        return await Inquirer.numbers(`Choose one or multiple episodes [1-${episodes[0].length}] or [1, 2, 5, 7, 12]`);
    }
}

module.exports = AnimeAsker;