import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import http from "http";
import DatabaseService from "./services/DatabaseService.ts";
import MALScheduler from "./services/MALScheduler.ts";
import { authRouter } from "./routers/authRouter.ts";
import { adminRouter } from "./routers/adminRouter.ts";
import { favoritesRouter } from "./routers/favoritesRouter.ts";
import { myAnimeListRouter } from "./routers/myAnimeListRouter.ts";
import { scrapperRouter } from "./routers/scrapperRouter.ts";
import { DownloaderManager } from "./services/DownloadManager.ts";
import { DownloaderFactory } from "../../../engine/service/download/factory/DownloaderFactory.ts";
import { downloadsRouter } from "./routers/downloadsRouter.ts";
import { authMiddleware } from "./middleware/auth.ts";
import type { AuthRequest } from "./middleware/auth.ts";
import DownloadService from "./services/DownloadService.ts";

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

app.get("/downloads", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const downloads = await DownloadService.getUserDownloads(authReq.user!.id);
        res.json({ downloads });
    } catch (error: any) {
        console.error("Get downloads error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/downloads", downloadsRouter);
app.use("/favorites", favoritesRouter);
app.use("/mal", myAnimeListRouter);
app.use("/", scrapperRouter);

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log("Client connecté:", socket.id);

    socket.on("downloadEpisode", async ({ readerUrl, output, userId, animeName, seasonName, clientDownloadId }) => {
        try {
            const downloader = await DownloaderFactory.get(readerUrl);
            if (!downloader) {
                socket.emit("error", { message: "Aucun downloader trouvé", downloadId: clientDownloadId });
                return;
            }

            const outputPath = path.join(DOWNLOADS_DIR, animeName || 'unknown', seasonName || 'episodes', output);
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });

            const manager = new DownloaderManager(downloader);

            let download = await DownloadService.createDownload(
                animeName || 'unknown',
                seasonName || null,
                output,
                outputPath,
                userId
            );
            const downloadId = download.id;

            socket.emit("downloadIdAssigned", { clientDownloadId, serverDownloadId: downloadId });

            activeDownloads.set(clientDownloadId, {
                manager,
                socketId: socket.id,
                outputPath,
            });

            manager.on("duration", dur => socket.emit("durationDetected", { downloadId: downloadId, totalDuration: dur }));
            manager.on("progress", (current, total) => {
                socket.emit("progress", { current, downloadId: downloadId, totalDuration: total })
                DownloadService.updateDownloadStatus("" + downloadId, 'encoding', current);
            });
            manager.on("done", success => {
                if (success) {
                    socket.emit("downloadReady", { downloadId: downloadId, fileName: output, downloadUrl: `/downloads/${downloadId}` });
                    DownloadService.updateDownloadStatus("" + downloadId, 'ready');
                    const fileSize = fs.statSync(outputPath).size;
                    DownloadService.updateDownloadFileSize("" + downloadId, fileSize);
                } else {
                    socket.emit("error", { message: "Download échoué", downloadId: downloadId });
                    DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, `FFmpeg failed with no code`);
                }
                activeDownloads.delete(downloadId);
            });
            manager.on("error", err => {
                socket.emit("error", { message: err.message, downloadId: downloadId });
                DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, err.message);
                activeDownloads.delete(downloadId);
            });

            await manager.downloadEpisode(readerUrl, 0, seasonName, animeName, outputPath);

        } catch (err: any) {
            socket.emit("error", { message: err.message, downloadId: clientDownloadId });
            activeDownloads.delete(clientDownloadId);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client déconnecté:", socket.id);
        // // Optionnel : cancel tous les downloads actifs pour ce socket
        // for (const [id, info] of activeDownloads.entries()) {
        //     if (info.socketId === socket.id) {
        //         // Ici on pourrait ajouter un stop() dans DownloaderManager
        //         activeDownloads.delete(id);
        //     }
        // }
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