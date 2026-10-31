import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePassword, currentUser, login, logout, register, updatePreferences } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import requireDatabase from '../middleware/requireDatabase.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } });

router.post('/register', authLimiter, requireDatabase, register);
router.post('/login', authLimiter, requireDatabase, login);
router.patch('/password', authLimiter, requireDatabase, requireAuth, changePassword);
router.patch('/preferences', requireDatabase, requireAuth, updatePreferences);
router.post('/logout', logout);
router.get('/me', requireDatabase, requireAuth, currentUser);

export default router;
