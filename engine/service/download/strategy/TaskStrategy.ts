export interface TaskStrategy {
    start(): Promise<void>;
    on(event: "start", listener: (info: { total: number }) => void): this;
    on(event: "duration", listener: (duration: number) => void): this;
    on(event: "progress", listener: (downloaded: number, total: number) => void): this;
    on(event: "done", listener: (success: boolean) => void): this;
    on(event: "error", listener: (err: any) => void): this;
}