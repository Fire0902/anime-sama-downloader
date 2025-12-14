// import correct
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export class Browser {
  static instance = null;

  constructor(browserInstance) {
    this.browser = browserInstance;
  }

  static async getInstance() {
    if (Browser.instance) {
      return Browser.instance;
    }
    console.log(`Creating new browser puppet instance...`);
    const browserInstance = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    Browser.instance = new Browser(browserInstance);
    return Browser.instance;
  }

  static async newPage() {
    const b = await this.getInstance();
    return b.browser.newPage();
  }

  static async closePage(page){
    page.close();
  }

  static async close() {
    const b = await this.getInstance();
    await b.browser.close();
    Browser.instance = null;
  }
}


