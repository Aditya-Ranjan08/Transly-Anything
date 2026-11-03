import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import { recoverTranslationJobs } from './jobs/translationWorker.js';
import User from './models/User.js';

const port = Number(process.env.PORT) || 5000;

app.listen(port, () => console.log(`Server running on ${port}`));

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Authentication endpoints will return a configuration error.');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    const legacyAccounts = await User.updateMany(
      { isVerified: { $exists: false } },
      { $set: { isVerified: true } },
    );
    if (legacyAccounts.modifiedCount) {
      console.log(`Marked ${legacyAccounts.modifiedCount} existing account(s) as verified.`);
    }
    await recoverTranslationJobs();
  } catch {
    console.error('MongoDB connection failed. Check MONGODB_URI and network access.');
  }
}

connectDatabase();
