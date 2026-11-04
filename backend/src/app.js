import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import translationJobRoutes from './routes/translationJobRoutes.js';
import { isDatabaseUnavailable } from './utils/databaseErrors.js';

const app = express();
app.use(helmet());
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'https://transly-anything-adi.vercel.app',
];
const allowedOrigins = [...new Set([
  ...defaultAllowedOrigins,
  ...(process.env.CLIENT_URL || '').split(','),
].map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean))];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    const key = part.slice(0, separator).trim();
    try { return [key, decodeURIComponent(part.slice(separator + 1).trim())]; }
    catch { return [key, '']; }
  }).filter(([key]) => key));
  next();
});
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));
app.use('/api/auth', authRoutes);
app.use('/api/translations', translationJobRoutes);
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'This file is larger than the configured upload limit.' });
  }
  if (error.name === 'MulterError') {
    return res.status(400).json({ message: 'The upload could not be read. Please choose the PDF again and retry.' });
  }
  if (error.message === 'Choose a PDF file to continue.' || error.message === 'Choose a PNG, JPG, or WebP image to continue.') return res.status(400).json({ message: error.message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body is invalid JSON.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: 'Some submitted values are invalid.' });
  if (error.name === 'CastError') return res.status(400).json({ message: 'A submitted identifier or value is invalid.' });
  if (error.code === 11000) return res.status(409).json({ message: 'A record with these details already exists.' });
  if (isDatabaseUnavailable(error)) {
    return res.status(503).json({ message: 'The database is temporarily unavailable. Please retry shortly.' });
  }
  if (error.message === 'Not allowed by CORS') return res.status(403).json({ message: 'This website is not allowed to access the API.' });
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status >= 500) console.error(`Unhandled API error (${error.name || 'unknown'}).`);
  return res.status(status).json({ message: status < 500 ? error.message : 'The request could not be completed. Please try again.' });
});

app.get('/api/health', (_req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const ready = database === 'connected';
  return res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'degraded', service: 'transly-api', database });
});

export default app;
