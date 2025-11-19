const readline = require('readline');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getEpisodes } = require('Scrapper').default;
const Semaphore = require('Semaphore').default;
const { parseNumbers } = require('Parser');
const { downloadEpisode } = require('EpisodeDownloader');

puppeteer.use(StealthPlugin());

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Prompt and read user input.
 * @param message
 * @returns user input. 
 */
async function askUser(message = "Prompt something : ") {
    return new Promise((resolve) => {
        rl.question(message, (answer) => resolve(answer));
    });
}

async function request() {
    let url = await askUser("Enter an anime name : ");
    url = url.replace(" ", "+");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        const searchUrl = `https://anime-sama.org/catalogue/?search=${url}`;

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2'
        });

        putTimeout(500);

        page.waitForSelector("#list_catalog", { timeout: 10000 });

        const animes = await extractAnime(page);

        const animesNames = Object.keys(animes);

        animesNames.forEach((title, index) => {
            console.log(`[${index + 1}] : ${title}`);
        });

        const chosenAnime = await askUser("Select a search result : ");

        const animeName = animesNames[parseInt(chosenAnime) - 1];

        await page.goto(animes[animeName], {
            waitUntil: 'networkidle2'
        });

        await page.waitForSelector(
            "div.flex.flex-wrap.overflow-y-hidden.justify-start.bg-slate-900.bg-opacity-70.rounded a",
            { timeout: 10000 }
        );

        const seasons = await extractSeason(page);
        Array.isArray(seasons) ? console.log("Seasons :") : console.log("No seasons found");
        seasons.forEach((season, index) => {
            console.log(`[${index + 1}] : ${season.name}`);
        });
        const chosenSeason = await askUser(`Select season(s) : [1-${seasons.length}] `);

        const stringChosenSeason = seasons[parseInt(chosenSeason) - 1].name;
        const seasonInt = parseInt(chosenSeason) - 1;

        const seasonUrl = animes[animeName] + seasons[seasonInt].link;

        const episodes = await getEpisodes(seasonUrl);
        const chosenEpisodes = await askUser(`Select episode(s)' : [1-${episodes.length}] `);

        const tabOfEpisodes = parseNumbers(chosenEpisodes);
        const tasks = [];
        for (const ep of tabOfEpisodes) {
            tasks.push(downloadWorker(ep, episodes, stringChosenSeason, animeName));
            putTimeout(300);
        }

        await Promise.all(tasks);
        console.log("");
        console.log("Download completed !");
    }
    finally {
        await browser.close();

        rl.close();
        process.stdin.pause();
        process.stdin.removeAllListeners();

        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
};

async function extractAnime(page) {
    const animes = await page.evaluate(() => {
        const result = {};
        const container = document.getElementById("list_catalog");
        if (!container) return result;

        const animesDiv = Array.from(container.getElementsByTagName("div"));
        animesDiv.forEach(animeDiv => {
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
    return animes;
}

async function extractSeason(page) {
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
        console.log("No season found or delay expirated.");
        return [];
    }
}

const semaphore = new Semaphore(2);

async function downloadWorker(ep, episodes, stringChosenSeason, url) {
    await semaphore.acquire();

    try {
        const episodeUrl = episodes[ep - 1];
        const rawUrl = episodeUrl.replace('to', 'net');

        await downloadEpisode(rawUrl, ep, stringChosenSeason, url);
    } finally {
        semaphore.release();
    }
}

module.exports = { request };