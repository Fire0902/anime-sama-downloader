# anime-sama-downloader

Tool to automaticly download multiple anumes episodes from websites, using anonymous web bots.

- Can simultaneously download multiple episodes at the same time.

- Handle striked episodes

- Bypass Cloudflare anti-bot challenge (for now only checkboxes)

- Use [anonymous and secure ways](https://pptr.dev) to protect yourself. Includes protection to [fingerprinting](https://en.wikipedia.org/wiki/Fingerprint_(computing)).

Also includes a console-lign client to select anime, season and episodes to download.

This project does not contains IA made code. We are two computer science students cooperating and helping each other.

> [!IMPORTANT]
> This project is still in WIP, will change <strong>a lot</strong>, and some features <strong>might be broken</strong> at this time.
> This tool does <strong>not</strong> contains copyrighted content <strong>nor endorse</strong> Copyright infringement. Use it at your own risks.

## Summary

1. [Dependencies](#dependencies)

2. [How to install](#how-to-install)
   - [Clone project](#clone-project)
   - [Install dependencies](#install-dependencies)

3. [How to use](#how-to-use)
   - [Using Console-Lign Interface](#using-console-lign-interface)
   - [Using auto-download with JSON ](#using-auto-download-with-json)

4. [Configuration](#configuration)

5. [Roadmap](#roadmap)
   - [Future](#future)
   - [Done](#previously-finished)

## Dependencies

- [node](https://nodejs.org) >= v25
- [axios](https://www.npmjs.com/package/axios) - node HTTP requests
- [puppeteer](https://pptr.dev/) - Handling web browser bot
- [inquirer](https://www.npmjs.com/package/inquirer) - user input (CLI)
- [cli-progress](https://www.npmjs.com/package/cli-progress) - bar progress for downloads (CLI)
- [ts-log](https://www.npmjs.com/package/tslog) - engine logs

## How to install

### Clone project

```bash
git clone https://github.com/Fire0902/anime-sama-downloader.git
```

### Install Dependencies

```bash
npm install
```

And the project is now ready to use.

## How To Use

### Using Console-Lign Interface

Launch a terminal, then start the main interface:

```bash
cd ~/anime-sama-downloader
npm run start:cli
```

### Using Auto-Download with JSON

You can also start a automatic download by creating a JSON file at ~/anime-sama-downloader/json/animes.json

Name it 'animes.json' or <strong>it will not</strong> work. Here is an example of a file:

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

Be warned that modify it <strong>might breaks correct process</strong>.

Additionnaly, some folders can be created while using tools, like logs/, or screenshots/ if you activate it in config.
Those files are generated only, and can be deleted at anytime. It will <strong>not</strong> affect tool process at all.

## Roadmap

We are currently planning to transform this project into an API,
by merging it to [adonis framework](https://adonisjs.com/).

We are also working on a website as an alternative to select animes of your choice.

### Future

| Features | Refactors | Bugfixes |
| --------------- | --------------- | --------------- |
| Show progress Mo instead of timestamp | [IMPORTANT] Refactor EpisodeDownloader    | Multibar progress display
| Jellyfin extension to call API        | Split Cli.run process to multiple methods | FileReader runs infinitly with \n
| Self-hosted web version
| [Final goal] Implements an API

### Previously finished

| Features | Refactors | Bugfixes |
| --------------- | --------------- | --------------- |
| CloudFlare anti-bot detection  	| Convert tool to TypeScript | Downloads stop at 2 eps
| Handle striked episode 			| Reorganise project architecture
| Logger for engine & CLI           | Remove duplicate in FileReader & UrlBuilder
| Inquirer lib for better CLI inputs
| waitForSelector with puppeteer lib

