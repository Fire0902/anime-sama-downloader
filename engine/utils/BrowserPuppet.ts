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
	 * The method launches a browser instance with given arguments.
	 * The browser will be closed when the parent node.js process is closed.
	 *
	 * Augments the original puppeteer.launch method with plugin lifecycle methods.
	 *
	 * All registered plugins that have a beforeLaunch method will be called in sequence to potentially update the options Object before launching the browser.
	 */
	async initialize() {
		this.browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
	}

	static async getInstance(): Promise<BrowserPuppet> {
		if (this.instance != null) {
			return this.instance;
		}
		this.logger.info("Creating new puppeteer browser instance...");

		this.instance = new this();
		await this.instance.initialize();

		return this.instance;
	}

	/**
	 * Creates a new page from instance
	 * @returns
	 */
	static async newPage(): Promise<Page> {
		const b = await this.getInstance();
		this.logger.info("Creating new puppeteer browser page");
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
			"load"
			| "domcontentloaded"
			| "networkidle0"
			| "networkidle2" = "networkidle2",
		goToPageTimeout: number = Config.goToPageTimeout,
		waitForSelectorTimeout: number = Config.waitForSelectorTimeout
	): Promise<Page> {
		this.logger.info(`Going to page ${url} and waiting until ${waitUntil}`);
		const page = await this.newPage();
		await page.goto(url, { waitUntil: waitUntil });

		await this.requestTimeout(goToPageTimeout);
		if (selector != "") {
			await page.waitForSelector(selector, { timeout: waitForSelectorTimeout });
		}
		return page;
	}

	/**
	 *
	 * @param page
	 */
	static closePage(page: Page) {
		page.close();
	}

	/**
	 * Close browser instance and set it to null.
	 */
	static async close() {
		const b = await this.getInstance();
		await b.browser?.close();
		this.instance = null;
	}

	/**
	 * Sends a timeout request to website, used for anti-bot bypass.
	 * @param duration duration in miliseconds
	 */
	static async requestTimeout(duration: number) {
		this.logger.info(`Requesting timeout (${duration} ms)`);
		await new Promise((resolve) => setTimeout(resolve, duration));
	}
}
