import { Logger } from "tslog";
import Config from "../config/Config.ts";
import fsp from "node:fs/promises";
import fs from "node:fs"

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

		this.attachTransport(logger);
		return logger;
	}

	/**
	 * Attaches logger to transport into log files. 
	 * Given logger will write in logs file everytime a log method is called.
	 * @param logger logger object to attach
	 */
	private static attachTransport(logger: Logger<any>) {
		logger.attachTransport(async (logObj) => await this.createFile(logObj));
	}

	/**
	 * Create recursively log file.
	 * @param logObj content to append to file
	 */
	private static async createFile(logObj: any){
		await fsp.mkdir(Config.logPath, { recursive: true });
		const filePath = `${Config.logPath}/${new Date().toDateString()}.txt`

		if (!fs.existsSync(filePath)){
			await fsp.writeFile(filePath, '', Config.defaultEncoding);
		}
		await fsp.appendFile(filePath, JSON.stringify(logObj, null, 1) + "\n")
	}
}
