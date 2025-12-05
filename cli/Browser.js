// import correct
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class Browser {
  static instance = null;

  constructor(browserInstance) {
    this.browser = browserInstance;
  }

  static async getInstance() {
    if (Browser.instance) {
      return Browser.instance;
    }

    const browserInstance = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    Browser.instance = new Browser(browserInstance);
    return Browser.instance;
  }

  static async newPage() {
    const b = await this.getInstance();
    return await b.browser.newPage();
  }

  static async closePage(page){
    await page.close();
  }

  static async close() {
    const b = await this.getInstance();
    await b.browser.close();
    Browser.instance = null;
  }
}

module.exports = Browser;
