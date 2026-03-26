// routes/downloadsRouter.ts
import { Router } from "express";
import fs from "fs";
import path from "path";
import DownloadService from "../services/DownloadService.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { authMiddleware } from "../middleware/auth.ts";

export const downloadsRouter = Router();

/**
 * GET /downloads
 * Récupère tous les téléchargements de l'utilisateur
 */
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

/**
 * GET /downloads/hierarchy
 * Récupère la hiérarchie des téléchargements de l'utilisateur
 */
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

/**
 * POST /downloads/zip/anime
 * Crée un zip pour un anime complet
 */
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

/**
 * POST /downloads/zip/season
 * Crée un zip pour une saison d'anime
 */
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

/**
 * DELETE /downloads/:downloadId
 * Supprime un téléchargement spécifique
 */
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