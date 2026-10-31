import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    preferredLanguage: { type: String, default: 'en', trim: true },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
