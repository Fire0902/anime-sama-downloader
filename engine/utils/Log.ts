import { Logger } from "tslog";
import Config from "../config/Config.ts";
import fs from "node:fs/promises";

/**
 * @see https://www.npmjs.com/package/tslog
 */
export default class Log {

	/**
	 * Creates and configure a new logger instance.
	 * @param name by default 'Logger'
	 * @returns new logger
	 */
	static create(name: string = 'Logger'): Logger<any> {
		const logger = new Logger({
			name: name,
			type: Config.logDefaultType,
			minLevel: Config.logMinLevel
		});

		this.#attachTransport(logger);
		return logger;
	}

	/**
	 * Attaches logger to transport into log files. 
	 * Given logger will write in logs file everytime a log method is called.
	 * @param logger logger object to attach
	 */
	static #attachTransport(logger: Logger<any>) {
		logger.attachTransport(async (logObj) => await this.#createFile(logObj));
	}

	/**
	 * Create recursively log file.
	 * @param logObj content to append to file
	 */
	static async #createFile(logObj: any){
		await fs.mkdir(Config.logPath, { recursive: true });
		const filePath = `${Config.logPath}/${new Date().toDateString()}.txt`

		await fs.writeFile(filePath, '', Config.defaultEncoding);
		await fs.appendFile(filePath, JSON.stringify(logObj) + "\n")
	}
}
