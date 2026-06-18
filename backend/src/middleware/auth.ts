import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthPayload } from '../services/auth.service';

// Extend Express Request to carry the decoded token payload
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Verifies the Bearer token and attaches the decoded payload to req.user. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/** Like requireAuth but only attaches the user if a valid token is present.
 *  Non-authenticated requests pass through without error. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      // Silently ignore invalid optional tokens
    }
  }
  next();
}
