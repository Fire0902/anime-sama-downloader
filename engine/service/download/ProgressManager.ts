import cliProgress from "cli-progress";

export default class ProgressManager {
    private static multiBar = new cliProgress.MultiBar(
        {
            format: "{name} [{bar}] {percentage}% || {eta}s",
            clearOnComplete: false,
            hideCursor: true,
            emptyOnZero: true,
            forceRedraw: true,
        },
        cliProgress.Presets.rect
    );

    static create(total: number, name: string) {
        return this.multiBar.create(total, 0, { name });
    }
}