// External URLs
const websiteUrl = "https://anime-sama.eu/catalogue";
const sibnetUrl = "https://video.sibnet.ru";

// Paths
const downloadPath = './animes';

// Types
const downloadDefaultFormat = 'txt';
const downloadEncoding = 'utf8';
const downloadFFmpegFormat = 'mp4';

// Attributes
const maxRunners = 2;
const goToPageTimeout = 15000;
const waitForSelectorTimeout = 5000;

module.exports = { 
    websiteUrl, sibnetUrl, 
    downloadPath, 
    downloadDefaultFormat, downloadEncoding, downloadFFmpegFormat,
    maxRunners, goToPageTimeout, waitForSelectorTimeout 
};