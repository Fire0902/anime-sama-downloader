import { input, select, confirm, Separator } from '@inquirer/prompts';
import Parser from '../Parser.ts';
import Log from '../log/Log.ts';

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
    static async input(msg: string) {
        this.logger.info(`Waiting for input with prompt: ${msg}`);
        return await input({ message: msg });
    }

    /**
     * Prompt and read multiple numbers as user input
     * @param message text to prompt
     * @returns user input as integers.
     */
    static async numbers(msg: string) {
        this.logger.info(`Waiting for numbers with prompt: ${msg}`);
        return Parser.parseNumbers(await input({ message: msg }));
    }

    /**
     * Prompt and read a 'yes/no' choice as user input. Can press enter for 'yes' option.
     * @param {*} msg
     * @returns if user selected yes or no.
     */
    static async confirm(msg: string) {
        this.logger.info(`Waiting for confirm with prompt: ${msg}`);
        return await confirm({ message: msg });
    }

    /**
     * Prompt and read multiple numbers as user input
     * @param message text to prompt
     * @param choices list of possible choices
     * @returns user selected choice.
     */
    static async select(msg: string, choices: (string | Separator)[]): Promise<string> {
        this.logger.info(`Waiting for select with prompt: ${msg}`);
        return await select({
            message: msg,
            choices: choices,
        });
    }

    /**
     * Separator object in choices list. Used to space/separate choices group
     * @param {*} choices 
     * @returns choices with an added separator
     */
    static addSeparator(choices: (string | Separator)[]) {
        this.logger.info(`Adding separator to choices`);
        choices.push(new Separator());
        return choices;
    }
}
