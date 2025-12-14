import assert from "node:assert";
import { Browser } from "../engine/Browser.js";
import { extractAnimeTitles } from "../engine/Scrapper.js";

export async function mochaGlobalSetup() {
  globalThis.browser = await Browser.newPage();
}

describe('Scrapper', function(){
  describe("#extractAnimeTitles()", function () {
    it("should return an object with animes titles and url bind", async function () {
      const testUrl = "https://anime-sama.eu/catalogue/?search=one+p"
      const animesPage = await globalThis.browser.newPage();
      await animesPage.goto(testUrl, {
        waitUntil: 'networkidle2'
      });
      const animes = await extractAnimeTitles(animesPage);

      assert.strictEqual(
        animes.includes("One Piece", "One Punch Man"), 
        true
      );
    });
  });
});