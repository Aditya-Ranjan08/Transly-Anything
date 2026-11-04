import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowRightLeft, Check, ChevronDown, CircleAlert, CloudUpload,
  FileText, Image, Languages, LockKeyhole, RefreshCw, Sparkles, X,
} from 'lucide-react';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import fetchCapabilities from '../features/translation/fetchCapabilities.js';
import recommendedTargetLanguage from '../features/translation/recommendedTargetLanguage.js';
import api from '../lib/api.js';

function prettySize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function validatePdf(file, maxBytes) {
  if (file.size > maxBytes) throw new Error(`This PDF is larger than the ${prettySize(maxBytes)} limit. Choose a smaller file.`);
  if (file.size === 0) throw new Error('This file is empty. Choose another PDF.');
  const extensionOk = file.name.toLowerCase().endsWith('.pdf');
  if (!extensionOk) throw new Error('Choose a PDF file to continue.');
  const header = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer());
  if (!header.includes('%PDF-')) throw new Error('This file does not look like a valid PDF. Try another file.');
  return file;
}

export default function DocumentTranslatorPage({ dark, setDark, user, onLogout }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [capabilities, setCapabilities] = useState({ configured: false, reachable: false, languages: [], pairs: [], maxFileSize: 10 * 1024 * 1024, message: '' });
  const [checkingCapabilities, setCheckingCapabilities] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setCheckingCapabilities(true);
    fetchCapabilities()
      .then((data) => { if (active) setCapabilities(data); })
      .catch((error) => { if (active) setCapabilities({ configured: true, reachable: false, languages: [], pairs: [], maxFileSize: 10 * 1024 * 1024, message: error.response?.data?.message || 'Could not check translation providers. Make sure the backend and database are running, then retry.' }); })
      .finally(() => { if (active) setCheckingCapabilities(false); });
    return () => { active = false; };
  }, []);

  async function retryCapabilities() {
    setCheckingCapabilities(true);
    try { setCapabilities(await fetchCapabilities()); }
    catch (error) {
      setCapabilities((current) => ({ ...current, reachable: false, message: error.response?.data?.message || 'Could not check translation providers. Make sure the backend and database are running, then retry.' }));
    } finally { setCheckingCapabilities(false); }
  }

  const targetCodes = useMemo(() => {
    const codes = capabilities.pairs.filter((pair) => pair.source === sourceLanguage).map((pair) => pair.target);
    return [...new Set(codes)].sort();
  }, [capabilities.pairs, sourceLanguage]);

  useEffect(() => {
    if (!targetCodes.includes(targetLanguage)) setTargetLanguage(recommendedTargetLanguage(sourceLanguage, targetCodes, user?.preferredLanguage));
  }, [targetCodes, targetLanguage, user?.preferredLanguage]);

  const sourceOptions = useMemo(() => {
    const supportedSources = new Set(capabilities.pairs.map((pair) => pair.source));
    return capabilities.languages.filter((language) => supportedSources.has(language.code));
  }, [capabilities.languages, capabilities.pairs]);
  useEffect(() => {
    if (capabilities.reachable && sourceOptions.length && !sourceOptions.some((language) => language.code === sourceLanguage)) {
      const nextSource = sourceOptions.find((language) => language.code === 'en')
        || sourceOptions.find((language) => language.code === 'hi')
        || sourceOptions[0];
      setSourceLanguage(nextSource.code);
    }
  }, [capabilities.reachable, sourceOptions, sourceLanguage]);
  const displayLanguage = (code) => capabilities.languages.find((language) => language.code === code)?.name || code;
  const serviceReady = capabilities.configured && capabilities.reachable && targetCodes.includes(targetLanguage);
  const canSwapLanguages = capabilities.pairs.some((pair) => pair.source === targetLanguage && pair.target === sourceLanguage);

  async function chooseFile(candidate) {
    setError('');
    setUploadError('');
    setFile(null);
    if (!candidate) return;
    try { setFile(await validatePdf(candidate, capabilities.maxFileSize)); }
    catch (validationError) { setError(validationError.message); }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    void chooseFile(event.dataTransfer.files?.[0]);
  }

  function clearFile() {
    setFile(null);
    setError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  async function startTranslation() {
    if (!file || !serviceReady || submitting) return;
    setSubmitting(true);
    setUploadError('');
    const form = new FormData();
    form.append('document', file);
    form.append('sourceLanguage', sourceLanguage);
    form.append('targetLanguage', targetLanguage);
    try {
      await api.get('/health', { timeout: 120000 });
      const { data } = await api.post('/translations/jobs', form, {
        timeout: 120000,
      });
      navigate(`/translation/${data.job.id}`);
    } catch (requestError) {
      const message = requestError.response?.data?.message
        || (requestError.code === 'ECONNABORTED'
          ? 'The upload timed out. Check your connection and try again.'
          : !requestError.response
            ? 'Could not reach the backend. Check your internet connection and try again.'
            : 'Could not upload this document. Check the backend and try again.');
      setUploadError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function swapLanguages() {
    const nextSource = targetLanguage;
    const nextTarget = sourceLanguage;
    if (sourceOptions.some((language) => language.code === nextSource) && capabilities.pairs.some((pair) => pair.source === nextSource && pair.target === nextTarget)) {
      setSourceLanguage(nextSource);
      setTargetLanguage(nextTarget);
    }
  }

  return (
    <WorkspaceLayout active="document" dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchPlaceholder="Search translations">
      <main className="document-content">
        <div className="document-breadcrumb"><Link to="/dashboard">Dashboard</Link><ArrowRight size={13} /><span>Document translator</span></div>
        <motion.section className="document-intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
          <div className="document-title-group"><span className="document-title-icon"><FileText size={24} /></span><div><span className="welcome-kicker"><Sparkles size={13} /> PDF WORKSPACE</span><h1>Document translator</h1><p>Choose a PDF and prepare it for a clear, readable translation.</p></div></div>
          <div className="document-hero-art" aria-hidden="true"><div className="document-art-halo" /><div className="document-art-paper"><span className="document-art-pdf">PDF</span><i /><i /><i /><b><Languages size={15} /> A <ArrowRight size={12} /> अ</b></div><span className="document-art-orbit orbit-pdf"><FileText size={16} /></span><span className="document-art-orbit orbit-lang"><Languages size={17} /></span><span className="document-art-star">✦</span></div>
        </motion.section>

        <div className="document-layout">
          <motion.section className="document-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .38, delay: .06 }}>
            <div className="document-tabs" role="tablist" aria-label="Translation input type">
              <button className="document-tab active" role="tab" aria-selected="true" aria-label="PDF"><FileText size={16} /><strong>PDF</strong></button>
              <Link className="document-tab" role="tab" aria-selected="false" to="/translate/image"><Image size={16} /> Image</Link>
              <Link className="document-tab" role="tab" aria-selected="false" to="/translate/text"><Languages size={16} /> Text</Link>
            </div>

            <input ref={fileInput} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event.target.files?.[0])} />
            <div className={`pdf-dropzone${dragActive ? ' is-dragging' : ''}${file ? ' has-file' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }} onDrop={handleDrop}>
              {!file ? <>
                <span className="upload-icon"><CloudUpload size={30} /></span>
                <h2>Drop your PDF here</h2><p>or choose one from your device</p>
                <button type="button" className="btn btn-primary choose-file-button mt-3 min-h-9 gap-2 rounded-lg px-4 text-sm" onClick={() => fileInput.current?.click()}><FileText size={15} /> Choose PDF</button>
                <span className="upload-limit">PDF only · up to {prettySize(capabilities.maxFileSize)}</span>
              </> : <>
                <span className="upload-icon selected-icon"><Check size={25} /></span>
                <h2>Your PDF is ready to review</h2><p>The file is selected on this device. It has not been uploaded.</p>
                <div className="selected-file"><span className="selected-file-icon"><FileText size={19} /></span><span className="selected-file-copy"><b title={file.name}>{file.name}</b><small>{prettySize(file.size)} · PDF · selected locally</small></span><button type="button" className="remove-file-button" onClick={clearFile} aria-label="Remove selected PDF"><X size={17} /></button></div>
              </>}
              {error && <div className="file-error" role="alert"><CircleAlert size={15} /> {error}</div>}
            </div>

            <div className="language-picker-heading"><div><span className="section-kicker">LANGUAGES</span><h2>Choose your translation direction</h2><small className="language-default-hint">Start with English → Hindi. Choose another supported pair from the dropdowns.</small></div><span className={`engine-status${serviceReady ? ' engine-ready' : ''}`}><span />{checkingCapabilities ? 'Checking providers…' : !capabilities.configured ? 'Provider setup needed' : !capabilities.reachable ? 'Translation providers offline' : serviceReady ? `${capabilities.pairs.length} supported pairs` : 'Choose a supported pair'}</span></div>
            <div className="language-select-row">
              <label className="document-language-field"><span>FROM</span><span className="language-select-wrap"><Languages size={15} /><select className="language-select" value={sourceLanguage} disabled={!capabilities.reachable} onChange={(event) => setSourceLanguage(event.target.value)}>{sourceOptions.map((language) => <option value={language.code} key={language.code}>{language.name}</option>)}</select><ChevronDown size={14} /></span></label>
              <button className="swap-languages" type="button" disabled={!serviceReady || !canSwapLanguages} onClick={swapLanguages} aria-label="Swap languages" title={canSwapLanguages ? 'Swap languages' : 'Reverse language pair is unavailable'}><ArrowRightLeft size={17} /></button>
              <label className="document-language-field"><span>TO</span><span className="language-select-wrap"><GlobePlaceholder /><select className="language-select" value={targetLanguage} disabled={!capabilities.reachable || !targetCodes.length} onChange={(event) => setTargetLanguage(event.target.value)}><option value="" disabled>Choose language</option>{targetCodes.map((code) => <option value={code} key={code}>{displayLanguage(code)}</option>)}</select><ChevronDown size={14} /></span></label>
            </div>

            {!serviceReady && <div className="translation-unavailable"><LockKeyhole size={16} /><span><b>{!capabilities.configured ? 'Connect a translation provider' : !capabilities.reachable ? 'Translation providers are unavailable' : 'This pair is not supported'}</b><small>{!capabilities.configured ? 'Add credentials or a URL for at least one provider in backend/.env.' : !capabilities.reachable ? capabilities.message || 'Check your configured provider credentials and network, then try again.' : 'Choose a language pair supported by at least one configured provider.'}</small>{capabilities.configured && !capabilities.reachable && <button type="button" className="retry-capabilities-button" onClick={() => void retryCapabilities()} disabled={checkingCapabilities}>{checkingCapabilities ? <RefreshCw size={13} className="retry-spinner" /> : <RefreshCw size={13} />} {checkingCapabilities ? 'Checking providers…' : 'Check again'}</button>}</span></div>}
            {uploadError && <div className="file-error" role="alert"><CircleAlert size={15} /> {uploadError}</div>}
            <button className="btn btn-primary translate-document-button mt-3 min-h-12 w-full gap-2 rounded-xl text-sm" type="button" disabled={!file || !serviceReady || submitting} onClick={() => void startTranslation()}><Sparkles size={17} />{submitting ? 'Uploading and starting job…' : 'Translate document'} <ArrowRight size={16} /></button>
            <p className="translate-hint">Your PDF uploads to this backend. Extracted text is sent to configured translation providers; if one fails, the next provider receives the text.</p>
          </motion.section>

          <aside className="document-aside">
            <section className="document-aside-card steps-card"><div className="aside-card-heading"><span className="aside-heading-icon"><Sparkles size={16} /></span><h2>How it works</h2></div>
              <ol className="document-steps"><li><span>1</span><div><b>Choose a PDF</b><p>We check the file type and size on your device.</p></div></li><li><span>2</span><div><b>Pick languages</b><p>Supported pairs will appear when the engine is ready.</p></div></li><li><span>3</span><div><b>Review the result</b><p>Read and download your translated document.</p></div></li></ol>
            </section>
            <section className="document-aside-card features-card"><div className="aside-card-heading"><span className="aside-heading-icon feature-heading-icon"><Check size={16} /></span><h2>Processing features</h2></div><ul><li><Check size={14} /> Selectable PDF text extraction</li><li><Check size={14} /> OCR for scanned PDF pages</li><li><Check size={14} /> Page order stays consistent</li><li><Check size={14} /> Hindi-compatible translated PDF output</li></ul><p className="planned-note">Scanned-page OCR can take longer than selectable text extraction.</p></section>
            <section className="document-tip"><span><LockKeyhole size={17} /></span><p><b>Temporary file storage.</b> Uploaded source and result files expire after 24 hours. Download your translated result before it expires.</p></section>
          </aside>
        </div>

        <section className="document-formats"><div className="formats-symbol"><FileText size={18} /></div><div className="formats-description"><b>Supported format</b><span>PDF · Up to {prettySize(capabilities.maxFileSize)} per file</span></div><span className="format-badge">PDF</span><span className="format-size-badge">{prettySize(capabilities.maxFileSize)} max</span></section>
      </main>
    </WorkspaceLayout>
  );
}

function GlobePlaceholder() {
  return <span className="language-placeholder-icon" aria-hidden="true">Aa</span>;
}
