import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft, Bell, ChevronDown, Clock3, FileImage, FileText, Heart, Home,
  Languages, LogOut, Menu, Moon, Settings, Sun, X,
} from 'lucide-react';
import Brand from './Brand.jsx';
import LogoutConfirmDialog from './LogoutConfirmDialog.jsx';
import api from '../lib/api.js';

const laterNav = [
  { icon: FileImage, label: 'Image translator', to: '/translate/image', key: 'image' },
  { icon: Languages, label: 'Text translator', to: '/translate/text', key: 'text' },
  { icon: Clock3, label: 'History', to: '/history', key: 'history' },
  { icon: Heart, label: 'Favorites', to: '/favorites', key: 'favorites' },
  { icon: Settings, label: 'Settings', to: '/settings', key: 'settings' },
];

export default function WorkspaceLayout({ children, active = 'dashboard', dark, setDark, user, onLogout, searchValue = '', onSearch, searchPlaceholder = 'Search translations' }) {
  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'T';
  const accountRef = useRef(null);
  const searchRef = useRef(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchValue || '');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  function requestLogout() {
    setAccountOpen(false);
    setMobileNavOpen(false);
    setLogoutConfirmOpen(true);
  }

  async function confirmLogout() {
    await onLogout?.();
    setLogoutConfirmOpen(false);
  }

  useEffect(() => {
    function handleDocumentEvent(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setAccountOpen(false);
        setSearchOpen(false);
      }
      if (event.type === 'pointerdown' && !accountRef.current?.contains(event.target)) setAccountOpen(false);
      if (event.type === 'pointerdown' && !searchRef.current?.contains(event.target)) setSearchOpen(false);
    }
    document.addEventListener('pointerdown', handleDocumentEvent);
    document.addEventListener('keydown', handleDocumentEvent);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentEvent);
      document.removeEventListener('keydown', handleDocumentEvent);
    };
  }, []);

  useEffect(() => {
    if (onSearch) setSearchQuery(searchValue || '');
  }, [onSearch, searchValue]);

  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await api.get('/translations/jobs', { params: { search: term } });
        if (active) setSearchResults(data.jobs || []);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar${mobileNavOpen ? ' mobile-nav-open' : ''}`}>
        <div className="dashboard-brand"><Brand /><p className="dashboard-tagline">Translate everything.</p></div>
        <div className="mobile-sidebar-actions">
          <button className="mobile-theme-toggle" type="button" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title={`Switch to ${dark ? 'light' : 'dark'} mode`}>
            {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
          </button>
          <button className="workspace-menu-toggle" type="button" onClick={() => setMobileNavOpen((open) => !open)} aria-expanded={mobileNavOpen} aria-label={mobileNavOpen ? 'Close workspace menu' : 'Open workspace menu'}>
            {mobileNavOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace navigation" onClick={() => setMobileNavOpen(false)}>
          <Link to="/" className="side-link mobile-back-home"><ArrowLeft size={17} /><span>Back to home</span></Link>
          <NavLink to="/dashboard" className={`side-link${active === 'dashboard' ? ' selected' : ''}`}><Home size={17} /><span>Dashboard</span></NavLink>
          <NavLink to="/translate/document" className={`side-link${active === 'document' ? ' selected' : ''}`}><FileText size={17} /><span>Document translator</span></NavLink>
          {laterNav.map(({ icon: Icon, label, to, key }) => to
            ? <NavLink to={to} end className={`side-link side-link-${key}${active === key ? ' selected' : ''}`} key={label}><Icon size={17} /><span>{label}</span></NavLink>
            : <button className="side-link side-link-disabled" key={label} type="button" disabled title={`${label} will be available in a later step`}><Icon size={17} /><span>{label}</span><span className="soon-mark">Soon</span></button>)}
          <div className="mobile-account-card">
            <div className="account-dropdown-user"><b>{user?.name || 'Transly'}</b><span>{user?.email || 'Workspace account'}</span></div>
            <button className="account-logout" type="button" onClick={requestLogout}><LogOut size={16} /> Log out</button>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <button className="theme-switch-row" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}>
            <span className="theme-switch-icons">{dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}</span>
            <span>{dark ? 'Dark mode' : 'Light mode'}</span>
            <span className={`switch-track${dark ? ' on' : ''}`}><span /></span>
          </button>
          <div className="sidebar-profile"><span className="profile-avatar">{initials}</span><span><b>{user?.name || 'Transly'}</b><small>{user?.email || 'Workspace'}</small></span></div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-search-wrap" ref={searchRef}>
            <label className="dashboard-search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input aria-label="Search translations" placeholder={searchPlaceholder} value={searchQuery} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearchQuery(event.target.value); onSearch?.(event.target.value); setSearchOpen(true); }} /></label>
            {searchOpen && searchQuery.trim().length >= 2 && <div className="translation-search-results" role="listbox" aria-label="Translation search results">
              {searchLoading ? <p className="translation-search-message">Searching your translations…</p> : searchResults.length ? <>{searchResults.map((job) => <Link className="translation-search-result" key={job.id} to={job.status === 'completed' ? `/translation/${job.id}/result` : `/translation/${job.id}`} onClick={() => setSearchOpen(false)}><span className="translation-search-result-copy"><b title={job.originalFileName}>{job.originalFileName}</b><small>{job.sourceLanguage || 'auto'} → {job.targetLanguage || '—'} · {new Date(job.createdAt).toLocaleDateString()}</small></span><span className={`translation-search-status status-${job.status}`}>{job.status}</span></Link>)}<Link className="translation-search-all" to="/history" onClick={() => setSearchOpen(false)}>Open translation history <span>→</span></Link></> : <p className="translation-search-message">No matching translations found.</p>}
            </div>}
          </div>
          <div className="topbar-right">
            <Link className="preview-pill dashboard-home-link" to="/" aria-label="Back to the home page"><ArrowLeft size={14} />Back to home</Link>
            <button className="icon-button" type="button" disabled title="Notifications are not available yet" aria-label="Notifications"><Bell size={18} /></button>
            <div className="account-menu" ref={accountRef}>
              <button className="account-trigger" type="button" aria-expanded={accountOpen} aria-haspopup="true" onClick={() => setAccountOpen((open) => !open)}>
                <span className="topbar-avatar">{initials}</span><span className="topbar-name">{user?.name || 'Transly workspace'}</span><ChevronDown size={15} className={`account-chevron${accountOpen ? ' is-open' : ''}`} />
              </button>
              {accountOpen && <div className="account-dropdown"><div className="account-dropdown-user"><b>{user?.name || 'Transly'}</b><span>{user?.email || 'Workspace account'}</span></div><button className="account-logout" type="button" onClick={requestLogout}><LogOut size={16} /> Log out</button></div>}
            </div>
          </div>
        </header>
        {children}
      </div>
      <LogoutConfirmDialog open={logoutConfirmOpen} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={confirmLogout} />
    </div>
  );
}
