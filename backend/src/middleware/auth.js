import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none',
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
    res.clearCookie('transly_token', authCookieOptions());
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}
