import { type PuppeteerLifeCycleEvent } from "puppeteer";

/**
 * Anime-sama specific configuration: URLs, HTML selectors, and scraping parameters.
 */
export default class AnimeSamaConfig {

    // ----- ADDRESSES -----

    /** Page listing all active anime-sama domains */
    static readonly websiteDomainsAdress: string = "https://anime-sama.pw";

    /** CSS selector to extract the domain name from the domains page */
    static readonly websiteDomainsClass: string = ".domain-name";

    /** Main website URL. Auto-updated at runtime via extractHostAdress(). */
    static websiteAdress: string = "https://anime-sama.to";

    /** Sibnet video host URL */
    static readonly videoHostAdress: string = "https://video.sibnet.ru";

    // ----- CATALOGUE / SEARCH -----

    /** Network event to wait for on the catalogue search page */
    static readonly animeSearchWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /** HTML id of the anime catalogue list container */
    static readonly animeSearchPageId: string = "list_catalog";

    /** CSS selector derived from animeSearchPageId */
    static readonly animeSearchPageSelector: string = `#${this.animeSearchPageId}`;

    // ----- SEASONS -----

    /** Network event to wait for on the seasons page */
    static readonly seasonSearchWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /** CSS selector for season links on an anime page */
    static readonly seasonsPageSelector: string =
        "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded.mt-2.h-auto a";
}
