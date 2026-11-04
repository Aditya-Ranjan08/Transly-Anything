import mongoose from 'mongoose';

export function isDatabaseUnavailable(error) {
  return mongoose.connection.readyState !== 1
    || /^(Mongo|Mongoose)/.test(error?.name || '')
    || /buffering timed out|topology was destroyed|connection.*closed/i.test(error?.message || '');
}

export function sendDatabaseUnavailable(res, error) {
  if (!isDatabaseUnavailable(error)) return false;
  res.status(503).json({ message: 'The database is temporarily unavailable. Please retry shortly.' });
  return true;
}
