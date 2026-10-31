import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, Clock3, FileImage, FileText, Globe2, Languages,
  ShieldCheck, Sparkles, Star, WandSparkles,
} from 'lucide-react';
import Brand from '../components/Brand.jsx';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import api from '../lib/api.js';

export default function DashboardPage({ dark, setDark, user, onLogout }) {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, favorites: 0, documents: 0, images: 0, texts: 0 });
  const [historyError, setHistoryError] = useState('');
  const [capabilities, setCapabilities] = useState({ languages: [], reachable: false, providers: [] });
  useEffect(() => {
    let active = true;
    api.get('/translations/jobs').then(({ data }) => {
      if (!active) return;
      setJobs(data.jobs || []);
      setStats(data.stats || { total: 0, completed: 0, favorites: 0, documents: 0, images: 0, texts: 0 });
    }).catch((error) => {
      if (active) setHistoryError(error.response?.data?.message || 'Recent translations are unavailable right now.');
    });
    api.get('/translations/capabilities').then(({ data }) => {
      if (active) setCapabilities(data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const recentJobs = useMemo(() => jobs.filter((job) => !query || job.originalFileName.toLowerCase().includes(query.toLowerCase())).slice(0, 5), [jobs, query]);

  return (
    <WorkspaceLayout active="dashboard" dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchValue={query} onSearch={setQuery}>
        <main className="dashboard-content">
          <motion.section className="welcome-banner" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42 }}>
            <div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={14} /> YOUR TRANSLATION SPACE</span><h1>Welcome to Transly<span>.</span></h1><p>Bring your documents, images and ideas a little closer.</p><a className="welcome-link" href="#quick-actions">Explore your workspace <ArrowRight size={15} /></a></div>
            <div className="welcome-illustration" aria-hidden="true">
              <div className="illus-halo" />
              <div className="illus-card illus-card-back"><span>नमस्ते</span><i /><i /><i /></div>
              <div className="illus-card illus-card-front"><span className="illus-file"><FileText size={18} /></span><b>Words, understood.</b><i /><i /><div className="illus-check"><Check size={13} /></div></div>
              <span className="illus-floating float-one">Aa</span><span className="illus-floating float-two"><Languages size={18} /></span>
              <span className="illus-sparkle">✦</span>
            </div>
          </motion.section>

          <section className="dashboard-section quick-actions" id="quick-actions">
            <div className="dashboard-section-title"><div><span className="section-kicker">GET STARTED</span><h2>Choose what to translate</h2></div><span className="section-hint">Start with a PDF document.</span></div>
            <div className="dashboard-action-grid">
              <Link className="dashboard-action action-violet" to="/translate/document">
                <span className="action-icon"><FileText size={21} /></span><span className="action-label">01 / DOCUMENT</span><h3>Translate a document</h3><p>Readable PDF output, page by page.</p><span className="action-button">Open document translator <ArrowRight size={14} /></span>
              </Link>
              <Link className="dashboard-action action-green" to="/translate/image">
                <span className="action-icon"><FileImage size={21} /></span><span className="action-label">02 / IMAGE</span><h3>Translate an image</h3><p>Extract and understand text in pictures.</p><span className="action-button">Open image translator <ArrowRight size={14} /></span>
              </Link>
              <Link className="dashboard-action action-coral" to="/translate/text">
                <span className="action-icon"><Languages size={21} /></span><span className="action-label">03 / TEXT</span><h3>Translate some text</h3><p>Make short passages easier to understand.</p><span className="action-button">Open text translator <ArrowRight size={14} /></span>
              </Link>
            </div>
          </section>

          <div className="dashboard-columns">
            <motion.section className="dashboard-panel recent-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, delay: .08 }}>
              <div className="panel-heading"><div className="panel-title-icon"><Clock3 size={17} /></div><div><h2>Recent translations</h2><p>Your latest translation jobs</p></div><span className="panel-count">{stats.total}</span></div>
              {historyError ? <div className="empty-translations"><h3>History unavailable</h3><p>{historyError}</p></div> : recentJobs.length ? <div className="dashboard-recent-list">{recentJobs.map((job) => <Link className="dashboard-recent-row" to={`/translation/${job.id}`} key={job.id}><span className="dashboard-recent-icon">{job.fileType === 'image' ? <FileImage size={17} /> : job.fileType === 'text' ? <Languages size={17} /> : <FileText size={17} />}</span><span className="dashboard-recent-copy"><b title={job.originalFileName}>{job.originalFileName}</b><small>{job.sourceLanguage} → {job.targetLanguage}</small></span><span className={`dashboard-recent-status status-${job.status}`}>{job.status}</span><ArrowRight size={15} /></Link>)}<Link className="dashboard-see-history" to="/history">View all history <ArrowRight size={14} /></Link></div> : <div className="empty-translations">
                <div className="empty-art"><div className="empty-paper"><span /><span /><span /><i><FileText size={18} /></i></div><span className="empty-star empty-star-one">✦</span><span className="empty-star empty-star-two">✳</span></div>
                <h3>No translations yet</h3><p>When you translate a file or text, you’ll find its status and download here.</p>
                {query && <p className="search-empty">No results for “{query}”</p>}
                <a href="#quick-actions" className="empty-link">See what’s coming <ArrowRight size={14} /></a>
              </div>}
            </motion.section>

            <div className="dashboard-sidepanels">
              <motion.section className="dashboard-panel stats-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, delay: .15 }}>
                <div className="panel-heading"><div className="panel-title-icon stats-title-icon"><WandSparkles size={17} /></div><div><h2>Your activity</h2><p>Real totals from your workspace</p></div></div>
                <div className="stats-grid">
                  <div className="stat-card stat-purple"><span className="stat-icon"><FileText size={16} /></span><span className="stat-value">{stats.documents}</span><span className="stat-label">Documents</span></div>
                  <div className="stat-card stat-green"><span className="stat-icon"><FileImage size={16} /></span><span className="stat-value">{stats.images}</span><span className="stat-label">Images</span></div>
                  <div className="stat-card stat-coral"><span className="stat-icon"><Languages size={16} /></span><span className="stat-value">{stats.texts}</span><span className="stat-label">Text translations</span></div>
                  <div className="stat-card stat-gold"><span className="stat-icon"><Star size={16} /></span><span className="stat-value">{stats.favorites}</span><span className="stat-label">Favorites</span></div>
                </div>
              </motion.section>
              <section className="help-panel"><div className="help-copy"><span className="help-kicker"><ShieldCheck size={14} /> YOUR WORKSPACE</span><h2>{capabilities.reachable ? 'Translation service connected.' : 'Check translation services.'}</h2><p>{capabilities.reachable ? `${capabilities.languages.length} languages are available from your configured provider.` : 'Translation pages check provider availability and supported language pairs before starting a job.'}</p><Link to="/settings">Review workspace settings <ArrowRight size={14} /></Link></div><div className="help-illustration"><Globe2 size={42} /><span>✓</span></div></section>
            </div>
          </div>

          <section className="supported-panel" id="supported-languages"><div className="supported-heading"><div className="supported-globe"><Globe2 size={19} /></div><div><h2>Available languages</h2><p>Reported by the translation providers currently configured for this workspace.</p></div></div><div className="supported-list">{capabilities.languages.slice(0, 8).map(({ code, name }) => <span className="language-chip" key={code}>{name}</span>)}</div><span className="supported-status">{capabilities.reachable ? `${capabilities.providers?.length || 0} provider${capabilities.providers?.length === 1 ? '' : 's'} ready` : 'Provider offline'}</span></section>

          <footer className="dashboard-footer"><Brand /><span>Translation tools are being built in small, tested steps.</span><span>© 2026 Transly · All rights reserved · Made by Ranjan.</span></footer>
        </main>
    </WorkspaceLayout>
  );
}
