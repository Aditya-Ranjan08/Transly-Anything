import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowRightLeft, Check, ChevronDown, CircleAlert, CloudUpload, FileImage, Languages, LockKeyhole, RefreshCw, Sparkles, X } from 'lucide-react';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import useProviderCapabilities from '../features/translation/useProviderCapabilities.js';
import recommendedTargetLanguage from '../features/translation/recommendedTargetLanguage.js';
import api from '../lib/api.js';

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ocrSupportedSourceCodes = new Set(['en', 'hi', 'es', 'fr']);

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImageTranslatorPage({ dark, setDark, user, onLogout }) {
  const { capabilities, checking, refresh } = useProviderCapabilities();
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!image) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const targetCodes = useMemo(() => {
    const pairs = capabilities.pairs.filter((pair) => pair.source === sourceLanguage);
    return [...new Set(pairs.map((pair) => pair.target))].sort();
  }, [capabilities.pairs, sourceLanguage]);
  const sourceOptions = useMemo(() => {
    const sources = new Set(capabilities.pairs.map((pair) => pair.source));
    return capabilities.languages.filter((language) => sources.has(language.code) && ocrSupportedSourceCodes.has(language.code));
  }, [capabilities.languages, capabilities.pairs]);
  useEffect(() => {
    if (capabilities.reachable && sourceOptions.length && !sourceOptions.some((language) => language.code === sourceLanguage)) {
      const nextSource = sourceOptions.find((language) => language.code === 'en')
        || sourceOptions.find((language) => language.code === 'hi')
        || sourceOptions[0];
      setSourceLanguage(nextSource.code);
    }
  }, [capabilities.reachable, sourceOptions, sourceLanguage]);
  useEffect(() => {
    if (!targetCodes.includes(targetLanguage)) setTargetLanguage(recommendedTargetLanguage(sourceLanguage, targetCodes, user?.preferredLanguage));
  }, [targetCodes, targetLanguage, user?.preferredLanguage]);

  const ready = capabilities.configured && capabilities.reachable && targetCodes.includes(targetLanguage);
  const canSwapLanguages = capabilities.pairs.some((pair) => pair.source === targetLanguage && pair.target === sourceLanguage);

  function swapLanguages() {
    const nextSource = targetLanguage;
    const nextTarget = sourceLanguage;
    if (sourceOptions.some((language) => language.code === nextSource) && capabilities.pairs.some((pair) => pair.source === nextSource && pair.target === nextTarget)) {
      setSourceLanguage(nextSource);
      setTargetLanguage(nextTarget);
    }
  }

  function selectImage(file) {
    setError('');
    setImage(null);
    if (!file) return;
    if (!acceptedTypes.has(file.type)) return setError('Choose a JPG, PNG, or WebP image.');
    if (file.size > capabilities.maxFileSize) return setError(`This image is larger than the ${formatSize(capabilities.maxFileSize)} limit.`);
    if (!file.size) return setError('This image is empty. Choose another file.');
    setImage(file);
  }

  async function startTranslation() {
    if (!image || !ready || submitting) return;
    setSubmitting(true);
    setError('');
    const form = new FormData();
    form.append('document', image);
    form.append('sourceLanguage', sourceLanguage);
    form.append('targetLanguage', targetLanguage);
    try {
      const { data } = await api.post('/translations/images', form);
      navigate(`/translation/${data.job.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not start image translation. Check the backend and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const unavailableMessage = !capabilities.configured
    ? 'Add credentials or a URL for at least one translation provider in backend/.env.'
    : !capabilities.reachable
      ? capabilities.message || 'Check provider credentials and network access, then retry.'
      : 'Choose a language pair supported by a configured provider.';

  return (
    <WorkspaceLayout active="image" dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchPlaceholder="Search translations">
      <main className="translation-tool-content">
        <div className="document-breadcrumb"><Link to="/dashboard">Dashboard</Link><ArrowRight size={13} /><span>Image translator</span></div>
        <header className="translation-tool-heading"><span className="translation-tool-icon image-tool-icon"><FileImage size={23} /></span><div><span className="welcome-kicker"><Sparkles size={13} /> IMAGE WORKSPACE</span><h1>Translate an image</h1><p>Extract text from an image, translate it, then review or download the result.</p></div></header>
        <nav className="translation-mode-tabs" aria-label="Translation type"><Link to="/translate/document">PDF document</Link><Link className="active" to="/translate/image">Image</Link><Link to="/translate/text">Text</Link></nav>

        <div className="translation-tool-grid">
          <section className="translation-tool-card">
            <div className="tool-card-heading"><div><span className="section-kicker">1 / ADD IMAGE</span><h2>Choose a clear image</h2></div><span className="tool-file-limit">JPG Â· PNG Â· WebP Â· {formatSize(capabilities.maxFileSize)} max</span></div>
            <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(event.target.files?.[0])} />
            <div className={`image-upload-zone${dragging ? ' is-dragging' : ''}${image ? ' has-image' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); selectImage(event.dataTransfer.files?.[0]); }}>
              {image ? <><div className="image-preview-frame"><img src={preview} alt="Selected image preview" /></div><div className="selected-image-row"><span className="selected-file-icon"><FileImage size={19} /></span><span className="selected-file-copy"><b title={image.name}>{image.name}</b><small>{formatSize(image.size)} Â· selected locally</small></span><button className="remove-file-button" type="button" onClick={() => { setImage(null); if (inputRef.current) inputRef.current.value = ''; }} aria-label="Remove selected image"><X size={17} /></button></div></> : <><span className="upload-icon"><CloudUpload size={28} /></span><h3>Drop your image here</h3><p>JPG, PNG or WebP. Clear, high-resolution images work best.</p><button className="btn btn-primary choose-file-button mt-3 min-h-9 gap-2 rounded-lg px-4 text-sm" type="button" onClick={() => inputRef.current?.click()}><FileImage size={15} /> Choose image</button></>}
            </div>

            <div className="tool-card-heading language-tool-heading"><div><span className="section-kicker">2 / LANGUAGES</span><h2>Choose translation direction</h2><small className="language-default-hint">Start with English â†’ Hindi. Choose another supported pair from the dropdowns.</small></div><span className={`engine-status${ready ? ' engine-ready supported-pairs-green' : ''}`}><span />{checking ? 'Checking providersâ€¦' : !capabilities.configured ? 'Setup needed' : !capabilities.reachable ? 'Providers offline' : `${capabilities.pairs.length} supported pairs`}</span></div>
            <div className="tool-language-row">
              <label className="document-language-field"><span>FROM</span><span className="language-select-wrap"><Languages size={15} /><select className="language-select" value={sourceLanguage} disabled={!capabilities.reachable} onChange={(event) => setSourceLanguage(event.target.value)}>{sourceOptions.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={14} /></span></label>
              <button className="tool-language-arrow swap-languages" type="button" disabled={!ready || !canSwapLanguages} onClick={swapLanguages} aria-label="Swap languages" title={canSwapLanguages ? 'Swap languages' : 'Reverse language pair is unavailable'}><ArrowRightLeft size={17} /></button>
              <label className="document-language-field"><span>TO</span><span className="language-select-wrap"><select className="language-select" value={targetLanguage} disabled={!capabilities.reachable || !targetCodes.length} onChange={(event) => setTargetLanguage(event.target.value)}><option value="" disabled>Choose language</option>{targetCodes.map((code) => <option key={code} value={code}>{capabilities.languages.find((item) => item.code === code)?.name || code}</option>)}</select><ChevronDown size={14} /></span></label>
            </div>
            {!ready && <div className="tool-unavailable"><LockKeyhole size={17} /><div><b>{!capabilities.reachable ? 'Translation providers are unavailable' : 'Choose a supported language pair'}</b><p>{unavailableMessage}</p>{capabilities.configured && !capabilities.reachable && <button type="button" onClick={() => void refresh()} disabled={checking}><RefreshCw size={14} className={checking ? 'retry-spinner' : ''} /> {checking ? 'Checking providersâ€¦' : 'Check again'}</button>}</div></div>}
            {error && <div className="file-error" role="alert"><CircleAlert size={15} />{error}</div>}
            <button className="btn btn-primary tool-submit-button mt-4 min-h-12 w-full gap-2 rounded-xl text-sm" type="button" disabled={!image || !ready || submitting} onClick={() => void startTranslation()}><Sparkles size={17} />{submitting ? 'Uploading imageâ€¦' : 'Translate image'}<ArrowRight size={16} /></button>
            <p className="tool-privacy-note"><LockKeyhole size={13} /> Image uploads to this backend for OCR. Extracted text is sent to configured translation providers, with automatic fallback if one fails.</p>
          </section>

          <aside className="translation-tool-aside"><section className="translation-aside-card"><span className="aside-heading-icon"><Check size={16} /></span><h2>Image translation steps</h2><ol><li>Upload a JPG, PNG, or WebP image.</li><li>OCR reads English, Hindi, Spanish, or French text.</li><li>Review the recognized text and translated PDF.</li></ol></section><section className="translation-aside-note"><LockKeyhole size={16} /><p>First-time OCR may download language data. Keep the backend online and connected to the internet for that initial setup.</p></section></aside>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
