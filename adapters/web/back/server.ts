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
import { jellyseerrRouter } from "./routers/jellyseerrRouter.ts";
import { authMiddleware } from "./middleware/auth.ts";
import type { AuthRequest } from "./middleware/auth.ts";
import DownloadService from "./services/DownloadService.ts";
import FTPConfigService from "./services/FTPConfigService.ts";
import FTPUploaderService from "./services/FTPUploaderService.ts";
import FolderStructureConfigService from "./services/FolderStructureConfigService.ts";
import AuthService from "./services/AuthService.ts";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (no dotenv dependency needed)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
        const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim();
    });
}

const app = express();
const PORT = 3000;
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

app.get("/downloads/active-ids", authMiddleware, (req, res) => {
    const ids = Array.from(activeDownloads.keys());
    res.json({ ids });
});

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/downloads", downloadsRouter);
app.use("/favorites", favoritesRouter);
app.use("/mal", myAnimeListRouter);
app.use("/settings", settingsRouter);
app.use("/jellyseerr", jellyseerrRouter);

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

    socket.on("downloadEpisode", async ({ readerUrl, urls: urlsParam, output, userId, animeName, seasonName, clientDownloadId, seasonIndex = 0, episodeIndex = 0 }) => {
        try {
            console.log(`[DOWNLOAD] Season: "${seasonName}", seasonIndex: ${seasonIndex}, episodeIndex: ${episodeIndex}, anime: "${animeName}"`);

            // Support both single URL (backward compatibility) and array of URLs
            const urls = urlsParam ? (Array.isArray(urlsParam) ? urlsParam : [urlsParam]) : (readerUrl ? [readerUrl] : []);

            if (!urls || urls.length === 0) {
                socket.emit("error", { message: "Aucune URL fournie", downloadId: clientDownloadId });
                return;
            }

            // Find a downloader that can handle at least one URL
            let downloader = null;
            for (const url of urls) {
                downloader = await DownloaderFactory.get(url);
                if (downloader) break;
            }

            if (!downloader) {
                socket.emit("error", { message: "Aucun downloader trouvé pour les URLs fournies", downloadId: clientDownloadId });
                return;
            }

            // Get folder structure config for this user
            let folderStructureConfig = await FolderStructureConfigService.getUserConfig(userId || 0).catch(() => null);

            // Handle single movie vs movies folder
            const isSingleMovie = seasonName === 'Film' || seasonName === 'film';
            const isMultipleMovies = seasonName && (seasonName.toLowerCase().startsWith('films'));

            let folderPath = '';
            if (isSingleMovie) {
                // Single movie: put it directly in anime folder with anime name as file prefix
                folderPath = `${animeName || 'unknown'}`;
            } else if (isMultipleMovies) {
                // Multiple movies: use Films folder
                folderPath = `${animeName || 'unknown'}/Films`;
            } else {
                // Normal seasons: use season name
                folderPath = `${animeName || 'unknown'}/${seasonName || 'episodes'}`;
            }

            if (folderStructureConfig && !isSingleMovie) {
                const removedExtension = output.replace(/\.[^/.]+$/, '');
                console.log(`[PATH] Using seasonIndex ${seasonIndex} (0-based) for buildFolderPath, will adjust to ${seasonIndex - 1}`);
                const pathResult = FolderStructureConfigService.buildFolderPath(
                    animeName || 'unknown',
                    isSingleMovie ? animeName || 'unknown' : (seasonName || 'episodes'),
                    Math.max(0, seasonIndex - 1),
                    removedExtension,
                    episodeIndex,
                    folderStructureConfig
                );
                folderPath = pathResult.folderPath;
                if (pathResult.episodeFileName) {
                    const ext = path.extname(output);
                    output = pathResult.episodeFileName + ext;
                }
                console.log(`[PATH] Built path with adjusted seasonIndex: "${folderPath}", file: "${output}"`);
            }

            const outputPath = path.join(DownloadService.getDownloadsDir(), folderPath, output);
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

            // Join a room dedicated to this download so reconnecting clients can reattach
            socket.join(`download:${downloadId}`);
            const downloadEntry: { manager: any; outputPath: string; userId: any; lastProgress: number; totalDuration: number } = {
                manager,
                outputPath,
                userId,
                lastProgress: 0,
                totalDuration: 0,
            };
            activeDownloads.set(String(downloadId), downloadEntry);

            manager.on("duration", (dur: number) => {
                downloadEntry.totalDuration = dur;
                io.to(`download:${downloadId}`).emit("durationDetected", { downloadId: downloadId, totalDuration: dur });
            });
            manager.on("progress", (current: number, total: number) => {
                downloadEntry.lastProgress = current;
                if (total > 0) downloadEntry.totalDuration = total;
                io.to(`download:${downloadId}`).emit("progress", { current, downloadId: downloadId, totalDuration: total })
                DownloadService.updateDownloadStatus("" + downloadId, 'encoding', current);
            });
            manager.on("done", async success => {
                if (success) {
                    let fileSize = 0;
                    try {
                        fileSize = fs.statSync(outputPath).size;
                    } catch (statErr) {
                        console.error(`[STAT ERROR] Cannot stat file at: ${outputPath}`, statErr);
                        // Try to find the file by listing the directory
                        try {
                            const dir = path.dirname(outputPath);
                            if (fs.existsSync(dir)) {
                                console.error(`[STAT ERROR] Directory exists. Files in dir:`, fs.readdirSync(dir));
                            } else {
                                console.error(`[STAT ERROR] Directory does not exist: ${dir}`);
                            }
                        } catch {}
                    }
                    DownloadService.updateDownloadFileSize("" + downloadId, fileSize);

                    // Check if user has FTP/SFTP configured
                    if (userId) {
                        try {
                            const ftpConfig = await FTPConfigService.getDecryptedConfig(userId);
                            if (ftpConfig && ftpConfig.protocol !== 'none') {
                                console.log(`Uploading to ${ftpConfig.protocol.toUpperCase()} for user ${userId}`);

                                // Emit FTP upload start event
                                io.to(`download:${downloadId}`).emit("uploadStart", { downloadId: downloadId, fileSize: fileSize });

                                // Build the FTP directory path with same structure (handle movies)
                                let ftpRemotePath = '';
                                const isSingleMovie = seasonName === 'Film' || seasonName === 'film';
                                const isMultipleMovies = seasonName && (seasonName.toLowerCase().startsWith('films'));

                                console.log(`[FTP] Season: "${seasonName}", isSingleMovie: ${isSingleMovie}, isMultipleMovies: ${isMultipleMovies}`);

                                if (isSingleMovie) {
                                    // Single movie: put it directly in anime folder
                                    ftpRemotePath = `${ftpConfig.remote_path || '/'}/${animeName || 'unknown'}`;
                                } else if (isMultipleMovies) {
                                    // Multiple movies: use Films folder
                                    ftpRemotePath = `${ftpConfig.remote_path || '/'}/${animeName || 'unknown'}/Films`;
                                } else {
                                    // Normal seasons: use season name
                                    ftpRemotePath = `${ftpConfig.remote_path || '/'}/${animeName || 'unknown'}/${seasonName || 'episodes'}`;
                                }

                                console.log(`[FTP] Initial remote path: "${ftpRemotePath}"`);
                                console.log(`[FTP] Local path: "${outputPath}"`);
                                console.log(`[FTP] File exists: ${fs.existsSync(outputPath)}`);

                                if (folderStructureConfig && !isSingleMovie) {
                                    const ftpPathResult = FolderStructureConfigService.buildFolderPath(
                                        animeName || 'unknown',
                                        isSingleMovie ? animeName || 'unknown' : (seasonName || 'episodes'),
                                        Math.max(0, seasonIndex - 1),
                                        output.replace(/\.[^/.]+$/, ''),
                                        episodeIndex,
                                        folderStructureConfig
                                    );
                                    ftpRemotePath = `${ftpConfig.remote_path || '/'}/${ftpPathResult.folderPath}`;
                                    console.log(`[FTP] Adjusted remote path with seasonIndex ${seasonIndex - 1}: "${ftpRemotePath}"`);
                                }

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

                                console.log(`[FTP] Upload result:`, uploadResult);

                                if (uploadResult.success && uploadResult.remotePath) {
                                    console.log(`Upload successful to ${uploadResult.remotePath}`);
                                    // Emit FTP upload complete event
                                    io.to(`download:${downloadId}`).emit("uploadComplete", { downloadId: downloadId, remotePath: uploadResult.remotePath });

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
                                    // Emit FTP upload failed event
                                    io.to(`download:${downloadId}`).emit("uploadFailed", { downloadId: downloadId, error: uploadResult.error });
                                    io.to(`download:${downloadId}`).emit("uploadWarning", {
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

                    io.to(`download:${downloadId}`).emit("downloadReady", { downloadId: downloadId, fileName: output, downloadUrl: `/downloads/${downloadId}` });
                    DownloadService.updateDownloadStatus("" + downloadId, 'ready');
                } else {
                    io.to(`download:${downloadId}`).emit("error", { message: "Erreur: L'encodage vidéo a échoué", downloadId: downloadId });
                    DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, `FFmpeg failed with no code`);
                }
                activeDownloads.delete(String(downloadId));
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
                    console.error('FFmpeg error details:', err);
                    errorMessage = "Erreur: Échec de l'encodage vidéo";
                }
                io.to(`download:${downloadId}`).emit("error", { message: errorMessage, downloadId: downloadId });
                DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, errorMessage);
                activeDownloads.delete(String(downloadId));
            });

            await manager.downloadEpisode(urls, episodeIndex, seasonName, animeName, outputPath);

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

    socket.on("reattachDownloads", ({ downloadIds }: { downloadIds: number[] }) => {
        downloadIds.forEach(id => {
            const entry = activeDownloads.get(String(id));
            if (entry) {
                socket.join(`download:${id}`);
                console.log(`[REATTACH] Socket ${socket.id} joined download:${id}`);
                if (entry.totalDuration > 0) {
                    socket.emit("durationDetected", { downloadId: String(id), totalDuration: entry.totalDuration });
                }
                if (entry.lastProgress > 0) {
                    socket.emit("progress", { current: entry.lastProgress, downloadId: String(id), totalDuration: entry.totalDuration });
                }
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

        if (process.env.INIT_USER && process.env.INIT_PASS) {
            const users = await AuthService.getAllUsers();
            if (users.length === 0) {
                const u = process.env.INIT_USER;
                await AuthService.register(u, `${u}@localhost`, process.env.INIT_PASS, true);
                console.log(`[STARTUP] Admin créé: ${u}`);
            }
        }

        const stale = await DownloadService.resetStaleDownloads();
        if (stale > 0) console.log(`[STARTUP] ${stale} download(s) stale réinitialisé(s)`);

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