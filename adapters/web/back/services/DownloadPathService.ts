import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DownloadPathConfig {
    downloadPath: string;
}

class DownloadPathService {
    private configFilePath: string;
    private downloadsDir: string;
    private defaultDownloadsDir: string;

    constructor() {
        this.configFilePath = path.join(__dirname, '../sql/download-config.json');
        this.defaultDownloadsDir = path.resolve(__dirname, '../downloads');
        this.downloadsDir = this.defaultDownloadsDir;
        this.loadConfig();
    }

    private loadConfig(): void {
        if (fs.existsSync(this.configFilePath)) {
            try {
                const raw = fs.readFileSync(this.configFilePath, 'utf-8');
                const config: DownloadPathConfig = JSON.parse(raw);
                if (config?.downloadPath) {
                    this.downloadsDir = path.resolve(config.downloadPath);
                }
            } catch {
                // Ignore invalid config file and continue with defaults.
            }
        }

        this.ensureDirectoryWritable(this.downloadsDir);
    }

    private saveConfig(): void {
        fs.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
        fs.writeFileSync(
            this.configFilePath,
            JSON.stringify({ downloadPath: this.downloadsDir }, null, 2),
            'utf-8'
        );
    }

    getDownloadsDir(): string {
        return this.downloadsDir;
    }

    setDownloadsDir(downloadDir: string): void {
        const resolvedDir = path.resolve(downloadDir);
        this.ensureDirectoryWritable(resolvedDir);
        this.downloadsDir = resolvedDir;
        this.saveConfig();
    }

    private ensureDirectoryWritable(downloadDir: string): void {
        fs.mkdirSync(downloadDir, { recursive: true });
        fs.accessSync(downloadDir, fs.constants.W_OK);
    }
}

export default new DownloadPathService();
