import express from "express";
import cors from "cors";
import Puppeteer from '../../engine/utils/web/Puppeteer.ts';
import AnimeService from '../../engine/service/anime/AnimeService.ts';
import Config from "../../engine/config/Config.ts";
import Scrapper from "../../engine/utils/web/Scrapper.ts";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Server } from "socket.io";
import http from "http";
import DatabaseService from "./services/DatabaseService.ts";
import AuthService from "./services/AuthService.ts";
import FavoriteService from "./services/FavoriteService.ts";
import DownloadService from "./services/DownloadService.ts";
import MALScheduler from "./services/MALScheduler.ts";
import { AuthRequest, authMiddleware, adminMiddleware } from "./middleware/auth.ts";

const app = express();
const PORT = 3000;

app.use(cors())
app.use(express.json());
app.use((req: any, res: any, next: any) => {
    res.setTimeout(10 * 60 * 1000);
    next();
});

const activeDownloads = new Map();
const DOWNLOADS_DIR = './downloads';

if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}


app.post("/auth/register", async (req: any, res: any) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await AuthService.register(username, email, password);
        res.json({ user });
    } catch (error: any) {
        console.error("Registration error:", error);
        res.status(400).json({ error: error.message });
    }
});

app.post("/auth/login", async (req: any, res: any) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const authToken = await AuthService.login(username, password);
        res.json(authToken);
    } catch (error: any) {
        console.error("Login error:", error);
        res.status(401).json({ error: error.message });
    }
});

app.post("/auth/logout", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.substring(7);
            await AuthService.logout(token);
        }
        res.json({ success: true });
    } catch (error: any) {
        console.error("Logout error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/auth/me", authMiddleware, async (req: AuthRequest, res: any) => {
    res.json({ user: req.user });
});


app.get("/admin/users", authMiddleware, adminMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const users = await AuthService.getAllUsers();
        res.json({ users });
    } catch (error: any) {
        console.error("Get users error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/admin/users", authMiddleware, adminMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const { username, email, password, isAdmin } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await AuthService.register(username, email, password, isAdmin);
        res.json({ user });
    } catch (error: any) {
        console.error("Create user error:", error);
        res.status(400).json({ error: error.message });
    }
});

app.delete("/admin/users/:userId", authMiddleware, adminMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const userId = parseInt(req.params.userId);

        if (userId === req.user?.id) {
            return res.status(400).json({ error: "Cannot delete your own account" });
        }

        await AuthService.deleteUser(userId);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: error.message });
    }
});


app.get("/favorites", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const favorites = await FavoriteService.getUserFavorites(req.user!.id);
        res.json({ favorites });
    } catch (error: any) {
        console.error("Get favorites error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/favorites", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const { animeName, animeUrl, malId } = req.body;

        if (!animeName || !animeUrl) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const favorite = await FavoriteService.addFavorite(
            req.user!.id,
            animeName,
            animeUrl,
            malId
        );
        res.json({ favorite });
    } catch (error: any) {
        console.error("Add favorite error:", error);
        res.status(400).json({ error: error.message });
    }
});

app.delete("/favorites/:favoriteId", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const favoriteId = parseInt(req.params.favoriteId);
        await FavoriteService.removeFavorite(req.user!.id, favoriteId);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Remove favorite error:", error);
        res.status(400).json({ error: error.message });
    }
});

app.get("/mal/search", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const query = req.query.q as string;

        if (!query) {
            return res.status(400).json({ error: "Missing query parameter" });
        }

        const results = await FavoriteService.searchMAL(query);
        res.json({ results });
    } catch (error: any) {
        console.error("MAL search error:", error);
        res.status(500).json({ error: error.message });
    }
});


