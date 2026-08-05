// services/DownloadOrchestratorService.ts
//
// Logique de téléchargement d'un épisode, partagée entre le transport Socket.io
// (front Angular) et le transport HTTP (route POST /downloads/launch appelée par
// n8n). Le transport ne fait que traduire les événements émis ici : construction
// du chemin, entrée en base, upload FTP et mises à jour de statut vivent au même
// endroit pour les deux.
import fs from "fs";
import path from "path";
import { DownloaderManager } from "./DownloadManager.ts";
import { DownloaderFactory } from "../../../../engine/service/download/factory/DownloaderFactory.ts";
import DirectM3U8Downloader from "../../../../engine/service/download/downloader/DirectM3U8Downloader.ts";
import DownloadService from "./DownloadService.ts";
import FTPConfigService from "./FTPConfigService.ts";
import FTPUploaderService from "./FTPUploaderService.ts";
import FolderStructureConfigService from "./FolderStructureConfigService.ts";

export interface LaunchParams {
    urls: string[];
    output: string;
    animeName: string;
    seasonName: string;
    seasonIndex?: number;
    episodeIndex?: number;
    directDownload?: boolean;
    userId?: number;
}

export interface DownloadOutcome {
    downloadId: number;
    success: boolean;
    /** Chemin local du fichier. Vidé si l'upload FTP a supprimé la copie locale. */
    filePath: string;
    fileName: string;
    fileSize: number;
    uploaded: boolean;
    remotePath?: string;
    error?: string;
}

/** Callbacks de progression. Toutes optionnelles : le transport HTTP n'en câble qu'une partie. */
export interface LaunchListeners {
    /**
     * Appelé dès que l'id est connu, avant le démarrage du téléchargement, pour
     * laisser le transport s'abonner (join de la room socket) sans rater d'événement.
     */
    onIdAssigned?(downloadId: number, downloaderName: string): void;
    onDuration?(totalDuration: number): void;
    onStreamInfo?(info: { resolution: string; codec: string }): void;
    onProgress?(current: number, totalDuration: number): void;
    onUploadStart?(fileSize: number): void;
    onUploadComplete?(remotePath: string): void;
    onUploadFailed?(error: string): void;
    onDone?(outcome: DownloadOutcome): void;
    onError?(message: string, downloadId: number): void;
}

export interface ActiveDownload {
    manager: DownloaderManager;
    outputPath: string;
    userId?: number;
    lastProgress: number;
    totalDuration: number;
}

/** Traduit une exception technique en message affichable, comme le faisait le handler socket. */
export function toUserMessage(err: { message?: string }): string {
    const m = err?.message ?? "";
    if (m.includes("strike")) return "Erreur: L'épisode est striké (contenu supprimé)";
    if (m.includes("404") || m.includes("not found")) return "Erreur: Épisode non trouvé";
    if (m.includes("timeout") || m.includes("ECONNREFUSED")) return "Erreur: Connexion échouée, vérifiez votre connexion";
    if (m.includes("FFmpeg")) return "Erreur: Échec de l'encodage vidéo";
    return m ? `Erreur: ${m}` : "Erreur inconnue";
}

class DownloadOrchestratorService {
    private activeDownloads = new Map<string, ActiveDownload>();

    getActiveIds(): string[] {
        return Array.from(this.activeDownloads.keys());
    }

    getActive(downloadId: number | string): ActiveDownload | undefined {
        return this.activeDownloads.get(String(downloadId));
    }

    /**
     * Résout le dossier de destination et le nom de fichier selon la config de
     * structure de l'utilisateur. Les films sont traités à part : un film seul va
     * directement dans le dossier de l'anime, une collection dans `Films/`.
     */
    private async resolvePaths(params: LaunchParams) {
        const { animeName, seasonName, seasonIndex = 0, episodeIndex = 0, userId } = params;
        let output = params.output;

        const folderStructureConfig = await FolderStructureConfigService
            .getUserConfig(userId ?? 0)
            .catch(() => null);

        const isSingleMovie = seasonName === 'Film' || seasonName === 'film';
        const isMultipleMovies = !!seasonName && seasonName.toLowerCase().startsWith('films');

        let folderPath: string;
        if (isSingleMovie) {
            folderPath = `${animeName || 'unknown'}`;
        } else if (isMultipleMovies) {
            folderPath = `${animeName || 'unknown'}/Films`;
        } else {
            folderPath = `${animeName || 'unknown'}/${seasonName || 'episodes'}`;
        }

        if (folderStructureConfig && !isSingleMovie) {
            const pathResult = FolderStructureConfigService.buildFolderPath(
                animeName || 'unknown',
                seasonName || 'episodes',
                seasonIndex,
                output.replace(/\.[^/.]+$/, ''),
                episodeIndex,
                folderStructureConfig
            );
            folderPath = pathResult.folderPath;
            if (pathResult.episodeFileName) {
                output = pathResult.episodeFileName + path.extname(output);
            }
            console.log(`[PATH] Built path with adjusted seasonIndex: "${folderPath}", file: "${output}"`);
        }

        return {
            folderStructureConfig,
            isSingleMovie,
            isMultipleMovies,
            output,
            outputPath: path.join(DownloadService.getDownloadsDir(), folderPath, output),
        };
    }

