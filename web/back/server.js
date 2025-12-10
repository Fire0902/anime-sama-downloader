const express = require("express");
const cors = require("cors");
const Browser = require('../../engine/Browser');
const { removeScans, startDownload } = require('../../engine/DownloadService');
const { websiteUrl } = require("../../config/config");
const { extractAnimeTitles, extractSeasonsWithScans, extractEpisodes } = require("../../engine/Scrapper");
const { parseNumbers } = require("../../engine/Parser");


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post("/input", async (req, res) => {
    const { value, lastChar } = req.body;

    const page = await Browser.newPage();

    console.log("Reçu du frontend:");
    console.log("Valeur complète:", value);
    console.log("Dernière lettre:", lastChar);
    
    const url = `${websiteUrl}/?search=${value.replaceAll(" ", "+")}`;
    await page.goto(url, {
        waitUntil: 'networkidle2'
    });

    const animesTitle = await extractAnimeTitles(page);

    res.json({ animesTitle: animesTitle });
});
app.post("/seasons", async (req, res) => {
    const { animeUrl } = req.body;

    const page = await Browser.newPage();

    await page.goto(animeUrl, {
        waitUntil: 'networkidle2'
    });
    const animeSeasonsWithScan = await extractSeasonsWithScans(page);
    const animeSeasons = removeScans(animeSeasonsWithScan);
    res.json({ animeSeasons: animeSeasons });
});

app.post("/episodes", async (req, res) => {
    const {animeName, seasonName, seasonUrl} = req.body;
    
    const readers = await extractEpisodes(seasonUrl);

    await startDownload(animeName, seasonName, parseNumbers(`1-${readers[0].length}`), readers);

    res.json({ message: "downloaded"});
});

app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
