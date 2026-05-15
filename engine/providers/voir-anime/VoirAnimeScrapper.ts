import Puppeteer from '../../utils/web/Puppeteer.ts';
import Semaphore from '../../utils/web/Semaphore.ts';
import VoirAnimeConfig from './VoirAnimeConfig.ts';
import Log from '../../utils/log/Log.ts';

/**
 * Voir-anime / Voir-drama specific scraping methods.
 * Both providers share the same HTML structure (WordPress manga plugin).
 * Pass the appropriate baseUrl from VoirAnimeConfig to target either site.
 */
export default class VoirAnimeScrapper {
    private static readonly logger = Log.create(this.name);

    /**
     * Search for anime titles matching the given query.
     * @param query search string with spaces already replaced by '+'
     * @param baseUrl base URL of the provider (voir-anime or voir-drama)
     * @returns map of title → anime page URL
     *
     * @example
     * ```json
     * {
     *   "One Piece Log: Fish-Man Island Saga": "https://voir-anime.to/anime/one-piece-log-fish-man-island-saga/",
     *   "One Piece Film: Red": "https://voir-anime.to/anime/one-piece-film-red-2/"
     * }
     * ```
     */
    static async searchAnimes(query: string, baseUrl: string): Promise<Record<string, string>> {
        this.logger.info(`Searching animes for: "${query}" on ${baseUrl}`);
        const url = `${baseUrl}/?s=${query}${VoirAnimeConfig.searchQuerySuffix}`;
        const page = await Puppeteer.goto(url);

        const results = await page.evaluate((selector: string) => {
            const animes: Record<string, string> = {};
            const rows = document.querySelectorAll(selector);
            rows.forEach(row => {
                const titleLink = row.querySelector('.post-title h3 a') as HTMLAnchorElement | null;
                if (titleLink) {
                    const name = titleLink.textContent?.trim() || '';
                    const href = titleLink.href;
                    if (name && href) animes[name] = href;
                }
            });
            return animes;
        }, VoirAnimeConfig.searchResultSelector);

        Puppeteer.closePage(page);
        return results;
    }

    /**
     * Extract episode page URLs and names from an anime page.
     * Episodes are listed in reverse order (latest first) in the DOM — this method reverses them.
     * @param animeUrl full URL of the anime page
     * @returns { urls: episode page URLs ascending, names: formatted episode names ascending }
     *
     * @example
     * ```json
     * {
     *   "urls": ["https://voir-anime.to/anime/yahari.../ep-01-vostfr/", ...],
     *   "names": ["Episode-01.mp4", "Episode-02.mp4", ...]
     * }
     * ```
     */
    static async extractEpisodes(animeUrl: string): Promise<{ urls: string[], names: string[] }> {
        this.logger.info(`Extracting episodes from: ${animeUrl}`);
        const page = await Puppeteer.goto(animeUrl, VoirAnimeConfig.episodeListSelector);

        const result = await page.evaluate((linkSelector: string) => {
            const urls: string[] = [];
            const names: string[] = [];
            const items = document.querySelectorAll(linkSelector);

            items.forEach(item => {
                const a = item as HTMLAnchorElement;
                const href = a.href;
                const text = a.textContent?.trim() || '';
                if (!href) return;

                urls.push(href);

                // Extract episode number from text like "Title - 13 VOSTFR - 13"
                // The last segment after " - " is the episode number
                const match = text.match(/\s*-\s*(\d+)\s*$/);
                if (match) {
                    const num = match[1].padStart(2, '0');
                    names.push(`Episode-${num}.mp4`);
                } else {
                    // Fallback: use truncated text as name
                    names.push(text.slice(0, 60).trim().replace(/[/\\?%*:|"<>]/g, '_') + '.mp4');
                }
            });

            // Episodes are in reverse order (latest first) — reverse to ascending order
            return { urls: urls.reverse(), names: names.reverse() };
        }, VoirAnimeConfig.episodeLinkSelector);

        Puppeteer.closePage(page);
        return result;
    }

    /**
     * Fetch a voir-anime/voir-drama episode page with a browser-like User-Agent
     * and extract the vidmoly embed iframe src via regex (no Puppeteer, fast).
     * Falls back to Puppeteer if the HTTP fetch fails or the regex finds nothing.
     * @param episodeUrl full URL of the episode page
     * @returns vidmoly embed URL, or null if not found
     */
    static async fetchVidmolyUrl(episodeUrl: string): Promise<string | null> {
        try {
            const response = await fetch(episodeUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                },
            });

            if (!response.ok) {
                this.logger.warn(`HTTP ${response.status} for episode page: ${episodeUrl}`);
                return await this.extractVidmolyUrlWithPuppeteer(episodeUrl);
            }

            const html = await response.text();
            const match = html.match(/iframe[^>]+src=["'](https?:\/\/vidmoly[^"']+)["']/i);
            if (match) return match[1];

            this.logger.warn(`No vidmoly iframe in HTTP response for: ${episodeUrl}, trying Puppeteer`);
            return await this.extractVidmolyUrlWithPuppeteer(episodeUrl);
        } catch (e) {
            this.logger.warn(`fetch failed for ${episodeUrl}, trying Puppeteer`);
            return await this.extractVidmolyUrlWithPuppeteer(episodeUrl);
        }
    }

    /**
     * Puppeteer fallback for extracting the vidmoly iframe src from an episode page.
     */
    static async extractVidmolyUrlWithPuppeteer(episodeUrl: string): Promise<string | null> {
        this.logger.info(`Puppeteer fallback for vidmoly URL from: ${episodeUrl}`);
        try {
            const page = await Puppeteer.goto(episodeUrl);
            const iframeSrc = await page.evaluate((sel: string) => {
                const iframe = document.querySelector(sel) as HTMLIFrameElement | null;
                return iframe?.src || null;
            }, VoirAnimeConfig.vidmolyIframeSelector);
            Puppeteer.closePage(page);
            return iframeSrc;
        } catch (e) {
            this.logger.warn(`Puppeteer also failed for: ${episodeUrl}`);
            return null;
        }
    }

    /**
     * Resolve vidmoly embed URLs for a list of episode page URLs.
     * Uses up to 5 concurrent HTTP fetches to avoid hammering the server.
     * @param episodePageUrls list of voir-anime episode page URLs
     * @returns list of { vidmolyUrl, name } pairs (null vidmolyUrl entries are kept for index alignment)
     */
    static async resolveVidmolyUrls(episodePageUrls: string[]): Promise<(string | null)[]> {
        const semaphore = new Semaphore(5);
        return Promise.all(
            episodePageUrls.map(async (url) => {
                await semaphore.acquire();
                try {
                    return await this.fetchVidmolyUrl(url);
                } finally {
                    semaphore.release();
                }
            })
        );
    }
}
