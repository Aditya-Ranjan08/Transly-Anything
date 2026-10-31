import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, FileImage, FileText, Heart, Languages, LoaderCircle, Search, Star, Trash2, X } from 'lucide-react';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import api from '../lib/api.js';

const formatDate = (value) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
const inputName = (type) => type === 'image' ? 'Image' : type === 'text' ? 'Text' : 'PDF';
const inputIcon = (type) => type === 'image' ? FileImage : type === 'text' ? Languages : FileText;

export default function TranslationLibraryPage({ mode, dark, setDark, user, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const favoritesOnly = mode === 'favorites';

  useEffect(() => {
    let active = true;
    api.get('/translations/jobs')
      .then(({ data }) => { if (active) setJobs(data.jobs || []); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load your translation history.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    if (favoritesOnly && !job.isFavorite) return false;
    if (status !== 'all' && job.status !== status) return false;
    return !query || job.originalFileName.toLowerCase().includes(query.toLowerCase()) || job.targetLanguage.toLowerCase().includes(query.toLowerCase());
  }), [favoritesOnly, jobs, query, status]);

  async function toggleFavorite(job) {
    setSavingId(job.id);
    setError('');
    try {
      const { data } = await api.patch(`/translations/jobs/${job.id}/favorite`, { isFavorite: !job.isFavorite });
      setJobs((current) => current.map((item) => item.id === job.id ? data.job : item));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this favorite.');
    } finally {
      setSavingId('');
    }
  }

  async function deleteJob() {
    if (!confirmDelete) return;
    const job = confirmDelete;
    setDeletingId(job.id);
    setError('');
    try {
      await api.delete(`/translations/jobs/${job.id}`);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      setConfirmDelete(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete this translation.');
    } finally {
      setDeletingId('');
    }
  }

  const title = favoritesOnly ? 'Your favorites' : 'Translation history';
  const active = favoritesOnly ? 'favorites' : 'history';

  return <WorkspaceLayout active={active} dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchValue={query} onSearch={setQuery} searchPlaceholder="Search your translations">
    <main className="library-content">
      <div className="document-breadcrumb"><Link to="/dashboard">Dashboard</Link><ArrowRight size={13} /><span>{title}</span></div>
      <header className="library-heading"><span className="library-heading-icon">{favoritesOnly ? <Heart size={22} /> : <Clock3 size={22} />}</span><div><span className="welcome-kicker">YOUR WORKSPACE</span><div className="library-title-row"><h1>{title}</h1><span className="library-count">{filteredJobs.length} {filteredJobs.length === 1 ? 'item' : 'items'}</span></div><p>{favoritesOnly ? 'Keep important completed translations close at hand.' : 'Find recent and past translation jobs in one place.'}</p></div></header>
      <div className="library-toolbar"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files or languages" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="completed">Completed</option><option value="processing">Processing</option><option value="queued">Queued</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select></div>
      {error && <div className="library-error" role="alert">{error}</div>}
      {loading ? <div className="library-empty"><LoaderCircle className="processing-spinner" size={25} /><h2>Loading translations</h2><p>Getting your saved jobs.</p></div> : filteredJobs.length ? <div className="library-list">{filteredJobs.map((job) => {
        const Icon = inputIcon(job.fileType);
        return <article className="library-job-card" key={job.id}><span className={`library-file-icon type-${job.fileType}`}><Icon size={20} /></span><div className="library-job-main"><h2 title={job.originalFileName}>{job.originalFileName}</h2><div className="library-job-meta"><span>{inputName(job.fileType)}</span><i /> <span>{job.sourceLanguage || 'auto'} â†’ {job.targetLanguage || 'â€”'}</span><i /> <time>{formatDate(job.createdAt)}</time></div></div><span className={`library-status status-${job.status}`}>{job.status}</span>{job.status === 'completed' && <button className={`library-favorite${job.isFavorite ? ' is-favorite' : ''}`} type="button" onClick={() => void toggleFavorite(job)} disabled={savingId === job.id} aria-label={job.isFavorite ? 'Remove favorite' : 'Add favorite'} title={job.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>{savingId === job.id ? <LoaderCircle size={17} className="processing-spinner" /> : <Star size={17} fill={job.isFavorite ? 'currentColor' : 'none'} />}</button>}<Link className="library-open-link" to={job.status === 'completed' ? `/translation/${job.id}/result` : `/translation/${job.id}`}>{job.status === 'completed' ? 'View result' : 'View status'} <ArrowRight size={14} /></Link><button className="library-delete-button" type="button" onClick={() => setConfirmDelete(job)} aria-label={`Delete ${job.originalFileName}`} title="Delete translation"><Trash2 size={17} /></button></article>;
      })}</div> : <section className="library-empty"><span>{favoritesOnly ? <Star size={23} /> : <Clock3 size={23} />}</span><h2>{favoritesOnly ? 'No favorites yet' : 'No translations found'}</h2><p>{favoritesOnly ? 'Mark a completed translation with the star to keep it here.' : query || status !== 'all' ? 'Try another search or status filter.' : 'Your translation jobs will appear here when you submit a file or text.'}</p>{!favoritesOnly && <Link to="/translate/document" className="result-primary-button">Start a translation <ArrowRight size={15} /></Link>}</section>}
    </main>
    {confirmDelete && <div className="modal modal-open bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingId) setConfirmDelete(null); }}>
      <section className="modal-box relative w-full max-w-[440px] rounded-2xl p-6" role="alertdialog" aria-modal="true" aria-labelledby="delete-job-title">
        <button className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3" type="button" onClick={() => setConfirmDelete(null)} disabled={Boolean(deletingId)} aria-label="Close delete confirmation"><X size={18} /></button>
        <span className="mb-4 grid size-12 place-items-center rounded-xl bg-error/10 text-error"><Trash2 size={21} /></span>
        <h2 id="delete-job-title" className="mb-2 text-xl font-semibold">Delete this translation?</h2>
        <p className="text-base-content/70 text-sm leading-relaxed"><b className="text-base-content">{confirmDelete.originalFileName}</b> and its saved preview, text and download files will be removed from your history.</p>
        {error && <p className="alert alert-error mt-3 text-sm" role="alert">{error}</p>}
        <div className="modal-action mt-6 flex-col-reverse gap-2 sm:flex-row">
          <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(null)} disabled={Boolean(deletingId)}>Keep translation</button>
          <button type="button" className="btn btn-error" onClick={() => void deleteJob()} disabled={deletingId === confirmDelete.id}>{deletingId === confirmDelete.id ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </section>
    </div>}
  </WorkspaceLayout>;
}

