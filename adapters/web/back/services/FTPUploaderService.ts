import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import Client from 'ftp';
import SFTPClient from 'ssh2-sftp-client';

export interface FTPConnectionConfig {
    protocol: 'ftp' | 'sftp';
    host: string;
    port: number;
    username: string;
    password: string;
    passive_mode?: boolean;
}

export interface UploadResult {
    success: boolean;
    remotePath?: string;
    localHash?: string;
    error?: string;
}

function computeLocalSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

function getLocalFileSize(filePath: string): number {
    return fs.statSync(filePath).size;
}

class FTPUploaderService {
    async testConnection(config: FTPConnectionConfig): Promise<boolean> {
        try {
            if (config.protocol === 'ftp') return await this.testFTPConnection(config);
            if (config.protocol === 'sftp') return await this.testSFTPConnection(config);
            return false;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    private testFTPConnection(config: FTPConnectionConfig): Promise<boolean> {
        return new Promise((resolve) => {
            const client = new Client();
            const timeout = setTimeout(() => { client.end(); resolve(false); }, 10000);
            client.on('ready', () => { clearTimeout(timeout); client.end(); resolve(true); });
            client.on('error', () => { clearTimeout(timeout); resolve(false); });
            client.connect({ host: config.host, port: config.port, user: config.username, password: config.password, passive: config.passive_mode !== false });
        });
    }

    private async testSFTPConnection(config: FTPConnectionConfig): Promise<boolean> {
        const sftp = new SFTPClient();
        try {
            await sftp.connect({ host: config.host, port: config.port, username: config.username, password: config.password });
            await sftp.end();
            return true;
        } catch (error) {
            console.error('SFTP test connection error:', error);
            return false;
        }
    }

    async uploadToFTP(localFilePath: string, remoteDirectory: string, config: FTPConnectionConfig): Promise<UploadResult> {
        try {
            if (!fs.existsSync(localFilePath)) return { success: false, error: 'Local file does not exist' };

            const fileName = path.basename(localFilePath);
            const remotePath = `${remoteDirectory}/${fileName}`;
            const localHash = await computeLocalSHA256(localFilePath);
            const localSize = getLocalFileSize(localFilePath);

            let result: UploadResult;
            if (config.protocol === 'ftp') {
                result = await this.uploadViaFTP(localFilePath, remotePath, localSize, config);
            } else if (config.protocol === 'sftp') {
                result = await this.uploadViaSFTP(localFilePath, remotePath, localSize, config);
            } else {
                return { success: false, error: 'Invalid protocol' };
            }

            if (result.success) result.localHash = localHash;
            return result;
        } catch (error) {
            console.error('Upload error:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private getFTPRemoteSize(client: Client, remotePath: string): Promise<number | null> {
        return new Promise((resolve) => {
            (client as any).size(remotePath, (err: any, size: number) => {
                resolve(err ? null : size);
            });
        });
    }

    private uploadViaFTP(
        localFilePath: string,
        remotePath: string,
        localSize: number,
        config: FTPConnectionConfig,
        retryCount: number = 0
    ): Promise<UploadResult> {
        return new Promise((resolve) => {
            const client = new Client();
            const timeout = setTimeout(() => { client.end(); resolve({ success: false, error: 'Connection timeout' }); }, 60000);

            try {
                client.on('ready', () => {
                    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
                    client.mkdir(remoteDir, true, (err: any) => {
                        if (err && err.code !== 2) {
                            clearTimeout(timeout); client.end();
                            return resolve({ success: false, error: `Failed to create directory: ${err.message}` });
                        }

                        const fileStream = fs.createReadStream(localFilePath);
                        client.put(fileStream, remotePath, async (err: any) => {
                            if (err) {
                                clearTimeout(timeout); client.end();
                                if (retryCount < 3 && (err.message.includes('Connection') || err.message.includes('ECONNRESET') || err.message.includes('closed'))) {
                                    console.log(`FTP upload retry (${retryCount + 1}/3): ${remotePath}`);
                                    await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                                    return resolve(this.uploadViaFTP(localFilePath, remotePath, localSize, config, retryCount + 1));
                                }
                                return resolve({ success: false, error: `Upload failed: ${err.message}` });
                            }

                            // Verify remote file size
                            const remoteSize = await this.getFTPRemoteSize(client, remotePath);
                            clearTimeout(timeout); client.end();

                            if (remoteSize !== null && remoteSize !== localSize) {
                                console.warn(`FTP size mismatch: local=${localSize} remote=${remoteSize} — retry ${retryCount + 1}/3`);
                                if (retryCount < 3) {
                                    await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                                    return resolve(this.uploadViaFTP(localFilePath, remotePath, localSize, config, retryCount + 1));
                                }
                                return resolve({ success: false, error: `Size mismatch: local=${localSize} remote=${remoteSize}` });
                            }

                            resolve({ success: true, remotePath });
                        });
                    });
                });

                client.on('error', async (err: any) => {
                    clearTimeout(timeout);
                    if (retryCount < 3 && (err.message.includes('Connection') || err.message.includes('ECONNRESET') || err.message.includes('closed'))) {
                        console.log(`FTP connection retry (${retryCount + 1}/3): ${err.message}`);
                        await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                        return resolve(this.uploadViaFTP(localFilePath, remotePath, localSize, config, retryCount + 1));
                    }
                    resolve({ success: false, error: err.message });
                });

                client.connect({ host: config.host, port: config.port, user: config.username, password: config.password, passive: config.passive_mode !== false, connTimeout: 30000 });
            } catch (err) {
                clearTimeout(timeout);
                resolve({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
            }
        });
    }

    private async uploadViaSFTP(
        localFilePath: string,
        remotePath: string,
        localSize: number,
        config: FTPConnectionConfig,
        retryCount: number = 0
    ): Promise<UploadResult> {
        const sftp = new SFTPClient();
        try {
            await sftp.connect({ host: config.host, port: config.port, username: config.username, password: config.password, readyTimeout: 30000 });

            const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
            try {
                await sftp.mkdir(remoteDir, true);
            } catch (err) {
                if (!(err instanceof Error && err.message.includes('exist'))) throw err;
            }

            await sftp.put(localFilePath, remotePath);

            // Verify remote file size via stat
            const stat = await sftp.stat(remotePath);
            await sftp.end();

            if (stat.size !== localSize) {
                console.warn(`SFTP size mismatch: local=${localSize} remote=${stat.size} — retry ${retryCount + 1}/3`);
                if (retryCount < 3) {
                    await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                    return this.uploadViaSFTP(localFilePath, remotePath, localSize, config, retryCount + 1);
                }
                return { success: false, error: `Size mismatch: local=${localSize} remote=${stat.size}` };
            }

            return { success: true, remotePath };
        } catch (error) {
            try { await sftp.end(); } catch {}
            if (retryCount < 3 && error instanceof Error && (error.message.includes('Connection') || error.message.includes('ECONNRESET') || error.message.includes('closed'))) {
                console.log(`SFTP upload retry (${retryCount + 1}/3): ${error.message}`);
                await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                return this.uploadViaSFTP(localFilePath, remotePath, localSize, config, retryCount + 1);
            }
            console.error('SFTP upload error:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

export default new FTPUploaderService();
