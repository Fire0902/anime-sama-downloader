// routes/scrapperRouter.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.ts";
import Config from "../../../../engine/config/Config.ts";
import Puppeteer from "../../../../engine/utils/web/Puppeteer.ts";
import Scrapper from "../../../../engine/utils/web/Scrapper.ts";
import AnimeService from "../../../../engine/service/anime/AnimeService.ts";

export const scrapperRouter = Router();

/**
 * POST /input
 * Recherche d'animes
 */
scrapperRouter.post("/input", authMiddleware, async (req, res) => {
    try {
        const { value } = req.body;
        if (!value) return res.status(400).json({ error: "Missing search value" });

        console.log("Reçu du frontend:", value);
        const url = `${Config.websiteAdress}/catalogue/?search=${value.replaceAll(" ", "+")}`;
        const page = await Puppeteer.goto(url);
        const animesTitle = await Scrapper.extractAnimeTitles(page);
        await page.close();

        res.json({ animesTitle });
    } catch (error: any) {
        console.error("Anime search error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /seasons
 * Récupération des saisons d'un anime
 */
scrapperRouter.post("/seasons", authMiddleware, async (req, res) => {
    try {
        const { animeUrl } = req.body;
        if (!animeUrl) return res.status(400).json({ error: "Missing anime URL" });

        const seasons = await AnimeService.extractSeasonWithoutScans(animeUrl);

        if(seasons){
            const entries = Object.entries(seasons);
            const filtered = entries.map(season => ({
                name: season[0],
                link: season[1]
            }))
            res.json({ animeSeasons: [...filtered] });
        }
    } catch (error: any) {
        console.error("Seasons fetch error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /episodes
 * Récupération des épisodes d'une saison
 */
scrapperRouter.post("/episodes", authMiddleware, async (req, res) => {
    try {
        const { seasonUrl } = req.body;
        if (!seasonUrl) return res.status(400).json({ error: "Missing season URL" });
        const readers = await Scrapper.extractEpisodes(seasonUrl);
        const readersNet = readers.map(readerList =>
            readerList.map((episode: string) => episode.replace('to/', 'net/'))
        );
        res.status(200).json({ readerUrls: readersNet });
    } catch (error: any) {
        console.error("Episodes fetch error:", error);
        res.status(500).json({ error: error.message });
    }
});