import Config from "../../config/Config.ts";
import PerfConfig from "../../config/PerfConfig.ts";
import Log from "../log/Log.ts";

import { Browser, Page, type PuppeteerLifeCycleEvent } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import FileUtils from "../file/FileUtils.ts";
puppeteer.use(StealthPlugin());

/**
 * Class for handling web browser bots, using puppeteer library.
 *
 * Used for automatic web scrapping.
 * @see [puppeteer docs](https://pptr.dev/)
 * @see [npm docs](https://www.npmjs.com/package/puppeteer)
 */
export default class Puppeteer {
	private static readonly logger = Log.create(this.name);

	private static instance: Puppeteer | null;
	private static initPromise: Promise<Puppeteer> | null = null;
	private browser!: Browser;

	/** Promise chain used to serialize extractions in LOW_RAM_MODE. */
	private static extractionChain: Promise<unknown> = Promise.resolve();
	/** Count of in-flight extractions (= open pages we control). */
	private static activeExtractions = 0;
	/** Pending idle-close timer; cleared as soon as an extraction starts. */
	private static idleCloseTimer: NodeJS.Timeout | null = null;

	/**
	 * Serializes extractions when LOW_RAM_MODE is on (1 page open at a time),
	 * tracks in-flight count to drive the idle-close timer, and runs the
	 * extraction unchanged when low-ram is off.
	 */
	private static async withExtractionSlot<T>(fn: () => Promise<T>): Promise<T> {
		const start = () => {
			if (Puppeteer.idleCloseTimer) {
				clearTimeout(Puppeteer.idleCloseTimer);
				Puppeteer.idleCloseTimer = null;
			}
			Puppeteer.activeExtractions++;
		};
		const end = () => {
			Puppeteer.activeExtractions = Math.max(0, Puppeteer.activeExtractions - 1);
			if (PerfConfig.lowRamMode && Puppeteer.activeExtractions === 0) {
				Puppeteer.scheduleIdleClose();
			}
		};

		if (!PerfConfig.lowRamMode) {
			start();
			try { return await fn(); } finally { end(); }
		}

		// Low-ram: chain extractions so only one runs at a time.
		const run = Puppeteer.extractionChain.then(async () => {
			start();
			try { return await fn(); } finally { end(); }
		});
		Puppeteer.extractionChain = run.catch(() => { /* swallow to keep chain alive */ });
		return run as Promise<T>;
	}

	private static scheduleIdleClose() {
		if (Puppeteer.idleCloseTimer) clearTimeout(Puppeteer.idleCloseTimer);
		Puppeteer.idleCloseTimer = setTimeout(() => {
			Puppeteer.idleCloseTimer = null;
			if (Puppeteer.activeExtractions === 0 && PerfConfig.lowRamMode) {
				Puppeteer.logger.info("Low-RAM idle: closing puppeteer browser");
				Puppeteer.close().catch(() => {});
			}
		}, PerfConfig.browserIdleCloseMs);
	}

	/**
	 * Singleton pattern getter
	 */
	static async getInstance(): Promise<Puppeteer> {
		if (Puppeteer.instance?.browser) {
			return Puppeteer.instance;
		}
		if (!Puppeteer.initPromise) {
			Puppeteer.initPromise = (async () => {
				Puppeteer.logger.info("Creating new puppeteer browser instance...");
				const instance = new Puppeteer();
				Puppeteer.instance = instance;
				await Puppeteer.initialize();
				Puppeteer.initPromise = null;
				return instance;
			})();
		}
		return Puppeteer.initPromise;
	}

	/**
	 * Initialize and launch puppeteer browser.
	 * 
	 * Need a not null Puppeteer instance.
	 * @see [puppeteer docs](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions).
	 */
	static async initialize() {
		if (Puppeteer.instance == null) return;

		const launchArgs = [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-blink-features=AutomationControlled",
			"--lang=en-US,en",
		];

		/** 
		 * Browser window viewport used by [Tor project](https://www.torproject.org/) 
		 * to prevent [fingerprinting](https://en.wikipedia.org/wiki/Fingerprint_(computing)).
		 *  
		 * You should not modify it except if Tor changes its window resolution.
		 * @defaultValue '{width: 1400, height: 900}'
		*/
		const viewport = Config.windowResolution;

		Puppeteer.logger.info(
			`Initializing puppeteer (res:${viewport.width},${viewport.height})`,
		);
		Puppeteer.instance.browser = await puppeteer.launch({
			headless: true,
			args: launchArgs,
			defaultViewport: viewport,
		});
	}

	/**
	 * Creates a new page from instance
	 * @returns
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.browser.newpage)
	 */
	private static async newPage(): Promise<Page> {
		const instance = await Puppeteer.getInstance();
		Puppeteer.logger.info("Creating new page");
		return instance.browser.newPage();
	}

	/**
	 * Types de ressources inutiles lors de l'extraction d'URLs vidéo.
	 * Les bloquer réduit drastiquement le temps de chargement des pages hébergeurs.
	 */
	private static readonly BLOCKED_RESOURCE_TYPES = new Set([
		"image", "stylesheet", "font", "media", "ping", "manifest",
	]);

