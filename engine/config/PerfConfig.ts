/**
 * Runtime-mutable performance tuning, driven by process.env.LOW_RAM_MODE.
 *
 * When ON:
 *  - Puppeteer extractions are serialized (one page open at a time across the app).
 *  - Puppeteer browser is closed after a short idle window.
 *  - FFmpeg / Axios use smaller buffers and fewer kept-alive sockets.
 *
 * Toggled at runtime via POST /settings/perf — read fresh on every call.
 */
export default class PerfConfig {
    static get lowRamMode(): boolean {
        return process.env.LOW_RAM_MODE === "true";
    }

    /** Milliseconds the puppeteer browser stays alive after the last extraction. */
    static readonly browserIdleCloseMs: number = 30_000;
}
