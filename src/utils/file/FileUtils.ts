import fsp from "node:fs/promises";
import fs from "node:fs"
import Config from "../../config/Config.ts";

/**
 * Class for creating and handling file and folders.
 * @see [Node.js File System docs](https://nodejs.org/api/fs.html)
 * @see [Writing files with Node.js](https://nodejs.org/en/learn/manipulating-files/writing-files-with-nodejs)
 */
export default class FileUtils {

    /**
     * Asynchronously appends or create a file.
     * @param path folder path to recursively create
     * @param name file name
	 * @param content text content to append to file
     * @param encoding file encoding (ex: utf8)
	 * @see [fsPromises.appendFile](https://nodejs.org/api/fs.html#fspromisesappendfilepath-data-options)
     */
	static async append(
        path = `.`,
        name = `${new Date().toDateString()}.txt`,
        content = '',
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
	 * Asynchronously and recursivly creates a directory.
	 * @param path folder path to recursively create
	 * @see [fsPromises.mkdir](https://nodejs.org/api/fs.html#fspromisesmkdirpath-options)
	 */
	static async createFolder(path: string) {
		await fsp.mkdir(path, { recursive: true });
	}

    /**
	 * Returns true if the path exists, false otherwise.
	 * 
	 * For detailed information, see the documentation of the asynchronous version of this API: fs.exists().
	 * 
	 * fs.exists() is deprecated, but fs.existsSync() is not.
	 *  
	 * The callback parameter to fs.exists() accepts parameters that are inconsistent with other Node.js callbacks. 
	 * 
	 * fs.existsSync() does not use a callback.
	 * @param path folder path to recursively create
	 * @returns true if the path exists, false otherwise.
	 * @see [fs.existsSync](https://nodejs.org/api/fs.html#fsexistssyncpath)
	 */
	static existsPath(path: string) {
		return fs.existsSync(path);
	}
}
