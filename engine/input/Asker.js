const InputService = require('./InputService');
const { websiteUrl } = require('../../config/config');

/**
 * Service for handling specific input for anime format.
 */
class Asker {
    static async askAnime() {
        let animeName = await InputService.input('Enter an anime name', websiteUrl);
        animeName = animeName.replace(" ", "+");
        return animeName
    }

    static async askAnimeFromList(animes) {
        const animeNumber = await InputService.number(`Choose an anime [1-${animes.length}]`, true);
        const animeName = animes[animeNumber];
        return animeName;
    }

    static async askSeasonNumberFromList(seasons) {
        return await InputService.number(`Choose a season [1-${seasons.length}]`, true);
    }

    static async askEpisodesFromList(episodes) {
        return await InputService.numbers(`Choose one or multiple episodes [1-${episodes[0].length}]`);
    }
}

module.exports = Asker;