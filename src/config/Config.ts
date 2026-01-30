import { type PuppeteerLifeCycleEvent } from "puppeteer";

/** 
 * Tool configuration class with all static config and debug attributes.
 * 
 * It is advised to modify those attributes instead of source code.
 * Modify it may breaks process, use it at your own risks.
*/
export default class Config{

    // ----- ADRESSES -----

    /** Main website URL for searching content */
    static readonly websiteAdress: string = "https://anime-sama.si";

    /** Video cloud host website URL */
    static readonly videoHostAdress: string = "https://video.sibnet.ru";

    // ----- DOWNLOAD -----
    
    /** Maximum number of videos downloaded simultaneously */
    static readonly maxSimultVideos: number = 2;

    /** */
    static readonly downloadJSONPath: string = 'json/animes.json';

    /** Folder where all videos will be downloaded */
    static readonly downloadPath: string = 'animes';

    /** Default format for downloads */
    static readonly downloadDefaultFormat: string = 'txt';

    /** Default format for FFmpeg downloads */
    static readonly downloadVideoFormat: string = 'mp4';

    /** Default video encoding */
    static readonly defaultEncoding: BufferEncoding = 'utf8';

    // ----- WEB -----

    /** Time to wait for web page before timeout */
    static readonly goToPageTimeout: number = 0;

    /** Time to wait for specific HTML element before timeout */
    static readonly waitForSelectorTimeout: number = 0;

    /** Browser user agent */
    static readonly userAgent: string = "Mozilla/5.0";

    static readonly defaultWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    // ----- WEB - ANIMES -----

    /**  */
    static readonly animeSearchWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /** */
    static readonly animeSearchPageId: string = "list_catalog";

    /** */
    static readonly animeSearchPageSelector: string = `#${this.animeSearchPageId}`;

    // ----- WEB - SEASONS -----

    /** */
    static readonly seasonSearchWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /** */
    static readonly seasonsPageSelector: string = 
    "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded.mt-2.h-auto a";

    // ----- DEBUG -----

    /** Will take a screenshot each loaded page. Mostly used for debugging */
    static readonly enableScreenshot: boolean = true;

    /** Where screenshots will be saved */
    static readonly screenshotPath: string = "screenshots";

    // ----- LOGS -----

    /** Folder where all logs will be written */
    static readonly logPath: string = "logs";

    /** Logs default file type */
    static readonly logFileType: string = "json";

    /** Logger minimum level to be visible or hidden */
    static readonly logDefaultType: "hidden" | "json" | "pretty" = "hidden";

    /** Logger minimum level to be visible or hidden */
    static readonly logMinLevel: number = 2;

}
