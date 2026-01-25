import fsp from "node:fs/promises";
import fs from "node:fs"
import Config from "../../config/Config.ts";

/**
 * Class for creating and handling file and folders
 * @see https://nodejs.org/api/fs.html
 */
export default class FileUtils {

    /**
     * Appends a file or create a new one recursively.
     * @param path folder path to recursively create
     * @param name file name
	 * @param content text content to append to file
     * @param encoding file encoding (ex: utf8)
     * @see https://nodejs.org/en/learn/manipulating-files/writing-files-with-nodejs
     */
	static async append(
        path = `.`,
        name = `${new Date().toDateString()}.txt`,
        content: any = '',
        encoding = Config.defaultEncoding
    ) 
    {
		await this.createFolder(path);
		const filePath = `${path}/${name}`;

        // Try to create file
        if (!fs.existsSync(filePath)) {
			await fsp.writeFile(filePath, "", encoding);
		}
		await fsp.appendFile(filePath, JSON.stringify(content, null, 1) + "\n");
	}

    /**
	 * Create a folder recursively.
	 * @param path folder path to recursively create
	 */
	static async createFolder(path = '.') {
		await fsp.mkdir(path, { recursive: true });
	}
}
