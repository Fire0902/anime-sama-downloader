import { EventEmitter } from "events";
import { spawn } from "node:child_process";
import type { TaskStrategy } from "../strategy/TaskStrategy.ts";


export default class FFmpegTask extends EventEmitter implements TaskStrategy {
    private m3u8Url: string;
    private outputPath: string;
    
    constructor(
        m3u8Url: string, 
        outputPath: string
    ) {
        super();
        this.m3u8Url = m3u8Url;
        this.outputPath = outputPath;
    }

    async start() {
        const ff = spawn("ffmpeg", [
            "-i", this.m3u8Url,
            "-c", "copy",
            "-bsf:a", "aac_adtstoasc",
            "-y",
            this.outputPath
        ]);

        let totalDuration = 0;

        ff.stderr.on("data", (data) => {
            const line = data.toString();

            if (totalDuration === 0) {
                const match = line.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
                if (match) {
                    totalDuration =
                        parseInt(match[1]) * 3600 +
                        parseInt(match[2]) * 60 +
                        parseFloat(match[3]);

                    this.emit("duration", totalDuration);
                }
            }

            const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
            if (timeMatch) {
                const current =
                    parseInt(timeMatch[1]) * 3600 +
                    parseInt(timeMatch[2]) * 60 +
                    parseFloat(timeMatch[3]);

                this.emit("progress", current, totalDuration);
            }
        });

        ff.on("close", (code) => this.emit("done", code === 0));
        ff.on("error", (err) => this.emit("error", err));
    }
}