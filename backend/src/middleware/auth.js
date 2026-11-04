import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

function isLocalOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'http:') return false;
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
    const octets = host.split('.');
    if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
    const [first, second] = octets.map(Number);
    return first === 127
      || first === 10
      || (first === 192 && second === 168)
      || (first === 172 && second >= 16 && second <= 31);
  } catch {
    return false;
  }
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
    const user = await User.findById(payload.sub).select('name email preferredLanguage createdAt isVerified');
    if (!user) return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
    if (!user.isVerified) return res.status(403).json({ message: 'Verify your email address before continuing.' });
    req.user = user;
    next();
  } catch (error) {
    if (mongoose.connection.readyState !== 1 || error.name?.startsWith('Mongo') || error.name?.startsWith('Mongoose')) {
      return res.status(503).json({ message: 'The database is temporarily unavailable. Please retry shortly.' });
    }
    res.clearCookie('transly_token', authCookieOptions(req));
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}
