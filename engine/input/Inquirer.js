const { input, number, select, checkbox, confirm, search, Separator } = require ('@inquirer/prompts');
const Parser = require('../Parser');

/**
 * API to display inquirer.js lib with simpler methods
 * @see inquirer
 */
class Inquirer {
    /**
     * @param message text to prompt
     * @returns user input as string.
     */
    static async input(msg) {
        return await input({message: msg});
    }

    /**
     * Prompt and read one number as user input.
     * @param message text to prompt
     * @param isArrayIndex if selected number is a index in an array
     * @returns user input as integer.
     */
    static async number(msg, isArrayIndex = false) {
        let input = await number({message: msg});
        if (isArrayIndex) input--;
        return input;
    }

    /**
     * Prompt and read multiple numbers as user input
     * @param message text to prompt
     * @returns user input as integers.
     */
    static async numbers(msg) {
        return Parser.parseNumbers(await input({message: msg}));
    }

    /**
     * Prompt and read a yes/no choice as user input
     * @param {*} msg 
     * @param {*} choices 
     * @returns if user selected yes or no.
     */
    static async confirm(msg) {
        return await confirm({message: msg});
    }

    static async select(msg, choices) {
        return await select({
            message: msg,
            choices: choices,
        });
    }

    static async checkbox(msg, choices) {
        return await checkbox({
            message: msg,
            choices: choices,
        });
    }

    /**
     * NOT WORKING
     * Prompt, search and read an anime name as user input
     * @param {*} msg 
     * @param {*} url 
     * @returns selected anime name
     */
    static async searchAnime(msg, url) {
        return await await search({
            message: msg,
            source: async (input) => {
                if (!input) return [];

                let searchUrl = `${url}/?search=${input}`;
                searchUrl = searchUrl.replaceAll(" ", "+");

                // const animes = await Scrapper.extractAnimeTitles();
                // const animeNames = Object.keys(animes);

                return [ searchUrl ];
            }
        });
    }

    /**
     * Separator object in choices list. Used to space/separate choices group
     * @param {*} choices 
     * @returns choices with an added separator
     */
    static addSeparator(choices){
        return choices.push(new Separator());
    }
}

module.exports = Inquirer;