    /**
     * Upload le fichier terminé si l'utilisateur a une config FTP/SFTP active.
     * Best-effort : un échec laisse le fichier local en place et n'interrompt rien.
     */
    private async uploadIfConfigured(
        params: LaunchParams,
        ctx: Awaited<ReturnType<DownloadOrchestratorService['resolvePaths']>>,
        downloadId: number,
        fileSize: number,
        listeners: LaunchListeners
    ): Promise<{ uploaded: boolean; remotePath?: string }> {
        const { animeName, seasonName, seasonIndex = 0, episodeIndex = 0, userId } = params;
        if (!userId) return { uploaded: false };

        const ftpConfig = await FTPConfigService.getDecryptedConfig(userId);
        if (!ftpConfig || ftpConfig.protocol === 'none') return { uploaded: false };

        console.log(`Uploading to ${ftpConfig.protocol.toUpperCase()} for user ${userId}`);
        listeners.onUploadStart?.(fileSize);

        let ftpRemotePath: string;
        if (ctx.isSingleMovie) {
            ftpRemotePath = `${ftpConfig.remote_path || '/'}/${animeName || 'unknown'}`;
        } else if (ctx.isMultipleMovies) {
            ftpRemotePath = `${ftpConfig.remote_path || '/'}/${animeName || 'unknown'}/Films`;
        } else {
            ftpRemotePath = `${ftpConfig.remote_path || '/'}/${animeName || 'unknown'}/${seasonName || 'episodes'}`;
        }

        if (ctx.folderStructureConfig && !ctx.isSingleMovie) {
            const ftpPathResult = FolderStructureConfigService.buildFolderPath(
                animeName || 'unknown',
                seasonName || 'episodes',
                Math.max(0, seasonIndex),
                ctx.output.replace(/\.[^/.]+$/, ''),
                episodeIndex,
                ctx.folderStructureConfig
            );
            ftpRemotePath = `${ftpConfig.remote_path || '/'}/${ftpPathResult.folderPath}`;
        }

        console.log(`[FTP] Remote path: "${ftpRemotePath}" | local: "${ctx.outputPath}"`);

        const uploadResult = await FTPUploaderService.uploadToFTP(ctx.outputPath, ftpRemotePath, {
            protocol: ftpConfig.protocol as 'ftp' | 'sftp',
            host: ftpConfig.host!,
            port: ftpConfig.port!,
            username: ftpConfig.username!,
            password: ftpConfig.password!,
            passive_mode: ftpConfig.passive_mode,
        });

        if (!uploadResult.success || !uploadResult.remotePath) {
            console.error(`Upload failed: ${uploadResult.error}`);
            listeners.onUploadFailed?.(uploadResult.error ?? 'unknown');
            return { uploaded: false };
        }

        console.log(`Upload successful to ${uploadResult.remotePath}`);
        listeners.onUploadComplete?.(uploadResult.remotePath);

        const ftpPath = `${ftpConfig.protocol}://${ftpConfig.host}:${ftpConfig.port}${uploadResult.remotePath}`;
        await DownloadService.updateDownloadPath("" + downloadId, ftpPath);

        // La copie locale n'a plus lieu d'être une fois le fichier sur le serveur distant.
        try {
            if (fs.existsSync(ctx.outputPath)) fs.unlinkSync(ctx.outputPath);
        } catch (e) {
            console.error('Failed to delete local file:', e);
        }

        return { uploaded: true, remotePath: uploadResult.remotePath };
    }

