# anime-sama-downloader

Anime episodes auto-downloader tool by fetching from anime-sama website. 

> [!IMPORTANT]
> This project will change a lot at this time. We plan to release tag version for better continuity.

### Needed:

- node >= v20
- axios
- cli-progress
- puppeteer
- readline

## How to initialize

### Git clone

```bash
git clone https://github.com/Fire0902/anime-sama-downloader.git
```

### Install dependencies:

```bash
npm install
```

## How to use

### Start CLI (Console-Lign Interface)

```bash
npm start:cli
```

### Auto download

You can also start a automatic download by putting json files at project-path/auto-download/json/

Here is an example of a JSON for two animes:

```json
{
    "One piece": {
        "_comment": "url is optionnal it's only use to make sure the app find the good one",
        "url": "https://anime-sama.org/catalogue/one-piece/",
        "_comment1": "if seasons = ALL episodes is useless else episodes is required else seasons format is 1-N | 1,5,7 | 6, just in case first season is 1 not 0",
        "seasons": "1-4",
        "_comment2": "episodes format is 1-N | 1 | 1,5,7,19 | ALL",
        "episodes": "ALL"   
    },
    "Vinland Saga": {
        "url": "",
        "seasons": "ALL",
        "episodes": ""
    }
}
```

Then start the auto-downloader:

```bash
npm start:download
```

## TODO

### Features

- [ ] Main goal: Implements an api to download anime from HTTP request with JSON

- [ ] Show Mo instead of timestamp download progression 

- [ ] Add self host web version to make the program user friendly

- [ ] Make a Jellyfin extension to communicate with api

### Refactor

- [ ] Implements usage of SBoudrias/Inquirer.js lib for better CLI inputs.

- [ ] Remove setTimeOut

- [X] Make the program with waitForSelector from the library puppeteer

- [X] Reorganise project as cli, engine and config sections

- [X] Remove duplicate function in FileReader and UrlBuilder

### Bugfixes

- [ ] Fix the bug that make FileReader infinitly \n without any reason (I suppose it's due to cli-progress unclose bar)