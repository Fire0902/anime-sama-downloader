const InputService = require('./InputService');
const { websiteUrl } = require('../../config/config');
const { extractEpisodes, extractAnimeTitles, extractSeasonsWithScans } = require('../engine/Scrapper');

/**
 * Service for handling specific input for anime format.
 */
class Asker {
    static async askAnimeFromSearch() {
        let animeName = await InputService.search('Enter an anime name', websiteUrl);
        animeName = animeName.replace(" ", "+");
        return animeName
    }

    static async askAnimeFromIndex(animeNames) {
        const animeNumber = await InputService.number(`Choose an anime [1-${animeNames.length}]`, true);
        const animeName = animeNames[animeNumber];
        return animeName;
    }

    static async askSeasonFromIndex() {
        const seasonNumber = await InputService.number(`Choose a season [1-${seasons.length}]`, true);
        const seasonName = seasons[seasonNumber].name;
        return seasonName;
    }

    static async askEpisodeIndexes() {
        console.log("\n- Episodes -");
        const chosenEpisodesNumbers = await InputService.numbers(
            `Choose one or multiple episodes [1-${readers[0].length}]`
        );
        return chosenEpisodesNumbers;
    }
}

module.exports = Asker;