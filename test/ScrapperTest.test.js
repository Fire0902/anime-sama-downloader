import assert from "node:assert";
import Scrapper from "../engine/utils/Scrapper.ts";
import BrowserPuppet from "../engine/utils/BrowserPuppet.ts";

describe('Scrapper', function () {
  describe("#extractAnimeTitles()", function () {
    it("should return an object with animes titles and url bind", async function () {
      const testUrl = "https://anime-sama.eu/catalogue/?search=one+p"
      let page, animes;
      
      try {
        page = await BrowserPuppet.goto(testUrl);
        animes = await Scrapper.extractAnimeTitles(page);
      }
      catch(e){
        console.error(e);
        return;
      }
      finally {
        BrowserPuppet.closePage(page);
        BrowserPuppet.close();
      }
      
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
      const page = await BrowserPuppet.goto(testUrl);
      const seasons = await Scrapper.extractSeasonsWithScans(page);

      BrowserPuppet.closePage(page);
      BrowserPuppet.close();

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