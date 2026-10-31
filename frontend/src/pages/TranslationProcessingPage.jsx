import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Check, CircleAlert, Clock3, FileImage, FileText, Languages,
  LoaderCircle, RefreshCw, ShieldCheck, Sparkles,
} from 'lucide-react';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import api from '../lib/api.js';

const stages = ['Upload', 'Extract text', 'OCR processing', 'Translation', 'Generate PDF'];

function fileSize(bytes = 0) {
  if (!bytes) return 'Not available';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function stageIndex(stage = '') {
  const normalized = stage.toLowerCase();
  if (normalized.includes('upload')) return 0;
  if (normalized.includes('extract')) return 1;
  if (normalized.includes('ocr')) return 2;
  if (normalized.includes('translat')) return 3;
  if (normalized.includes('generat') || normalized.includes('pdf')) return 4;
  if (normalized.includes('complet')) return 5;
  return -1;
}

function statusLabel(status = '') {
  return ({ queued: 'Queued', processing: 'In progress', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' })[status] || 'Unknown status';
}

export default function TranslationProcessingPage({ dark, setDark, user, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');

  const refreshJob = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const { data } = await api.get(`/translations/jobs/${encodeURIComponent(id)}`);
      setJob(data.job);
      setError('');
      setPollError('');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Could not reach the processing service.';
      if (initial) setError(message);
      else setPollError(message);
    } finally {
      if (initial) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void refreshJob(true); }, [refreshJob]);
  useEffect(() => {
    if (!job || !['queued', 'processing'].includes(job.status)) return undefined;
    const timer = window.setInterval(() => void refreshJob(), 2500);
    return () => window.clearInterval(timer);
  }, [job?.status, refreshJob]);
  useEffect(() => {
    if (job?.status === 'completed') navigate(`/translation/${id}/result`, { replace: true });
  }, [id, job?.status, navigate]);

  const savedStageIndex = job ? stageIndex(job.currentStage) : -1;
  const inferredFailedStage = job?.status === 'failed'
    ? (Number(job.progress) >= 75 ? 4 : Number(job.progress) >= 10 ? 3 : 1)
    : -1;
  const currentStage = savedStageIndex >= 0 ? savedStageIndex : inferredFailedStage;
  const numericProgress = job && Number.isFinite(Number(job.progress)) ? Math.max(0, Math.min(100, Number(job.progress))) : null;
  const isActive = job && ['queued', 'processing'].includes(job.status);
  const isFailed = job && ['failed', 'cancelled'].includes(job.status);
  const retryPath = job?.fileType === 'image' ? '/translate/image' : job?.fileType === 'text' ? '/translate/text' : '/translate/document';

  return (
    <WorkspaceLayout active="document" dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchPlaceholder="Search translations">
      <main className="processing-content">
        <div className="document-breadcrumb"><Link to="/dashboard">Dashboard</Link><ArrowRight size={13} /><Link to="/translate/document">Document translator</Link><ArrowRight size={13} /><span>Processing</span></div>
        <div className="processing-heading"><span className="processing-title-icon"><FileText size={23} /></span><div><span className="welcome-kicker"><Sparkles size={13} /> TRANSLATION JOB</span><h1>{loading ? 'Checking your document…' : error ? 'Processing details unavailable' : job?.status === 'completed' ? 'Your document is ready' : job?.status === 'failed' ? 'This translation needs attention' : job?.status === 'cancelled' ? 'Translation cancelled' : 'Translating your document'}</h1><p>{loading ? 'Loading the latest job status.' : error ? 'We could not load this job from your account.' : job?.status === 'completed' ? 'The processing job has completed.' : job?.status === 'failed' ? 'The job stopped before it could complete.' : job?.status === 'cancelled' ? 'This job was cancelled.' : 'We’ll keep this screen up to date with actual job progress.'}</p></div></div>

        {loading ? <section className="processing-state-card"><LoaderCircle className="processing-spinner" size={28} /><h2>Loading processing status</h2><p>Checking the job record linked to this page.</p></section> : error ? <section className="processing-state-card processing-error-state"><span className="state-icon error-icon"><CircleAlert size={22} /></span><h2>No job details to show</h2><p>{error}</p><div className="processing-state-actions"><Link className="processing-outline-button" to="/translate/document">Back to document translator</Link><Link className="processing-text-link" to="/dashboard">Dashboard</Link></div></section> : job ? <>
          {pollError && <div className="processing-inline-warning" role="status"><CircleAlert size={14} /> Live status refresh failed. Showing the last saved update.</div>}
          <div className="processing-layout">
            <section className="processing-main-card">
              <div className="processing-job-summary">
                <div className="processing-illustration" aria-hidden="true"><div className="processing-illustration-halo" /><div className="processing-paper"><span>PDF</span><i /><i /><i /></div><span className="processing-float translate-float">A <ArrowRight size={11} /> अ</span><span className="processing-float check-float"><Check size={15} /></span></div>
                <div className="processing-job-copy"><span className={`job-status-pill status-${job.status}`}><span /> {statusLabel(job.status)}</span><h2>{job.status === 'completed' ? 'Processing complete' : job.status === 'failed' ? 'Processing stopped' : job.status === 'cancelled' ? 'Job cancelled' : job.currentStage || 'Waiting for a worker'}</h2><p>{isActive ? 'This status refreshes automatically while the job is active.' : job.status === 'completed' ? 'The backend marked this job as complete.' : job.errorMessage || 'No additional information was saved for this job.'}</p>
                  <div className="processing-file-row"><span className="processing-file-icon">{job.fileType === 'image' ? <FileImage size={17} /> : job.fileType === 'text' ? <Languages size={17} /> : <FileText size={17} />}</span><span><b title={job.originalFileName}>{job.originalFileName}</b><small>{job.totalPages ? `${job.totalPages} pages` : job.fileType.toUpperCase()} · {fileSize(job.fileSize)}</small></span></div>
                </div>
              </div>

              <div className="processing-stage-track" aria-label="Processing stages">
                {stages.map((stage, index) => {
                  const complete = job.status === 'completed' || (currentStage >= 0 && index < currentStage);
                  const current = isActive && index === currentStage;
                  const failedHere = isFailed && index === currentStage;
                  return <div className={`stage-item${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}${failedHere ? ' is-failed' : ''}`} key={stage}>
                    <span className="stage-dot">{complete ? <Check size={14} /> : current ? <LoaderCircle size={15} /> : index + 1}</span><b>{stage}</b><small>{complete ? 'Completed' : failedHere ? statusLabel(job.status) : current ? statusLabel(job.status) : job.status === 'completed' ? 'Completed' : 'Waiting'}</small>
                  </div>;
                })}
              </div>

              <div className="processing-progress-card">
                <div className="progress-ring" style={{ '--progress': `${numericProgress ?? 0}%` }}><span>{numericProgress === null ? '—' : `${numericProgress}%`}</span></div>
                <div className="progress-content"><h3>{isFailed ? statusLabel(job.status) : job.status === 'completed' ? 'Document complete' : job.currentStage || 'Waiting in queue'}</h3><p>{job.totalPages > 0 ? `${job.completedPages} of ${job.totalPages} pages completed` : 'Page details will appear when the processor reports them.'}</p><div className="progress-track"><span style={{ width: `${numericProgress ?? 0}%` }} /></div></div>
                <div className="progress-updated"><Clock3 size={14} /><span>Updated<br /><b>{new Date(job.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b></span></div>
              </div>

              <div className="processing-details-grid">
                <section className="page-progress-panel"><div className="processing-panel-title"><h3>Page progress</h3><span>{job.totalPages ? `${job.completedPages}/${job.totalPages}` : 'No page data'}</span></div>
                  {job.totalPages > 0 ? <div className="page-progress-summary"><span className="page-progress-check"><Check size={15} /></span><div><b>{job.completedPages} pages reported complete</b><small>Per-page timing is not available in this job record.</small></div></div> : <div className="page-progress-empty"><FileText size={20} /><p>The processor hasn’t reported page counts for this job yet.</p></div>}
                </section>
                <section className="job-info-panel"><div className="processing-panel-title"><h3>Processing details</h3><ShieldCheck size={16} /></div><dl><div><dt>File type</dt><dd>{job.fileType.toUpperCase()}</dd></div><div><dt>Source language</dt><dd>{job.sourceLanguage || 'Auto-detect'}</dd></div><div><dt>Target language</dt><dd>{job.targetLanguage || 'Not set'}</dd></div><div><dt>Completed pages</dt><dd>{job.completedPages}</dd></div></dl><p className="job-honesty-note"><ShieldCheck size={13} /> Values on this screen come from the saved job status.</p></section>
              </div>

              {job.status === 'failed' && job.errorMessage && <div className="job-error-detail"><CircleAlert size={15} /><span>{job.errorMessage}</span></div>}
              <div className="processing-footer-actions">{job.status === 'completed' || job.hasTranslatedText ? <Link className="processing-outline-button" to={`/translation/${id}/result`}>Open translation result <ArrowRight size={14} /></Link> : job.status === 'failed' ? <Link className="processing-outline-button" to={retryPath}>Try another translation <ArrowRight size={14} /></Link> : <Link className="processing-outline-button" to="/dashboard">Go to dashboard <ArrowRight size={14} /></Link>}{isActive && <span className="auto-refresh-note"><RefreshCw size={13} /> Refreshes every 2.5 seconds</span>}</div>
            </section>

            <aside className="processing-aside">
              <section className="processing-aside-card"><div className="processing-aside-heading"><span><FileText size={16} /></span><h2>Document info</h2></div><dl className="document-info-list"><div><dt>File name</dt><dd title={job.originalFileName}>{job.originalFileName}</dd></div><div><dt>File size</dt><dd>{fileSize(job.fileSize)}</dd></div><div><dt>Total pages</dt><dd>{job.totalPages || 'Not reported'}</dd></div><div><dt>File type</dt><dd>{job.fileType.toUpperCase()}</dd></div><div><dt>Job started</dt><dd>{new Date(job.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd></div></dl></section>
              <section className="processing-aside-card processing-tip-card"><div className="processing-aside-heading"><span><Sparkles size={16} /></span><h2>About this status</h2></div><p>Progress is reported by the processing service. Transly doesn’t estimate time remaining or invent page completion.</p><span className="processing-api-badge"><span /> Live job record</span></section>
            </aside>
          </div>
        </> : null}
      </main>
    </WorkspaceLayout>
  );
}
