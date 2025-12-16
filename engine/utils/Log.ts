import { Logger } from "tslog";
import Config from "../config/Config.ts";
import fs from "fs/promises";

export default class Log {
	static create(name: string): Logger<unknown> {
        const logger = new Logger({ name: name });
        logger.attachTransport( async (logObj) => {
			await fs.writeFile(Config.logsPath, "");
			await fs.appendFile(Config.logsPath, JSON.stringify(logObj) + "\n")
		});
		return logger;
	}
}
