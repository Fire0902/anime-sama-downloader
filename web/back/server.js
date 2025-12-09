const express = require("express");
const cors = require("cors");
const Browser = require('../../engine/Browser');
const { removeScans } = require('../../engine/DownloadService');
const { websiteUrl } = require("../../config/config");
const { extractAnimeTitles, extractSeasonsWithScans } = require("../../engine/Scrapper");


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

app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
