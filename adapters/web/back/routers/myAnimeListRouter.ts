import { Router } from "express";
import { authMiddleware } from "../middleware/auth.ts";
import FavoriteService from "../services/FavoriteService.ts";

export const myAnimeListRouter = Router();

myAnimeListRouter.get("/search", authMiddleware, async (req, res: any) => {
    try {
        const query = req.query.q as string;

        if (!query) {
            return res.status(400).json({ error: "Missing query parameter" });
        }

        const results = await FavoriteService.searchMAL(query);
        res.json({ results });
    } catch (error: any) {
        console.error("MAL search error:", error);
        res.status(500).json({ error: error.message });
    }
});
