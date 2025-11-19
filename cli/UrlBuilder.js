const readline = require('readline');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getEpisodes } = require('./Scrapper');
const Semaphore = require('./Semaphore');
const { parseNumbers } = require('./Parser');
const { downloadEpisode } = require('./EpisodeDownloader');

puppeteer.use(StealthPlugin());


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askToUser(message = "Entrez quelque chose : ") {
    return new Promise((resolve) => {
        rl.question(message, (answer) => {
            resolve(answer);
        });
    });
}

async function request() {
    let url = await askToUser("Tape le nom d'un anime : ");
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

        await new Promise(resolve => setTimeout(resolve, 500));

        page.waitForSelector("#list_catalog", { timeout: 10000 });

        const animes = await extractAnime(page);

        const animesNames = Object.keys(animes);

        animesNames.forEach((title, index) => {
            console.log(`[${index + 1}] : ${title}`);
        });

        const chosenAnime = await askToUser("Choisir l'anime : ");

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
        const chosenSeason = await askToUser(`Saison choisie : [1-${seasons.length}] `);

        const stringChosenSeason = seasons[parseInt(chosenSeason) - 1].name;
        const seasonInt = parseInt(chosenSeason) - 1;

        const seasonUrl = animes[animeName] + seasons[seasonInt].link;

        const episodes = await getEpisodes(seasonUrl);
        const chosenEpisodes = await askToUser(`chose episode's' : [1-${episodes.length}] `);

        const tabOfEpisodes = parseNumbers(chosenEpisodes);
        const tasks = [];
        for (const ep of tabOfEpisodes) {
            tasks.push(downloadWorker(ep, episodes, stringChosenSeason, animeName));
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        await Promise.all(tasks);
        console.log("");
        console.log("Tous les downloads terminés !");
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
        console.log("Aucune saison trouvée ou délai dépassé.");
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

module.exports = {request};