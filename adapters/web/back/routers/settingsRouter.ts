import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FTPConfigService from '../services/FTPConfigService.ts';
import FTPUploaderService from '../services/FTPUploaderService.ts';
import FolderStructureConfigService from '../services/FolderStructureConfigService.ts';
import StorageService from '../services/StorageService.ts';
import DownloadService from '../services/DownloadService.ts';
import { authMiddleware, adminMiddleware } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirnameRouters = path.dirname(__filename);

function updateEnvFile(updates: Record<string, string>): void {
    const envPath = path.join(__dirnameRouters, '../.env');
    let lines: string[] = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, 'utf8').split('\n')
        : [];
    for (const [key, value] of Object.entries(updates)) {
        const idx = lines.findIndex(l => new RegExp(`^${key}=`).test(l));
        if (idx >= 0) {
            lines[idx] = `${key}=${value}`;
        } else {
            lines.push(`${key}=${value}`);
        }
        process.env[key] = value;
    }
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

export const settingsRouter = Router();

/**
 * GET /settings/ftp
 * Récupère la configuration FTP/SFTP de l'utilisateur (sans password)
 */
settingsRouter.get('/ftp', authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const config = await FTPConfigService.getUserFTPConfig(authReq.user!.id);
        res.json({ config });
    } catch (error: any) {
        console.error('Get FTP config error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /settings/ftp
 * Crée ou met à jour la configuration FTP/SFTP de l'utilisateur
 */
settingsRouter.post('/ftp', authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const { protocol, host, port, username, password, remote_path, passive_mode } = req.body;

        if (!protocol) {
            return res.status(400).json({ error: 'Protocol is required' });
        }

        const config = await FTPConfigService.saveUserFTPConfig(authReq.user!.id, {
            protocol,
            host,
            port,
            username,
            password,
            remote_path,
            passive_mode
        });

        res.json({ config });
    } catch (error: any) {
        console.error('Save FTP config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /settings/ftp/test
 * Teste la connexion FTP/SFTP
 */
settingsRouter.post('/ftp/test', authMiddleware, async (req, res) => {
    try {
        const { protocol, host, port, username, password, passive_mode } = req.body;

        if (!protocol || !host || !port || !username || !password) {
            return res.status(400).json({ error: 'Missing required fields for connection test' });
        }

        const success = await FTPUploaderService.testConnection({
            protocol: protocol as 'ftp' | 'sftp',
            host,
            port,
            username,
            password,
            passive_mode
        });

        res.json({ success });
    } catch (error: any) {
        console.error('FTP connection test error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /settings/ftp
 * Réinitialise la configuration FTP à 'none' (désactiver FTP/SFTP)
 */
settingsRouter.delete('/ftp', authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        await FTPConfigService.resetUserFTPConfig(authReq.user!.id);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Reset FTP config error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /settings/folder-structure
 * Récupère la configuration de structure de dossier de l'utilisateur
 */
settingsRouter.get('/folder-structure', authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const config = await FolderStructureConfigService.getUserConfig(authReq.user!.id);
        res.json({ config });
    } catch (error: any) {
        console.error('Get folder structure config error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /settings/folder-structure
 * Crée ou met à jour la configuration de structure de dossier
 */
settingsRouter.post('/folder-structure', authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const { mode, season_format, episode_format, add_season_index, season_index_space, add_episode_index, episode_index_space } = req.body;

        if (!mode) {
            return res.status(400).json({ error: 'Mode is required' });
        }

        if (!['mode1', 'mode2', 'mode3', 'jellyfin'].includes(mode)) {
            return res.status(400).json({ error: 'Invalid mode' });
        }

        const config = await FolderStructureConfigService.saveUserConfig(authReq.user!.id, {
            mode,
            season_format,
            episode_format,
            add_season_index,
            season_index_space,
            add_episode_index,
            episode_index_space
        });

        res.json({ config });
    } catch (error: any) {
        console.error('Save folder structure config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /settings/storage
 * Récupère les infos de stockage (disque et dossier de téléchargement)
 */
settingsRouter.get('/storage', authMiddleware, async (req, res) => {
    try {
        const downloadPath = DownloadService.getDownloadsDir();
        const storageInfo = StorageService.getStorageInfo(downloadPath);
        const formattedInfo = StorageService.formatStorageInfo(storageInfo);
        res.json({ storage: formattedInfo });
    } catch (error: any) {
        console.error('Get storage info error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /settings/jellyseerr
 * Retourne l'URL Jellyseerr et si le token est configuré
 */
settingsRouter.get('/jellyseerr', authMiddleware, (req, res) => {
    res.json({
        url: process.env.JELLYSEERR_URL ?? '',
        hasToken: !!process.env.JELLYSEERR_TOKEN,
    });
});

/**
 * POST /settings/jellyseerr
 * Met à jour l'URL et le token Jellyseerr dans le .env (admin seulement)
 */
settingsRouter.post('/jellyseerr', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { url, token } = req.body;
        if (!url) return res.status(400).json({ error: 'url est requis' });

        const updates: Record<string, string> = { JELLYSEERR_URL: url };
        if (token) updates['JELLYSEERR_TOKEN'] = token;
        updateEnvFile(updates);

        res.json({ success: true });
    } catch (error: any) {
        console.error('Save jellyseerr config error:', error);
        res.status(500).json({ error: error.message });
    }
});

