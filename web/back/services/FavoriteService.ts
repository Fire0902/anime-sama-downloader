import DatabaseService from './DatabaseService.ts';
import { Database } from 'sqlite';
import axios from 'axios';

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || 'f0d7169306ed51b57773127b0a1ac7ec';

export interface Favorite {
    id: number;
    user_id: number;
    anime_name: string;
    anime_url: string;
    mal_id: number | null;
    is_ongoing: boolean;
    last_episode_downloaded: number;
    last_checked: string | null;
    created_at: string;
}

export interface MALAnimeStatus {
    id: number;
    status: string;
    num_episodes: number;
}

class FavoriteService {
    private db: Database<any, any> | null;

    constructor() {
        this.db = null;
    }

    private getDb(): Database<any, any> {
        if (!this.db) {
            this.db = DatabaseService.getDb();
        }
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        return this.db;
    }

    async addFavorite(
        userId: number,
        animeName: string,
        animeUrl: string,
        malId?: number
    ): Promise<Favorite> {
        const db = this.getDb();
        
        let isOngoing = false;
        if (malId) {
            try {
                const status = await this.getMALAnimeStatus(malId);
                isOngoing = status.status === 'currently_airing';
            } catch (error) {
                console.error('Error fetching MAL status:', error);
            }
        }

        const result = await db.run(
            `INSERT INTO favorites (user_id, anime_name, anime_url, mal_id, is_ongoing, last_checked)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [userId, animeName, animeUrl, malId || null, isOngoing ? 1 : 0]
        );

        const favorite = await db.get<Favorite>(
            'SELECT * FROM favorites WHERE id = ?',
            [result.lastID]
        );

        if (!favorite) {
            throw new Error('Failed to add favorite');
        }

        return favorite;
    }

    async removeFavorite(userId: number, favoriteId: number): Promise<void> {
        const db = this.getDb();
        
        const result = await db.run(
            'DELETE FROM favorites WHERE id = ? AND user_id = ?',
            [favoriteId, userId]
        );

        if (!result.changes || result.changes === 0) {
            throw new Error('Favorite not found or access denied');
        }
    }

    async getUserFavorites(userId: number): Promise<Favorite[]> {
        const db = this.getDb();
        
        return await db.all<Favorite[]>(
            'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }

    async getOngoingFavorites(): Promise<Favorite[]> {
        const db = this.getDb();
        
        return await db.all<Favorite[]>(
            `SELECT * FROM favorites 
             WHERE is_ongoing = 1 
             AND mal_id IS NOT NULL
             ORDER BY last_checked ASC`
        );
    }

    async updateLastEpisode(favoriteId: number, episodeNumber: number): Promise<void> {
        const db = this.getDb();
        
        await db.run(
            `UPDATE favorites 
             SET last_episode_downloaded = ?, last_checked = datetime('now')
             WHERE id = ?`,
            [episodeNumber, favoriteId]
        );
    }

    async updateLastChecked(favoriteId: number): Promise<void> {
        const db = this.getDb();
        
        await db.run(
            `UPDATE favorites 
             SET last_checked = datetime('now')
             WHERE id = ?`,
            [favoriteId]
        );
    }

    async getMALAnimeStatus(malId: number): Promise<MALAnimeStatus> {
        try {
            const response = await axios.get(
                `https://api.myanimelist.net/v2/anime/${malId}`,
                {
                    headers: {
                        'X-MAL-Client-ID': MAL_CLIENT_ID
                    },
                    params: {
                        fields: 'status,num_episodes'
                    }
                }
            );

            return {
                id: response.data.id,
                status: response.data.status,
                num_episodes: response.data.num_episodes
            };
        } catch (error: any) {
            console.error(`Error fetching MAL anime ${malId}:`, error.message);
            throw error;
        }
    }

    async searchMAL(query: string): Promise<any[]> {
        try {
            const response = await axios.get(
                'https://api.myanimelist.net/v2/anime',
                {
                    headers: {
                        'X-MAL-Client-ID': MAL_CLIENT_ID
                    },
                    params: {
                        q: query,
                        limit: 10
                    }
                }
            );

            return response.data.data.map((item: any) => ({
                id: item.node.id,
                title: item.node.title,
                status: item.node.status
            }));
        } catch (error: any) {
            console.error('Error searching MAL:', error.message);
            throw error;
        }
    }
}

export default new FavoriteService();