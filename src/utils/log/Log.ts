import { Logger } from "tslog";
import Config from "../../config/Config.ts";
import FileUtils from "../file/FileUtils.ts";

/**
 * Class for creating and configuring loggers.
 * @see [ts-log docs](https://tslog.js.org)
 */
export default class Log {

	/**
	 * Creates and configure a new logger instance.
	 * @param name logger name, by default 'Logger'
	 * @param type log type, by default 'hidden'
	 * @param minLevel
	 * @returns new logger
	 * @see [logs type docs](https://tslog.js.org/#/?id=settings)
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
	 * 
	 * Given logger will write in logs file for each called log method.
	 * @param logger logger to attach
	 * @see [attach addictional transport docs](https://tslog.js.org/#/?id=attach-additional-transports)
	 */
	private static attachTransport(logger: Logger<any>) {
		logger.attachTransport(
			async (logObj) =>
				await FileUtils.append(
					Config.logPath,
					Config.logFileName,
					logObj
				),
		);
	}
}
