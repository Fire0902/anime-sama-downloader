import { Router } from 'express';
import FTPConfigService from '../services/FTPConfigService.ts';
import FTPUploaderService from '../services/FTPUploaderService.ts';
import FolderStructureConfigService from '../services/FolderStructureConfigService.ts';
import { authMiddleware } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

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
