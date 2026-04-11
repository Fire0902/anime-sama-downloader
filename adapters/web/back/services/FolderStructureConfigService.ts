import DatabaseService from './DatabaseService.ts';
import { Database } from 'sqlite';

export interface FolderStructureConfig {
    id?: number;
    user_id: number;
    mode: 'mode1' | 'mode2' | 'mode3';
    season_format?: string;
    episode_format?: string;
    add_season_index?: boolean;
    season_index_space?: boolean;
    add_episode_index?: boolean;
    episode_index_space?: boolean;
    created_at?: string;
    updated_at?: string;
}

class FolderStructureConfigService {
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
     * Get folder structure config for user
     */
    async getUserConfig(userId: number): Promise<FolderStructureConfig | null> {
        const db = this.getDb();
        try {
            let config = await db.get<FolderStructureConfig>(
                'SELECT * FROM folder_structure_configs WHERE user_id = ?',
                [userId]
            );

            if (!config) {
                // Create default config
                config = await this.initializeUserConfig(userId);
            }

            return config;
        } catch (error) {
            console.error('Error fetching folder structure config:', error);
            throw error;
        }
    }

    /**
     * Initialize default config for new user
     */
    private async initializeUserConfig(userId: number): Promise<FolderStructureConfig> {
        const db = this.getDb();
        await db.run(
            `INSERT INTO folder_structure_configs (user_id, mode) VALUES (?, 'mode1')`,
            [userId]
        );
        const config = await db.get<FolderStructureConfig>(
            'SELECT * FROM folder_structure_configs WHERE user_id = ?',
            [userId]
        );
        if (!config) {
            throw new Error('Failed to create default folder structure config');
        }
        return config;
    }

    /**
     * Save/Update folder structure config
     */
    async saveUserConfig(userId: number, config: Partial<FolderStructureConfig>): Promise<FolderStructureConfig> {
        const db = this.getDb();

        // Validate mode
        if (!['mode1', 'mode2', 'mode3'].includes(config.mode || 'mode1')) {
            throw new Error('Invalid mode');
        }

        try {
            const existing = await db.get(
                'SELECT id FROM folder_structure_configs WHERE user_id = ?',
                [userId]
            );

            if (existing) {
                // Update
                await db.run(
                    `UPDATE folder_structure_configs
                     SET mode = ?, season_format = ?, episode_format = ?,
                         add_season_index = ?, season_index_space = ?,
                         add_episode_index = ?, episode_index_space = ?
                     WHERE user_id = ?`,
                    [
                        config.mode || 'mode1',
                        config.season_format || 'season_name',
                        config.episode_format || 'episode_name',
                        config.add_season_index ? 1 : 0,
                        config.season_index_space !== false ? 1 : 0,
                        config.add_episode_index ? 1 : 0,
                        config.episode_index_space !== false ? 1 : 0,
                        userId
                    ]
                );
            } else {
                // Create
                await db.run(
                    `INSERT INTO folder_structure_configs
                     (user_id, mode, season_format, episode_format, add_season_index, season_index_space, add_episode_index, episode_index_space)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        config.mode || 'mode1',
                        config.season_format || 'season_name',
                        config.episode_format || 'episode_name',
                        config.add_season_index ? 1 : 0,
                        config.season_index_space !== false ? 1 : 0,
                        config.add_episode_index ? 1 : 0,
                        config.episode_index_space !== false ? 1 : 0
                    ]
                );
            }

            const updated = await db.get<FolderStructureConfig>(
                'SELECT * FROM folder_structure_configs WHERE user_id = ?',
                [userId]
            );
            if (!updated) {
                throw new Error('Failed to retrieve updated config');
            }

            return updated;
        } catch (error) {
            console.error('Error saving folder structure config:', error);
            throw error;
        }
    }

    /**
     * Build the folder path based on config
     */
    buildFolderPath(
        animeName: string,
        seasonName: string,
        seasonIndex: number,
        episodeName: string,
        episodeIndex: number,
        config: FolderStructureConfig
    ): string {
        const parts: string[] = [animeName];

        // Build season folder name
        let seasonFolder = '';
        if (config.mode === 'mode1') {
            // anime_name/season_name/episode_name
            seasonFolder = seasonName;
        } else if (config.mode === 'mode2') {
            // anime_name/Season {index}/episode_name
            seasonFolder = `Season ${seasonIndex}`;
        } else if (config.mode === 'mode3') {
            // Custom format
            seasonFolder = config.season_format || 'season_name';
            seasonFolder = seasonFolder.replace('{name}', seasonName);
            seasonFolder = seasonFolder.replace('{index}', String(seasonIndex));

            if (config.add_season_index) {
                const spacing = config.season_index_space ? ' ' : '';
                seasonFolder += `${spacing}${seasonIndex}`;
            }
        }

        if (seasonFolder) {
            parts.push(seasonFolder);
        }

        // Build episode file name
        let episodeFile = episodeName;
        if (config.mode === 'mode3' && config.episode_format) {
            episodeFile = config.episode_format;
            episodeFile = episodeFile.replace('{name}', episodeName);
            episodeFile = episodeFile.replace('{index}', String(episodeIndex));

            if (config.add_episode_index) {
                const spacing = config.episode_index_space ? ' ' : '';
                episodeFile += `${spacing}${episodeIndex}`;
            }
        }

        return parts.join('/');
    }
}

export default new FolderStructureConfigService();
