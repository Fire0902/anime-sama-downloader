import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
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
import DownloadOrchestrator, { toUserMessage } from "./services/DownloadOrchestratorService.ts";
import { downloadsRouter } from "./routers/downloadsRouter.ts";
import { jellyseerrRouter } from "./routers/jellyseerrRouter.ts";
import { jellyfinRouter } from "./routers/jellyfinRouter.ts";
import { authMiddleware } from "./middleware/auth.ts";
import type { AuthRequest } from "./middleware/auth.ts";
import DownloadService from "./services/DownloadService.ts";
import SegmentService from "./services/SegmentService.ts";
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

// Dossiers de saison en cours de segmentation (évite les lancements concurrents
// du module Python sur le même dossier, p.ex. si plusieurs onglets sont ouverts).
const segmentingFolders = new Set<string>();

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
    res.json({ ids: DownloadOrchestrator.getActiveIds() });
});

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/downloads", downloadsRouter);
app.use("/favorites", favoritesRouter);
app.use("/mal", myAnimeListRouter);
app.use("/settings", settingsRouter);
app.use("/jellyseerr", jellyseerrRouter);
app.use("/jellyfin", jellyfinRouter);

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

    socket.on("downloadEpisode", async ({ readerUrl, urls: urlsParam, output, userId, animeName, seasonName, clientDownloadId, seasonIndex = 0, episodeIndex = 0, directDownload = false }) => {
        try {
            console.log(`[DOWNLOAD] Season: "${seasonName}", seasonIndex: ${seasonIndex}, episodeIndex: ${episodeIndex}, anime: "${animeName}"`);

            // Support both single URL (backward compatibility) and array of URLs
            const urls = urlsParam ? (Array.isArray(urlsParam) ? urlsParam : [urlsParam]) : (readerUrl ? [readerUrl] : []);

            if (!urls || urls.length === 0) {
                socket.emit("error", { message: "Aucune URL fournie", downloadId: clientDownloadId });
                return;
            }

            // Renseigné par onIdAssigned, avant que le moindre événement ne soit émis.
            let currentDownloadId: number | undefined;

            await DownloadOrchestrator.launch(
                { urls, output, animeName, seasonName, seasonIndex, episodeIndex, directDownload, userId },
                {
                    onIdAssigned: (downloadId, downloaderName) => {
                        socket.emit("downloadIdAssigned", { clientDownloadId, serverDownloadId: downloadId, downloaderName });
                        // Room dédiée : permet à un client qui se reconnecte de se rattacher.
                        socket.join(`download:${downloadId}`);
                        currentDownloadId = downloadId;
                    },
                    onDuration: (totalDuration) => {
                        io.to(`download:${currentDownloadId}`).emit("durationDetected", { downloadId: currentDownloadId, totalDuration });
                    },
                    onStreamInfo: (info) => {
                        io.to(`download:${currentDownloadId}`).emit("streamInfo", { downloadId: currentDownloadId, ...info });
                    },
                    onProgress: (current, totalDuration) => {
                        io.to(`download:${currentDownloadId}`).emit("progress", { current, downloadId: currentDownloadId, totalDuration });
                    },
                    onUploadStart: (fileSize) => {
                        io.to(`download:${currentDownloadId}`).emit("uploadStart", { downloadId: currentDownloadId, fileSize });
                    },
                    onUploadComplete: (remotePath) => {
                        io.to(`download:${currentDownloadId}`).emit("uploadComplete", { downloadId: currentDownloadId, remotePath });
                    },
                    onUploadFailed: (error) => {
                        io.to(`download:${currentDownloadId}`).emit("uploadFailed", { downloadId: currentDownloadId, error });
                        io.to(`download:${currentDownloadId}`).emit("uploadWarning", {
                            downloadId: currentDownloadId,
                            message: `FTP upload failed: ${error}. File saved locally.`,
                        });
                    },
                    onDone: (outcome) => {
                        if (!outcome.success) return;
                        io.to(`download:${outcome.downloadId}`).emit("downloadReady", {
                            downloadId: outcome.downloadId,
                            fileName: outcome.fileName,
                            downloadUrl: `/downloads/${outcome.downloadId}`,
                        });
                    },
                    onError: (message, downloadId) => {
                        io.to(`download:${downloadId}`).emit("error", { message, downloadId });
                    },
                }
            );
            return;
        } catch (err: any) {
            socket.emit("error", { message: toUserMessage(err), downloadId: clientDownloadId });
            return;
        }
    });

    // Segmentation OP/ED d'une saison terminée (détection chapitres + MKV) via
    // le sous-module Python `segmentai`. Déclenché par le client quand le dernier
    // épisode d'une saison passe en "ready". Post-traitement non bloquant : en cas
    // d'échec on prévient le client mais les MP4 téléchargés restent intacts.
    socket.on("segmentSeason", async ({ userId, animeName, seasonName, seasonIndex = 0 }) => {
        try {
            if (!SegmentService.isAvailable() || !SegmentService.isEnabled()) return;

            const config = await FolderStructureConfigService.getUserConfig(userId || 0).catch(() => null);
            let folderPath = `${animeName || 'unknown'}/${seasonName || 'episodes'}`;
            if (config) {
                const r = FolderStructureConfigService.buildFolderPath(
                    animeName || 'unknown',
                    seasonName || 'episodes',
                    seasonIndex,
                    '',
                    0,
                    config
                );
                folderPath = r.folderPath;
            }
            const seasonDir = path.join(DownloadService.getDownloadsDir(), folderPath);

            if (segmentingFolders.has(seasonDir)) return;

            if (!fs.existsSync(seasonDir)) {
                socket.emit("segmentSkipped", { animeName, seasonName, reason: "Dossier introuvable" });
                return;
            }
            // Si l'upload FTP est actif, les MP4 locaux sont supprimés après upload :
            // il n'y a alors plus rien à segmenter.
            const hasMp4 = fs.readdirSync(seasonDir).some(f => f.toLowerCase().endsWith(".mp4"));
            if (!hasMp4) {
                socket.emit("segmentSkipped", { animeName, seasonName, reason: "Aucun fichier MP4 à segmenter" });
                return;
            }

            const mode = SegmentService.getCleanMode();
            segmentingFolders.add(seasonDir);
            socket.emit("segmentStart", { animeName, seasonName });
            console.log(`[segmentai] Segmentation de "${animeName}" - "${seasonName}" (${mode}) dans ${seasonDir}`);

            const proc = spawn(
                SegmentService.getPythonExecutable(),
                SegmentService.buildArgs(seasonDir, mode),
                { cwd: SegmentService.getModuleDir() }
            );

            let stderrBuffer = "";
            proc.stdout.on("data", (chunk: Buffer) => {
                const line = chunk.toString();
                console.log(`[segmentai] ${line.trimEnd()}`);
                socket.emit("segmentProgress", { animeName, seasonName, line });
            });
            proc.stderr.on("data", (chunk: Buffer) => { stderrBuffer += chunk.toString(); });

            proc.on("close", (code) => {
                segmentingFolders.delete(seasonDir);
                if (code === 0) {
                    console.log(`[segmentai] Terminé: "${animeName}" - "${seasonName}"`);
                    socket.emit("segmentDone", { animeName, seasonName });
                } else {
                    console.error(`[segmentai] Échec (code ${code}): ${stderrBuffer}`);
                    socket.emit("segmentError", { animeName, seasonName, error: stderrBuffer || `Code de sortie ${code}` });
                }
            });
            proc.on("error", (err) => {
                segmentingFolders.delete(seasonDir);
                console.error("[segmentai] Erreur de lancement:", err);
                socket.emit("segmentError", { animeName, seasonName, error: err.message });
            });
        } catch (err: any) {
            console.error("segmentSeason error:", err);
            socket.emit("segmentError", { animeName, seasonName, error: err?.message ?? "Erreur inconnue" });
        }
    });

    socket.on("reattachDownloads", ({ downloadIds }: { downloadIds: number[] }) => {
        downloadIds.forEach(id => {
            const entry = DownloadOrchestrator.getActive(id);
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
            console.log(`Serveur lancé sur ${process.env.API_URL || "0.0.0.0"}:${PORT}`);
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