import { EventEmitter } from "events";
import axios from "axios";
import fs from "fs";
import http from "http";
import https from "https";
import Config from "../../../config/Config.ts";
import PerfConfig from "../../../config/PerfConfig.ts";
import type { TaskStrategy } from "../strategy/TaskStrategy.ts";

// Speed: 6 sockets/host with 1 Mo writer buffer. Low-ram: 2 sockets, default 64K buffer.
const speedHttpAgent  = new http.Agent({ keepAlive: true, maxSockets: 6 });
const speedHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 6 });
const lowRamHttpAgent  = new http.Agent({ keepAlive: true, maxSockets: 2 });
const lowRamHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 2 });

export default class AxiosTask extends EventEmitter implements TaskStrategy {
    private url: string;
    private outputPath: string;
    private referer: string | undefined;

    constructor(url: string, outputPath: string, referer?: string) {
        super();
        this.url = url;
        this.outputPath = outputPath;
        this.referer = referer;
    }

    async start() {
        try {
            const lowRam = PerfConfig.lowRamMode;
            const res = await axios.get(this.url, {
                responseType: "stream",
                httpAgent:  lowRam ? lowRamHttpAgent  : speedHttpAgent,
                httpsAgent: lowRam ? lowRamHttpsAgent : speedHttpsAgent,
                headers: {
                    "User-Agent": Config.userAgent,
                    ...(this.referer ? { Referer: this.referer } : {}),
                },
                maxRedirects: 10,
            });

            const total = Number.parseInt(res.headers["content-length"] || "0", 10);
            let downloaded = 0;

            this.emit("start", { total });
            this.emit("duration", total);

            const writer = lowRam
                ? fs.createWriteStream(this.outputPath)
                : fs.createWriteStream(this.outputPath, { highWaterMark: 1024 * 1024 });

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
