import Config from '../config/Config.ts';
import Semaphore from '../utils/Semaphore.ts';
import Browser from '../utils/Browser.ts';
import Log from '../utils/Log.ts';
import EpisodeDownloader from './EpisodeDownloader.ts';

/**
 * 
 */
export default class DownloadService {
    
    private static readonly logger = Log.create(DownloadService.name);
    private static readonly semaphore = new Semaphore(Config.maxRunners);

    /**
     * Start downloading anime episodes.
     * @param animeName 
     * @param seasonName 
     * @param episodesNumbers 
     * @param urls 
     */
    static async startDownload(animeName: string, seasonName: string, episodesNumbers: number[], urls: [][]) { 
        this.logger.info('Starting downloads');

        const tasks = [];
        for (const episodeNumber of episodesNumbers) {
            const episodeUrls: [] = [];
            for (const url of urls){
                episodeUrls.push(url[episodeNumber-1]);
            }
            tasks.push(this.downloadWorker(episodeNumber, episodeUrls, seasonName, animeName));
            await Browser.requestTimeout(300);
        }
        await Promise.all(tasks);
        this.logger.info("End of downloads");
    }

    /**
     * Acquire a worker and make it download a given episode.
     * @param episodeNumber 
     * @param episodesUrls 
     * @param season 
     * @param anime 
     */
    static async downloadWorker(episodeNumber: number, episodesUrls: any, season: string, anime: string) {
        await this.semaphore.acquire();
        try {
            const downloadCallback = await this.getNotStrikedEpisodeDownloader(episodesUrls);
            await downloadCallback(episodeNumber, season, anime);
        }
        catch(e){
            this.logger.error(`Failed to download episode ${episodeNumber}`);
            this.logger.error(e);
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
    static async getNotStrikedEpisodeDownloader(readers: any){
        for (const episode of readers){
            const episodeUrl = episode.replace('to/', 'net/');

            if(episodeUrl.includes("vidmoly") && !(await this.isStrike(episodeUrl))){
                return async (episodeNumber: number, season: string, anime: string) => await EpisodeDownloader.downloadEpisodeVidmoly(episodeUrl, episodeNumber, season, anime);
            }else if(episodeUrl.includes('sibnet')){
                return async (episodeNumber: number, season: string, anime: string) => await EpisodeDownloader.downloadEpisodeSibnet(episodeUrl, episodeNumber, season, anime);
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
    static async isStrike(url: string) {
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

            Browser.closePage(page);
            if (result === "ok") return false;
            return result === "strike";

        } catch (err) {
            Browser.closePage(page);
            this.logger.error(err);
            return true;
        }
    }
}
