// routes/downloadsRouter.ts
import { Router } from "express";
import fs from "fs";
import path from "path";
import DownloadService from "../services/DownloadService.ts";
import DownloadOrchestrator from "../services/DownloadOrchestratorService.ts";
import type { DownloadOutcome } from "../services/DownloadOrchestratorService.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { authMiddleware } from "../middleware/auth.ts";

export const downloadsRouter = Router();

/**
 * Notifie n8n en fin de téléchargement. Best-effort : l'échec du callback ne doit
 * pas invalider un téléchargement qui a réussi, on se contente de le journaliser.
 */
async function notifyWebhook(webhookUrl: string, body: Record<string, unknown>) {
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) console.error(`[webhook] ${webhookUrl} a répondu ${res.status}`);
    } catch (err: any) {
        console.error(`[webhook] Envoi vers ${webhookUrl} échoué:`, err?.message ?? err);
    }
}

/**
 * POST /downloads/launch
 * Déclenchement HTTP d'un téléchargement, équivalent de l'événement socket
 * `downloadEpisode` pour les appelants sans WebSocket (n8n).
 *
 * Répond 202 dès que le téléchargement est accepté, sans attendre l'encodage.
 * Si `webhookUrl` est fourni, il est appelé en POST à la fin avec un payload
 * contenant `filePath`/`fileName`, exploitable tel quel par le flow de rangement.
 */
downloadsRouter.post("/launch", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const {
            urls, output, animeName, seasonName,
            seasonIndex = 0, episodeIndex = 0, directDownload = false, webhookUrl,
        } = req.body ?? {};

        const urlList = Array.isArray(urls) ? urls.filter((u: unknown) => typeof u === 'string' && u.trim()) : [];
        if (urlList.length === 0) return res.status(400).json({ error: "Champ 'urls' manquant ou vide" });
        if (!output || typeof output !== 'string') return res.status(400).json({ error: "Champ 'output' manquant" });
        if (!animeName || typeof animeName !== 'string') return res.status(400).json({ error: "Champ 'animeName' manquant" });

        if (webhookUrl !== undefined) {
            if (typeof webhookUrl !== 'string' || !/^https?:\/\//i.test(webhookUrl)) {
                return res.status(400).json({ error: "Champ 'webhookUrl' invalide (http(s) attendu)" });
            }
        }

        const listeners = webhookUrl ? {
            onDone: (outcome: DownloadOutcome) => {
                notifyWebhook(webhookUrl, {
                    ...outcome,
                    animeName,
                    seasonName: seasonName ?? null,
                    seasonIndex,
                    episodeIndex,
                });
            },
        } : {};

        const { downloadId, downloaderName } = await DownloadOrchestrator.launch({
            urls: urlList,
            output,
            animeName,
            seasonName: seasonName ?? 'episodes',
            seasonIndex,
            episodeIndex,
            directDownload,
            userId: authReq.user!.id,
        }, listeners);

        res.status(202).json({ downloadId, downloaderName, status: 'accepted' });
    } catch (error: any) {
        console.error("Launch download error:", error);
        res.status(502).json({ error: error.message });
    }
});


// downloadsRouter.get("", authMiddleware, async (req, res) => {
//     const authReq = req as AuthRequest;
//     console.log("salut")
//     try {
//         const downloads = await DownloadService.getUserDownloads(authReq.user!.id);
//         res.json({ downloads });
//     } catch (error: any) {
//         console.error("Get downloads error:", error);
//         res.status(500).json({ error: error.message });
//     }
// });


downloadsRouter.get("/errors", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const downloads = await DownloadService.getUserErroredDownloads(authReq.user!.id);
        res.json({ downloads });
    } catch (error: any) {
        console.error("Get errored downloads error:", error);
        res.status(500).json({ error: error.message });
    }
});

downloadsRouter.delete("/errors", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const removed = await DownloadService.clearUserErroredDownloads(authReq.user!.id);
        res.json({ removed });
    } catch (error: any) {
        console.error("Clear errored downloads error:", error);
        res.status(500).json({ error: error.message });
    }
});

downloadsRouter.get("/hierarchy", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const hierarchy = await DownloadService.getDownloadHierarchy(authReq.user!.id);
        res.json({ hierarchy });
    } catch (error: any) {
        console.error("Get hierarchy error:", error);
        res.status(500).json({ error: error.message });
    }
});

downloadsRouter.post("/zip/anime", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const { animeName } = req.body;
        if (!animeName) {
            return res.status(400).json({ error: "Missing anime name" });
        }

        const zipPath = await DownloadService.zipAnime(animeName, authReq.user!.id);

        res.download(zipPath, path.basename(zipPath), (err) => {
            if (err) console.error("Download error:", err);
            fs.unlinkSync(zipPath);
        });
    } catch (error: any) {
        console.error("Zip anime error:", error);
        res.status(500).json({ error: error.message });
    }
});

downloadsRouter.post("/zip/season", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const { animeName, seasonName } = req.body;
        if (!animeName || !seasonName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const zipPath = await DownloadService.zipSeason(animeName, seasonName, authReq.user!.id);

        res.download(zipPath, path.basename(zipPath), (err) => {
            if (err) console.error("Download error:", err);
            fs.unlinkSync(zipPath);
        });
    } catch (error: any) {
        console.error("Zip season error:", error);
        res.status(500).json({ error: error.message });
    }
});

downloadsRouter.delete("/:downloadId", authMiddleware, async (req, res) => {
    try {
        const { downloadId } = req.params;
        await DownloadService.deleteDownload(downloadId);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Delete download error:", error);
        res.status(500).json({ error: error.message });
    }
});

downloadsRouter.get("/:downloadId", async (req: any, res: any) => {
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