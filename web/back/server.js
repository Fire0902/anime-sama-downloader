const express = require("express");
const cors = require("cors");
const Browser = require('../../engine/Browser');
const { removeScans, startDownload, downloadWorker, getNotStrikedEpisodeDownloader } = require('../../engine/DownloadService');
const { websiteUrl } = require("../../config/config");
const { extractAnimeTitles, extractSeasonsWithScans, extractEpisodes } = require("../../engine/Scrapper");
const { parseNumbers } = require("../../engine/Parser");
const fs = require("fs");
const { spawn } = require("child_process");
const { requestTimeout } = require("../../engine/EpisodeDownloader");


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post("/input", async (req, res) => {
    const { value, lastChar } = req.body;

    const page = await Browser.newPage();

    console.log("Reçu du frontend:");
    console.log("Valeur complète:", value);
    console.log("Dernière lettre:", lastChar);

    const url = `${websiteUrl}/?search=${value.replaceAll(" ", "+")}`;
    await page.goto(url, {
        waitUntil: 'networkidle2'
    });

    const animesTitle = await extractAnimeTitles(page);

    res.json({ animesTitle: animesTitle });
});
app.post("/seasons", async (req, res) => {
    const { animeUrl } = req.body;

    const page = await Browser.newPage();

    await page.goto(animeUrl, {
        waitUntil: 'networkidle2'
    });
    const animeSeasonsWithScan = await extractSeasonsWithScans(page);
    const animeSeasons = removeScans(animeSeasonsWithScan);
    res.json({ animeSeasons: animeSeasons });
});

app.get("/episodes", async (req, res) => {
    const { animeName, seasonName, seasonUrl } = req.query;

    const readers = await extractEpisodes(seasonUrl);
    const url = readers[0][0].replace('to/', 'net/');

    const page = await Browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await requestTimeout(700);
    const html = await page.content();

    const regex = /sources:\s*\[\{file:"([^"]+)"/;
    const match = html.match(regex);
    const m3u8Url = match[1];

    const tmpFile = `/tmp/${animeName}-${seasonName}.mp4`;

    const ff = spawn("ffmpeg", [
        "-i", m3u8Url,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        "-movflags", "faststart",
        tmpFile
    ]);

    ff.stderr.on("data", data => console.log(data.toString()));

    ff.on("close", () => {
        res.download(tmpFile, `${animeName}-${seasonName}.mp4`, err => {
            if (err) console.error(err);
            fs.unlink(tmpFile, () => { });
        });
    });
});




app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
