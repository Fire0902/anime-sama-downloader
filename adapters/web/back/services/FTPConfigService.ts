import DatabaseService from './DatabaseService.ts';
import { Database } from 'sqlite';
import crypto from 'crypto';

// Encryption key - should be stored in environment variable
const ENCRYPTION_KEY = process.env.FTP_ENCRYPTION_KEY || 'default-secret-key-change-in-env';

export interface FTPConfig {
    id: number;
    user_id: number;
    protocol: 'none' | 'ftp' | 'sftp';
    host: string | null;
    port: number | null;
    username: string | null;
    password_encrypted: string | null;
    remote_path: string | null;
    passive_mode: boolean;
    created_at: string;
    updated_at: string;
}

export interface FTPConfigInput {
    protocol: 'none' | 'ftp' | 'sftp';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    remote_path?: string;
    passive_mode?: boolean;
}

class FTPConfigService {
    private db: Database<any, any> | null = null;

    private getDb(): Database<any, any> {
        if (!this.db) {
            this.db = DatabaseService.getDb();
        }
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db;
    }

    /**
     * Encrypt password using AES-256
     */
    private encryptPassword(password: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32),
            iv
        );
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt password
     */
    private decryptPassword(encryptedPassword: string): string {
        const parts = encryptedPassword.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32),
            iv
        );
        let decrypted = decipher.update(parts[1], 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    /**
     * Get FTP config for user (password NOT included)
     */
    async getUserFTPConfig(userId: number): Promise<FTPConfig | null> {
        const db = this.getDb();
        try {
            let config = await db.get<FTPConfig>(
                'SELECT * FROM ftp_configs WHERE user_id = ?',
                [userId]
            );

            if (!config) {
                // Create default config if doesn't exist
                config = await this.initializeUserFTPConfig(userId);
            }

            // Don't send encrypted password to client
            const { password_encrypted, ...configWithoutPassword } = config;
            return configWithoutPassword as any;
        } catch (error) {
            console.error('Error fetching FTP config:', error);
            throw error;
        }
    }

    /**
     * Initialize default FTP config for new user
     */
    private async initializeUserFTPConfig(userId: number): Promise<FTPConfig> {
        const db = this.getDb();
        await db.run(
            `INSERT INTO ftp_configs (user_id, protocol) VALUES (?, 'none')`,
            [userId]
        );
        const config = await db.get<FTPConfig>(
            'SELECT * FROM ftp_configs WHERE user_id = ?',
            [userId]
        );
        if (!config) {
            throw new Error('Failed to create default FTP config');
        }
        return config;
    }

    /**
     * Save/Update FTP config for user
     */
    async saveUserFTPConfig(
        userId: number,
        config: FTPConfigInput
    ): Promise<FTPConfig> {
        const db = this.getDb();

        // Validate
        if (!['none', 'ftp', 'sftp'].includes(config.protocol)) {
            throw new Error('Invalid protocol');
        }

        if (config.protocol !== 'none') {
            if (!config.host || !config.port || !config.username || !config.password) {
                throw new Error('Missing required FTP/SFTP fields');
            }
            if (config.port < 1 || config.port > 65535) {
                throw new Error('Port must be between 1 and 65535');
            }
        }

        try {
            let encryptedPassword: string | null = null;
            if (config.password) {
                encryptedPassword = this.encryptPassword(config.password);
            }

            // Check if config exists
            const existing = await db.get(
                'SELECT id FROM ftp_configs WHERE user_id = ?',
                [userId]
            );

            if (existing) {
                // Update
                await db.run(
                    `UPDATE ftp_configs
                     SET protocol = ?, host = ?, port = ?, username = ?,
                         password_encrypted = ?, remote_path = ?, passive_mode = ?
                     WHERE user_id = ?`,
                    [
                        config.protocol,
                        config.host || null,
                        config.port || null,
                        config.username || null,
                        encryptedPassword,
                        config.remote_path || null,
                        config.passive_mode ? 1 : 0,
                        userId
                    ]
                );
            } else {
                // Create
                await db.run(
                    `INSERT INTO ftp_configs
                     (user_id, protocol, host, port, username, password_encrypted, remote_path, passive_mode)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        config.protocol,
                        config.host || null,
                        config.port || null,
                        config.username || null,
                        encryptedPassword,
                        config.remote_path || null,
                        config.passive_mode ? 1 : 0
                    ]
                );
            }

            // Return without password
            const updated = await db.get<FTPConfig>(
                'SELECT * FROM ftp_configs WHERE user_id = ?',
                [userId]
            );
            if (!updated) {
                throw new Error('Failed to retrieve updated config');
            }

            const { password_encrypted, ...configWithoutPassword } = updated;
            return configWithoutPassword as any;
        } catch (error) {
            console.error('Error saving FTP config:', error);
            throw error;
        }
    }

    /**
     * Get decrypted FTP config (for internal use only)
     */
    async getDecryptedConfig(userId: number): Promise<(FTPConfig & { password?: string }) | null> {
        const db = this.getDb();
        try {
            const config = await db.get<FTPConfig>(
                'SELECT * FROM ftp_configs WHERE user_id = ?',
                [userId]
            );

            if (!config || config.protocol === 'none') {
                return null;
            }

            if (!config.password_encrypted) {
                return config;
            }

            const decryptedPassword = this.decryptPassword(config.password_encrypted);
            return {
                ...config,
                password: decryptedPassword
            };
        } catch (error) {
            console.error('Error getting decrypted config:', error);
            throw error;
        }
    }

    /**
     * Reset FTP config to 'none' for user
     */
    async resetUserFTPConfig(userId: number): Promise<void> {
        const db = this.getDb();
        try {
            await db.run(
                `UPDATE ftp_configs
                 SET protocol = 'none', host = NULL, port = NULL, username = NULL,
                     password_encrypted = NULL, remote_path = NULL, passive_mode = 0
                 WHERE user_id = ?`,
                [userId]
            );
        } catch (error) {
            console.error('Error resetting FTP config:', error);
            throw error;
        }
    }
}

export default new FTPConfigService();
