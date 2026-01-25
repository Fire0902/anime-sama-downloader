import assert from "node:assert";
import Scrapper from "../src/utils/web/Scrapper.ts";
import Puppeteer from "../src/utils/web/Puppeteer.ts";
import Config from "../src/config/Config.ts";

before(async () => {
  await Puppeteer.getInstance();
});

after(async () => {
  await Puppeteer.close();
});

describe('Scrapper', () => {
  describe("#extractAnimeTitles()", () => {
    it("should return an object with animes titles and url bind", async () => {

      const animeName = "one+p"; // Format for href
      const testUrl = `${Config.websiteAdress}/catalogue?search=${animeName}`
      let page, animes;
      
      try {
        page = await Puppeteer.goto(testUrl);
        animes = await Scrapper.extractAnimeTitles(page);
      }
      catch(e){
        console.error(e);
        return;
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
  
  // describe("#extractSeasonsWithScans()", function () {
  //   it("should return seasons with their url", async function () {
  //     let seasons;
  //     try{
  //       const testUrl = "https://anime-sama.eu/catalogue/one-piece/"
  //       const page = await BrowserPuppet.goto(testUrl);
  //       seasons = await Scrapper.extractSeasonsWithScans(page);
  //     }catch(e){
  //       console.error(e);
  //       return;
  //     }

  //     let result = false;
  //     if(Object.keys(seasons).includes("Saga 1 (East Blue)") 
  //       || Object.keys(seasons).includes("One Piece Log: Fish-Man Island Saga")){
  //         result = true;
  //     }

  //     assert.strictEqual(
  //       result,
  //       true
  //     );
  //   })
  // })
});