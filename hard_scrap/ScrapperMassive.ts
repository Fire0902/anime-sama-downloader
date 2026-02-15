import Puppeteer from "../engine/utils/web/Puppeteer.ts";
import Scrapper from "../engine/utils/web/Scrapper.ts";
import { Page } from "puppeteer";

class ScapperMassive {
    static async scrapAnimeList(){
        for(let i = 0; i<2; i++){
            this.scrapOnePage(i);        
        }
    }
    static async scrapOnePage(pagination: number){
        Puppeteer.initialize();
        const hostAdress: string = await Scrapper.extractHostAdress();
        const page: Page = await Puppeteer.goto(hostAdress + `/catalogue/?page=${pagination}`);
        const animes = await Scrapper.extractAnimeTitles(page);
        console.log(animes);
    }
}

ScapperMassive.scrapAnimeList();