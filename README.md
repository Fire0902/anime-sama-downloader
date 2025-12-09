# anime-sama-downloader

### Deps:

- axios
- cli-progress
- progress
- readline

### Download deps:

```bash
npm install
```

### Start Cli

```bash
npm start:cli
```

### Start download from a json

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