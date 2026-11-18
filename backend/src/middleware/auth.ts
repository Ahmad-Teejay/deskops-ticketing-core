import type { Request, Response, NextFunction } from 'express';
import jwt = require('jsonwebtoken');

export type AuthContext = {
  userId: string;
  organisationId: string;
  role: string;
};

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'Authentication is not configured' });
    return;
  }

  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });

    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.organisationId !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    (req as AuthenticatedRequest).auth = {
      userId: payload.sub,
      organisationId: payload.organisationId,
      role: payload.role,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = (req as AuthenticatedRequest).auth;

  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!auth.organisationId) {
    res.status(403).json({ error: 'Organisation is required' });
    return;
  }

  res.locals.organisationId = auth.organisationId;
  next();
}