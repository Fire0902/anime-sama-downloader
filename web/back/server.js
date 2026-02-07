import express from "express";
import cors from "cors";
import Puppeteer from '../../src/utils/web/Puppeteer.ts';
import AnimeService from '../../src/service/anime/AnimeService.ts';
import Config from "../../src/config/Config.ts";
import Scrapper from "../../src/utils/web/Scrapper.ts";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
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

const activeDownloads = new Map();
const DOWNLOADS_DIR = './downloads';

if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.get("/existing-downloads", (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const downloads = files
            .filter(file => file.endsWith('.mp4'))
            .map(file => {
                const filePath = path.join(DOWNLOADS_DIR, file);
                const stats = fs.statSync(filePath);
                const downloadId = `existing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                activeDownloads.set(downloadId, {
                    filePath: filePath,
                    fileName: file,
                    socketId: null
                });

                return {
                    downloadId,
                    fileName: file,
                    fileSize: stats.size,
                    downloadUrl: `http://localhost:${PORT}/download/${downloadId}`,
                    createdAt: stats.birthtime
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        res.json({ downloads });
    } catch (error) {
        console.error("Erreur lors de la récupération des téléchargements:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.delete("/download/:downloadId", (req, res) => {
    const { downloadId } = req.params;
    const downloadInfo = activeDownloads.get(downloadId);

    if (!downloadInfo) {
        return res.status(404).json({ error: "Téléchargement introuvable" });
    }

    const { filePath } = downloadInfo;

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`Erreur suppression:`, err);
                return res.status(500).json({ error: "Erreur lors de la suppression" });
            }
            console.log(`Fichier supprimé:`, filePath);
            activeDownloads.delete(downloadId);
            res.json({ success: true, message: "Fichier supprimé" });
        });
    } else {
        activeDownloads.delete(downloadId);
        res.status(404).json({ error: "Fichier introuvable" });
    }
});

app.post("/input", async (req, res) => {
    const { value } = req.body;
    const page = await Puppeteer.newPage();
    console.log("Reçu du frontend:", value);
    const url = `${Config.websiteAdress}/catalogue/?search=${value.replaceAll(" ", "+")}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
    const animesTitle = await Scrapper.extractAnimeTitles(page);
    res.json({ animesTitle: animesTitle });
});

app.post("/seasons", async (req, res) => {
    const { animeUrl } = req.body;
    const page = await Puppeteer.newPage();
    await page.goto(animeUrl, { waitUntil: 'networkidle2' });
    const animeSeasonsWithScan = await Scrapper.extractSeasonsWithScans(page);
    const seasonsArray = animeSeasonsWithScan.map(s => s.name);
    const animeSeasons = AnimeService.removeScansFromSeasons(seasonsArray);
    const filtered = animeSeasonsWithScan.filter(season => animeSeasons.includes(season.name));
    res.json({ animeSeasons: filtered });
});

app.post("/episodes", async (req, res) => {
    const { seasonUrl } = req.body;
    console.log(seasonUrl);
    const readers = await Scrapper.extractEpisodes(seasonUrl);
    const readersNet = [];
    readersNet[0] = readers[0].map(episode => episode.replace('to/', 'net/'));
    readersNet[1] = readers[1].map(episode => episode.replace('to/', 'net/'));
    readersNet[2] = readers[2].map(episode => episode.replace('to/', 'net/'));

    const temp = await Puppeteer.newPage();
    const m3u8url = [[], [], []];
    for (let i = 0; i < readersNet.length; i++) {
        const reader = readersNet[i];

        for (let j = 0; j < reader.length; j++) {
            const url = reader[j];
            if(url.includes("vidmoly")){
                await temp.goto(url);
    
                const m3u8 = await temp.evaluate(() => {
                    if (window.jwplayer) {
                        const player = jwplayer("vplayer");
                        const sources = player.getPlaylist?.()?.[0]?.sources;
                        if (sources && sources.length > 0) {
                            return sources[0].file;
                        }
                    }
                    return null;
                });
    
                m3u8url[i][j] = m3u8;
            }
        }
    }
    if (!m3u8url) {
        return res.status(404).json({ error: "URL M3U8 introuvable" });
    }
    res.status(200).json({ m3u8url });
});

app.get("/download/:downloadId", (req, res) => {
    const { downloadId } = req.params;
    const downloadInfo = activeDownloads.get(downloadId);

    if (!downloadInfo) {
        return res.status(404).json({ error: "Téléchargement introuvable" });
    }

    const { filePath, fileName } = downloadInfo;

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Fichier introuvable" });
    }

    const stat = fs.statSync(filePath);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const readStream = fs.createReadStream(filePath);

    readStream.pipe(res);

    readStream.on('end', () => {
        console.log(`[${downloadId}] Téléchargement terminé`);
    });

    readStream.on('error', (err) => {
        console.error(`Erreur lecture fichier:`, err);
        res.status(500).json({ error: "Erreur lors de la lecture du fichier" });
    });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log("Client connecté:", socket.id);

    socket.on("downloadEpisode", ({ m3u8Url, output, downloadId }) => {
        console.log(`[${downloadId}] Starting download:`, m3u8Url, "->", output);

        const outputPath = path.join(DOWNLOADS_DIR, output);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        activeDownloads.set(downloadId, {
            filePath: outputPath,
            fileName: output,
            socketId: socket.id
        });

        const ff = spawn("ffmpeg", [
            "-i", m3u8Url,
            "-c", "copy",
            "-bsf:a", "aac_adtstoasc",
            "-y",
            outputPath
        ]);

        ff.stderr.on("data", (data) => {
            const line = data.toString();

            const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const seconds = parseFloat(timeMatch[3]);
                const current = hours * 3600 + minutes * 60 + seconds;

                socket.emit("progress", { current, downloadId });
            }
        });

        ff.on("close", (code) => {
            console.log(`[${downloadId}] FFMPEG terminé avec le code:`, code);
            if (code === 0) {
                const fileSize = fs.statSync(outputPath).size;
                console.log(`[${downloadId}] Fichier prêt (${fileSize} bytes)`);

                socket.emit("downloadReady", {
                    downloadId,
                    fileName: output,
                    fileSize,
                    downloadUrl: `http://localhost:${PORT}/download/${downloadId}`
                });
            } else {
                socket.emit("error", { message: `FFmpeg a échoué avec le code ${code}`, downloadId });
                activeDownloads.delete(downloadId);
            }
        });

        ff.on("error", (err) => {
            console.error(`[${downloadId}] Erreur FFMPEG:`, err);
            socket.emit("error", { message: err.message, downloadId });
            activeDownloads.delete(downloadId);
        });
    });

    socket.on("disconnect", () => {
        console.log("Client déconnecté:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});