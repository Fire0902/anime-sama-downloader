import Config from "../../config/Config.ts";
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
	private browser!: Browser;

	/**
	 * Singleton pattern getter
	 */
	static async getInstance(): Promise<Puppeteer> {
		if (Puppeteer.instance != null) {
			return Puppeteer.instance;
		}
		Puppeteer.logger.info("Creating new puppeteer browser instance...");

		const instance = new Puppeteer();
		Puppeteer.instance = instance;
		await Puppeteer.initialize();

		return instance;
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
		enableScreenshot: boolean = Config.debug.enableScreenshots,
		checkCloudFlare: boolean = Config.checkCloudFlare,
	): Promise<Page> 
	{
		const page = await Puppeteer.newPage();
		if (page == null) {
			Puppeteer.logger.fatal(new Error("Failed to create new page"));
		}

		Puppeteer.logger.info(`Fetching ${url}, wait for: ${waitUntil}`);
		await page.goto(url, { waitUntil: waitUntil });
		await Puppeteer.timeout(goToPageTimeout);

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

	/**
	 * Captures a screenshot of a page.
	 * @param page
	 * @param path
	 * @param name
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.page.screenshot)
	 */
	static async screenshot(
		page: Page,
		path = `${Config.debug.screenshotsPath}`,
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
     * Format and returns a value to be usable in a HTTP query string.
     * @example 
     * ```text
     * "One Piece" -> "one+piece"
     * It can then be used in href: "https://website.com?query=one+piece"
     * ```
     * @param value Value to format
     * @returns A value to be usable in a HTTP query string
     */
    static toQuery(value: string): string {
        return value.toLowerCase().replace(" ", "+");
    }


	/**
	 * Close a single web page.
	 * @param page HTML web page
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.page.close)
	 */
	static closePage(page: Page) {
		page?.close();
	}

	/**
	 * Close browser singleton, and all associated pages.
	 * @see [puppeteer docs](https://pptr.dev/api/puppeteer.browser.close)
	 */
	static async close(): Promise<void> {
		Puppeteer.logger.info("Closing puppeteer singleton");
		if (Puppeteer.instance?.browser) {
			await Puppeteer.instance?.browser?.close();
		}
		Puppeteer.instance = null;
	}
}
