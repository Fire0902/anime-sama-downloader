import { input, number, select, checkbox, confirm, search, Separator } from '@inquirer/prompts';
import Parser from '../utils/Parser.ts';
import Log from '../utils/Log.ts';

/**
 * Generic API to display inquirer.js lib with simpler methods
 * @see https://www.npmjs.com/package/inquirer
 */
export default class Inquirer {

    private static readonly logger = Log.create(this.name);

    /**
     * @param message text to prompt
     * @returns user input as string.
     */
    static async input(msg: string): Promise<string> {
        this.logger.info(`Waiting for input with prompt: ${msg}`);
        return await input({ message: msg });
    }

    /**
     * Prompt and read one number as user input.
     * @param message text to prompt
     * @param isArrayIndex if selected number is a index in an array
     * @returns user input as integer.
     */
    static async number(msg: string, isArrayIndex: boolean = false): Promise<number> {
        this.logger.info(`Waiting for number (isIndex: ${isArrayIndex}) with prompt: ${msg}`);
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
        this.logger.info(`Waiting for numbers with prompt: ${msg}`);
        return Parser.parseNumbers(await input({ message: msg }));
    }

    /**
     * Prompt and read a 'yes/no' choice as user input. Can press enter for 'yes' option.
     * @param {*} msg
     * @returns if user selected yes or no.
     */
    static async confirm(msg: string): Promise<boolean> {
        this.logger.info(`Waiting for confirm with prompt: ${msg}`);
        return await confirm({ message: msg });
    }

    /**
     * 
     * @param msg 
     * @param choices 
     * @returns 
     */
    static async select(msg: string, choices: (string | Separator)[]): Promise<string> {
        this.logger.info(`Waiting for select with prompt: ${msg}`);
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
        this.logger.info(`Waiting for checkbox with prompt: ${msg}`);
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
        this.logger.info(`Waiting for search with prompt: ${msg} and url: ${url}`);
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
        this.logger.info(`Adding separator to choices`);
        choices.push(new Separator());
        return choices;
    }
}
