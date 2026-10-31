import mongoose from 'mongoose';

const translationJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    translationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    originalFileName: { type: String, required: true, trim: true, maxlength: 255 },
    originalFilePath: { type: String, default: '' },
    originalTextPath: { type: String, default: '' },
    translatedTextPath: { type: String, default: '' },
    translatedFilePath: { type: String, default: '' },
    fileType: { type: String, enum: ['pdf', 'image', 'text'], required: true },
    fileSize: { type: Number, min: 0, default: 0 },
    sourceLanguage: { type: String, default: 'auto' },
    targetLanguage: { type: String, default: '' },
    totalPages: { type: Number, min: 0, default: 0 },
    completedPages: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    currentStage: { type: String, default: 'queued', maxlength: 80 },
    errorMessage: { type: String, default: '', maxlength: 500 },
    isFavorite: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('TranslationJob', translationJobSchema);
