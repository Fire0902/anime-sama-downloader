const fs = require("fs/promises");
const fsSync = require("fs");
const { spawn } = require("child_process");
const cliProgress = require("cli-progress");
const axios = require("axios");
const { sibnetUrl, downloadPath, downloadDefaultFormat, downloadEncoding, downloadFFmpegFormat } = require('../config/config');
const Browser = require('./Browser');

const multiBar = new cliProgress.MultiBar(
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
function runFFmpeg(m3u8Url, output, bar) {
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

    ff.on("close", _ => {
      if (bar) bar.update(bar.getTotal());
      bar.stop();
      resolve();
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
async function downloadEpisodeVidmoly(rawVideoUrl, episode, season, anime, retry = 0) {
  
  const page = await Browser.newPage();

  await page.goto(rawVideoUrl, { waitUntil: 'networkidle2' });
  await requestTimeout(700);
  // await page.waitForSelector(
  //   "#vs_ts",
  //   { timeout: 10000 }
  // );

  const html = await page.content();

  const folderPath = `${downloadPath}/${anime}/${season}/`;
  await fs.mkdir(folderPath, { recursive: true });

  const regex = /sources:\s*\[\{file:"([^"]+)"/;
  const match = html.match(regex);

  if (!match) {
    const episodeFormatedName = `EP-${episode}`;
    const filePath = `${downloadPath}/${anime}/${season}/${episodeFormatedName}-${Date.now()}.${downloadDefaultFormat}`;

    await fs.writeFile(filePath, html, downloadEncoding);
    await requestTimeout(1000);
    await Browser.closePage(page);
    if(retry <= 5){
      downloadEpisodeVidmoly(rawVideoUrl, episode, season, anime, retry+1);
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
  const seasonFormatedName = `${season}-${episodeFormatedName}`;
  const animeFormatedName = `${anime}/${seasonFormatedName}`
  const filePath = `${downloadPath}/${animeFormatedName}`

  const bar = multiBar.create(Math.floor(duration), 0, { name: seasonFormatedName });
  await runFFmpeg(m3u8Url, `${filePath}.${downloadFFmpegFormat}`, bar);
  
  await Browser.closePage(page);
}

async function downloadEpisodeSibnet(rawVideoUrl, episode, season, anime){
  const page = await Browser.newPage();

  await page.goto(rawVideoUrl, { waitUntil: "networkidle2" });
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
      console.log("[ERROR] MP4 video not found.");
      await Browser.closePage(page);
      return;
  }
  await Browser.closePage(page);

  const finalUrl = sibnetUrl + mp4url;
  const folderPath = `${downloadPath}/${anime}/${season}`;
  
  const episodeFormatedName = `Episode-${episode}`;
  const seasonFormatedName = `${season}/${episodeFormatedName}`;
  const filePath = `${folderPath}/${episodeFormatedName}.mp4`;

  await fs.mkdir(`${folderPath}`, { recursive: true });
  await requestMP4(finalUrl, filePath, seasonFormatedName);
}

async function requestMP4(url, outPath, barName = "Download") {
    const res = await axios.get(url, {
        responseType: "stream",
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": sibnetUrl,
        }
    });

    const total = parseInt(res.headers["content-length"], 10);
    let downloaded = 0;

    const bar = multiBar.create(total, 0, { name: barName });

    const writer = fsSync.createWriteStream(outPath);

    res.data.on("data", chunk => {
        downloaded += chunk.length;
        bar.update(downloaded);
    });

    res.data.pipe(writer);

    return new Promise(resolve => {
        writer.on("finish", () => {
            bar.update(total);
            resolve();
        });
    });
}


/**
 * Sends a timeout request to website, used for anti-bot bypass.
 * @param duration duration in miliseconds
 */
async function requestTimeout(duration) {
  await new Promise(resolve => setTimeout(resolve, duration));
}

module.exports = { downloadEpisodeVidmoly, downloadEpisodeSibnet, requestTimeout };
