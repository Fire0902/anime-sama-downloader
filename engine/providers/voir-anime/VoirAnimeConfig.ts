/**
 * Voir-anime / Voir-drama configuration: URLs and scraping parameters.
 * Both providers share the same HTML structure, only the base URL differs.
 */
export default class VoirAnimeConfig {

    // ----- ADDRESSES -----

    /** Base URL for voir-anime */
    static readonly voirAnimeBaseUrl: string = 'https://voir-anime.to';

    /** Base URL for voir-drama */
    static readonly voirDramaBaseUrl: string = 'https://voirdrama.to/';

    // ----- SEARCH -----

    /** Query string appended after ?s=<query> for searches */
    static readonly searchQuerySuffix: string =
        '&post_type=wp-manga&op&author&artist&release&adult&type&language&m_orderby=latest';

    // ----- SELECTORS -----

    /** CSS selector for individual anime rows in search results */
    static readonly searchResultSelector: string = '.c-tabs-item__content';

    /** CSS selector for the episode list ul on an anime page */
    static readonly episodeListSelector: string = 'ul.main';

    /** CSS selector for individual episode links */
    static readonly episodeLinkSelector: string = 'ul.main li.wp-manga-chapter a';

    /** CSS selector for the vidmoly iframe on an episode page */
    static readonly vidmolyIframeSelector: string = 'iframe[src*="vidmoly"]';
}
