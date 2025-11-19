const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());


async function extractEpisodes(seasonUrl) {
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

async function extractAnimes(page) {
    const tab = await page.evaluate(() => {
        const result = {};
        const container = document.getElementById("list_catalog");
        if (!container) return result;

        const htmlFindAnimes = Array.from(container.getElementsByTagName("div"));
        htmlFindAnimes.forEach(animeDiv => {
            const a = animeDiv.getElementsByTagName("a");
            if (a.length > 0) {
                const content = a[0].querySelector('.card-content');
                if (content) {
                    const titleEl = content.getElementsByTagName("h2")[0];
                    if (titleEl) {
                        result[titleEl.textContent.trim()] = a[0].href;
                    }
                }
            }
        });

        return result;
    });
    return tab;
}

async function extractSeasons(page) {
    try {
        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        const saisons = await page.evaluate(() => {
            const links = document.querySelectorAll(
                "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a"
            );
            return Array.from(links).map(a => ({
                name: a.textContent.trim(),
                link: a.getAttribute("href")
            }));
        });

        return saisons;
    } catch (err) {
        console.log("Aucune saison trouvée ou délai dépassé.");
        return [];
    }
}

module.exports = { extractEpisodes, extractAnimes, extractSeasons }
