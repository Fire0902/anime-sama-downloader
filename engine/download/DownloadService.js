import Semaphore from '../utils/Semaphore.js';
import Browser from '../utils/web/Browser.js';
import EpisodeDownloader from './EpisodeDownloader.js';
import Config from '../config/Config.js';

/**
 * 
 */
export default class DownloadService {
    
    static semaphore = new Semaphore(Config.maxRunners);

    /**
     * Start downloading anime episodes.
     * @param animeName 
     * @param seasonName 
     * @param episodesNumbers 
     * @param readers 
     */
    static async startDownload(animeName, seasonName, episodesNumbers, readers) { 
        console.log('\n[LOG] Starting downloads...');
        const tasks = [];
        for (const episodeNumber of episodesNumbers) {
            const episodeReaders = [];
            for (const reader of readers){
                episodeReaders.push(reader[episodeNumber-1]);
            }
            tasks.push(this.downloadWorker(episodeNumber, episodeReaders, seasonName, animeName));
            await Browser.requestTimeout(300);
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
    static async downloadWorker(episodeNumber, readers, season, anime) {
        await this.semaphore.acquire();
        try {
            const downloadCallback = await this.getNotStrikedEpisodeDownloader(readers);
            await downloadCallback(episodeNumber, season, anime);
        }
        catch(e){
            console.error(`Failed to download episode ${episodeNumber}`);
            console.error(e);
            this.semaphore.release();
        }
        finally {
            this.semaphore.release();
        }
    }

    /**
     * 
     * @param {*} readers 
     * @returns a appropriate callback download method 
     */
    static async getNotStrikedEpisodeDownloader(readers){
        for(const ep of readers){
            const episodeUrl = ep.replace('to/', 'net/');

            if(episodeUrl.includes("vidmoly") && !(await this.isStrike(episodeUrl))){
                return async (episodeNumber, season, anime) => await EpisodeDownloader.downloadEpisodeVidmoly(episodeUrl, episodeNumber, season, anime);
            }else if(episodeUrl.includes('sibnet')){
                return async (episodeNumber, season, anime) => await EpisodeDownloader.downloadEpisodeSibnet(episodeUrl, episodeNumber, season, anime);
            }
            return () => console.warn(`No appropriate media player found for episode: ${episodeUrl}`);
        }
        return () => console.warn('No appropriate media player found');
    }

    /**
     * Verify if given url is striked.
     * For Vidmoly only.
     * @param url
     */
    static async isStrike(url) {
        const page = await Browser.newPage();
        try {
            await page.goto(url, { timeout: Config.goToPageTimeout, waitUntil: "domcontentloaded" });

            const strikeSelector = '.error-banner';
            const okSelectors = ['.jw-video', '.jw-reset'];

            const result = await Promise.race([
                page.waitForSelector(strikeSelector, { timeout: Config.waitForSelectorTimeout }).then(() => "strike").catch(() => null),
                Promise.all(okSelectors.map(sel =>
                    page.waitForSelector(sel, { timeout: Config.waitForSelectorTimeout })
                )).then(() => "ok").catch(() => null)
            ]);

            await Browser.closePage(page);
            if (result === "ok") return false;
            return result === "strike";

        } catch (err) {
            await Browser.closePage(page);
            console.log(err);
            return true;
        }
    }

    /**
     * 
     * @param {*} seasons 
     * @returns 
     */
    static removeScans(seasons){
        console.log('\n[LOG] Removing scans from seasons...');
        return seasons.filter(season => !season.name.toLowerCase().includes('scans'));
    }
}

