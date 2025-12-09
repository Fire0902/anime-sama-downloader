const { input, number, select, checkbox, confirm, search, Separator } = require ('@inquirer/prompts');
const parseNumbers = require('../Parser');

/**
 * API to display inquirer.js lib with simpler methods
 * @see inquirer.js
 */
class InputService {
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
        let answer = await number({message: msg});
        if (isArrayIndex) answer--;
        return answer;
    }

    /**
     * Prompt and read multiple numbers as user input
     * @param message text to prompt
     * @returns user input as integers.
     */
    static async numbers(msg) {
        let answer = await input({message: msg});
        return parseNumbers(answer);
    }

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

    static async search(msg, url) {
        return await await search({
            message: msg,
            source: async (input, { signal }) => {
                if (!input) return [];
                let completeUrl = `${url}/?search=${input}`;
                completeUrl = completeUrl.replaceAll(" ", "+");

                const response = await fetch( completeUrl, { signal });

                const animes = await extractAnimeTitles(page);
                const animeNames = Object.keys(animes);
                return [ animes ];
                //return data.objects.map((result) => ({ name: result.name })); 
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

module.exports = InputService;