import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authCookieOptions } from '../middleware/auth.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt,
  };
}

function setSessionCookie(req, res, userId) {
  if (!isJwtSecretReady()) {
    const error = new Error('Authentication is not configured. Set JWT_SECRET to a random value with at least 32 characters.');
    error.status = 503;
    throw error;
  }
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: userId,
    issuer: 'transly-api',
    expiresIn: '7d',
  });
  res.cookie('transly_token', token, { ...authCookieOptions(req), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function isJwtSecretReady() {
  return Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && !process.env.JWT_SECRET.startsWith('replace-'));
}

export async function register(req, res) {
  if (!isJwtSecretReady()) return res.status(503).json({ message: 'Authentication is not configured. Set JWT_SECRET to a private random value of at least 32 characters.' });
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (name.length < 2 || name.length > 60) return res.status(400).json({ message: 'Name must be between 2 and 60 characters.' });
  if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ message: 'Password must be at least 8 characters and no longer than 72 UTF-8 bytes.' });

  try {
    const existing = await User.exists({ email });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists. Log in instead.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashedPassword });
    return res.status(201).json({ user: safeUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists. Log in instead.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: 'We could not create your account. Please try again.' });
  }
}

export async function login(req, res) {
  if (!isJwtSecretReady()) return res.status(503).json({ message: 'Authentication is not configured. Set JWT_SECRET to a private random value of at least 32 characters.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (email.length > 254 || !emailPattern.test(email) || !password) return res.status(400).json({ message: 'Enter a valid email and password.' });
  if (Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ message: 'Password must be no longer than 72 UTF-8 bytes.' });

  try {
    const user = await User.findOne({ email }).select('+password');
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    if (!passwordMatches) return res.status(401).json({ message: 'Email or password is incorrect.' });
    setSessionCookie(req, res, user.id);
    return res.json({ user: safeUser(user) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: 'We could not log you in. Please try again.' });
  }
}

export async function changePassword(req, res) {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!currentPassword || Buffer.byteLength(currentPassword, 'utf8') > 72) {
    return res.status(400).json({ message: 'Enter your current password.' });
  }
  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ message: 'Your new password must be at least 8 characters and no longer than 72 UTF-8 bytes.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'Choose a new password that is different from your current password.' });
  }

  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ message: 'Your account could not be found.' });
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) return res.status(401).json({ message: 'Your current password is incorrect.' });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return res.json({ message: 'Your password has been changed.' });
  } catch {
    return res.status(500).json({ message: 'We could not change your password. Please try again.' });
  }
}

export async function updatePreferences(req, res) {
  const preferredLanguage = typeof req.body?.preferredLanguage === 'string'
    ? req.body.preferredLanguage.trim().toLowerCase()
    : '';
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(preferredLanguage)) {
    return res.status(400).json({ message: 'Choose a valid preferred language.' });
  }
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { preferredLanguage }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'Your account could not be found.' });
    return res.json({ user: safeUser(user), message: 'Your language preference has been saved.' });
  } catch {
    return res.status(500).json({ message: 'We could not save your preference. Please try again.' });
  }
}

export function logout(req, res) {
  const cookieOptions = authCookieOptions(req);
  res.clearCookie('transly_token', cookieOptions);
  // Remove cookies issued before the session cookie covered all API routes.
  res.clearCookie('transly_token', { ...cookieOptions, path: '/api/auth' });
  return res.json({ message: 'You have been logged out.' });
}

export function currentUser(req, res) {
  // Refresh the verified session cookie at /api so protected translation routes receive it too.
  res.cookie('transly_token', req.cookies.transly_token, { ...authCookieOptions(req), maxAge: 7 * 24 * 60 * 60 * 1000 });
  return res.json({ user: safeUser(req.user) });
}
