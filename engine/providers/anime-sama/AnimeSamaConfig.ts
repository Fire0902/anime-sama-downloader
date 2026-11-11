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

    /**
     * Substring a discovered domain must contain to be adopted. The domains page
     * hands out mirrors, so this guards against adopting an unrelated host if
     * that page is ever parked or replaced; anything else keeps websiteAdress.
     */
    static readonly websiteDomainKeyword: string = "anime-sama";

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

    /**
     * Selectors for a single catalogue card.
     *
     * The site now renders one `.as-carte` per work, with the title in an
     * `h3.as-carte-titre` and the work name repeated in a `data-nom` attribute.
     * `legacyContent` targets the previous markup (`.card-content` + `h2`) and
     * is only used when no card matches.
     */
    static readonly animeCardSelectors = {
        card: '.as-carte',
        link: 'a.as-carte-lien',
        title: '.as-carte-titre',
        nameAttribute: 'data-nom',
        legacyContent: '.card-content',
    };

    // ----- SEASONS -----

    /** Network event to wait for on the seasons page */
    static readonly seasonSearchWaitUntil: PuppeteerLifeCycleEvent = 'networkidle2';

    /**
     * Element waited for on an anime page before extracting seasons.
     * Comma-separated so either markup satisfies the wait: the season panels
     * themselves, or the container used by the previous layout.
     */
    static readonly seasonsPageSelector: string =
        "a.oe-panneau, div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded.mt-2.h-auto a";

    /**
     * Selectors for a single season panel on an anime page.
     *
     * Panels are written by the page's own `panneauAnime()` / `panneauScan()`
     * helpers: `a.oe-panneau`, plus `oe-panneau-scan` for scans and
     * `oe-indispo` for a season whose reader is being replaced.
     * `legacyPanel` targets the previous markup.
     */
    static readonly seasonPanelSelectors = {
        panel: 'a.oe-panneau',
        name: '.oe-panneau-nom',
        scanClass: 'oe-panneau-scan',
        unavailableClass: 'oe-indispo',
        legacyPanel: 'a.border-blue-500',
    };
}
