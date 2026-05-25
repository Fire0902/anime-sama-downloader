import { EventEmitter } from "events";
import { spawn } from "node:child_process";
import PerfConfig from "../../../config/PerfConfig.ts";
import type { TaskStrategy } from "../strategy/TaskStrategy.ts";

export default class FFmpegTask extends EventEmitter implements TaskStrategy {
    private m3u8Url: string;
    private outputPath: string;
    private streamInfoEmitted = false;

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
            const chunk = data.toString();

            // Parse stream info once — process line by line for reliability
            if (!this.streamInfoEmitted) {
                for (const line of chunk.split('\n')) {
                    if (!line.includes('Video:')) continue;
                    const codecMatch = line.match(/Video:\s*(\w+)/);
                    const resMatch   = line.match(/(\d{3,4})x(\d{3,4})/);
                    if (codecMatch && resMatch) {
                        this.streamInfoEmitted = true;
                        const raw = codecMatch[1].toLowerCase();
                        const w = parseInt(resMatch[1]);
                        const h = parseInt(resMatch[2]);
                        const px = Math.min(w, h); // height = smaller dimension (landscape)
                        const resolution = px >= 2160 ? '4K' : px >= 1080 ? '1080p' : px >= 720 ? '720p' : px >= 480 ? '480p' : `${px}p`;
                        const codec = (raw.includes('hevc') || raw.includes('265')) ? 'H.265'
                            : (raw.includes('264') || raw === 'h264' || raw.includes('avc')) ? 'H.264'
                            : raw === 'vp9' ? 'VP9'
                            : raw.includes('av1') ? 'AV1'
                            : raw.toUpperCase();
                        this.emit("streamInfo", { resolution, codec });
                        break;
                    }
                }
            }

            if (totalDuration === 0) {
                const match = chunk.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
                if (match) {
                    totalDuration =
                        parseInt(match[1]) * 3600 +
                        parseInt(match[2]) * 60 +
                        parseFloat(match[3]);
                    estimatedSize = Math.round(totalDuration * bitratePerSecond);
                    this.emit("duration", estimatedSize);
                }
            }

            const timeMatch = chunk.match(/time=(\d+):(\d+):(\d+\.\d+)/);
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
