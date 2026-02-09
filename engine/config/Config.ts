import { type PuppeteerLifeCycleEvent } from "puppeteer";

/** 
 * Tool configuration class with all static config and debug attributes.
 *
 * Modify it may breaks process, use it at your own risks.
*/
export default class Config{

    // ----- ADRESSES -----

    /** Main website URL for searching content */
    static readonly websiteDomainsAdress: string = "https://anime-sama.pw";

    /** Main website URL for searching content */
    static readonly websiteDomainsClass: string = ".domain-name";

    /** Main website URL for searching content. Its value is auto-updated. */
    static websiteAdress: string = "https://anime-sama.tv";

    /** Video cloud host website URL */
    static readonly videoHostAdress: string = "https://video.sibnet.ru";

    // ----- DOWNLOAD -----
    
    /** Maximum number of videos downloaded simultaneously */
    static readonly maxSimultVideos: number = 2;

    /** Folder where all data will be taken from auto-downloader */
    static readonly autoDownloaderDataPath: string = 'json/animes.json';

    /** Folder where all videos will be downloaded */
    static readonly downloadPath: string = 'animes';

    /** Default format for downloads */
    static readonly downloadDefaultFormat: string = 'txt';

    /** Default format for FFmpeg downloads */
    static readonly downloadVideoFormat: string = 'mp4';

    /** Default video encoding */
    static readonly defaultEncoding: BufferEncoding = 'utf8';

    /** Delay between each download (ms) */
    static readonly downloadTimeout: number = 0;

    // ----- PUPPETEER -----

    /** 
     * Browser window viewport used by [Tor project](https://www.torproject.org/) 
     * to prevent [fingerprinting](https://en.wikipedia.org/wiki/Fingerprint_(computing)).
     *  
     * You should not modify it except if Tor changes its window resolution.
     * @defaultValue '{width: 1400, height: 900}'
    */
    static readonly windowResolution: {width: number, height: number} = 
    { width: 1400, height: 900 }

    /** Browser user agent */
    static readonly userAgent: string = "Mozilla/5.0";

    /** Default network event to wait for */
    static readonly defaultWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /** Time to wait for web page before timeout (ms) */
    static readonly goToPageTimeout: number = 0;

    /** Time to wait for specific HTML element before timeout (ms) */
    static readonly waitForSelectorTimeout: number = 0;

    /** Set to true to check for CloudFlare challenge and try to bypass them */
    static readonly checkCloudFlare: boolean = false;

    // ----- PUPPETEER - ANIMES -----

    /** Default network event to wait for */
    static readonly animeSearchWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /** Anime catalog list HTML identifier */
    static readonly animeSearchPageId: string = "list_catalog";

    /** Anime catalog list HTML selector */
    static readonly animeSearchPageSelector: string = `#${this.animeSearchPageId}`;

    // ----- PUPPETEER - SEASONS -----

    /** Default network event to wait for */
    static readonly seasonSearchWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /** Anime catalog list HTML selector */
    static readonly seasonsPageSelector: string = 
    "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded.mt-2.h-auto a";

    // ----- LOGS -----

    /** Folder where all logs will be written */
    static readonly logPath: string = "logs";

    /** Logs default file type */
    static readonly logFileType: string = "json";

    /** Logs default filename */
    static readonly logFileName: string = `${new Date().toDateString()}.${this.logFileType}`;

    /** Logger minimum level to be visible or hidden */
    static readonly logDefaultType: "hidden" | "json" | "pretty" = "hidden";

    /** Logger minimum level to be visible or hidden */
    static readonly logMinLevel: number = 2;

    // ----- DEBUG -----

    /** Will take a screenshot each loaded page. Mostly used for debugging */
    static readonly enableScreenshots: boolean = false;

    /** Where screenshots will be saved */
    static readonly screenshotsPath: string = "screenshots";

}
