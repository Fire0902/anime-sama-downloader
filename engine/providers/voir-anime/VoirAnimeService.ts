import VoirAnimeConfig from './VoirAnimeConfig.ts';
import VoirAnimeScrapper from './VoirAnimeScrapper.ts';
import Log from '../../utils/log/Log.ts';

export type VoirAnimeProvider = 'voir-anime' | 'voir-drama';

/**
 * High-level service for voir-anime and voir-drama: search and episodes.
 * Both providers share the same HTML structure — only the base URL differs.
 */
export default class VoirAnimeService {
    private static readonly logger = Log.create(this.name);

    static getBaseUrl(provider: VoirAnimeProvider): string {
        return provider === 'voir-drama'
            ? VoirAnimeConfig.voirDramaBaseUrl
            : VoirAnimeConfig.voirAnimeBaseUrl;
    }

    /**
     * Format a search string for use in the URL query parameter.
     * Replaces spaces with '+'.
     * @example "One Piece" → "one+piece"
     */
    static toQuery(value: string): string {
        return value.trim().replace(/\s+/g, '+');
    }

    // ----- SEARCH -----

    /**
     * Search for anime titles matching the given name.
     * @param name partial anime name to search
     * @param provider which site to search ('voir-anime' or 'voir-drama')
     * @returns map of title → anime page URL
     */
    static async getAnimesFromSearch(name: string, provider: VoirAnimeProvider = 'voir-anime') {
        this.logger.info(`Searching for "${name}" on ${provider}`);
        const baseUrl = this.getBaseUrl(provider);
        return VoirAnimeScrapper.searchAnimes(this.toQuery(name), baseUrl);
    }

    // ----- EPISODES -----

    /**
     * Get vidmoly embed URLs and episode names from an anime page URL.
     * Scrapes the episode list, then resolves each episode page → vidmoly URL via HTTP.
     * Episodes that fail to resolve are silently dropped (same behaviour as anime-sama
     * dropping unavailable sources).
     * @param animeUrl full URL of the anime page (acts as both anime and season URL)
     */
    static async getEpisodes(animeUrl: string) {
        this.logger.info(`Getting episodes from: ${animeUrl}`);

        const { urls: episodePageUrls, names } = await VoirAnimeScrapper.extractEpisodes(animeUrl);

        this.logger.info(`Resolving vidmoly URLs for ${episodePageUrls.length} episodes`);
        const rawVidmolyUrls = await VoirAnimeScrapper.resolveVidmolyUrls(episodePageUrls);

        // Keep only episodes where resolution succeeded, maintaining name alignment
        const vidmolyUrls: string[] = [];
        const resolvedNames: string[] = [];
        rawVidmolyUrls.forEach((url, i) => {
            if (url) {
                vidmolyUrls.push(url);
                resolvedNames.push(names[i]);
            }
        });

        return { urls: vidmolyUrls, names: resolvedNames };
    }
}
