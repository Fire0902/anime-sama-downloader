import assert from "node:assert";
import Browser from "../engine/utils/web/Browser.js";
import Scrapper from "../engine/utils/web/Scrapper.js";

describe('Scrapper', function () {
  describe("#extractAnimeTitles()", function () {
    it("should return an object with animes titles and url bind", async function () {
      const testUrl = "https://anime-sama.eu/catalogue/?search=one+p"
      const page = await Browser.newPage();
      await page.goto(testUrl, {
        waitUntil: 'networkidle2'
      });
      const animes = await Scrapper.extractAnimeTitles(page);

      Browser.close();

      let result = false;

      if(Object.keys(animes).includes("One Piece") 
        || Object.keys(animes).includes("One Punch Man")){
          result = true;
      }

      assert.strictEqual(
        result,
        true
      );
    });
  });
  describe("#extractSeasonsWithScans()", function () {
    it("should return seasons with their url", async function () {
      const testUrl = "https://anime-sama.eu/catalogue/one-piece/"
      const page = await Browser.newPage();
      await page.goto(testUrl, {
        waitUntil: 'networkidle2'
      });
      const seasons = await Scrapper.extractSeasonsWithScans(page);

      Browser.close();

      let result = false;

      if(Object.keys(seasons).includes("Saga 1 (East Blue)") 
        || Object.keys(seasons).includes("One Piece Log: Fish-Man Island Saga")){
          result = true;
      }

      assert.strictEqual(
        result,
        true
      );
    })
  })
});