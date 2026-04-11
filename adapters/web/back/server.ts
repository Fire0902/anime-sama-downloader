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
import { settingsRouter } from "./routers/settingsRouter.ts";
import { DownloaderManager } from "./services/DownloadManager.ts";
import { DownloaderFactory } from "../../../engine/service/download/factory/DownloaderFactory.ts";
import { downloadsRouter } from "./routers/downloadsRouter.ts";
import { authMiddleware } from "./middleware/auth.ts";
import type { AuthRequest } from "./middleware/auth.ts";
import DownloadService from "./services/DownloadService.ts";
import FTPConfigService from "./services/FTPConfigService.ts";
import FTPUploaderService from "./services/FTPUploaderService.ts";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cors());
app.use(express.json());

const activeDownloads = new Map();

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
app.use("/settings", settingsRouter);

app.get("/settings/download-path", authMiddleware, async (req, res) => {
    try {
        res.json({ downloadPath: DownloadService.getDownloadsDir() });
    } catch (error: any) {
        console.error('Get download path error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/settings/download-path", authMiddleware, async (req, res) => {
    try {
        const downloadPath = req.body?.downloadPath;
        console.log('Set download path request:', downloadPath);
        if (!downloadPath || typeof downloadPath !== 'string') {
            return res.status(400).json({ error: 'Chemin de téléchargement invalide' });
        }

        DownloadService.setDownloadsDir(downloadPath);
        res.json({ downloadPath: DownloadService.getDownloadsDir() });
    } catch (error: any) {
        console.error('Set download path error:', error);
        res.status(400).json({ error: error.message || 'Impossible de définir le dossier de téléchargement' });
    }
});

app.use("/", scrapperRouter);

app.use(express.static(path.join(__dirname, "../front/dist/front/browser")));
app.get("/{*any}", (req, res) => {
  res.sendFile(path.join(__dirname, "../front/dist/front/browser/index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true
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

            const outputPath = path.join(DownloadService.getDownloadsDir(), animeName || 'unknown', seasonName || 'episodes', output);
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

            socket.emit("downloadIdAssigned", { clientDownloadId, serverDownloadId: downloadId, downloaderName: downloader.getDownloaderName()});

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
            manager.on("done", async success => {
                if (success) {
                    const fileSize = fs.statSync(outputPath).size;
                    DownloadService.updateDownloadFileSize("" + downloadId, fileSize);

                    // Check if user has FTP/SFTP configured
                    if (userId) {
                        try {
                            const ftpConfig = await FTPConfigService.getDecryptedConfig(userId);
                            if (ftpConfig && ftpConfig.protocol !== 'none') {
                                console.log(`Uploading to ${ftpConfig.protocol.toUpperCase()} for user ${userId}`);

                                // Build the FTP directory path with anime/season structure
                                const ftpRemotePath = `${ftpConfig.remote_path || '/'}/${animeName || 'unknown'}/${seasonName || 'episodes'}`;

                                const uploadResult = await FTPUploaderService.uploadToFTP(
                                    outputPath,
                                    ftpRemotePath,
                                    {
                                        protocol: ftpConfig.protocol as 'ftp' | 'sftp',
                                        host: ftpConfig.host!,
                                        port: ftpConfig.port!,
                                        username: ftpConfig.username!,
                                        password: ftpConfig.password!,
                                        passive_mode: ftpConfig.passive_mode
                                    }
                                );

                                if (uploadResult.success && uploadResult.remotePath) {
                                    console.log(`Upload successful to ${uploadResult.remotePath}`);
                                    // Update the file_path in DB to indicate FTP location
                                    const ftpPath = `${ftpConfig.protocol}://${ftpConfig.host}:${ftpConfig.port}${uploadResult.remotePath}`;
                                    await DownloadService.updateDownloadPath("" + downloadId, ftpPath);

                                    // Optionally delete local file after successful upload
                                    try {
                                        if (fs.existsSync(outputPath)) {
                                            fs.unlinkSync(outputPath);
                                        }
                                    } catch (e) {
                                        console.error('Failed to delete local file:', e);
                                    }
                                } else {
                                    console.error(`Upload failed: ${uploadResult.error}`);
                                    socket.emit("uploadWarning", {
                                        downloadId: downloadId,
                                        message: `FTP upload failed: ${uploadResult.error}. File saved locally.`
                                    });
                                }
                            }
                        } catch (ftpError) {
                            console.error('FTP config retrieval error:', ftpError);
                            // Continue without FTP - file is already saved locally
                        }
                    }

                    socket.emit("downloadReady", { downloadId: downloadId, fileName: output, downloadUrl: `/downloads/${downloadId}` });
                    DownloadService.updateDownloadStatus("" + downloadId, 'ready');
                } else {
                    socket.emit("error", { message: "Erreur: L'encodage vidéo a échoué", downloadId: downloadId });
                    DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, `FFmpeg failed with no code`);
                }
                activeDownloads.delete(downloadId);
            });
            manager.on("error", err => {
                let errorMessage = err.message;
                if (err.message && err.message.includes("strike")) {
                    errorMessage = "Erreur: L'épisode est striké (contenu supprimé)";
                } else if (err.message && (err.message.includes("404") || err.message.includes("not found"))) {
                    errorMessage = "Erreur: Épisode non trouvé";
                } else if (err.message && (err.message.includes("timeout") || err.message.includes("ECONNREFUSED"))) {
                    errorMessage = "Erreur: Connexion échouée, vérifiez votre connexion";
                } else if (err.message && err.message.includes("FFmpeg")) {
                    errorMessage = "Erreur: Échec de l'encodage vidéo";
                }
                socket.emit("error", { message: errorMessage, downloadId: downloadId });
                DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, errorMessage);
                activeDownloads.delete(downloadId);
            });

            await manager.downloadEpisode(readerUrl, 0, seasonName, animeName, outputPath);

        } catch (err: any) {
            let errorMessage = "Erreur inconnue";
            if (err.message && err.message.includes("strike")) {
                errorMessage = "Erreur: L'épisode est striké (contenu supprimé)";
            } else if (err.message && (err.message.includes("404") || err.message.includes("not found"))) {
                errorMessage = "Erreur: Épisode non trouvé";
            } else if (err.message && (err.message.includes("timeout") || err.message.includes("ECONNREFUSED"))) {
                errorMessage = "Erreur: Connexion échouée";
            } else if (err.message) {
                errorMessage = `Erreur: ${err.message}`;
            }
            socket.emit("error", { message: errorMessage, downloadId: clientDownloadId });
            activeDownloads.delete(clientDownloadId);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client déconnecté:", socket.id);
    });
});



async function startServer() {
    try {
        await DatabaseService.initialize();

        MALScheduler.start();

        DownloadService.startFileWatcher(10_000);

        server.listen(PORT, process.env.API_URL || "0.0.0.0", () => {
            console.log(`Serveur lancé sur ${process.env.API_URL || "0.0.0.0" + PORT}`);
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
    DownloadService.stopFileWatcher();
    await DatabaseService.close();
    process.exit(0);
});