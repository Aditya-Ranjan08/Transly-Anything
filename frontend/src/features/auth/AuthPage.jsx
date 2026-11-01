import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, FileText, Globe2, Languages, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import Brand from '../../components/Brand.jsx';
import { useAuth } from './AuthContext.jsx';

export default function AuthPage({ mode, dark, setDark }) {
  const isRegister = mode === 'register';
  const { user, loading: authLoading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (isRegister && name.trim().length < 2) return setError('Please enter your name (at least 2 characters).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) return setError('Use at least 8 characters and no more than 72 UTF-8 bytes for your password.');
    if (isRegister && password !== confirmPassword) return setError('Those passwords do not match.');

    setSubmitting(true);
    try {
      if (isRegister) await register({ name: name.trim(), email: email.trim(), password });
      else await login({ email: email.trim(), password });
      const target = location.state?.from?.pathname;
      navigate(target && target !== '/login' && target !== '/register' ? target : '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not reach Transly. Start the backend and check its database settings, then try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-story-top"><Brand /><button className="auth-theme-toggle" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button></div>
        <div className="auth-story-copy">
          <span className="auth-eyebrow"><Sparkles size={14} /> A clearer way to understand</span>
          <h1>Good words<br />go <span>everywhere.</span></h1>
          <p>Keep your documents and ideas close, even when the language changes.</p>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-art-halo" />
            <div className="auth-art-paper paper-one"><span className="auth-art-icon"><FileText size={19} /></span><b>Project notes</b><i /><i /><i /><span className="auth-art-check"><Check size={13} /></span></div>
            <div className="auth-art-paper paper-two"><span className="paper-language">EN <ArrowRight size={12} /> à¤¹à¤¿à¤¨à¥à¤¦à¥€</span><i /><i /><i /></div>
            <span className="auth-art-float float-globe"><Globe2 size={19} /></span><span className="auth-art-float float-language"><Languages size={20} /></span><span className="auth-art-star">âœ¦</span>
          </div>
          <div className="auth-benefits"><span><ShieldCheck size={15} /> Private workspace</span><span><Check size={15} /> Your own translation history</span></div>
        </div>
        <div className="auth-story-footer"><span>Â© 2026 Transly</span><span>Made for meaning.</span></div>
      </section>

      <section className="auth-form-side">
        <Link className="auth-back-link" to="/"><ArrowLeft size={15} /> Back to home</Link>
        <motion.div className="auth-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
          <div className="auth-card-brand"><Brand /></div>
          <span className="auth-card-kicker">{isRegister ? 'YOUR TRANSLATION SPACE' : 'WELCOME BACK'}</span>
          <h2>{isRegister ? 'Create your account' : 'Log in to Transly'}</h2>
          <p className="auth-card-description">{isRegister ? 'Start with a free account. Your workspace is ready when you are.' : 'Pick up where you left off and continue your translation journey.'}</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isRegister && <div className="auth-field"><label htmlFor="auth-name">Your name</label><input className="auth-control" id="auth-name" name="name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="e.g. Aanya Sharma" maxLength={60} required /></div>}
            <div className="auth-field"><label htmlFor="auth-email">Email address</label><input className="auth-control" id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} placeholder="you@example.com" maxLength={254} required /></div>
            <div className="auth-field"><label htmlFor="auth-password">Password</label><div className="password-input"><input className="auth-password-control" id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.currentTarget.value)} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} maxLength={72} required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            {isRegister && <div className="auth-field"><label htmlFor="auth-confirm-password">Confirm password</label><div className="password-input"><input className="auth-password-control" id="auth-confirm-password" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.currentTarget.value)} placeholder="Enter your password again" maxLength={72} required /><button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={submitting || authLoading} aria-busy={submitting}>{submitting ? <><span className="button-spinner" /> {isRegister ? 'Creating account…' : 'Logging in…'}</> : <>{isRegister ? 'Create account' : 'Log in'} <ArrowRight size={17} /></>}</button>
          </form>

          <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Transly?'} <Link to={isRegister ? '/login' : '/register'} state={location.state}>{isRegister ? 'Log in' : 'Create an account'}</Link></p>
          <div className="auth-secure-note"><ShieldCheck size={14} /> Passwords are hashed before they are stored.</div>
        </motion.div>
        <p className="auth-legal">By continuing, you agree to use Transly responsibly. <span>Your account data stays yours.</span></p>
      </section>
    </main>
  );
}
