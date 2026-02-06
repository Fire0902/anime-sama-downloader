import express from "express";
import cors from "cors";
import Puppeteer from '../../src/utils/web/Puppeteer.ts';
import AnimeService from '../../src/service/anime/AnimeService.ts';
import Config from "../../src/config/Config.ts";
import Scrapper from "../../src/utils/web/Scrapper.ts";
import fs from "fs";
import { spawn } from "child_process";
import EpisodeDownloader from "../../src/service/download/EpisodeDownloader.ts";
import { Server } from "socket.io";
import http from "http";


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.setTimeout(10 * 60 * 1000);
    next();
});


app.post("/input", async (req, res) => {
    const { value } = req.body;

    const page = await Puppeteer.newPage();

    console.log("Reçu du frontend:");
    console.log("Valeur complète:", value);

    const url = `${Config.websiteAdress}/catalogue/?search=${value.replaceAll(" ", "+")}`;

    console.log(url);

    await page.goto(url, {
        waitUntil: 'networkidle2'
    });

    const animesTitle = await Scrapper.extractAnimeTitles(page);

    console.log("résultats ", animesTitle)

    res.json({ animesTitle: animesTitle });
});
app.post("/seasons", async (req, res) => {
    const { animeUrl } = req.body;

    const page = await Puppeteer.newPage();

    await page.goto(animeUrl, {
        waitUntil: 'networkidle2'
    });
    const animeSeasonsWithScan = await Scrapper.extractSeasonsWithScans(page);
    const seasonsArray = animeSeasonsWithScan.map(s => s.name);
    const animeSeasons = AnimeService.removeScansFromSeasons(seasonsArray);
    console.log(animeSeasonsWithScan)
    const filtered = animeSeasonsWithScan.filter(season => animeSeasons.includes(season.name));
    res.json({ animeSeasons: filtered });
});

app.get("/episodes", async (req, res) => {
    const { animeName, seasonName, seasonUrl } = req.query;

    const decodedSeasonUrl = decodeURIComponent(seasonUrl);

    const readers = await Scrapper.extractEpisodes(decodedSeasonUrl);
    const url = readers[0][0].replace('to/', 'net/');

    const tmpFile = `./tmp/${animeName}-${seasonName}.mp4`;

    await EpisodeDownloader.downloadEpisodeVidmoly(url, 1, seasonName, animeName, 0, tmpFile)
    res.download(tmpFile, `${animeName}-${seasonName}.mp4`, err => {
        if (err) console.error(err);
        fs.unlink(tmpFile, () => { });
    });
    
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", socket => {
    console.log("Client connected");

    socket.on("downloadEpisode", ({ m3u8Url, output }) => {
        const ff = spawn("ffmpeg", ["-i", m3u8Url, "-codec", "copy", output]);

        ff.stderr.on("data", (data) => {
            const line = data.toString();
            const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const seconds = parseFloat(timeMatch[3]);
                const current = hours * 3600 + minutes * 60 + seconds;

                socket.emit("progress", { current });
            }
        });

        ff.on("close", () => {
            socket.emit("done", { file: output });
        });

        ff.on("error", (err) => {
            socket.emit("error", { message: err.message });
        });
    });
});

server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
