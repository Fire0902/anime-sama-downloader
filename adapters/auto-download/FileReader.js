//file used to install many anime at the same time
let listAnimes = require("./json/Animes.json");
import Browser from '../engine/utils/Browser.ts';
import Parser from "../engine/utils/Parser.ts";
import DownloadService from "../engine/download/DownloadService.js";
import { websiteUrl, waitForSelectorTimeout } from "../engine/config/Config.ts";
import AnimeManager from '../engine/anime/AnimeManager.ts';

class FileReader {

    /**
     * search first found name for all anime in the object
     * @param {*} animes 
     */
    static async fillAnimesUrlAndNames() {
        const page = await Browser.newPage();

        for (let animeName in listAnimes) {
            let animeNameCompact = animeName.replaceAll(" ", "+").toLowerCase();
            const url = `${websiteUrl}/?search=${animeNameCompact}`;
            await page.goto(url, {
                waitUntil: 'networkidle2'
            });

            await page.waitForSelector("#list_catalog", { timeout: waitForSelectorTimeout });
            const animesFound = await Scrapper.extractAnimeTitles(page);
            if (Object.keys(animesFound)[0])
                listAnimes[Object.keys(animesFound)[0]] = {
                    ...listAnimes[animeNameCompact],
                    url: Object.values(animesFound)[0]
                }
            listAnimes[animeNameCompact] = undefined;
        }
        Browser.closePage(page);
        console.log(listAnimes);
    }

    /**
     * 
     * @returns 
     */
    static async getSeasonsUrl() {
        const page = await Browser.newPage();
        const url = {};
        for (const [animeName, anime] of Object.entries(listAnimes)) {
            await page.goto(anime.url, {
                waitUntil: 'networkidle2'
            });
            await page.waitForSelector(
                "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
                { timeout: 10000 }
            );
            const seasonsWithScans = await Scrapper.extractSeasons(page);
            const seasons = AnimeManager.removeScans(seasonsWithScans);
            let chosenSeasons = [];
            if (anime.seasons === "ALL") {
                chosenSeasons = Array.from({ length: seasons.length }, (_, i) => i + 1);
            } else {
                chosenSeasons = Parser.parseNumbers(anime.seasons);
            }
            if (!url[animeName]) {
                url[animeName] = {};
            }
            for (const season of chosenSeasons) {
                console.log(season);
                if (seasons[season - 1]) {
                    url[animeName][seasons[season - 1].name] = anime.url + seasons[season - 1].link;
                }
            }
        }
        console.log("saisons");
        console.log(url);
        return url;
    }

    /**
     * 
     * @param {*} url 
     */
    static async getEpisodes(url) {
        console.log(url);
        for (const [, seasons] of Object.entries(url)) {
            console.log(seasons);
            for (const [seasonName, url] of Object.entries(seasons)) {
                const readers = await Scrapper.extractEpisodes(url);
                console.log("reader");
                console.log(readers);
                seasons[seasonName] = readers;
            }
        }
        console.log("episodes");
        console.dir(url, { depth: null });
    }

}

async function main() {
    await FileReader.fillAnimesUrlAndNames();
    const url = await FileReader.getSeasonsUrl();
    await FileReader.getEpisodes(url);

    for (const [animeName, seasons] of Object.entries(url)) {
        for (const [seasonName, readers] of Object.entries(seasons)) {
            let numbers = [];
            if (listAnimes[animeName].episodes === "ALL") {
                for (let index = 0; index < readers[0].length; index++) {
                    numbers.push(index + 1);
                }
            } else {
                numbers = Parser.parseNumbers(listAnimes[animeName].episodes);
            }
            await DownloadService.startDownload(animeName, seasonName, numbers, readers);
        }
    }
    Browser.close();
}
await main();