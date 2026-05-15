import fs from 'fs';
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
    error?: string;
}

class FTPUploaderService {
    /**
     * Test FTP/SFTP connection
     */
    async testConnection(config: FTPConnectionConfig): Promise<boolean> {
        try {
            if (config.protocol === 'ftp') {
                return await this.testFTPConnection(config);
            } else if (config.protocol === 'sftp') {
                return await this.testSFTPConnection(config);
            }
            return false;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    /**
     * Test FTP connection
     */
    private testFTPConnection(config: FTPConnectionConfig): Promise<boolean> {
        return new Promise((resolve) => {
            const client = new Client();
            const timeout = setTimeout(() => {
                client.end();
                resolve(false);
            }, 10000);

            client.on('ready', () => {
                clearTimeout(timeout);
                client.end();
                resolve(true);
            });

            client.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });

            client.connect({
                host: config.host,
                port: config.port,
                user: config.username,
                password: config.password,
                passive: config.passive_mode !== false
            });
        });
    }

    /**
     * Test SFTP connection
     */
    private async testSFTPConnection(config: FTPConnectionConfig): Promise<boolean> {
        const sftp = new SFTPClient();
        try {
            await sftp.connect({
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password
            });
            await sftp.end();
            return true;
        } catch (error) {
            console.error('SFTP test connection error:', error);
            return false;
        }
    }

    /**
     * Upload file to FTP server
     */
    async uploadToFTP(
        localFilePath: string,
        remoteDirectory: string,
        config: FTPConnectionConfig
    ): Promise<UploadResult> {
        try {
            if (!fs.existsSync(localFilePath)) {
                return {
                    success: false,
                    error: 'Local file does not exist'
                };
            }

            const fileName = path.basename(localFilePath);
            const remotePath = `${remoteDirectory}/${fileName}`;

            if (config.protocol === 'ftp') {
                return await this.uploadViaFTP(localFilePath, remotePath, config);
            } else if (config.protocol === 'sftp') {
                return await this.uploadViaSFTP(localFilePath, remotePath, config);
            }

            return {
                success: false,
                error: 'Invalid protocol'
            };
        } catch (error) {
            console.error('Upload error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Upload via FTP with retry logic
     */
    private uploadViaFTP(
        localFilePath: string,
        remotePath: string,
        config: FTPConnectionConfig,
        retryCount: number = 0
    ): Promise<UploadResult> {
        return new Promise((resolve) => {
            const client = new Client();
            const timeout = setTimeout(() => {
                client.end();
                resolve({
                    success: false,
                    error: 'Connection timeout'
                });
            }, 60000); // 60s timeout

            try {
                client.on('ready', () => {
                    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));

                    // Ensure remote directory exists
                    client.mkdir(remoteDir, true, (err) => {
                        if (err && err.code !== 2) { // code 2 = already exists
                            clearTimeout(timeout);
                            client.end();
                            return resolve({
                                success: false,
                                error: `Failed to create directory: ${err.message}`
                            });
                        }

                        // Upload file
                        const fileStream = fs.createReadStream(localFilePath);
                        client.put(fileStream, remotePath, (err) => {
                            clearTimeout(timeout);
                            if (err) {
                                client.end();
                                // Retry if connection error and we haven't exceeded max retries
                                if (retryCount < 2 && (err.message.includes('Connection') || err.message.includes('ECONNRESET') || err.message.includes('closed'))) {
                                    console.log(`FTP upload retry (${retryCount + 1}/2): ${remotePath}`);
                                    setTimeout(() => {
                                        this.uploadViaFTP(localFilePath, remotePath, config, retryCount + 1).then(resolve);
                                    }, 2000); // Wait 2 seconds before retry
                                    return;
                                }
                                return resolve({
                                    success: false,
                                    error: `Upload failed: ${err.message}`
                                });
                            }

                            client.end();
                            resolve({
                                success: true,
                                remotePath
                            });
                        });
                    });
                });

                client.on('error', (err) => {
                    clearTimeout(timeout);
                    // Retry if connection error and we haven't exceeded max retries
                    if (retryCount < 2 && (err.message.includes('Connection') || err.message.includes('ECONNRESET') || err.message.includes('closed'))) {
                        console.log(`FTP connection retry (${retryCount + 1}/2): ${err.message}`);
                        setTimeout(() => {
                            this.uploadViaFTP(localFilePath, remotePath, config, retryCount + 1).then(resolve);
                        }, 2000); // Wait 2 seconds before retry
                        return;
                    }
                    resolve({
                        success: false,
                        error: err.message
                    });
                });

                client.connect({
                    host: config.host,
                    port: config.port,
                    user: config.username,
                    password: config.password,
                    passive: config.passive_mode !== false,
                    connTimeout: 30000 // 30s connection timeout
                });
            } catch (err) {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        });
    }

    /**
     * Upload via SFTP with retry logic
     */
    private async uploadViaSFTP(
        localFilePath: string,
        remotePath: string,
        config: FTPConnectionConfig,
        retryCount: number = 0
    ): Promise<UploadResult> {
        const sftp = new SFTPClient();
        try {
            await sftp.connect({
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password,
                readyTimeout: 30000
            });

            // Ensure remote directory exists
            const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
            try {
                await sftp.mkdir(remoteDir, true);
            } catch (err) {
                // Directory might already exist, that's fine
                if (!(err instanceof Error && err.message.includes('exist'))) {
                    throw err;
                }
            }

            // Upload file
            await sftp.put(localFilePath, remotePath);
            await sftp.end();

            return {
                success: true,
                remotePath
            };
        } catch (error) {
            // Retry if connection error and we haven't exceeded max retries
            if (retryCount < 2 && error instanceof Error && (error.message.includes('Connection') || error.message.includes('ECONNRESET') || error.message.includes('closed'))) {
                console.log(`SFTP upload retry (${retryCount + 1}/2): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                return this.uploadViaSFTP(localFilePath, remotePath, config, retryCount + 1);
            }
            console.error('SFTP upload error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

export default new FTPUploaderService();
