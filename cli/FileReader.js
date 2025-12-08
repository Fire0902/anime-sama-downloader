//file used to install many anime at the same time
let listAnimes = require("./Animes.json");
const Browser = require('./Browser');
const { parseNumbers } = require("./Parser");
const { extractAnimes, extractSeasons, extractEpisodes } = require("./Scrapper");
const {startDownload, removeScans} = require("./DownloadService");


const websiteUrl = 'https://anime-sama.eu/catalogue';

/**
 * search first found name for all anime in the object
 * @param {*} animes 
 */
async function fillAnimesUrlAndNames(){
    const page = await Browser.newPage();
    for(const anime in listAnimes){
        const url = websiteUrl + "/?search=" + anime.replaceAll(" ", "+").toLowerCase();
        await page.goto(url, {
            waitUntil: 'networkidle2'
        });
        await page.waitForSelector("#list_catalog", { timeout: 10000 });
        const animesFound = await extractAnimes(page);
        if(Object.keys(animesFound)[0])
            listAnimes[Object.keys(animesFound)[0]] = {
                ...listAnimes[anime],
                url: Object.values(animesFound)[0]
            }
        listAnimes[anime] = undefined;
    }
    await Browser.closePage(page);
    console.log(listAnimes);
}

async function getSeasonsUrl(){
    const page = await Browser.newPage();
    const url = {};
    for(const [animeName, anime] of Object.entries(listAnimes)){
        await page.goto(anime.url, {
            waitUntil: 'networkidle2'
        });
        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );
        const seasonsWithScans = await extractSeasons(page);
        const seasons = removeScans(seasonsWithScans);
        let chosenSeasons = [];
        if(anime.seasons === "ALL"){
            chosenSeasons = Array.from({ length: seasons.length }, (_, i) => i + 1);
        }else{
            chosenSeasons = parseNumbers(anime.seasons);
        }
        if (!url[animeName]) {
            url[animeName] = {}; 
        }
        for(const season of chosenSeasons){
            console.log(season);
            if(seasons[season-1]){
                url[animeName][seasons[season-1].name] = anime.url + seasons[season-1].link;
            }
        }
    }
    console.log("saisons");
    console.log(url);
    return url;
}

async function getEpisodes(url){
    console.log(url);
    for(const [animeName, seasons] of Object.entries(url)){
        console.log(seasons);
        for(const [seasonName, url] of Object.entries(seasons)){
            const readers = await extractEpisodes(url);
            console.log("reader");
            console.log(readers);
            seasons[seasonName] = readers;
        }
    }
    console.log("episodes");
    console.dir(url, { depth: null });
}

async function main(){
    await fillAnimesUrlAndNames();
    const url = await getSeasonsUrl();
    await getEpisodes(url);
    
    for(const [animeName, seasons] of Object.entries(url)){
        for(const [seasonName, readers] of Object.entries(seasons)){
            let numbers = [];
            if(listAnimes[animeName].episodes === "ALL"){
                for(let index = 0; index<readers[0].length; index++){
                    numbers.push(index+1);
                }
            }else{
                numbers = parseNumbers(listAnimes[animeName].episodes);
            }
            await startDownload(animeName, seasonName, numbers, readers);
        }
    }

    Browser.close();
}
main();