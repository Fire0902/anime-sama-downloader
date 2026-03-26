import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import DatabaseService from './DatabaseService.ts';
import { Database } from 'sqlite';

const JWT_SECRET = process.env.JWT_SECRET || 'salut';
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

export interface User {
    id: number;
    username: string;
    email: string;
    is_admin: boolean;
    created_at: string;
}

export interface AuthToken {
    token: string;
    user: User;
}

class AuthService {
    private getDb(): Database {
        const db = DatabaseService.getDb();
        if (!db) {
            throw new Error('Database not initialized. Call DatabaseService.initialize() first.');
        }
        return db;
    }

    async register(username: string, email: string, password: string, isAdmin: boolean = false): Promise<User> {
        const db = this.getDb();
        
        const existingUser = await db.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            throw new Error('Username or email already exists');
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await db.run(
            'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
            [username, email, passwordHash, isAdmin ? 1 : 0]
        );

        const user = await db.get<User>(
            'SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?',
            [result.lastID]
        );

        if (!user) {
            throw new Error('Failed to create user');
        }

        return user;
    }

    async login(usernameOrEmail: string, password: string): Promise<AuthToken> {
        const db = this.getDb();
        
        const user = await db.get(
            `SELECT id, username, email, password_hash, is_admin, created_at 
             FROM users 
             WHERE username = ? OR email = ?`,
            [usernameOrEmail, usernameOrEmail]
        );

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, isAdmin: user.is_admin },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.run(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, token, expiresAt.toISOString()]
        );

        await this.cleanExpiredSessions();

        const userResponse: User = {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.is_admin,
            created_at: user.created_at
        };

        return { token, user: userResponse };
    }

    async verifyToken(token: string): Promise<User | null> {
        try {
            const db = this.getDb();
            
            const decoded = jwt.verify(token, JWT_SECRET) as any;

            const session = await db.get(
                `SELECT s.*, u.id, u.username, u.email, u.is_admin, u.created_at
                 FROM sessions s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.token = ? AND s.expires_at > datetime('now')`,
                [token]
            );

            if (!session) {
                return null;
            }

            return {
                id: session.id,
                username: session.username,
                email: session.email,
                is_admin: session.is_admin,
                created_at: session.created_at
            };
        } catch (error) {
            return null;
        }
    }

    async logout(token: string): Promise<void> {
        const db = this.getDb();
        await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    }

    async deleteUser(userId: number): Promise<void> {
        const db = this.getDb();
        await db.run('DELETE FROM users WHERE id = ?', [userId]);
    }

    async getAllUsers(): Promise<User[]> {
        const db = this.getDb();
        return await db.all<User[]>(
            'SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC'
        );
    }

    private async cleanExpiredSessions(): Promise<void> {
        const db = this.getDb();
        await db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
    }

    async getUserById(userId: number): Promise<User | undefined> {
        const db = this.getDb();
        return await db.get<User>(
            'SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?',
            [userId]
        );
    }
}

export default new AuthService();