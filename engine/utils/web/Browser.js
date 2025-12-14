// import correct
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Config = require('../../config/Config');

puppeteer.use(StealthPlugin());

class Browser {
  static instance = null;

  constructor(browserInstance) {
    this.browser = browserInstance;
  }

  static async getInstance() {
    if (Browser.instance != null) {
      return Browser.instance;
    }
    console.log('[LOG] Creating new Puppeteer browser instance...');

    const browserInstance = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    Browser.instance = new Browser(browserInstance);
    return Browser.instance;
  }

  /**
   * Creates a new page from instance
   * @returns 
   */
  static async newPage() {
    const b = await this.getInstance();
    return b.browser.newPage();
  }

  /**
   * Create a new browser page, and go to a given web url.
   * @param {*} url web url (exemple: https://ecosia.org)
   * @param {*} selector html attribute to wait for. If none provided, won't wait for selector. Not required
   * @param {*} goToPageTimeout web timeout, not required
   * @param {*} waitForSelectorTimeout web timeout, not required  
   * @returns the page instance.
   */
  static async goTo(
    url,
    selector = null,
    goToPageTimeout = Config.goToPageTimeout,
    waitForSelectorTimeout = Config.waitForSelectorTimeout
  ) {
    const page = await this.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    await this.requestTimeout(goToPageTimeout);
    if (selector != null) {
      await page.waitForSelector(selector, { timeout: waitForSelectorTimeout });
    }
    return page;
  }

  static async closePage(page) {
    page.close();
  }

  /**
   * Close browser instance and set it to null.
   */
  static async close() {
    const b = await this.getInstance();
    await b.browser.close();
    Browser.instance = null;
  }

  /**
  * Sends a timeout request to website, used for anti-bot bypass.
  * @param duration duration in miliseconds
  */
  static async requestTimeout(duration) {
    await new Promise(resolve => setTimeout(resolve, duration));
  }
}

module.exports = Browser;