    /**
     * Prépare et démarre un téléchargement. Retourne dès que l'entrée en base est
     * créée : le téléchargement se poursuit en arrière-plan et rend compte via
     * `listeners`. Lève si aucun downloader ne sait traiter les URLs fournies.
     */
    async launch(params: LaunchParams, listeners: LaunchListeners = {}): Promise<{ downloadId: number; downloaderName: string; outputPath: string }> {
        const { urls, animeName, seasonName, seasonIndex = 0, episodeIndex = 0, directDownload = false, userId } = params;

        if (!urls || urls.length === 0) throw new Error("Aucune URL fournie");

        let downloader = null;
        if (directDownload) {
            downloader = new DirectM3U8Downloader();
        } else {
            for (const url of urls) {
                downloader = await DownloaderFactory.get(url);
                if (downloader) break;
            }
        }
        if (!downloader) throw new Error("Aucun downloader trouvé pour les URLs fournies");

        const ctx = await this.resolvePaths(params);
        fs.mkdirSync(path.dirname(ctx.outputPath), { recursive: true });

        const manager = new DownloaderManager(downloader);
        const download = await DownloadService.createDownload(
            animeName || 'unknown',
            seasonName || null,
            ctx.output,
            ctx.outputPath,
            userId
        );
        const downloadId = download.id;

        const entry: ActiveDownload = { manager, outputPath: ctx.outputPath, userId, lastProgress: 0, totalDuration: 0 };
        this.activeDownloads.set(String(downloadId), entry);

        listeners.onIdAssigned?.(downloadId, downloader.getDownloaderName());

        manager.on("duration", (dur: number) => {
            entry.totalDuration = dur;
            listeners.onDuration?.(dur);
        });

        manager.on("streamInfo", (info: { resolution: string; codec: string }) => {
            listeners.onStreamInfo?.(info);
        });

        manager.on("progress", (current: number, total: number) => {
            entry.lastProgress = current;
            if (total > 0) entry.totalDuration = total;
            listeners.onProgress?.(current, total);
            DownloadService.updateDownloadStatus("" + downloadId, 'encoding', current);
        });

        manager.on("done", async (success: boolean) => {
            if (!success) {
                DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, `FFmpeg failed with no code`);
                this.activeDownloads.delete(String(downloadId));
                listeners.onError?.("Erreur: L'encodage vidéo a échoué", downloadId);
                listeners.onDone?.({
                    downloadId, success: false, filePath: ctx.outputPath, fileName: ctx.output,
                    fileSize: 0, uploaded: false, error: "L'encodage vidéo a échoué",
                });
                return;
            }

            let fileSize = 0;
            try {
                fileSize = fs.statSync(ctx.outputPath).size;
            } catch (statErr) {
                console.error(`[STAT ERROR] Cannot stat file at: ${ctx.outputPath}`, statErr);
            }
            DownloadService.updateDownloadFileSize("" + downloadId, fileSize);

            let uploaded = false;
            let remotePath: string | undefined;
            try {
                const r = await this.uploadIfConfigured(params, ctx, downloadId, fileSize, listeners);
                uploaded = r.uploaded;
                remotePath = r.remotePath;
            } catch (ftpError) {
                // Le fichier est déjà sauvegardé localement : on continue sans FTP.
                console.error('FTP config retrieval error:', ftpError);
            }

            DownloadService.updateDownloadStatus("" + downloadId, 'ready');
            this.activeDownloads.delete(String(downloadId));

            listeners.onDone?.({
                downloadId,
                success: true,
                filePath: uploaded ? '' : ctx.outputPath,
                fileName: ctx.output,
                fileSize,
                uploaded,
                remotePath,
            });
        });

        manager.on("error", (err: Error) => {
            const message = toUserMessage(err);
            DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, message);
            this.activeDownloads.delete(String(downloadId));
            listeners.onError?.(message, downloadId);
            listeners.onDone?.({
                downloadId, success: false, filePath: ctx.outputPath, fileName: ctx.output,
                fileSize: 0, uploaded: false, error: message,
            });
        });

        // Volontairement non attendu : le téléchargement tourne en tâche de fond.
        const run = directDownload
            ? manager.downloadEpisodePerUrl(urls, episodeIndex, seasonName, animeName, ctx.outputPath)
            : manager.downloadEpisode(urls, episodeIndex, seasonName, animeName, ctx.outputPath);

        run.catch((err: any) => {
            const message = toUserMessage(err);
            DownloadService.updateDownloadStatus("" + downloadId, 'error', 0, message);
            this.activeDownloads.delete(String(downloadId));
            listeners.onError?.(message, downloadId);
        });

        return { downloadId, downloaderName: downloader.getDownloaderName(), outputPath: ctx.outputPath };
    }
}

export default new DownloadOrchestratorService();
