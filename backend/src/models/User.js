import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    preferredLanguage: { type: String, default: 'en', trim: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    resetPasswordOtp: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
