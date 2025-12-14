/** */
export default class Config{
    // ----- External URLs -----

    /** Main anime website URL (currently anime-sama) */
    static websiteUrl = "https://anime-sama.eu/catalogue";

    /** Video cloud host website URL */
    static sibnetUrl = "https://video.sibnet.ru";

    // ----- Paths -----

    /** Folder where all videos will be downloaded */
    static downloadPath = './animes';

    // ----- File formats -----
    
    /** */
    static downloadDefaultFormat = 'txt';

    /** Default video encoding */
    static downloadEncoding = 'utf8';

    /** Default format for FFmpeg downloads */
    static downloadFFmpegFormat = 'mp4';

    // ----- Attributes -----

    /** Maximum number of videos downloaded simultaneously */
    static maxRunners = 2;

    /** */
    static goToPageTimeout = 4000;

    /** */
    static waitForSelectorTimeout = 6000;

    // ----- HTML selectors -----

    /** */
    static animeSearchPageId = "list_catalog";

    /** */
    static animeSearchPageSelector = `#${this.animeSearchPageId}`;

    /** */
    static seasonsPageSelector = "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a";
}

