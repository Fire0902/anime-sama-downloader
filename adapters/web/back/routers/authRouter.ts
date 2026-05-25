import { Router } from "express";
import AuthService from "../services/AuthService.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { AuthRequest } from "../middleware/auth.ts";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
    try {
        const { username, email, password, is_admin } = req.body;
        if (!username || !email || !password)
            return res.status(400).json({ error: "Missing fields" });

        const existingUsers = await AuthService.getAllUsers();
        const isFirstUser = existingUsers.length === 0;
        const user = await AuthService.register(username, email, password, isFirstUser && !!is_admin);
        res.json({ user });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

authRouter.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: "Missing fields" });
        
        const token = await AuthService.login(username, password);
        res.json(token);
    } catch (err: any) {
        res.status(401).json({ error: err.message });
    }
});

authRouter.post("/logout", authMiddleware, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (token) await AuthService.logout(token);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.get("/me", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    res.json({ user: authReq.user });
});

authRouter.get("/has-users", async (_req, res) => {
    try {
        const users = await AuthService.getAllUsers();
        res.json({ hasUsers: users.length > 0 });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});