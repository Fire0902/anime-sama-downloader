import { Logger } from "tslog";
import Config from "../../config/Config.ts";
import FileUtils from "../file/FileUtils.ts";

/**
 * Class for creating and configuring loggers
 * @see https://www.npmjs.com/package/tslog
 */
export default class Log {
	/**
	 * Creates and configure a new logger instance.
	 * @param name logger name, by default 'Logger'.
	 * @param type log type, by default 'hidden'.
	 * @param minLevel
	 * @returns new logger
	 * @see https://www.npmjs.com/package/tslog
	 */
	static create(
		name: string = "Logger",
		type: "hidden" | "json" | "pretty" = Config.logDefaultType,
		minLevel: number = Config.logMinLevel
	): Logger<any> {
		const logger = new Logger({
			name: name,
			type: type,
			minLevel: minLevel
		});

		this.attachTransport(logger);
		return logger;
	}

	/**
	 * Attaches logger to transport into log files.
	 * Given logger will write in logs file everytime a log method is called.
	 * @param logger logger object to attach
	 * @see https://www.npmjs.com/package/tslog
	 */
	private static attachTransport(logger: Logger<any>) {
		logger.attachTransport(
			async (logObj) =>
				await FileUtils.append(
					Config.logPath,
					`${new Date().toDateString()}.${Config.logFileType}`,
					logObj
				),
		);
	}
}
