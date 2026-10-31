import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import translationJobRoutes from './routes/translationJobRoutes.js';

const app = express();
app.use(helmet());
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim());
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
app.use((error, _req, res, _next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'This file is larger than the configured upload limit.' });
  }
  if (error.message === 'Choose a PDF file to continue.' || error.message === 'Choose a PNG, JPG, or WebP image to continue.') return res.status(400).json({ message: error.message });
  return res.status(error.status || 500).json({ message: error.status ? error.message : 'The request could not be completed.' });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'transly-api' }));

export default app;
