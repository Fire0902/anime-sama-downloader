import Config from "../config/Config.ts";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";
import Log from "./Log.ts";

puppeteer.use(StealthPlugin());

export default class BrowserPuppet {
	private static readonly logger = Log.create(this.name);
	private static instance: BrowserPuppet | null;
	private browser!: Browser;

	/**
	 * Singleton getter
	 */
	static async getInstance(): Promise<BrowserPuppet> {
		if (BrowserPuppet.instance != null) {
			return BrowserPuppet.instance;
		}
		BrowserPuppet.logger.info("Creating new puppeteer browser instance...");

		const instance = new BrowserPuppet();
		instance.browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		BrowserPuppet.instance = instance;
		return instance;
	}

	/**
	 * Creates a new page from instance
	 * @returns
	 */
	static async newPage(): Promise<Page> {
		const b = await BrowserPuppet.getInstance();
		BrowserPuppet.logger.info("Creating new puppeteer browser page");

		return b.browser.newPage();
	}

	/**
	 * Create a new browser page, and go to a given web url.
	 * @param url web url (exemple: https://ecosia.org)
	 * @param selector html attribute to wait for. If none provided, won't wait for selector. Not required
	 * @param waitUntil event to listen and wait for. If none provided, wait for network idle. Not required
	 * @param goToPageTimeout web timeout, not required
	 * @param waitForSelectorTimeout web timeout, not required
	 * @returns the page instance.
	 */
	static async goto(
		url: string,
		selector: string = "",
		waitUntil:
			| "load"
			| "domcontentloaded"
			| "networkidle0"
			| "networkidle2" = "networkidle2",
		goToPageTimeout: number = Config.goToPageTimeout,
		waitForSelectorTimeout: number = Config.waitForSelectorTimeout
	): Promise<Page> {
		BrowserPuppet.logger.info(`Going to page ${url} (waitUntil=${waitUntil})`);
		const page = await BrowserPuppet.newPage();

		if (page == null){
			BrowserPuppet.logger.error('Failed to create new page');
			throw new Error('Failed to create new page');
		}
		await page.goto(url, { waitUntil: waitUntil });

		await BrowserPuppet.requestTimeout(goToPageTimeout);
		if (selector !== "") {
			await page.waitForSelector(selector, {
				timeout: waitForSelectorTimeout,
			});
		}
		return page;
	}

	/**
	 * Sends a timeout request to website (anti-bot)
	 * @param duration duration in miliseconds
	 */
	static async requestTimeout(duration: number) {
		BrowserPuppet.logger.info(`Requesting timeout (${duration} ms)`);
		await new Promise((resolve) => setTimeout(resolve, duration));
	}

	/**
	 * Close a single web page
	 * @param page
	 */
	static closePage(page: Page) {
		page?.close();
	}

	/**
	 * Close browser and reset singleton
	 */
	static async close(): Promise<void> {
		if (BrowserPuppet.instance?.browser) {
			BrowserPuppet.logger.info("Closing puppeteer browser instance...");
			await BrowserPuppet.instance.browser.close();
		}
		BrowserPuppet.instance = null;
	}
}
