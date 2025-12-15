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

    // ----- File formats -----
    
    /** */
    static readonly downloadDefaultFormat: string = 'txt';

    /** Default video encoding */
    static readonly downloadEncoding: string = 'utf8';

    /** Default format for FFmpeg downloads */
    static readonly downloadFFmpegFormat: string = 'mp4';

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
}

