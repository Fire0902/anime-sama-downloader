//file used to install many anime at the same time
let listAnimes = require("./Animes.json");
const Browser = require('./Browser');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { parseNumbers } = require("./Parser");
const { extractAnimes, extractSeasons, extractEpisodes } = require("./Scrapper");
const Semaphore = require('./Semaphore');
const { downloadEpisodeVidmoly, requestTimeout, downloadEpisodeSibnet } = require('./EpisodeDownloader');

puppeteer.use(StealthPlugin());

const websiteUrl = 'https://anime-sama.org/catalogue';

/**
 * search first found name for all anime in the object
 * @param {*} animes 
 */
async function fillAnimesUrl(animes){
    const page = await Browser.newPage();
    for(const anime in animes){
        const url = websiteUrl + "/?search=" + anime.replace(" ", "+").toLowerCase();
        await page.goto(url, {
            waitUntil: 'networkidle2'
        });
        await page.waitForSelector("#list_catalog", { timeout: 10000 });
        const animesFound = await extractAnimes(page);
        animes[anime].url = Object.values(animesFound)[0] ?? null;
    }
    await Browser.closePage(page);
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
            for(const i of seasons){
                chosenSeasons.push(i+1);
            }
        }else{
            chosenSeasons = parseNumbers(anime.seasons);
        }
        if (!url[animeName]) {
            url[animeName] = {}; 
        }
        for(const season of chosenSeasons){
            if(seasons[season-1]){
                url[animeName][seasons[season-1].name] = anime.url + seasons[season-1].link;
            }
        }
    }
    return url;
}

async function getEpisodes(url){
    for(const [animeName, seasons] of Object.entries(url)){
        for(const [seasonName, url] of Object.entries(seasons)){
            const readers = await extractEpisodes(url);
            seasons[seasonName] = readers;
        }
    }
    console.dir(url, { depth: null });
}

function removeScans(seasons){
    return seasons.filter(season => !season.name.toLowerCase().includes('scans'));
}

/**
 * Start downloading anime episodes.
 * @param animeName 
 * @param seasonName 
 * @param episodesNumbers 
 * @param readers 
 */
async function startDownload(animeName, seasonName, episodesNumbers, readers) { 
    console.log('\nStarting downloads...');
    const tasks = [];
    for (const episodeNumber of episodesNumbers) {
        const episodeReaders = [];
        for(const reader of readers){
            episodeReaders.push(reader[episodeNumber-1]);
        }
        tasks.push(downloadWorker(episodeNumber, episodeReaders, seasonName, animeName));
        await requestTimeout(300);
    }
    await Promise.all(tasks);
    console.log("\nEnd of downloads");
}

/**
 * Acquire a worker and make it download a given episode.
 * @param episodeNumber 
 * @param episodes 
 * @param season 
 * @param url 
 */
const semaphore = new Semaphore(2);
async function downloadWorker(episodeNumber, readers, season, anime) {
    await semaphore.acquire();
    try {
        const downloadCallback = await getNotStrikeEpisodeDownloader(readers);
        await downloadCallback(episodeNumber, season, anime);
    } 
    catch(e){
        console.error(`Failed to download episode ${episodeNumber}`);
        console.error(e);
        semaphore.release();
    }
    finally {
        semaphore.release();
    }
}
async function getNotStrikeEpisodeDownloader(readers){
    for(const ep of readers){
        const episode = ep.replace('to/', 'net/');

        if(episode.includes("vidmoly") && !(await isStrike(episode))){
            return async (episodeNumber, season, anime) => {await downloadEpisodeVidmoly(episode, episodeNumber, season, anime);};
        }else if(episode.includes('sibnet')){
            return async (episodeNumber, season, anime) => {await downloadEpisodeSibnet(episode, episodeNumber, season, anime);};
        }
    }
    return () => {console.log('pas de lecteur vidéo adéquat trouvé');}
}
/* for Vidmoly only */
async function isStrike(url) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        await page.goto(url, { timeout: 15000, waitUntil: "domcontentloaded" });

        const strikeSelector = '.error-banner';
        const okSelectors = ['.jw-video', '.jw-reset'];

        const result = await Promise.race([
            page.waitForSelector(strikeSelector, { timeout: 5000 }).then(() => "strike").catch(() => null),
            Promise.all(okSelectors.map(sel =>
                page.waitForSelector(sel, { timeout: 5000 })
            )).then(() => "ok").catch(() => null)
        ]);

        await browser.close();

        if (result === "strike") return true;
        if (result === "ok") return false;

        return true;

    } catch (err) {
        await browser.close();
        return true;
    }
}

async function main(){
    const emptyUrl = Object.fromEntries(
        Object.entries(listAnimes).filter(([_, data]) =>
            !data.url || data.url.trim() === ""
        )
    );
    await fillAnimesUrl(emptyUrl);
    listAnimes = {
        ...listAnimes,
        ...emptyUrl
    };
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