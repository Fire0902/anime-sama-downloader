import { type PuppeteerLifeCycleEvent } from "puppeteer";
import cliProgress from "cli-progress";

/** 
 * Tool configuration class with all static config and debug attributes.
 *
 * Modify it may breaks process, use it at your own risks.
*/
export default class Config{

    /** ADRESSES */
    static readonly externalHost = {
        /** Main website URL for searching content */
        domains: "https://anime-sama.pw",

        /** Main website URL for searching content */
        domainsClass: ".domain-name",

        /** Main website URL for searching content. Its value is auto-updated. */
        adress: "https://anime-sama.tv",

        /** Video cloud host website URL */
        videoHostAdress: "https://video.sibnet.ru",
    };

    /** DOWNLOAD */
    static readonly download = {
        /** Maximum number of videos downloaded simultaneously */
        maxSimultVideos: 2,

        /** Folder where all data will be taken from auto-downloader */
        autoDownloaderDataPath: 'json/animes.json',

        /** Folder where all videos will be downloaded */
        path: 'animes',

        /** Default format for downloads */
        defaultFormat: 'txt',

        /** Default format for FFmpeg downloads */
        videoFormat: 'mp4',

        /** Default video encoding */
        defaultEncoding: 'utf8' as BufferEncoding,

        /** Delay between each download (ms) */
        timeout: 0,
    };

    /** PUPPETEER */
    static readonly web = {
        /** 
        * Browser window viewport used by [Tor Project](https://www.torproject.org/) 
        * to prevent [fingerprinting](https://en.wikipedia.org/wiki/Fingerprint_(computing)).
        *  
        * You should not modify it except if Tor changes its window resolution.
        * @defaultValue '{width: 1400, height: 900}'
        */
        windowResolution: { width: 1400, height: 900 },
        
        /** Browser user agent */
        userAgent: "Mozilla/5.0",

        /** Default network event to wait for */
        defaultWaitUntil: 'networkidle2' as PuppeteerLifeCycleEvent,

        /** Time to wait for web page before timeout (ms) */
        goToPageTimeout: 0,

        /** Set to true to check for CloudFlare challenge and try to bypass them */
        checkCloudFlare: false,

        /** Time to wait for specific HTML element before timeout (ms) */
        waitForSelectorTimeout: 0,

        animes: {
            /** Default network event to wait for */
            waitUntil: 'networkidle2' as PuppeteerLifeCycleEvent,

            /** Anime catalog list HTML identifier */
            pageId: "list_catalog",

        },

        seasons: {
            /** Default network event to wait for */
            searchWaitUntil: 'networkidle2' as PuppeteerLifeCycleEvent,

            /** Anime catalog list HTML selector */
            pageSelector: 
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded.mt-2.h-auto a",
        },
    };

    /** LOGS */
    static readonly log = {
        /** Logger minimum level to be visible or hidden */
        defaultType: "hidden" as "hidden" | "json" | "pretty",

        /** Logger minimum level to be visible or hidden */
        minLevel: 2,
        
        /** Folder where all logs will be written */
        path: "logs",

        /** Logs default file type */
        fileType: "json",

        /** Logs default filename */
        fileName: `${new Date().toISOString()}`,

        /** Set as true will reduce logs a lot and greatly increase performance. */
        hidePositionForProduction: true,
    };

    // ----- DEBUG -----

    static readonly debug = {
        screenshots: {
            /** Will take a screenshot each loaded page */
            enable: false,

            /** Where screenshots will be saved */
            path: "screenshots",

            /** What screenshots will be named after */
            fileName: `screenshot-${new Date().toISOString()}`,
        }
    };

    static readonly cliProgressOptions = {
        format: "{name} [{bar}] {percentage}% || {eta}s",
        clearOnComplete: false,
        hideCursor: true,
        emptyOnZero: true,
		forceRedraw: true,
        fps: 3,
    } as cliProgress.Options;
}
