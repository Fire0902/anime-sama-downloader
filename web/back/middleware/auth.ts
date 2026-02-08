import AuthService from '../services/AuthService.ts';

export interface AuthRequest {
    user?: {
        id: number;
        username: string;
        email: string;
        is_admin: boolean;
    };
}

export async function authMiddleware(req: any, res: any, next: any) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7); // Enlever "Bearer "
        const user = await AuthService.verifyToken(token);

        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
}

export async function adminMiddleware(req: any, res: any, next: any) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
}