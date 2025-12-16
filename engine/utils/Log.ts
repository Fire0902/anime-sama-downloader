import { Logger } from "tslog";
import Config from "../config/Config.ts";
import fs from "node:fs/promises";

export default class Log {
	static create(name: string): Logger<unknown> {
		const logger = new Logger({ name: name });

		this.attachTransport(logger);
		return logger;
	}

	static attachTransport(logger: Logger<unknown>){
		logger.attachTransport(async (logObj) => {
			await fs.writeFile(Config.logsPath, '', Config.downloadEncoding);
			await fs.appendFile(Config.logsPath, JSON.stringify(logObj) + "\n")
		});
	}
}
