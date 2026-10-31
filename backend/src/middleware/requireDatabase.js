import mongoose from 'mongoose';

export default function requireDatabase(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'The database is not connected. Check MONGODB_URI in backend/.env.' });
  }
  next();
}
