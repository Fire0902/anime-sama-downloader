import Config from "../../config/Config.ts";
import Log from "../log/Log.ts";

import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

/**
 * Class for handling web browser bots, using puppeteer library.
 *
 * Used for automatic web scrapping.
 * @see https://pptr.dev/
 * @see https://www.npmjs.com/package/puppeteer
 */
export default class Puppeteer {
	private static readonly logger = Log.create(this.name);

	private static instance: Puppeteer | null;
	private browser!: Browser;

	/**
	 * Generates a random number.
	 *
	 * Mostly used for random windows dimensions, to prevent fingerprinting attacks.
	 * @param min
	 * @param max
	 * @returns random number between min and max
	 */
	private static randomNumber = (min: number, max: number) =>
		Math.floor(Math.random() * (max - min + 1)) + min;

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
	 * Needs a not null Puppeteer instance.
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

		// Browser window parameters, to prevent fingerprinting attacks
		const viewport = {
			width: Puppeteer.randomNumber(100, 1920),
			height: Puppeteer.randomNumber(100, 1080),
		};

		Puppeteer.logger.info(`Initializing puppeteer (res:${viewport.width},${viewport.height})`);
		Puppeteer.instance.browser = await puppeteer.launch({
			headless: true,
			args: launchArgs,
			defaultViewport: viewport,
		});
	}

	/**
	 * Creates a new page from instance
	 * @returns
	 * @see https://pptr.dev/
	 */
	private static async newPage(): Promise<Page> {
		const b = await Puppeteer.getInstance();
		Puppeteer.logger.info("Creating new page");
		return b.browser.newPage();
	}

	/**
	 * Create a new browser page, and try to go to a given adress.
	 * @param url HTTP adress (ex: https://ecosia.org)
	 * @param selector HTML element to wait for. Will not wait if none provided.
	 * @param waitUntil HTML event to wait for. Wait for network idle if none provided.
	 * @param goToPageTimeout time to wait for specific HTML element before timeout
	 * @param waitForSelectorTimeout time to wait for specific HTML element before timeout
	 * @param screenshot will take a screenshot each loaded page. Mostly used for debugging
	 * @returns page instance with HTML content.
	 * @see https://pptr.dev/
	 */
	static async goto(
		url: string,
		selector = "",
		waitUntil:
			| "load"
			| "domcontentloaded"
			| "networkidle0"
			| "networkidle2" = "networkidle2",
		goToPageTimeout = Config.goToPageTimeout,
		waitForSelectorTimeout = Config.waitForSelectorTimeout,
		screenshot = Config.screenshot
	): Promise<Page> {

		const page = await Puppeteer.newPage();
		if (page == null) {
			Puppeteer.logger.fatal(new Error("Failed to create new page"));
		}

		Puppeteer.logger.info(`Fetching ${url}, wait for ${waitUntil}`);
		await page.goto(url, { waitUntil: waitUntil });
		await Puppeteer.timeout(goToPageTimeout);

		if (selector !== "") {
			await page.waitForSelector(selector, { timeout: waitForSelectorTimeout });
		}
		if (screenshot) {
			await page.screenshot({ path: `screenshot-${new Date().toISOString()}.png` });
		}

		// CloudFlare anti-bot bypass
		if (await Puppeteer.isCloudFlareChallenge(page)) {
			Puppeteer.logger.info(`CloudFlare challenge detected`);
			await Puppeteer.passCloudFlareCheckbox(page);
		}
		return page;
	}

	/**
	 * Verifies if given page is a CloudFlare challenge
	 * @param page HTML web page
	 * @returns if given page is a CloudFlare challenge
	 */
	private static async isCloudFlareChallenge(page: Page) {
		Puppeteer.logger.info(`Verifying if page is CloudFlare challenge`);
		const pageContent = await page.evaluate(() => document.body.textContent);
		return pageContent.toLowerCase().includes("cloudflare");
	}

	/**
	 * Try to pass CloudFlare checkbox challenge
	 * @param page HTML web page
	 */
	private static async passCloudFlareCheckbox(page: Page) {
		Puppeteer.logger.info(`Trying to pass CloudFlare checkbox challenge`);
		await page.waitForSelector("#checkbox", {
			timeout: Config.waitForSelectorTimeout,
		});
		await page.click("#checkbox");
		await page.waitForNavigation();
	}

	/**
	 * Sends a timeout request to website (anti-bot)
	 * @param duration duration in miliseconds
	 */
	static async timeout(duration = Config.goToPageTimeout) {
		Puppeteer.logger.info(`Requesting timeout (${duration} ms)`);
		await new Promise((resolve) => setTimeout(resolve, duration));
	}

	/**
	 * Close a single web page
	 * @param page HTML web page
	 * @see https://pptr.dev/
	 */
	static closePage(page: Page) {
		page?.close();
	}

	/**
	 * Close browser instance and reset puppeteer instance singleton
	 * @see https://pptr.dev/
	 */
	static async close(): Promise<void> {
		if (Puppeteer.instance?.browser) {
			Puppeteer.logger.info("Closing puppeteer singleton");
			await Puppeteer.instance.browser.close();
		}
		Puppeteer.instance = null;
	}
}
