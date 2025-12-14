import assert from "node:assert";
import Browser from "../engine/utils/web/Browser.js";
import Scrapper from "../engine/utils/web/Scrapper.js";

describe('Scrapper', function(){
  describe("#extractAnimeTitles()", function () {
    it("should return an object with animes titles and url bind", async function () {
      const testUrl = "https://anime-sama.eu/catalogue/?search=one+p"
      const page = await Browser.newPage();
      await page.goto(testUrl, {
        waitUntil: 'networkidle2'
      });
      const animes = await Scrapper.extractAnimeTitles(page);

      console.log(animes)

      assert.strictEqual(
        Object.keys(animes).includes("One Piece", "One Punch Man"), 
        true
      );
    });
  });
});