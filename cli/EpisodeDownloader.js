const puppeteer = require('puppeteer');
const fs = require("fs/promises");
const { spawn } = require("child_process");
const cliProgress = require("cli-progress");

const multiBar = new cliProgress.MultiBar(
  {
    clearOnComplete: false,
    hideCursor: false,
    format: '{name} [{bar}] {percentage}% | {value}/{total} sec'
  },
  cliProgress.Presets.shades_classic
);

const downloadPath = './animes';
const downloadDefaultFormat = 'txt';
const downloadEncoding = 'utf8';

const downloadFFmpegFormat = 'mp4';

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
async function downloadEpisode(rawVideoUrl, episode, season, anime) {
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(rawVideoUrl, { waitUntil: 'networkidle2' });
  await requestTimeout(500)

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
    await browser.close();
    downloadEpisode(rawVideoUrl, episode, season, anime);
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

  const episodeFormatedName = `E-${episode}`;
  const bar = multiBar.create(Math.floor(duration), 0, { name: `${season}-${episodeFormatedName}` });
  await runFFmpeg(m3u8Url, `${downloadPath}/${anime}/${season}/${episodeFormatedName}.${downloadFFmpegFormat}`, bar);
  await browser.close();
}

/**
 * Sends a timeout request to website, used for anti-bot bypass.
 * @param duration duration in miliseconds
 */
async function requestTimeout(duration) {
  await new Promise(resolve => setTimeout(resolve, duration));
}

module.exports = { downloadEpisode, requestTimeout };
