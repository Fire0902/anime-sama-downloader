import { EventEmitter } from "events";
import axios from "axios";
import fs from "fs";
import Config from "../../../config/Config.ts";
import type { TaskStrategy } from "../strategy/TaskStrategy.ts";

export default class AxiosTask extends EventEmitter implements TaskStrategy {
    private url: string;
    private outputPath: string;

    constructor(
        url: string,
        outputPath: string
    ) {
        super();
        this.url = url;
        this.outputPath = outputPath;
    }

    async start() {
        try {
            const res = await axios.get(this.url, {
                responseType: "stream",
                headers: {
                    "User-Agent": Config.userAgent,
                    Referer: Config.videoHostAdress,
                },
            });

            const total = Number.parseInt(res.headers["content-length"] || "0", 10);
            let downloaded = 0;

            this.emit("start", { total });
            this.emit("duration", total);

            const writer = fs.createWriteStream(this.outputPath);

            res.data.on("data", (chunk: Buffer) => {
                downloaded += chunk.length;
                this.emit("progress", downloaded, total);
            });

            res.data.on("error", (err: Error) => {
                this.emit("error", err);
            });

            writer.on("finish", () => {
                this.emit("progress", total, total);
                this.emit("done", true);
            });

            writer.on("error", (err: Error) => {
                this.emit("error", err);
            });

            res.data.pipe(writer);

        } catch (err) {
            this.emit("error", err);
        }
    }
}