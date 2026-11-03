import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePassword, currentUser, forgotPassword, login, logout, register, resetPassword, updatePreferences, verifyOtp } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import requireDatabase from '../middleware/requireDatabase.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } });

router.post('/register', authLimiter, requireDatabase, register);
router.post('/verify-otp', authLimiter, requireDatabase, verifyOtp);
router.post('/login', authLimiter, requireDatabase, login);
router.post('/forgot-password', authLimiter, requireDatabase, forgotPassword);
router.post('/reset-password', authLimiter, requireDatabase, resetPassword);
router.patch('/password', authLimiter, requireDatabase, requireAuth, changePassword);
router.patch('/preferences', requireDatabase, requireAuth, updatePreferences);
router.post('/logout', logout);
router.get('/me', requireDatabase, requireAuth, currentUser);

export default router;