	/**
	 * Ouvre une page en bloquant les ressources inutiles (images, CSS, polices, pub…).
	 * À utiliser pour l'extraction d'URLs M3U8/vidéo uniquement.
	 * ~3-10x plus rapide que goto() sur les hébergeurs chargés en assets.
	 */
	static async gotoFast(
		url: string,
		waitUntil: PuppeteerLifeCycleEvent = "domcontentloaded",
		timeout: number = Config.goToPageTimeout,
	): Promise<Page> {
		return Puppeteer.withExtractionSlot(async () => {
			const page = await Puppeteer.newPage();

			// Bloquer les ressources inutiles au niveau réseau
			await page.setRequestInterception(true);
			page.on("request", (req) => {
				if (Puppeteer.BLOCKED_RESOURCE_TYPES.has(req.resourceType())) {
					req.abort();
				} else {
					req.continue();
				}
			});

			try {
				await page.goto(url, { waitUntil, timeout });
				return page;
			} catch (e) {
				await Puppeteer.closePage(page);
				throw e;
			}
		});
	}

	/**
	 * Create a new browser page, and try to go to a given adress.
	 * @param url HTTP adress (ex: https://wikipedia.org)
	 * @param selector HTML element to wait for. Will not wait if none provided
	 * @param waitUntil HTML event to wait for
	 * @param goToPageTimeout Time to wait for specific HTML element before timeout
	 * @param waitForSelectorTimeout Time to wait for specific HTML element before timeout
	 * @param enableScreenshot Will take a screenshot each loaded page. Mostly used for debugging
	 * @returns Page instance with HTML content
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.page.goto)
	 */
	static async goto(
		url: string,
		selector: string = "",
		waitUntil: PuppeteerLifeCycleEvent = Config.defaultWaitUntil,
		goToPageTimeout: number = Config.goToPageTimeout,
		waitForSelectorTimeout: number = Config.waitForSelectorTimeout,
		enableScreenshot: boolean = Config.enableScreenshots,
		checkCloudFlare: boolean = Config.checkCloudFlare,
	): Promise<Page> {
		return Puppeteer.withExtractionSlot(async () => {
			const page = await Puppeteer.newPage();
			if (page == null) {
				Puppeteer.logger.fatal(new Error("Failed to create new page"));
			}

			Puppeteer.logger.info(`Fetching ${url}, wait for: ${waitUntil}`);
			try {

				await page.goto(url, {
					waitUntil: waitUntil,
					timeout: goToPageTimeout
				});

				if (selector !== "") {
					await page.waitForSelector(selector, { timeout: waitForSelectorTimeout });
				}

				if (enableScreenshot) await this.screenshot(page);

				// CloudFlare anti-bot bypass
				if (checkCloudFlare && await Puppeteer.isCloudFlare(page)) {
					Puppeteer.logger.info(`CloudFlare challenge detected`);
					await Puppeteer.passCloudFlareCheckBox(page);
				}
				return page;
			}
			catch (e) {
				await Puppeteer.closePage(page);
				throw e;
			}
		});
	}

	/**
	 * Captures a screenshot of a page.
	 * @param page
	 * @param path
	 * @param name
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.page.screenshot)
	 */
	static async screenshot(
		page: Page,
		path = `${Config.screenshotsPath}`,
		name = `screenshot-${new Date().toISOString()}`,
	) {
		await FileUtils.append(path, `${name}.png`);
		await page.screenshot({ path: `${path}/${name}.png` });
	}

	/**
	 * Sends a timeout request to website (anti-bot bypass).
	 * @param duration Duration in miliseconds
	 */
	static async timeout(duration = Config.goToPageTimeout) {
		Puppeteer.logger.info(`Requesting timeout (${duration}ms)`);
		await new Promise((resolve) => setTimeout(resolve, duration));
	}

	/**
	 * Verifies if given page is a CloudFlare challenge
	 * @param page HTML web page
	 * @returns if given page is a CloudFlare challenge
	 */
	private static async isCloudFlare(page: Page) {
		Puppeteer.logger.info(`Verifying if page is CloudFlare challenge`);
		const pageContent = await page.evaluate(() => document.body.textContent);
		return pageContent.toLowerCase().includes("cloudflare");
	}

	/**
	 * Try to pass CloudFlare checkbox challenge.
	 * @param page HTML web page
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.page.click)
	 */
	private static async passCloudFlareCheckBox(page: Page) {
		Puppeteer.logger.info(`Trying to pass CloudFlare checkbox challenge`);
		await page.waitForSelector("#checkbox", {
			timeout: Config.waitForSelectorTimeout,
		});
		await page.click("#checkbox");
		await page.waitForNavigation();
	}

	/**
	 * Close a single web page.
	 * @param page HTML web page
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.page.close)
	 */
	static async closePage(page: Page) {
		if (!page.isClosed()) {
			await page.close();
		}
	}

	/**
	 * Close browser singleton, and all associated pages.
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.browser.close)
	 */
	static async close(): Promise<void> {
		Puppeteer.logger.info("Closing puppeteer singleton");
		Puppeteer.initPromise = null;
		try {
			if (Puppeteer.instance?.browser) {
				await Puppeteer.instance?.browser?.close();
			}
		} catch (e) {
			Puppeteer.logger.warn("Browser already closed or process gone");
		} finally {
			Puppeteer.instance = null;
		}
	}
	static async closeAllPages(): Promise<void> {
		const instance = await this.getInstance();
		const pages = await instance.browser.pages();
		await Promise.all(pages.map(page => page.close()));
	}
}
