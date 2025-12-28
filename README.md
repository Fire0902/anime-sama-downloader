# anime-sama-downloader

Tool to automaticly download multiple anumes episodes from websites, with anonymous browser bots puppeteer

- Can simultaneously download multiple episode at the same time.

- Handle striked episodes

- Bypass Cloudflare anti-bot challenge (for now only checkboxes)

- Use random window dimensions to protect yourself from fingerprinting attacks

Also includes a console lign client to select anime, season and episodes to download.

This project does not contains IA made code. We consists of two students cooperating and helping each other.

> [!IMPORTANT]
> This tool <strong>does not</strong> contains copyrighted content <strong>nor endorse</strong> Copyright infringement. Use it at your own risks.

> [!IMPORTANT]
> This project is still in WIP, <strong>will change a lot</strong> and 
<strong>some features might be broken at this time</strong>. 
We plan to release tag versions for better continuity.

## Dependencies

- [node](https://nodejs.org) >= v25
- [axios](https://www.npmjs.com/package/axios) - node HTTP requests
- [puppeteer](https://pptr.dev/) - Handling web browser bot
- [inquirer](https://www.npmjs.com/package/inquirer) - user input (CLI)
- [cli-progress](https://www.npmjs.com/package/cli-progress) - bar progress for downloads (CLI)
- [ts-log](https://www.npmjs.com/package/tslog) - engine logs

## Summary

1. [How to install](#how-to-install)
    - [Clone project](#clone-project)
    - [Install dependencies](#install-dependencies)

2. [How to use](#how-to-use)
    - [Using Console-Lign Interface](#using-console-lign-interface)
    - [Using auto-download with JSON ](#using-auto-download-with-json)

3. [Configuration](#configuration)

4. [Roadmap](#roadmap)
    - [Features](#features)
    - [Refactors](#refactors)
    - [Bugfixes](#bugfixes)

## How to install

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

### Using Console-Lign Interface

Launch a terminal, then start the main interface:

```bash
cd ~/anime-sama-downloader
npm run start:cli
```

### Using auto-download with JSON 

You can also start a automatic download by creating a JSON file at ~/anime-sama-downloader/json/anime.json

Name it 'animes.json' or it won't work.

Here is an example of a file:

```json
{
    "One Piece": {
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
    },
    "One Punch Man": {
        "url": "",
        "seasons": "3",
        "episodes": "ALL"
    }
}
```

A JSON template file is also available at ~/anime-sama-downloader/json.

To start auto-download:

```bash
cd ~/anime-sama-downloader
npm run start:download
```

## Configuration

Project should be ready to work, but you can change tool parameters values at ~/anime-sama-downloader/src/config/Config.ts.

Be warned that modify it might breaks some features. 

## Roadmap

We are currently planning to transform this project into an API,
by merging it to [AdonysJS framework](https://adonisjs.com/).

We are also working on a website as an alternative to select animes of your choice.

Here are the main things we plan to do :

### Features

- [ ] Main goal: Implements an api to download from HTTP request with JSON

- [ ] Show Mo instead of timestamp download progression 

- [ ] Make a Jellyfin extension to communicate with api (not a priority)

- [ ] Add self host web version to make the program user friendly

- [X] Add CloudFlare anti-bot page detection.

- [X] Add striked episode detection and handle.

- [X] Add logger for engine and CLI.

- [X] Add usage of SBoudrias/Inquirer.js lib for better CLI inputs.

- [X] Make the program with waitForSelector from the library puppeteer

### Refactors

- [ ] Refactor EpisodeDownloader.ts.

- [X] Convert project to TypeScript for more type-safety.

- [X] Reorganise project with cli, engine and config sections

- [X] Remove duplicate functions in FileReader and UrlBuilder

### Bugfixes

- [ ] Fix the bug that make FileReader infinitly \n without any reason (I suppose it's due to cli-progress unclosed bar)

- [X] Fix downloads always stop at 2 episodes
