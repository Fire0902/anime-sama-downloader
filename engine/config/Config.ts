/** */
export default class Config{
    // ----- External URLs -----

    /** Main anime website URL (currently anime-sama) */
    static readonly websiteUrl: string = "https://anime-sama.eu/catalogue";

    /** Video cloud host website URL */
    static readonly sibnetUrl: string = "https://video.sibnet.ru";

    // ----- Paths -----

    /** Folder where all videos will be downloaded */
    static readonly downloadPath: string = './animes';

    // ----- Files -----
    
    /** */
    static readonly downloadDefaultFormat: string = 'txt';

    /** Default format for FFmpeg downloads */
    static readonly downloadFFmpegFormat: string = 'mp4';

    /** Default video encoding */
    static readonly defaultEncoding: BufferEncoding = 'utf8';


    // ----- Attributes -----

    /** Maximum number of videos downloaded simultaneously */
    static readonly maxRunners: number = 2;

    /** */
    static readonly goToPageTimeout: number = 4000;

    /** */
    static readonly waitForSelectorTimeout: number = 6000;

    // ----- HTML selectors -----

    /** */
    static readonly animeSearchPageId: string = "list_catalog";

    /** */
    static readonly animeSearchPageSelector: string = `#${this.animeSearchPageId}`;

    /** */
    static readonly seasonsPageSelector: string = "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a";

    // ----- Log -----

    /** Folder where all logs will be written */
    static readonly logPath: string = "./logs";

    /** Logger minimum level to be visible or hidden */
    static readonly logDefaultType: "json" | "pretty" | "hidden" | undefined = "hidden";

    /** Logger minimum level to be visible or hidden */
    static readonly logMinLevel: number = 2;
}

