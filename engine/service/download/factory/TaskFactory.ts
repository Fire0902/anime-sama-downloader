import SibnetDownloader from "../downloader/SibnetDownloader.ts";
import VidmolyDownloader from "../downloader/VidmolyDownloader.ts";
import { TaskStrategy } from "../strategy/TaskStrategy.ts";
import AxiosTask from "../task/AxiosTask.ts";
import FFmpegTask from "../task/FFmpegTask.ts";

export class DownloaderFactory {
    static async get(url: string, outputPath: string): Promise<TaskStrategy | null> {
            if (await (new VidmolyDownloader().canHandle(url))){
                return new FFmpegTask(url, outputPath);
            }else if(await (new SibnetDownloader().canHandle(url))){
                return new AxiosTask(url, outputPath);
            }
        return null;
    }
}