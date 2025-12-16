import { input, number, select, checkbox, confirm, search, Separator } from '@inquirer/prompts';
import Parser from '../../engine/utils/Parser.ts';

/**
 * Generic API to display inquirer.js lib with simpler methods
 * @see https://www.npmjs.com/package/inquirer
 */
export default class Inquirer {
    /**
     * @param message text to prompt
     * @returns user input as string.
     */
    static async input(msg: string): Promise<string> {
        return await input({ message: msg });
    }

    /**
     * Prompt and read one number as user input.
     * @param message text to prompt
     * @param isArrayIndex if selected number is a index in an array
     * @returns user input as integer.
     */
    static async number(msg: string, isArrayIndex: boolean = false): Promise<number> {
        let input;
        while (input === undefined) {
            input = await number({ message: msg });
        }
        if (isArrayIndex) input--;
        return input;
    }

    /**
     * Prompt and read multiple numbers as user input
     * @param message text to prompt
     * @returns user input as integers.
     */
    static async numbers(msg: string): Promise<number[]> {
        return Parser.parseNumbers(await input({ message: msg }));
    }

    /**
     * Prompt and read a 'yes/no' choice as user input. Can press enter for 'yes' option.
     * @param {*} msg
     * @returns if user selected yes or no.
     */
    static async confirm(msg: string): Promise<boolean> {
        return await confirm({ message: msg });
    }

    /**
     * 
     * @param msg 
     * @param choices 
     * @returns 
     */
    static async select(msg: string, choices: (string | Separator)[]): Promise<string> {
        return await select({
            message: msg,
            choices: choices,
        });
    }

    /**
     * 
     * @param msg 
     * @param choices 
     * @returns 
     */
    static async checkbox(msg: string, choices: (string | Separator)[]): Promise<string[]> {
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
    static async search(msg: string, url: string): Promise<string> {
        return await search({
            message: msg,
            source: (input) => {
                if (!input) return [];

                let searchUrl = `${url}/?search=${input}`;
                searchUrl = searchUrl.replaceAll(" ", "+");
                return [searchUrl];
            }
        });
    }

    /**
     * Separator object in choices list. Used to space/separate choices group
     * @param {*} choices 
     * @returns choices with an added separator
     */
    static addSeparator(choices: (string | Separator)[]): (string | Separator)[] {
        choices.push(new Separator());
        return choices;
    }
}
