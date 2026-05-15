import { EventEmitter } from "events";
import axios from "axios";
import fs from "fs";
import Config from "../../../config/Config.ts";
import type { TaskStrategy } from "../strategy/TaskStrategy.ts";

export default class AxiosTask extends EventEmitter implements TaskStrategy {
    private url: string;
    private outputPath: string;
    private referer: string | undefined;

    constructor(
        url: string,
        outputPath: string,
        referer?: string
    ) {
        super();
        this.url = url;
        this.outputPath = outputPath;
        this.referer = referer;
    }

    async start() {
        try {
            const res = await axios.get(this.url, {
                responseType: "stream",
                headers: {
                    "User-Agent": Config.userAgent,
                    ...(this.referer ? { Referer: this.referer } : {}),
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