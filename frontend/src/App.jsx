import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, FileImage,
  FileText, Globe2, Languages, LayoutDashboard, LogIn, LogOut, Menu, Moon, ScanText,
  ShieldCheck, Sparkles, Sun, X,
} from 'lucide-react';
import Brand from './components/Brand.jsx';
import LogoutConfirmDialog from './components/LogoutConfirmDialog.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import { useAuth } from './features/auth/AuthContext.jsx';

const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const DocumentTranslatorPage = lazy(() => import('./pages/DocumentTranslatorPage.jsx'));
const ImageTranslatorPage = lazy(() => import('./pages/ImageTranslatorPage.jsx'));
const TextTranslatorPage = lazy(() => import('./pages/TextTranslatorPage.jsx'));
const TranslationProcessingPage = lazy(() => import('./pages/TranslationProcessingPage.jsx'));
const TranslationResultPage = lazy(() => import('./pages/TranslationResultPage.jsx'));
const TranslationLibraryPage = lazy(() => import('./pages/TranslationLibraryPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const AuthPage = lazy(() => import('./features/auth/AuthPage.jsx'));
const MotionLink = motion.create(Link);

const features = [
  { icon: FileText, title: 'PDF translation', text: 'Translate selectable text in a clean, readable document.' },
  { icon: ScanText, title: 'Text recognition', text: 'Extract text from clear JPG, PNG and WebP images before translation.' },
  { icon: FileImage, title: 'Image translation', text: 'Read text from an image and review the translated result.' },
  { icon: Languages, title: 'Languages that fit', text: 'Start with English, Hindi, Spanish and French as providers become available.' },
  { icon: ShieldCheck, title: 'Your files, handled carefully', text: 'Private processing, clear file limits and temporary file cleanup.' },
  { icon: ArrowDownRight, title: 'Simple downloads', text: 'Get a readable result you can save and share.' },
];

const tools = [
  { icon: FileText, number: '01', title: 'Translate a PDF', detail: 'Upload a document and get a readable translation', href: '/translate/document', tone: 'violet' },
  { icon: FileImage, number: '02', title: 'Images', detail: 'JPG, PNG and screenshots', href: '/translate/image', tone: 'coral' },
  { icon: Languages, number: '03', title: 'Text', detail: 'Short passages and everyday phrases', href: '/translate/text', tone: 'lime' },
];

function LandingPage({ dark, setDark, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const accountRef = useRef(null);
  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'T';

  const closeMenu = () => setMenuOpen(false);
  const handleLogout = () => {
    setAccountOpen(false);
    closeMenu();
    setLogoutConfirmOpen(true);
  };
  const confirmLogout = async () => {
    await onLogout?.();
    setLogoutConfirmOpen(false);
  };
  const navItems = [
    ['Translate', '#quick-translator'],
    ['Features', '#features'],
    ['How it works', '#how-it-works'],
  ];

  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const marker = window.scrollY + Math.min(window.innerHeight * 0.28, 190);
        let current = 'home';
        ['quick-translator', 'features', 'how-it-works'].forEach((id) => {
          const section = document.getElementById(id);
          if (section && section.getBoundingClientRect().top + window.scrollY <= marker) current = id;
        });
        setActiveNav(current);
      });
    };
    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') setAccountOpen(false);
      if (event.type === 'pointerdown' && !accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener('pointerdown', closeAccountMenu);
    document.addEventListener('keydown', closeAccountMenu);
    return () => {
      document.removeEventListener('pointerdown', closeAccountMenu);
      document.removeEventListener('keydown', closeAccountMenu);
    };
  }, []);

  return (
    <div className="site-shell" id="home">
      <header className="site-header">
        <div className="nav-wrap">
          <Brand />
          <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <a className={activeNav === 'home' ? 'is-active' : ''} aria-current={activeNav === 'home' ? 'location' : undefined} href="#home" onClick={closeMenu}>Home</a>
            {navItems.map(([label, href]) => <a className={activeNav === href.slice(1) ? 'is-active' : ''} aria-current={activeNav === href.slice(1) ? 'location' : undefined} key={label} href={href} onClick={closeMenu}>{label}</a>)}
            {user ? <>
              <div className="mobile-account-summary"><span className="landing-account-avatar">{initials}</span><span><b>{user.name || 'Transly account'}</b><small>{user.email}</small></span></div>
              <Link className="mobile-nav-login" to="/dashboard" onClick={closeMenu}><LayoutDashboard size={16} /> Go to dashboard</Link>
              <button className="mobile-nav-cta mobile-nav-logout" type="button" onClick={() => void handleLogout()}><LogOut size={16} /> Log out</button>
            </> : <>
              <Link className="mobile-nav-login" to="/login" onClick={closeMenu}><LogIn size={16} /> Log in</Link>
            </>}
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title={`Switch to ${dark ? 'light' : 'dark'} mode`}>
              {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            {user ? <div className="landing-account-menu" ref={accountRef}>
              <button className="landing-account-trigger" type="button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>
                <span className="landing-account-avatar">{initials}</span><span className="landing-account-name">{user.name || 'Your account'}</span><ChevronDown size={16} className={accountOpen ? 'is-open' : ''} />
              </button>
              {accountOpen && <div className="landing-account-dropdown" role="menu">
                <div className="landing-account-details"><b>{user.name || 'Transly account'}</b><span>{user.email}</span></div>
                <Link to="/dashboard" role="menuitem" onClick={() => setAccountOpen(false)}><LayoutDashboard size={17} /> Go to dashboard</Link>
                <button type="button" role="menuitem" onClick={() => void handleLogout()}><LogOut size={17} /> Log out</button>
              </div>}
            </div> : <>
              <Link className="login-link" to="/login"><LogIn size={16} /> Log in</Link>
            </>}
          </div>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero section-wrap">
          <motion.div className="hero-copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }}>
            <div className="eyebrow"><Sparkles size={14} /> Documents, images & text</div>
            <h1>Words travel.<br /><span>Meaning stays.</span></h1>
            <p className="hero-description">Understand your documents in another language. Transly is being built to make translation feel clear, careful and easy.</p>
            <div className="hero-actions">
              {user
                ? <Link className="button button-primary hero-dashboard-button" to="/dashboard">Go to dashboard <ArrowRight size={16} /></Link>
                : <Link className="button button-primary" to="/register">Get started <ArrowUpRight size={16} /></Link>}
            </div>
            <div className="trust-note"><span className="trust-icon"><Check size={13} /></span> Designed for readable results, not just word swaps</div>
          </motion.div>

          <motion.div className="hero-art" aria-label="Illustration of a document being translated" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }}>
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <div className="floating-chip chip-left"><Languages size={17} /><span>Hello <ArrowRight size={12} /> नमस्ते</span></div>
            <div className="floating-chip chip-right"><span className="live-dot" /> Meaning, carried over</div>
            <div className="translation-preview preview-left" aria-hidden="true"><div className="preview-card-top"><i /><b /></div><div className="preview-green-block"><i /><i /><i /></div><div className="preview-card-lines"><i /><i /><i /></div></div>
            <div className="translation-preview preview-right" aria-hidden="true"><div className="preview-card-top"><i /><b /></div><div className="preview-translate-row"><span /><i /><i /></div><div className="preview-card-lines"><i /><i /><i /><i /></div></div>
            <div className="paper-card">
              <div className="paper-top"><span className="file-badge"><FileText size={18} /></span><div><strong>Quarterly overview</strong><small>PDF document · 8 pages</small></div><span className="more-dots">•••</span></div>
              <div className="paper-languages"><span><i className="language-dot">EN</i> English</span><ArrowRight size={16} /><span><i className="language-dot hindi">हि</i> Hindi</span></div>
              <div className="paper-content">
                <div className="paper-heading" /><div className="paper-line long" /><div className="paper-line" />
                <div className="translated-block"><span className="translated-mark"><Check size={12} /></span><div className="paper-line long" /><div className="paper-line short" /></div>
                <div className="paper-line medium" /><div className="paper-line long" />
              </div>
              <div className="paper-footer"><span><Sparkles size={13} /> Clear translation, page by page</span><span className="footer-arrow"><ArrowRight size={14} /></span></div>
            </div>
            <div className="art-caption">One document.<br /><b>A little more understood.</b></div>
            <span className="sparkle sparkle-a">✳</span><span className="sparkle sparkle-b">✦</span>
          </motion.div>
        </section>

        <section className="tools-section section-wrap" id="quick-translator">
          <div className="section-heading heading-row">
            <div><span className="section-kicker">Start here</span><h2>Translate your PDF</h2></div>
            <span className="heading-aside">You can also translate an image or some text.</span>
          </div>
          <div className="tool-grid">
            {tools.map(({ icon: Icon, number, title, detail, href, tone }) => (
              <MotionLink className={`tool-card tone-${tone}`} to={href} key={title} whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
                <div className="tool-card-top"><span className="tool-icon"><Icon size={21} strokeWidth={1.8} /></span><span className="tool-number">{number}</span></div>
                <div className="tool-card-bottom"><div><h3>{title}</h3><p>{detail}</p></div><span className="round-arrow"><ArrowUpRight size={17} /></span></div>
              </MotionLink>
            ))}
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="section-wrap features-wrap">
            <div className="section-heading centered"><span className="section-kicker">Thoughtfully made</span><h2>Translation that feels more human.</h2><p>Useful tools, clear expectations and a result you can actually read.</p></div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, title, text }, index) => <article className="feature-card" key={title}><span className={`feature-icon feature-${index}`}><Icon size={19} strokeWidth={1.8} /></span><h3>{title}</h3><p>{text}</p></article>)}
            </div>
            <div className="language-strip" id="languages">
              <div className="language-intro"><Globe2 size={18} /><span><b>Languages we’re building for</b><small>Start with English and Hindi, with more languages planned.</small></span></div>
              <div className="language-pills"><span>English</span><span>हिन्दी</span><span>Español</span><span>Français</span></div>
            </div>
          </div>
        </section>

        <section className="steps-section section-wrap" id="how-it-works">
          <div className="section-heading centered"><span className="section-kicker">No steep learning curve</span><h2>Three steps. Clearer understanding.</h2><p>We’re building a simple flow from your file to a readable translation.</p></div>
          <div className="steps-grid">
            <article className="step"><span className="step-number">01</span><span className="step-icon"><FileText size={21} /></span><h3>Add your content</h3><p>Choose a PDF, image or text to get started.</p></article>
            <div className="step-connector"><ArrowRight size={18} /></div>
            <article className="step"><span className="step-number">02</span><span className="step-icon"><Languages size={21} /></span><h3>Choose languages</h3><p>Select a supported source and target language.</p></article>
            <div className="step-connector"><ArrowRight size={18} /></div>
            <article className="step"><span className="step-number">03</span><span className="step-icon"><Sparkles size={21} /></span><h3>Read and save</h3><p>Review the result, then download when it’s ready.</p></article>
          </div>
          <div className="format-note"><span className="format-label">Translate these formats now</span><span className="format-types"><span><FileText size={15} /> PDF</span><span><FileImage size={15} /> JPG</span><span><FileImage size={15} /> PNG</span><span><Languages size={15} /> Text</span></span></div>
        </section>

        <section className="closing-cta section-wrap" id="account">
          <div className="cta-orb"><Sparkles size={23} /></div>
          <div><span className="section-kicker">A new perspective is close</span><h2>Make every word go further.</h2><p>Create your workspace and keep your translation journey in one place.</p></div>
          <Link className="button button-light" to="/register">Create your account <ArrowRight size={16} /></Link>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner section-wrap">
          <div className="footer-brand"><Brand /><p>Translate anything.<br />Understand everything.</p><span className="footer-note">A clearer way to understand every document.</span></div>
          <div className="footer-links">
            <div><b>Explore</b><a href="#features">Features & languages</a><a href="#how-it-works">How it works</a><a href="#quick-translator">Translate a file</a></div>
            <div><b>Your workspace</b>{user ? <><Link to="/dashboard">Go to dashboard</Link><button type="button" onClick={() => void handleLogout()}>Log out</button></> : <><Link to="/register">Create an account</Link><Link to="/login">Log in</Link></>}<a href="#home">Back to top</a></div>
          </div>
          <div className="footer-bottom"><span>© 2026 Transly. All rights reserved. Made by Ranjan.</span><span>Made for a world with more than one language.</span></div>
        </div>
      </footer>
      <LogoutConfirmDialog open={logoutConfirmOpen} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={confirmLogout} />
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('transly-theme') === 'dark');
  const { user, logout, syncUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('transly-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <Suspense fallback={<main className="auth-loading"><span className="auth-spinner" /><p>Preparing your workspace…</p></main>}>
      <Routes>
        <Route path="/" element={<LandingPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" dark={dark} setDark={setDark} />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" dark={dark} setDark={setDark} />} />
        <Route path="/forgot-password" element={<AuthPage key="forgot-password" mode="forgot-password" dark={dark} setDark={setDark} />} />
        <Route path="/reset-password" element={<AuthPage key="reset-password" mode="reset-password" dark={dark} setDark={setDark} />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/translate/document" element={<RequireAuth><DocumentTranslatorPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/translate/image" element={<RequireAuth><ImageTranslatorPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/translate/text" element={<RequireAuth><TextTranslatorPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/translation/:id" element={<RequireAuth><TranslationProcessingPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/translation/:id/result" element={<RequireAuth><TranslationResultPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><TranslationLibraryPage mode="history" dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/favorites" element={<RequireAuth><TranslationLibraryPage mode="favorites" dark={dark} setDark={setDark} user={user} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage dark={dark} setDark={setDark} user={user} syncUser={syncUser} onLogout={handleLogout} /></RequireAuth>} />
        <Route path="*" element={<LandingPage dark={dark} setDark={setDark} user={user} onLogout={handleLogout} />} />
      </Routes>
    </Suspense>
  );
}
