import assert from "node:assert";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path"; import BrowserPuppet from "../engine/utils/BrowserPuppet.ts";
import EpisodeDownloader from "../engine/download/EpisodeDownloader.ts";
import FakeBar from "./mock/FakeBar.mock.ts";


before(() => {
    execSync(`ffmpeg -f lavfi -i color=c=black:s=1280x720:d=60 -f lavfi -i anullsrc -shortest -c:v libx264 -c:a aac -hls_time 6 -hls_playlist_type vod ./test/tmp/hls/empty.m3u8`);
});

describe('EpisodeDownloader', function () {
    describe("#runFFmpeg()", function () {
        it("should process m3u8 and update progress bar to 100%", async function () {
            this.timeout(20_000);

            const m3u8Path = path.resolve("./test/tmp/hls/empty.m3u8");
            const output = path.resolve("./test/tmp/output.ts");
            const bar = new FakeBar();

            await EpisodeDownloader.runFFmpeg(m3u8Path, output, bar);

            assert.ok(fs.existsSync(output), "Output file not created");
            assert.strictEqual(bar.getCurrent(), bar.getTotal());
        });
    })
    
})

