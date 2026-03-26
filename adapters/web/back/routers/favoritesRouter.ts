// routes/favoritesRouter.ts
import { Router } from "express";
import FavoriteService from "../services/FavoriteService.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import MALScheduler from "../services/MALScheduler.ts";

export const favoritesRouter = Router();

/**
 * GET /favorites
 * Récupère la liste des favoris de l'utilisateur
 */
favoritesRouter.get("/", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const favorites = await FavoriteService.getUserFavorites(authReq.user!.id);
        res.json({ favorites });
    } catch (error: any) {
        console.error("Get favorites error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /favorites
 * Ajoute un anime aux favoris
 */
favoritesRouter.post("/", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const { animeName, animeUrl, malId } = req.body;

        if (!animeName || !animeUrl) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const favorite = await FavoriteService.addFavorite(
            authReq.user!.id,
            animeName,
            animeUrl,
            malId
        );
        res.json({ favorite });
    } catch (error: any) {
        console.error("Add favorite error:", error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * DELETE /favorites/:favoriteId
 * Supprime un favori
 */
favoritesRouter.delete("/:favoriteId", authMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
        const favoriteId = parseInt(req.params.favoriteId, 10);
        await FavoriteService.removeFavorite(authReq.user!.id, favoriteId);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Remove favorite error:", error);
        res.status(400).json({ error: error.message });
    }
});


favoritesRouter.post("/:favoriteId/check-now", authMiddleware, async (req, res: any) => {
    const authReq = req as AuthRequest;
    try {
        const favoriteId = parseInt(req.params.favoriteId);
        const favorites = await FavoriteService.getUserFavorites(authReq.user!.id);
        const favorite = favorites.find(f => f.id === favoriteId);
        
        if (!favorite) {
            return res.status(404).json({ error: "Favorite not found" });
        }
        
        if (!favorite.mal_id) {
            return res.status(400).json({ error: "No MAL ID associated with this favorite" });
        }
        
        const malStatus = await FavoriteService.getMALAnimeStatus(favorite.mal_id);
        
        await FavoriteService.updateOngoingStatus(favoriteId, malStatus.status === 'currently_airing');
        await FavoriteService.updateLastChecked(favoriteId);
        
        let nextEpisodeTime = null;
        if (malStatus.broadcast && malStatus.status === 'currently_airing') {

            nextEpisodeTime = {
                day: malStatus.broadcast.day_of_the_week,
                time: malStatus.broadcast.start_time
            };
        }
        
        res.json({
            favorite: {
                id: favorite.id,
                anime_name: favorite.anime_name,
                mal_status: malStatus.status,
                num_episodes: malStatus.num_episodes,
                last_downloaded: favorite.last_episode_downloaded,
                new_episodes_available: malStatus.num_episodes - favorite.last_episode_downloaded,
                next_episode_broadcast: nextEpisodeTime
            }
        });
    } catch (error: any) {
        console.error("Check now error:", error);
        res.status(500).json({ error: error.message });
    }
});
favoritesRouter.get("/scheduled", authMiddleware, async (req, res: any) => {
    const authReq = req as AuthRequest;
    try {
        const scheduledDownloads = MALScheduler.getScheduledDownloads();
        
        const enrichedSchedules = await Promise.all(
            scheduledDownloads.map(async (scheduled) => {
                const favorites = await FavoriteService.getUserFavorites(authReq.user!.id);
                const favorite = favorites.find(f => f.id === scheduled.favoriteId);
                
                return {
                    favoriteId: scheduled.favoriteId,
                    animeName: favorite?.anime_name || 'Unknown',
                    episodeNumber: scheduled.episodeNumber,
                    scheduledTime: scheduled.scheduledTime,
                    timeRemaining: scheduled.scheduledTime.getTime() - Date.now()
                };
            })
        );
        
        res.json({ 
            scheduled: enrichedSchedules.filter(s => s.timeRemaining > 0)
        });
    } catch (error: any) {
        console.error("Get scheduled downloads error:", error);
        res.status(500).json({ error: error.message });
    }
});