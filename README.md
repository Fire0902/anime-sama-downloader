# anime-sama-downloader

Anime auto-downloader tool using anime-sama website. 

> [!IMPORTANT]
> This project is still in WIP and will change a lot and some features might be broken at this time. We plan to release tag version for better continuity.

### Dependencies:

- node >= v22
- [axios](https://www.npmjs.com/package/axios) - Node HTTP requests
- [cli-progress](https://www.npmjs.com/package/cli-progress) - bar progress for downloads
- [inquirer](https://www.npmjs.com/package/inquirer) - User inputs handle
- [puppeteer](https://www.npmjs.com/package/puppeteer) - Simulates web browsers
- [ts-log](https://www.npmjs.com/package/tslog) - Logs

## How to initialize

### Clone project

```bash
git clone https://github.com/Fire0902/anime-sama-downloader.git
```

### Install dependencies

```bash
npm install
```

And the project is now ready to use.

## How to use

### Using CLI (Console-Lign Interface)

To start the main interface:

```bash
cd ~/path/to/project
npm run start:cli
```

### Using auto-download from JSON 

You can also start a automatic download by putting a json file at project-path/auto-download/json/

Name it 'Animes.json' or it won't work.

Here is an example of a file:

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

Then start the auto-download:

```bash
cd ~/path/to/project
npm start:download
```

## TODO

Here are the main things we plan to do:

### Features

- [ ] Main goal: Implements an api to download anime from HTTP request with JSON

- [ ] Show Mo instead of timestamp download progression 

- [ ] Add self host web version to make the program user friendly

- [ ] Make a Jellyfin extension to communicate with api (not a priority)

- [ ] Use search methods from Inquirer lib for dynamic anime and season search in CLI inputs.

- [X] Implements logger for engine and CLI.


### Refactor

- [X] Convert engine and CLI from js to typescript.

- [X] Implements usage of SBoudrias/Inquirer.js lib for better CLI inputs.

- [X] Make the program with waitForSelector from the library puppeteer

- [X] Reorganise project as cli, engine and config sections

- [X] Remove duplicate function in FileReader and UrlBuilder

### Bugfixes

- [ ] Fix the bug that make FileReader infinitly \n without any reason (I suppose it's due to cli-progress unclose bar)