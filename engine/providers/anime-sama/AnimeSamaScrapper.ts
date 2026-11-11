import { Page } from 'puppeteer';
import Puppeteer from '../../utils/web/Puppeteer.ts';
import AnimeSamaConfig from './AnimeSamaConfig.ts';
import Log from '../../utils/log/Log.ts';

/**
 * Globals a season page defines for itself, read inside page.evaluate().
 * Declared here for type-checking only; they exist in the browser, not in Node.
 *
 * - `eps1`..`eps3`: one reader each, one URL per episode.
 * - `lecteursInfos`: per-host metadata, `mort: true` marking a dead host.
 * - `lecteursHS`: 12-char vidmoly/ansembed embed ids whose video was deleted.
 * - `liensHS`: full URLs, for deleted videos on the other hosts.
 */
declare const eps1: string[] | undefined;
declare const eps2: string[] | undefined;
declare const eps3: string[] | undefined;
declare const lecteursInfos: Record<string, { nom?: string; mort?: boolean }> | undefined;
declare const lecteursHS: string[] | undefined;
declare const liensHS: string[] | undefined;

/**
 * Anime-sama specific scraping methods.
 * Handles all HTML extraction logic tied to anime-sama's page structure.
 */
export default class AnimeSamaScrapper {
    private static readonly logger = Log.create(this.name);

