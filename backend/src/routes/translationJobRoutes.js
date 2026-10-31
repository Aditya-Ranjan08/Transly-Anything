import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import requireDatabase from '../middleware/requireDatabase.js';
import {
  cancelTranslationJob, createImageTranslationJob, createTextTranslationJob, createTranslationJob, deleteTranslationJob, getJobText, getTranslationCapabilities,
  getTranslationJob, listTranslationJobs, setJobFavorite, streamJobFile,
} from '../controllers/translationJobController.js';

const router = Router();
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(moduleDirectory, '../../storage/tmp/uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const maxFileSize = Math.max(1024, Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024);
const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter(_req, file, callback) {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') return callback(new Error('Choose a PDF file to continue.'));
    callback(null, true);
  },
});
const imageUpload = multer({
  dest: uploadDirectory,
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const supported = (extension === '.png' && file.mimetype === 'image/png')
      || (['.jpg', '.jpeg'].includes(extension) && file.mimetype === 'image/jpeg')
      || (extension === '.webp' && file.mimetype === 'image/webp');
    if (!supported) return callback(new Error('Choose a PNG, JPG, or WebP image to continue.'));
    callback(null, true);
  },
});

router.use(requireDatabase, requireAuth);
router.get('/capabilities', getTranslationCapabilities);
router.get('/jobs', listTranslationJobs);
router.post('/jobs', upload.single('document'), createTranslationJob);
router.post('/images', imageUpload.single('document'), createImageTranslationJob);
router.post('/text', createTextTranslationJob);
router.get('/jobs/:id', getTranslationJob);
router.get('/jobs/:id/text/:kind', getJobText);
router.get('/jobs/:id/preview/:kind', streamJobFile);
router.get('/jobs/:id/download/:kind', streamJobFile);
router.post('/jobs/:id/cancel', cancelTranslationJob);
router.delete('/jobs/:id', deleteTranslationJob);
router.patch('/jobs/:id/favorite', setJobFavorite);

export default router;
