import { Router } from "express";
import AuthService from "../services/AuthService.ts";
import { authMiddleware, adminMiddleware } from "../middleware/auth.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import MALScheduler from "../services/MALScheduler.ts";

export const adminRouter = Router();

/**
 * GET /admin/users
 * Récupère tous les utilisateurs
 */
adminRouter.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await AuthService.getAllUsers();
        res.json({ users });
    } catch (error: any) {
        console.error("Get users error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /admin/users
 * Crée un nouvel utilisateur
 */
adminRouter.post("/users", authMiddleware, adminMiddleware, async (req, res) => {
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

/**
 * DELETE /admin/users/:userId
 * Supprime un utilisateur sauf soi-même
 */
adminRouter.delete("/users/:userId", authMiddleware, adminMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const userId = parseInt(req.params.userId, 10);

        if (userId === authReq.user?.id) {
            return res.status(400).json({ error: "Cannot delete your own account" });
        }

        await AuthService.deleteUser(userId);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: error.message });
    }
});

adminRouter.get("/scheduler/status", authMiddleware, adminMiddleware, async (req, res: any) => {
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

adminRouter.post("/scheduler/restart", authMiddleware, adminMiddleware, async (req, res: any) => {
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

adminRouter.patch("/users/:userId/password", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'password requis' });
        await AuthService.updatePassword(userId, password);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});