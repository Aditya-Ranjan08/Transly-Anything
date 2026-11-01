import jwt from 'jsonwebtoken';
import User from '../models/User.js';

function isLocalOrigin(origin) {
  return /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/i.test(origin || '');
}

function isLocalDevelopment(req) {
  if (req?.headers?.origin) return isLocalOrigin(req.headers.origin);

  const origins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return process.env.NODE_ENV === 'development'
    && origins.length > 0
    && origins.every(isLocalOrigin);
}

export const authCookieOptions = (req) => ({
  httpOnly: true,
  secure: !isLocalDevelopment(req),
  sameSite: isLocalDevelopment(req) ? 'lax' : 'none',
  path: '/api',
});

export async function requireAuth(req, res, next) {
  const token = req.cookies?.transly_token;
  if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
    return res.status(503).json({ message: 'Authentication is not configured on the server.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'transly-api' });
    const user = await User.findById(payload.sub).select('name email preferredLanguage createdAt');
    if (!user) return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
    req.user = user;
    next();
  } catch {
    res.clearCookie('transly_token', authCookieOptions(req));
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}
