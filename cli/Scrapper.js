const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());


async function getEpisodes(seasonUrl){
  const browser = await puppeteer.launch({
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  await page.goto(seasonUrl, {
    waitUntil: 'networkidle2'
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  const episodes = await page.evaluate(() => {
    return typeof eps1 !== 'undefined' ? eps1 : [];
  });
  
  
  await browser.close();
  return episodes;
};
module.exports = {getEpisodes}