app.get("/downloads", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const downloads = await DownloadService.getUserDownloads(req.user!.id);
        res.json({ downloads });
    } catch (error: any) {
        console.error("Get downloads error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/downloads/hierarchy", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const hierarchy = await DownloadService.getDownloadHierarchy(req.user!.id);
        res.json({ hierarchy });
    } catch (error: any) {
        console.error("Get hierarchy error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/downloads/zip/anime", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const { animeName } = req.body;

        if (!animeName) {
            return res.status(400).json({ error: "Missing anime name" });
        }

        const zipPath = await DownloadService.zipAnime(animeName, req.user!.id);

        res.download(zipPath, path.basename(zipPath), (err) => {
            if (err) {
                console.error("Download error:", err);
            }
            fs.unlinkSync(zipPath);
        });
    } catch (error: any) {
        console.error("Zip anime error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/downloads/zip/season", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const { animeName, seasonName } = req.body;

        if (!animeName || !seasonName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const zipPath = await DownloadService.zipSeason(animeName, seasonName, req.user!.id);

        res.download(zipPath, path.basename(zipPath), (err: any) => {
            if (err) {
                console.error("Download error:", err);
            }
            fs.unlinkSync(zipPath);
        });
    } catch (error: any) {
        console.error("Zip season error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete("/downloads/:downloadId", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const { downloadId } = req.params;
        await DownloadService.deleteDownload(downloadId);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Delete download error:", error);
        res.status(500).json({ error: error.message });
    }
});


app.post("/input", authMiddleware, async (req: AuthRequest, res: any) => {
    const { value } = req.body;
    const page = await Puppeteer.newPage();
    console.log("Reçu du frontend:", value);
    const url = `${Config.websiteAdress}/catalogue/?search=${value.replaceAll(" ", "+")}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
    const animesTitle = await Scrapper.extractAnimeTitles(page);
    res.json({ animesTitle: animesTitle });
});

app.post("/seasons", authMiddleware, async (req: AuthRequest, res: any) => {
    const { animeUrl } = req.body;
    const page = await Puppeteer.newPage();
    await page.goto(animeUrl, { waitUntil: 'networkidle2' });
    const animeSeasonsWithScan = await Scrapper.extractSeasonsWithScans(page);
    const seasonsArray = animeSeasonsWithScan.map(s => s.name);
    const animeSeasons = AnimeService.removeScansFromSeasons(seasonsArray);
    const filtered = animeSeasonsWithScan.filter(season => animeSeasons.includes(season.name));
    res.json({ animeSeasons: filtered });
});

app.post("/episodes", authMiddleware, async (req: AuthRequest, res: any) => {
    const { seasonUrl } = req.body;
    console.log(seasonUrl);
    
    const readers = await Scrapper.extractEpisodes(seasonUrl);
    
    const readersNet = readers.map(readerList => 
        readerList.map(episode => episode.replace('to/', 'net/'))
    );
    
    res.status(200).json({ 
        readerUrls: readersNet
    });
});

app.get("/download/:downloadId", async (req: any, res: any) => {
    const { downloadId } = req.params;
    const download = await DownloadService.getDownloadByDownloadId(downloadId);

    if (!download) {
        return res.status(404).json({ error: "Téléchargement introuvable" });
    }

    if (!fs.existsSync(download.file_path)) {
        return res.status(404).json({ error: "Fichier introuvable" });
    }

    const stat = fs.statSync(download.file_path);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${download.episode_name}"`);

    const readStream = fs.createReadStream(download.file_path);
    readStream.pipe(res);

    readStream.on('error', (err) => {
        console.error(`Erreur lecture fichier:`, err);
        res.status(500).json({ error: "Erreur lors de la lecture du fichier" });
    });
});


app.get("/favorites/scheduled", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const scheduledDownloads = MALScheduler.getScheduledDownloads();
        
        const enrichedSchedules = await Promise.all(
            scheduledDownloads.map(async (scheduled) => {
                const favorites = await FavoriteService.getUserFavorites(req.user!.id);
                const favorite = favorites.find(f => f.id === scheduled.favoriteId);
                
                return {
                    favoriteId: scheduled.favoriteId,
                    animeName: favorite?.anime_name || 'Unknown',
                    episodeNumber: scheduled.episodeNumber,
                    scheduledTime: scheduled.scheduledTime,
                    timeRemaining: scheduled.scheduledTime.getTime() - Date.now()
                };
            })
        );
        
        res.json({ 
            scheduled: enrichedSchedules.filter(s => s.timeRemaining > 0)
        });
    } catch (error: any) {
        console.error("Get scheduled downloads error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/favorites/:favoriteId/check-now", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const favoriteId = parseInt(req.params.favoriteId);
        const favorites = await FavoriteService.getUserFavorites(req.user!.id);
        const favorite = favorites.find(f => f.id === favoriteId);
        
        if (!favorite) {
            return res.status(404).json({ error: "Favorite not found" });
        }
        
        if (!favorite.mal_id) {
            return res.status(400).json({ error: "No MAL ID associated with this favorite" });
        }
        
        const malStatus = await FavoriteService.getMALAnimeStatus(favorite.mal_id);
        
        await FavoriteService.updateOngoingStatus(favoriteId, malStatus.status === 'currently_airing');
        await FavoriteService.updateLastChecked(favoriteId);
        
        let nextEpisodeTime = null;
        if (malStatus.broadcast && malStatus.status === 'currently_airing') {

            nextEpisodeTime = {
                day: malStatus.broadcast.day_of_the_week,
                time: malStatus.broadcast.start_time
            };
        }
        
        res.json({
            favorite: {
                id: favorite.id,
                anime_name: favorite.anime_name,
                mal_status: malStatus.status,
                num_episodes: malStatus.num_episodes,
                last_downloaded: favorite.last_episode_downloaded,
                new_episodes_available: malStatus.num_episodes - favorite.last_episode_downloaded,
                next_episode_broadcast: nextEpisodeTime
            }
        });
    } catch (error: any) {
        console.error("Check now error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/admin/scheduler/status", authMiddleware, adminMiddleware, async (req: AuthRequest, res: any) => {
    try {
        const scheduled = MALScheduler.getScheduledDownloads();
        
        res.json({
            isRunning: MALScheduler['isRunning'],
            checkInterval: MALScheduler['checkInterval'],
            scheduledDownloadsCount: scheduled.length,
            scheduledDownloads: scheduled.map(s => ({
                favoriteId: s.favoriteId,
                episodeNumber: s.episodeNumber,
                scheduledTime: s.scheduledTime,
                timeRemaining: Math.round((s.scheduledTime.getTime() - Date.now()) / 1000 / 60) + ' minutes'
            }))
        });
    } catch (error: any) {
        console.error("Scheduler status error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/admin/scheduler/restart", authMiddleware, adminMiddleware, async (req: AuthRequest, res: any) => {
    try {
        MALScheduler.stop();
        MALScheduler.start();
        
        res.json({ 
            success: true, 
            message: 'Scheduler restarted successfully' 
        });
    } catch (error: any) {
        console.error("Scheduler restart error:", error);
        res.status(500).json({ error: error.message });
    }
});


const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log("Client connecté:", socket.id);

    socket.on("downloadEpisode", async ({ readerUrl, output, userId, animeName, seasonName, clientDownloadId }) => {
    console.log(`Starting download for reader:`, readerUrl);

    let m3u8Url: string;
    try {
        if (!readerUrl.includes("vidmoly")) {
            socket.emit("error", { 
                message: "Seul vidmoly est supporté pour le moment", 
                downloadId: clientDownloadId 
            });
            return;
        }

        const temp = await Puppeteer.newPage();
        await temp.goto(readerUrl);

        m3u8Url = await temp.evaluate(() => {
            if ((window as any).jwplayer) {
                const player = (window as any).jwplayer("vplayer");
                const sources = player.getPlaylist?.()?.[0]?.sources;
                if (sources && sources.length > 0) {
                    return sources[0].file;
                }
            }
            return null;
        }) as string;

        await temp.close();

        if (!m3u8Url) {
            socket.emit("error", { 
                message: "URL M3U8 introuvable", 
                downloadId: clientDownloadId 
            });
            return;
        }

        console.log(`M3U8 URL extracted: ${m3u8Url}`);
    } catch (error: any) {
        console.error(`Erreur extraction M3U8:`, error);
        socket.emit("error", { 
            message: `Erreur extraction M3U8: ${error.message}`, 
            downloadId: clientDownloadId 
        });
        return;
    }

    const outputPath = path.join(DOWNLOADS_DIR, animeName || 'unknown', seasonName || 'episodes', output);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    let download;
    try {
        download = await DownloadService.createDownload(
            animeName || 'unknown',
            seasonName || null,
            output,
            outputPath,
            userId
        );
    } catch (error) {
        console.error(`Erreur création download:`, error);
        socket.emit("error", { message: "Impossible de créer le téléchargement", downloadId: clientDownloadId });
        return;
    }
    
    const downloadId = download.id;
    console.log(`Download DB ID: ${downloadId}, Client ID: ${clientDownloadId}`);
    
    socket.emit("downloadIdAssigned", { clientDownloadId, serverDownloadId: downloadId });

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

    let totalDuration = 0;

    ff.stderr.on("data", async (data) => {
        const line = data.toString();
        
        if (totalDuration === 0) {
            const durationMatch = line.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
            if (durationMatch) {
                const hours = parseInt(durationMatch[1]);
                const minutes = parseInt(durationMatch[2]);
                const seconds = parseFloat(durationMatch[3]);
                totalDuration = hours * 3600 + minutes * 60 + seconds;
                
                console.log(`[${downloadId}] Durée totale détectée: ${totalDuration}s`);
                socket.emit("durationDetected", { downloadId, totalDuration });
            }
        }
        
        const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const current = hours * 3600 + minutes * 60 + seconds;

            socket.emit("progress", { 
                current, 
                downloadId,
                totalDuration
            });

            try {
                await DownloadService.updateDownloadStatus("" + downloadId, 'encoding', current);
            } catch (error) {
                console.error(`[${downloadId}] Erreur mise à jour status:`, error);
            }
        }
    });

    ff.on("close", async (code) => {
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

            try {
                await DownloadService.updateDownloadStatus("" + downloadId, 'ready');
                await DownloadService.updateDownloadFileSize("" + downloadId, fileSize);
            } catch (error) {
                console.error(`[${downloadId}] Erreur mise à jour final:`, error);
            }
        } else {
            socket.emit("error", { message: `FFmpeg a échoué avec le code ${code}`, downloadId });
            activeDownloads.delete(downloadId);

            try {
                await DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, `FFmpeg failed with code ${code}`);
            } catch (error) {
                console.error(`[${downloadId}] Erreur mise à jour erreur:`, error);
            }
        }
    });

    ff.on("error", async (err) => {
        console.error(`[${downloadId}] Erreur FFMPEG:`, err);
        socket.emit("error", { message: err.message, downloadId });
        activeDownloads.delete(downloadId);

        try {
            await DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, err.message);
        } catch (error) {
            console.error(`[${downloadId}] Erreur mise à jour erreur:`, error);
        }
    });
});

    socket.on("disconnect", () => {
        console.log("Client déconnecté:", socket.id);
    });
});



async function startServer() {
    try {
        await DatabaseService.initialize();

        MALScheduler.start();

        server.listen(PORT, () => {
            console.log(`Serveur lancé sur http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Erreur au démarrage:', error);
        process.exit(1);
    }
}

startServer();

process.on('SIGINT', async () => {
    console.log('\nArrêt du serveur...');
    MALScheduler.stop();
    await DatabaseService.close();
    process.exit(0);
});