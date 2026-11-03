import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert, Copy, Download, FileText,
  Languages, RefreshCw, Sparkles,
} from 'lucide-react';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import api from '../lib/api.js';

const languageNames = { en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French', auto: 'Auto-detected' };
const translatedPdfFilename = (name) => `Transly-${String(name || 'translation').replace(/\.[^.]+$/, '') || 'translation'}.pdf`;
const translatedTextFilename = (name) => `Transly-${String(name || 'translation').replace(/\.[^.]+$/, '') || 'translation'}.txt`;

function resultFileUrl(id, kind, inline = false) {
  return api.getUri({
    url: `/translations/jobs/${encodeURIComponent(id)}/${kind}`,
    ...(inline ? { params: { inline: 1 } } : {}),
  });
}

export default function TranslationResultPage({ dark, setDark, user, onLogout }) {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [originalPreview, setOriginalPreview] = useState('');
  const [translatedPreview, setTranslatedPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const hasPdf = Boolean(job?.hasTranslatedPdf);
  const hasTextResult = Boolean(job?.hasTranslatedText && translatedText);

  useEffect(() => {
    let active = true;

    async function loadResult() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/translations/jobs/${encodeURIComponent(id)}`);
        if (!active) return;
        setJob(data.job);
        if (!['completed', 'failed'].includes(data.job.status)) {
          setError('This translation is still processing. Check its live status first.');
          return;
        }
        const requests = await Promise.allSettled([
          data.job.hasOriginalText ? api.get(`/translations/jobs/${id}/text/original`, { responseType: 'text' }) : Promise.resolve({ data: '' }),
          data.job.hasTranslatedText ? api.get(`/translations/jobs/${id}/text/translated`, { responseType: 'text' }) : Promise.resolve({ data: '' }),
        ]);
        if (!active) return;
        const [originalTextResult, translatedTextResult] = requests;
        if (originalTextResult.status === 'fulfilled') setOriginalText(String(originalTextResult.value.data || ''));
        if (translatedTextResult.status === 'fulfilled') setTranslatedText(String(translatedTextResult.value.data || ''));
        if (data.job.hasOriginal) setOriginalPreview(resultFileUrl(id, `preview/${data.job.fileType === 'image' ? 'original-image' : 'original-pdf'}`, true));
        if (data.job.hasTranslatedPdf) setTranslatedPreview(resultFileUrl(id, 'preview/translated-pdf', true));
        if (data.job.status === 'completed' && !data.job.hasTranslatedPdf && !data.job.hasTranslatedText) {
          setError('Translation completed, but its result files are no longer available. Submit the document again.');
        }
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'We could not load this translation result.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadResult();
    return () => {
      active = false;
    };
  }, [id]);

  async function download(kind, filename) {
    setNotice('');
    try {
      const { data } = await api.get(`/translations/jobs/${id}/download/${kind}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      setNotice(requestError.response?.data?.message || 'This temporary download is no longer available.');
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(translatedText);
      setNotice('Translated text copied.');
    } catch {
      setNotice('Clipboard access is unavailable in this browser.');
    }
  }

  const sourceName = languageNames[job?.sourceLanguage] || job?.sourceLanguage || 'Source';
  const targetName = languageNames[job?.targetLanguage] || job?.targetLanguage || 'Target';
  const translatorPath = job?.fileType === 'image' ? '/translate/image' : job?.fileType === 'text' ? '/translate/text' : '/translate/document';
  const translatorLabel = job?.fileType === 'image' ? 'Image translator' : job?.fileType === 'text' ? 'Text translator' : 'Document translator';
  const failedTitle = job?.targetLanguage === 'hi' ? 'Hindi PDF was not generated' : 'Translated PDF was not generated';
  const jobErrorMessage = job?.errorMessage?.includes('moduleDirectory is not defined')
    ? 'The backend was running an older PDF generator. Restart the backend, then submit this file again to generate its translated PDF.'
    : job?.errorMessage;

  return (
    <WorkspaceLayout active={job?.fileType === 'image' ? 'image' : job?.fileType === 'text' ? 'text' : 'document'} dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchPlaceholder="Search translations">
      <main className="result-content">
        <div className="result-top-navigation"><div className="document-breadcrumb"><Link to="/dashboard">Dashboard</Link><ChevronRight size={13} /><Link to={translatorPath}>{translatorLabel}</Link><ChevronRight size={13} /><span>Result</span></div><Link className="result-back-button" to={translatorPath}><ArrowLeft size={15} /> Back to {translatorLabel.toLowerCase()}</Link></div>
        {loading ? <section className="result-state-card"><span className="auth-spinner" /><h2>Loading your result</h2><p>Opening the latest saved translation files.</p></section> : error ? <section className="result-state-card result-error-state"><span className="result-state-icon"><CircleAlert size={22} /></span><h2>Result unavailable</h2><p>{error}</p><div className="result-state-links"><Link to={`/translation/${id}`} className="result-secondary-button">View processing status</Link><Link to="/translate/document" className="result-primary-button">Translate another document</Link></div></section> : job && <>
          <motion.section className={`result-success-banner${job.status === 'failed' ? ' result-partial-banner' : ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
            <span className="result-success-icon">{job.status === 'completed' ? <Check size={22} /> : <CircleAlert size={22} />}</span>
            <div className="result-success-copy"><h1>{job.status === 'completed' ? 'Your translation is ready' : failedTitle}</h1><p>{job.status === 'completed' ? 'Review your translated document and download the files you need.' : jobErrorMessage || 'The job stopped before its translated PDF was saved. Submit the file again after fixing the backend error.'}</p></div>
            <div className="result-summary"><span className="result-summary-file"><FileText size={18} /></span><div><b title={job.originalFileName}>{job.originalFileName}</b><small>{job.fileType === 'text' ? 'Text' : job.fileType === 'image' ? 'Image' : `${job.totalPages || 0} pages`} · {Math.max(1, Math.round(job.fileSize / 1024))} KB</small></div><span className="result-language-pair"><span>{sourceName}</span><ArrowRight size={14} /><span>{targetName}</span></span></div>
          </motion.section>

          {notice && <div className="result-notice" role="status">{notice}</div>}
          {!hasPdf && hasTextResult && <div className="result-notice result-font-note"><CircleAlert size={15} /> Translated text is saved. The translated PDF is missing for this failed job; submit the PDF again after restarting the backend.</div>}
          {job.status === 'completed' && hasPdf && job.fileType !== 'text' ? <div className="result-preview-grid">
            <section className="result-preview-card"><div className="result-preview-heading original-heading"><span><FileText size={16} /></span><div><h2>{job.fileType === 'image' ? 'Original image' : 'Original document'}</h2><small>{sourceName}</small></div></div><div className={job.fileType === 'image' ? 'result-image-frame' : 'result-pdf-frame'}>{originalPreview ? (job.fileType === 'image' ? <img src={originalPreview} alt={`Original ${job.originalFileName}`} /> : <iframe title="Original PDF preview" src={originalPreview} />) : <div className="result-preview-empty"><FileText size={24} /><p>Original preview expired.</p></div>}</div>{job.fileType !== 'image' && originalPreview && <a className="result-pdf-open-link" href={originalPreview} target="_blank" rel="noreferrer">Open original PDF</a>}</section>
            <section className="result-preview-card"><div className="result-preview-heading translated-heading"><span><Languages size={16} /></span><div><h2>Translated document</h2><small>{targetName}</small></div><a className="preview-download" href={resultFileUrl(id, 'download/translated-pdf')} download={translatedPdfFilename(job.originalFileName)} title="Download translated PDF" aria-label="Download translated PDF"><Download size={15} /></a></div><div className="result-pdf-frame">{translatedPreview ? <iframe title="Translated PDF preview" src={translatedPreview} /> : <div className="result-preview-empty"><FileText size={24} /><p>Translated preview expired.</p></div>}</div>{translatedPreview && <a className="result-pdf-open-link" href={translatedPreview} target="_blank" rel="noreferrer">Open translated PDF</a>}</section>
          </div> : <section className="result-text-panels">
            <article><h2>Original text</h2><pre>{originalText || 'Original text preview is unavailable.'}</pre></article>
            <article><h2>Translated text</h2><pre>{translatedText || 'No translated text was saved for this job.'}</pre></article>
          </section>}

          {hasTextResult && <details className="result-text-details"><summary>Open text previews <ChevronRight size={15} /></summary><div className="result-text-panels"><article><h2>Original text</h2><pre>{originalText || 'Original text preview is unavailable.'}</pre></article><article><h2>Translated text</h2><pre>{translatedText}</pre></article></div></details>}

          <section className="result-actions"><div className="result-download-actions">
            {hasPdf && <a className="result-primary-button" href={resultFileUrl(id, 'download/translated-pdf')} download={translatedPdfFilename(job.originalFileName)}><Download size={15} /> Download translated PDF</a>}
            {hasTextResult && <><button className="result-secondary-button" onClick={() => void copyText()}><Copy size={15} /> Copy translated text</button><button className="result-secondary-button" onClick={() => void download('translated-text', translatedTextFilename(job.originalFileName))}><Download size={15} /> Download text</button></>}
            <Link className="result-secondary-button" to={translatorPath}><RefreshCw size={14} /> {job.status === 'failed' ? 'Retry translation' : 'Translate another'}</Link>
          </div><span className="result-expiry">Temporary files expire {job.expiresAt ? new Date(job.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'after 24 hours'}.</span></section>
        </>}
      </main>
    </WorkspaceLayout>
  );
}
