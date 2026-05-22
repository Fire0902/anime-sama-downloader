import { EventEmitter } from "events";
import { spawn } from "node:child_process";
import PerfConfig from "../../../config/PerfConfig.ts";
import type { TaskStrategy } from "../strategy/TaskStrategy.ts";

export default class FFmpegTask extends EventEmitter implements TaskStrategy {
    private m3u8Url: string;
    private outputPath: string;

    constructor(m3u8Url: string, outputPath: string) {
        super();
        this.m3u8Url = m3u8Url;
        this.outputPath = outputPath;
    }

    async start() {
        // Speed tweaks: larger probe + keep-alive HLS. Skipped in low-ram mode
        // (each probesize buffer is held in RAM × concurrent downloads).
        const speedArgs = PerfConfig.lowRamMode ? [] : [
            "-http_persistent", "1",
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "30",
            "-fflags", "+genpts",
            "-analyzeduration", "2000000",
            "-probesize", "4000000",
        ];

        const ff = spawn("ffmpeg", [
            "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
            ...speedArgs,
            "-i", this.m3u8Url,
            "-c", "copy",
            "-bsf:a", "aac_adtstoasc",
            "-y",
            this.outputPath
        ]);

        let totalDuration = 0;
        let estimatedSize = 0;
        const bitratePerSecond = (2.5 * 1024 * 1024) / 8; // ~320 KB/s anime

        ff.stderr.on("data", (data) => {
            const line = data.toString();

            if (totalDuration === 0) {
                const match = line.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
                if (match) {
                    totalDuration =
                        parseInt(match[1]) * 3600 +
                        parseInt(match[2]) * 60 +
                        parseFloat(match[3]);
                    estimatedSize = Math.round(totalDuration * bitratePerSecond);
                    this.emit("duration", estimatedSize);
                }
            }

            const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
            if (timeMatch) {
                const current =
                    parseInt(timeMatch[1]) * 3600 +
                    parseInt(timeMatch[2]) * 60 +
                    parseFloat(timeMatch[3]);
                const downloadedBytes = Math.round(current * bitratePerSecond);
                this.emit("progress", downloadedBytes, estimatedSize);
            }
        });

        ff.on("close", (code) => this.emit("done", code === 0));
        ff.on("error", (err) => this.emit("error", err));
    }
}
