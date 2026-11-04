import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import { recoverTranslationJobs } from './jobs/translationWorker.js';
import User from './models/User.js';

const port = Number(process.env.PORT) || 5000;
const server = app.listen(port, () => console.log(`Server listening on port ${port}`));
let shuttingDown = false;

mongoose.connection.on('connected', () => console.info('MongoDB connection established.'));
mongoose.connection.on('disconnected', () => console.warn('MongoDB connection lost; the driver will attempt to reconnect.'));
mongoose.connection.on('error', (error) => console.error(`MongoDB connection error (${error.name || 'unknown'}).`));

const wait = (milliseconds) => new Promise((resolve) => {
  const timer = setTimeout(resolve, milliseconds);
  timer.unref?.();
});

async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error('MONGODB_URI is not set. Authentication endpoints will return a configuration error.');
    return;
  }

  let retryDelay = 1000;
  while (!shuttingDown) {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
        });
      }
      const legacyAccounts = await User.updateMany(
        { isVerified: { $exists: false } },
        { $set: { isVerified: true } },
      );
      if (legacyAccounts.modifiedCount) {
        console.log(`Marked ${legacyAccounts.modifiedCount} existing account(s) as verified.`);
      }
      await recoverTranslationJobs();
      console.info('Database startup checks completed.');
      return;
    } catch (error) {
      console.error(`Database initialization failed (${error.name || 'unknown'}); retrying in ${Math.round(retryDelay / 1000)}s.`);
      await wait(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    }
  }
}

void connectDatabase();

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; closing the API server.`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref?.();
  server.close(() => {
    void mongoose.disconnect().finally(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
