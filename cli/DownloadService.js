const Semaphore = require('./Semaphore');
const { downloadEpisodeVidmoly, requestTimeout, downloadEpisodeSibnet } = require('./EpisodeDownloader');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());


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

module.exports = {getNotStrikeEpisodeDownloader, downloadWorker, startDownload, removeScans}