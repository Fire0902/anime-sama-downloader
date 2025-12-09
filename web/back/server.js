const express = require("express");
const cors = require("cors");
const Browser = require('../../engine/Browser');
const { websiteUrl } = require("../../config/config");
const { extractAnimeTitles } = require("../../engine/Scrapper");


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

app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
