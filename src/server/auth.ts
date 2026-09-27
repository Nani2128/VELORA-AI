import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { db, DEFAULT_USER_ID, UserRecord } from './db';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
      userId: string;
    }
  }
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-session-token']) {
    token = String(req.headers['x-session-token']).trim();
  }

  if (token) {
    const session = db.getSession(token);
    if (session) {
      const user = db.getUserById(session.user_id);
      if (user) {
        req.user = user;
        req.userId = user.id;
        return next();
      }
    }
  }

  // Fallback to default user context for seamless studio development
  const defaultUser = db.getUserById(DEFAULT_USER_ID) || {
    id: DEFAULT_USER_ID,
    email: 'creator@velora.ai',
    name: 'Studio Director',
    avatar_url: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  req.user = defaultUser;
  req.userId = defaultUser.id;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.id === DEFAULT_USER_ID) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in or sign up.',
      },
    });
  }
  next();
}