    /**
     * Extract the active website host from the domains list page.
     * Also updates AnimeSamaConfig.websiteAdress with the resolved value.
     *
     * The domains page lists mirrors, and a mirror answers with a redirect to
     * the canonical host while dropping the path (`/catalogue/?search=…` lands
     * on the home page). So the listed domain is followed once and the host we
     * actually land on is kept. Anything unusable leaves websiteAdress alone.
     */
    static async extractHostAdress(): Promise<string> {
        this.logger.info('Extracting website host adress');
        const fallback = AnimeSamaConfig.websiteAdress;
        let page: Page | null = null;

        try {
            page = await Puppeteer.goto(AnimeSamaConfig.websiteDomainsAdress);

            const rawDomain = await page.evaluate(domainClass => {
                const domainContainer = document.querySelector(domainClass);
                return domainContainer?.textContent ?? '';
            }, AnimeSamaConfig.websiteDomainsClass);

            const domain = rawDomain.trim()
                .replace(/^https?:\/\//i, '')
                .replace(/\/.*$/, '');

            const looksLikeDomain = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$/i.test(domain);
            if (!looksLikeDomain || !domain.toLowerCase().includes(AnimeSamaConfig.websiteDomainKeyword)) {
                this.logger.warn(`No usable domain on ${AnimeSamaConfig.websiteDomainsAdress} (got "${rawDomain.trim()}"), keeping ${fallback}`);
                return fallback;
            }

            // Follow the mirror to the host it redirects to.
            let resolved = `https://${domain}`;
            try {
                await page.goto(resolved, { waitUntil: 'domcontentloaded' });
                const landed = new URL(page.url()).origin;
                if (landed.toLowerCase().includes(AnimeSamaConfig.websiteDomainKeyword)) resolved = landed;
            } catch (e) {
                this.logger.warn(`Could not follow ${resolved}, using it as-is`);
            }

            this.logger.info(`Resolved host adress: ${resolved}`);
            AnimeSamaConfig.websiteAdress = resolved;
            return resolved;
        } catch (e) {
            this.logger.warn(`Host adress extraction failed, keeping ${fallback}`);
            return fallback;
        } finally {
            if (page) await Puppeteer.closePage(page);
        }
    }

    /**
     * Extract anime titles and their catalogue URLs from a search result page.
     * @param page web page
     * @returns map of title → catalogue URL
     *
     * @example
     * ```json
     * {
     *   "One Piece": "https://anime-sama.eu/catalogue/one-piece/",
     *   "One Punch Man": "https://anime-sama.eu/catalogue/one-punch-man/"
     * }
     * ```
     */
    static async extractAnimeTitles(page: Page): Promise<Record<string, string>> {
        this.logger.info('Extracting anime titles');
        const animeSearchPageId = AnimeSamaConfig.animeSearchPageId;
        const selectors = AnimeSamaConfig.animeCardSelectors;
        return await page.evaluate((animeSearchPageId, sel) => {
            const animes: Record<string, string> = {};
            const container = document.getElementById(animeSearchPageId) ?? document.body;

            // Current markup: one card per work, title in `.as-carte-titre` and
            // repeated in `data-nom`. The card's link already holds an absolute URL.
            container.querySelectorAll(sel.card).forEach(card => {
                const a = (card.querySelector(sel.link) ?? card.querySelector('a')) as HTMLAnchorElement | null;
                if (!a?.href) return;
                const title = (
                    card.getAttribute(sel.nameAttribute)
                    ?? card.querySelector(sel.title)?.textContent
                    ?? ''
                ).trim();
                if (title) animes[title] = a.href;
            });
            if (Object.keys(animes).length > 0) return animes;

            // Previous markup: `.card-content` wrapper with the title in a heading.
            Array.from(container.getElementsByTagName("div")).forEach(animeDiv => {
                const a = animeDiv.getElementsByTagName("a")[0];
                if (!a) return;
                const content = a.querySelector(sel.legacyContent);
                const title = content?.querySelector('h1, h2, h3, h4')?.textContent?.trim();
                if (title) animes[title] = a.href;
            });
            return animes;
        }, animeSearchPageId, selectors);
    }

    /**
     * Extract all seasons (including scans) from an anime page.
     *
     * Seasons whose reader is flagged as unavailable by the site are skipped:
     * they have no playable episode list.
     * @param page web page
     * @returns array of { name, link, scan }, `link` relative to the anime page
     */
    static async extractSeasonsWithScans(page: Page): Promise<Array<{ name: string, link: string | null, scan?: boolean }>> {
        this.logger.info('Extracting seasons');
        const selectors = AnimeSamaConfig.seasonPanelSelectors;
        return await page.evaluate((sel) => {
            /**
             * Link relative to the anime page, without a leading slash, because
             * callers append it to the anime URL. Panels now carry an absolute
             * path (`/catalogue/<anime>/saison1/vostfr`) where they used to carry
             * just `saison1/vostfr`; reading `a.href` resolves both the same way.
             */
            const toRelativeLink = (a: HTMLAnchorElement): string => {
                const base = location.origin + location.pathname.replace(/\/+$/, '') + '/';
                const absolute = a.href;
                if (absolute.startsWith(base)) return absolute.slice(base.length);
                return absolute.replace(location.origin, '').replace(/^\/+/, '');
            };

            const panels = Array.from(document.querySelectorAll(sel.panel)) as HTMLAnchorElement[];
            if (panels.length > 0) {
                return panels
                    .filter(a => !a.classList.contains(sel.unavailableClass))
                    .map(a => ({
                        // The panel name lives in its own span: reading the whole
                        // link would also pick up badge text.
                        name: (a.querySelector(sel.name)?.textContent ?? a.textContent ?? '').trim(),
                        link: toRelativeLink(a),
                        scan: a.classList.contains(sel.scanClass),
                    }));
            }

            // Previous markup.
            const legacyPanels = Array.from(document.querySelectorAll(sel.legacyPanel)) as HTMLAnchorElement[];
            return legacyPanels.map(a => ({
                name: a.textContent?.trim() || '',
                link: toRelativeLink(a),
                scan: (a.textContent ?? '').toLowerCase().includes('scan'),
            }));
        }, selectors);
    }

    /**
     * Extract episode reader URLs and episode names from a season page.
     *
     * Reads the anime-sama globals eps1/eps2/eps3 and the #selectEpisodes element.
     *
     * Links the page itself flags as dead are discarded, so the download cascade
     * does not spend attempts on them: a reader with no live link left is left
     * out entirely, and a dead link inside a surviving reader is blanked rather
     * than removed, because callers address episodes by index.
     * @param seasonUrl full URL of the season page
     */
    static async extractEpisodes(seasonUrl: string) {
        this.logger.info(`Extracting episodes from : ${seasonUrl}`);
        const page = await Puppeteer.goto(seasonUrl);

        const result = await page.evaluate(() => {
            const readers: string[][] = [];
            readers.push(typeof eps1 !== 'undefined' ? eps1 : []);
            readers.push(typeof eps2 !== 'undefined' ? eps2 : []);
            readers.push(typeof eps3 !== 'undefined' ? eps3 : []);

            const selectElement = document.getElementById('selectEpisodes') as HTMLSelectElement;
            const episodeNames: string[] = [];
            if (selectElement) {
                Array.from(selectElement.options).forEach(option => {
                    episodeNames.push(option.value || option.text);
                });
            }

            // ----- Dead readers and links, as flagged by the page itself -----

            const hostInfos = typeof lecteursInfos !== 'undefined' ? lecteursInfos : {};
            const deadEmbedIds = new Set(typeof lecteursHS !== 'undefined' ? lecteursHS : []);
            const deadUrls = new Set(typeof liensHS !== 'undefined' ? liensHS : []);

            /** Host entry for a URL. Keys are bare hosts: "sibnet.ru" covers "video.sibnet.ru". */
            const hostInfo = (url: string) => {
                let hostname: string;
                try {
                    hostname = new URL(url).hostname.toLowerCase();
                } catch {
                    return undefined;
                }
                const key = Object.keys(hostInfos).find(host => {
                    const h = host.toLowerCase();
                    return hostname === h || hostname.endsWith(`.${h}`);
                });
                return key ? hostInfos[key] : undefined;
            };

            const isDeadLink = (url: string): boolean => {
                if (!url || !url.trim()) return false;
                const embedId = url.match(/(?:vidmoly\.[a-z]+|ansembed\.net)\/(?:embed-)?([a-z0-9]{12})/i)?.[1];
                if (embedId && deadEmbedIds.has(embedId)) return true;
                if (deadUrls.has(url)) return true;
                return hostInfo(url)?.mort === true;
            };

            const original = readers.map(list => list ?? []);
            const dead = original.map(list => list.map(url => isDeadLink(url)));
            const keepReader = original.map((list, i) =>
                list.some((url, j) => !!url && url.trim().length > 0 && !dead[i][j])
            );

            let droppedLinks = 0;
            const kept: string[][] = [];
            original.forEach((list, i) => {
                if (!keepReader[i]) return;
                kept.push(list.map((url, j) => {
                    if (!dead[i][j]) return url;
                    droppedLinks++;
                    return '';
                }));
            });

            // Every reader flagged dead is more likely a stale page than a season
            // that cannot be downloaded at all: hand back the raw lists instead.
            const presentReaders = original.filter(list => list.length > 0).length;
            const allReadersDead = kept.length === 0 && presentReaders > 0;

            return {
                readers: allReadersDead ? original : kept,
                episodeNames,
                droppedReaders: allReadersDead ? 0 : presentReaders - kept.length,
                droppedLinks: allReadersDead ? 0 : droppedLinks,
                allReadersDead,
            };
        });

        Puppeteer.closePage(page);

        if (result.droppedReaders > 0 || result.droppedLinks > 0) {
            this.logger.info(`Discarded ${result.droppedReaders} dead reader(s) and ${result.droppedLinks} dead link(s)`);
        }
        if (result.allReadersDead) {
            this.logger.warn('Every reader is flagged dead on this page: keeping them all as a fallback');
        }
        return result;
    }
}
