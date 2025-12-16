import fs from "fs/promises";
import fsSync from "fs";
import { spawn } from "child_process";
import cliProgress from "cli-progress";
import axios from "axios";
import Browser from '../utils/BrowserPuppet.ts';
import Config from '../config/Config.ts';
import Log from "../utils/Log.ts";

/**
 * 
 */
export default class EpisodeDownloader {

  private static readonly logger = Log.create(this.name);
  private static readonly multiBar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: '{name} [{bar}] {percentage}%'
    },
    cliProgress.Presets.shades_classic
  );

  /**
   * @param m3u8Url 
   * @param output 
   * @param bar 
   * @returns 
   */
  static runFFmpeg(m3u8Url: string, output: any, bar: any) {
    this.logger.info(`Running FFmpeg for: ${m3u8Url}`);

    return new Promise((resolve, reject) => {
      const ff = spawn("ffmpeg", ["-i", m3u8Url, "-codec", "copy", output]);

      ff.stderr.on("data", data => {
        const line = data.toString();
        const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);

        if (timeMatch && bar) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseFloat(timeMatch[3]);
          const current = hours * 3600 + minutes * 60 + seconds;
          bar.update(Math.floor(current));
        }
      });

      ff.on("close", () => {
        if (bar) bar.update(bar.getTotal());
        bar.stop();
        resolve(() => { });
      });

      ff.on("error", err => reject(err));
    });
  }

  /**
   * Download an episode.
   * @param rawVideoUrl
   * @param episode 
   * @param season 
   * @param anime 
   * @returns 
   */
  static async downloadEpisodeVidmoly(rawVideoUrl: string, episode: any, season: any, anime: any, retry = 0) {
    this.logger.info(`Downloading episode ${episode} from Vidmoly: ${rawVideoUrl}`);

    const page = await Browser.goto(rawVideoUrl);
    const htmlContent = await page.content();

    const folderPath = `${Config.downloadPath}/${anime}/${season}/`;
    await fs.mkdir(folderPath, { recursive: true });

    const regex = /sources:\s*\[\{file:"([^"]+)"/;
    const match = htmlContent.match(regex);

    if (!match) {
      const episodeFormatedName = `EP-${episode}`;
      const filePath = `${Config.downloadPath}/${anime}/${season}/${episodeFormatedName}-${Date.now()}.${Config.downloadDefaultFormat}`;

      await fs.writeFile(filePath, htmlContent);
      await Browser.requestTimeout(1000);
      await Browser.closePage(page);
      if (retry <= 5) {
        this.downloadEpisodeVidmoly(rawVideoUrl, episode, season, anime, retry + 1);
      }
      return;
    }

    const m3u8Url = match[1];

    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      m3u8Url
    ]);

    let duration = 0;
    ffprobe.stdout.on("data", data => {
      duration = parseFloat(data.toString());
    });

    await new Promise(resolve => ffprobe.on("close", resolve));

    const episodeFormatedName = `Episode-${episode}`;
    const seasonFormatedName = `${season}/${episodeFormatedName}`;
    const animeFormatedName = `${anime}/${seasonFormatedName}`
    const filePath = `${Config.downloadPath}/${animeFormatedName}`

    const bar = this.multiBar.create(Math.floor(duration), 0, { name: seasonFormatedName });
    await this.runFFmpeg(m3u8Url, `${filePath}.${Config.downloadFFmpegFormat}`, bar);

    Browser.closePage(page);
  }

  /**
   * 
   * @param rawVideoUrl 
   * @param episode 
   * @param season 
   * @param anime 
   * @returns 
   */
  static async downloadEpisodeSibnet(rawVideoUrl: string, episode: any, season: any, anime: any) {
    this.logger.info(`Downloading episode ${episode} from Sibnet: ${rawVideoUrl}`);

    const page = await Browser.goto(rawVideoUrl);

    const mp4url = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll("script")];
      for (let sc of scripts) {
        if (sc.textContent.includes("player.src")) {
          const match = sc.textContent.match(/src:\s*"\s*(.*?)\s*"/);
          if (match) return match[1];
        }
      }
      return null;
    });
    if (!mp4url) {
      this.logger.error("MP4 video not found.");
      Browser.closePage(page);
      return;
    }
    Browser.closePage(page);

    const finalUrl = Config.sibnetUrl + mp4url;

    const folderPath = `${Config.downloadPath}/${anime}/${season}`;

    const episodeFormatedName = `Episode-${episode}.mp4`;
    const seasonFormatedName = `${season}/${episodeFormatedName}`;
    const animeFormatedName = `${anime}/${seasonFormatedName}`;

    const filePath = `${folderPath}/${animeFormatedName}`;

    await fs.mkdir(`${folderPath}`, { recursive: true });
    await this.requestMP4(finalUrl, filePath, seasonFormatedName);
  }

  /**
   * 
   * @param url 
   * @param outPath 
   * @param barName 
   * @returns 
   */
  static async requestMP4(url: string, outPath: string, barName = "Download") {
    const res = await axios.get(url, {
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": Config.sibnetUrl,
      }
    });

    const total = parseInt(res.headers["content-length"], 10);
    let downloaded = 0;

    const bar = this.multiBar.create(total, 0, { name: barName });

    const writer = fsSync.createWriteStream(outPath);

    res.data.on("data", (chunk: any) => {
      downloaded += chunk.length;
      bar.update(downloaded);
    });

    res.data.pipe(writer);

    return new Promise(resolve => {
      writer.on("finish", () => {
        bar.update(total);
        resolve(() => { });
      });
    });
  }
}


