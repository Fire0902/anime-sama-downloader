import DatabaseService from './DatabaseService.ts';
import { Database } from 'sqlite';

export interface FolderStructureConfig {
    id?: number;
    user_id: number;
    mode: 'mode1' | 'mode2' | 'mode3' | 'jellyfin';
    season_format?: string;
    episode_format?: string;
    add_season_index?: boolean;
    season_index_space?: boolean;
    add_episode_index?: boolean;
    episode_index_space?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface FolderPathResult {
    folderPath: string;
    episodeFileName: string | null;
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

    async getUserConfig(userId: number): Promise<FolderStructureConfig | null> {
        const db = this.getDb();
        try {
            let config = await db.get<FolderStructureConfig>(
                'SELECT * FROM folder_structure_configs WHERE user_id = ?',
                [userId]
            );
            if (!config) {
                config = await this.initializeUserConfig(userId);
            }
            return config;
        } catch (error) {
            console.error('Error fetching folder structure config:', error);
            throw error;
        }
    }

    private async initializeUserConfig(userId: number): Promise<FolderStructureConfig> {
        const db = this.getDb();
        await db.run(
            `INSERT INTO folder_structure_configs (user_id, mode) VALUES (?, 'jellyfin')`,
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

    async saveUserConfig(userId: number, config: Partial<FolderStructureConfig>): Promise<FolderStructureConfig> {
        const db = this.getDb();

        if (!['mode1', 'mode2', 'mode3', 'jellyfin'].includes(config.mode || 'jellyfin')) {
            throw new Error('Invalid mode');
        }

        try {
            const existing = await db.get(
                'SELECT id FROM folder_structure_configs WHERE user_id = ?',
                [userId]
            );

            if (existing) {
                await db.run(
                    `UPDATE folder_structure_configs
                     SET mode = ?, season_format = ?, episode_format = ?,
                         add_season_index = ?, season_index_space = ?,
                         add_episode_index = ?, episode_index_space = ?
                     WHERE user_id = ?`,
                    [
                        config.mode || 'jellyfin',
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
                await db.run(
                    `INSERT INTO folder_structure_configs
                     (user_id, mode, season_format, episode_format, add_season_index, season_index_space, add_episode_index, episode_index_space)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        config.mode || 'jellyfin',
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
            if (!updated) throw new Error('Failed to retrieve updated config');
            return updated;
        } catch (error) {
            console.error('Error saving folder structure config:', error);
            throw error;
        }
    }

    buildFolderPath(
        animeName: string,
        seasonName: string,
        seasonIndex: number,
        episodeName: string,
        episodeIndex: number,
        config: FolderStructureConfig
    ): FolderPathResult {
        const parts: string[] = [animeName];
        const displaySeasonIndex = seasonIndex + 1;
        const displayEpisodeIndex = episodeIndex + 1;

        if (config.mode === 'jellyfin') {
            const isSpecial = /\b(ova|oav)\b/i.test(seasonName);
            const ss = isSpecial ? '00' : String(displaySeasonIndex).padStart(2, '0');
            const ee = String(displayEpisodeIndex).padStart(2, '0');
            parts.push(`Season ${ss}`);
            return {
                folderPath: parts.join('/'),
                episodeFileName: `${animeName} S${ss}E${ee}`,
            };
        }

        let seasonFolder = '';
        if (config.mode === 'mode1') {
            seasonFolder = seasonName;
        } else if (config.mode === 'mode2') {
            seasonFolder = `Season ${displaySeasonIndex}`;
        } else if (config.mode === 'mode3') {
            seasonFolder = config.season_format || 'season_name';
            seasonFolder = seasonFolder.replace('{name}', seasonName);
            seasonFolder = seasonFolder.replace('{index}', String(displaySeasonIndex));
            if (config.add_season_index) {
                const spacing = config.season_index_space ? ' ' : '';
                seasonFolder += `${spacing}${displaySeasonIndex}`;
            }
        }

        if (seasonFolder) parts.push(seasonFolder);

        return { folderPath: parts.join('/'), episodeFileName: null };
    }
}

export default new FolderStructureConfigService();
