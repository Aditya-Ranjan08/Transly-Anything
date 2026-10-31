import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowRightLeft, ChevronDown, CircleAlert, Languages, LockKeyhole, RefreshCw, Sparkles } from 'lucide-react';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import useProviderCapabilities from '../features/translation/useProviderCapabilities.js';
import recommendedTargetLanguage from '../features/translation/recommendedTargetLanguage.js';
import api from '../lib/api.js';

const MAX_TEXT_CHARACTERS = 50_000;

export default function TextTranslatorPage({ dark, setDark, user, onLogout }) {
  const { capabilities, checking, refresh } = useProviderCapabilities();
  const [text, setText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const targetCodes = useMemo(() => {
    const pairs = capabilities.pairs.filter((pair) => pair.source === sourceLanguage);
    return [...new Set(pairs.map((pair) => pair.target))].sort();
  }, [capabilities.pairs, sourceLanguage]);
  const sourceOptions = useMemo(() => {
    const sources = new Set(capabilities.pairs.map((pair) => pair.source));
    return capabilities.languages.filter((language) => sources.has(language.code));
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

  async function startTranslation() {
    if (!text.trim() || !ready || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/translations/text', { text, sourceLanguage, targetLanguage });
      navigate(`/translation/${data.job.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not start text translation. Check the backend and try again.');
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
    <WorkspaceLayout active="text" dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchPlaceholder="Search translations">
      <main className="translation-tool-content">
        <div className="document-breadcrumb"><Link to="/dashboard">Dashboard</Link><ArrowRight size={13} /><span>Text translator</span></div>
        <header className="translation-tool-heading"><span className="translation-tool-icon text-tool-icon"><Languages size={23} /></span><div><span className="welcome-kicker"><Sparkles size={13} /> TEXT WORKSPACE</span><h1>Translate text</h1><p>Paste a passage and translate it into a language you choose.</p></div></header>
        <nav className="translation-mode-tabs" aria-label="Translation type"><Link to="/translate/document">PDF document</Link><Link to="/translate/image">Image</Link><Link className="active" to="/translate/text">Text</Link></nav>

        <div className="translation-tool-grid text-tool-grid">
          <section className="translation-tool-card">
            <div className="tool-card-heading"><div><span className="section-kicker">1 / YOUR TEXT</span><h2>What would you like translated?</h2></div><span className="text-character-count">{text.length.toLocaleString()} / {MAX_TEXT_CHARACTERS.toLocaleString()}</span></div>
            <label className="text-input-label" htmlFor="translation-text">Source text</label>
            <textarea id="translation-text" className="translation-textarea" value={text} maxLength={MAX_TEXT_CHARACTERS} onChange={(event) => { setText(event.target.value); setError(''); }} placeholder="Type or paste text hereâ€¦" />
            <div className="tool-card-heading language-tool-heading"><div><span className="section-kicker">2 / LANGUAGES</span><h2>Choose translation direction</h2><small className="language-default-hint">Start with English â†’ Hindi. Choose another supported pair from the dropdowns.</small></div><span className={`engine-status${ready ? ' engine-ready supported-pairs-green' : ''}`}><span />{checking ? 'Checking providersâ€¦' : !capabilities.configured ? 'Setup needed' : !capabilities.reachable ? 'Providers offline' : `${capabilities.pairs.length} supported pairs`}</span></div>
            <div className="tool-language-row">
              <label className="document-language-field"><span>FROM</span><span className="language-select-wrap"><Languages size={15} /><select className="language-select" value={sourceLanguage} disabled={!capabilities.reachable} onChange={(event) => setSourceLanguage(event.target.value)}>{sourceOptions.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={14} /></span></label>
              <button className="tool-language-arrow swap-languages" type="button" disabled={!ready || !canSwapLanguages} onClick={swapLanguages} aria-label="Swap languages" title={canSwapLanguages ? 'Swap languages' : 'Reverse language pair is unavailable'}><ArrowRightLeft size={17} /></button>
              <label className="document-language-field"><span>TO</span><span className="language-select-wrap"><select className="language-select" value={targetLanguage} disabled={!capabilities.reachable || !targetCodes.length} onChange={(event) => setTargetLanguage(event.target.value)}><option value="" disabled>Choose language</option>{targetCodes.map((code) => <option key={code} value={code}>{capabilities.languages.find((item) => item.code === code)?.name || code}</option>)}</select><ChevronDown size={14} /></span></label>
            </div>
            {!ready && <div className="tool-unavailable"><LockKeyhole size={17} /><div><b>{!capabilities.reachable ? 'Translation providers are unavailable' : 'Choose a supported language pair'}</b><p>{unavailableMessage}</p>{capabilities.configured && !capabilities.reachable && <button type="button" onClick={() => void refresh()} disabled={checking}><RefreshCw size={14} className={checking ? 'retry-spinner' : ''} /> {checking ? 'Checking providersâ€¦' : 'Check again'}</button>}</div></div>}
            {error && <div className="file-error" role="alert"><CircleAlert size={15} />{error}</div>}
            <button className="btn btn-primary tool-submit-button mt-4 min-h-12 w-full gap-2 rounded-xl text-sm" type="button" disabled={!text.trim() || !ready || submitting} onClick={() => void startTranslation()}><Sparkles size={17} />{submitting ? 'Starting translationâ€¦' : 'Translate text'}<ArrowRight size={16} /></button>
            <p className="tool-privacy-note"><LockKeyhole size={13} /> Text is sent to configured translation providers; if one fails, the next provider receives it. Your translation history and result expire after 24 hours.</p>
          </section>
          <aside className="translation-tool-aside"><section className="translation-aside-card"><span className="aside-heading-icon"><Languages size={16} /></span><h2>Clear text in, clear text out</h2><p>Translate up to {MAX_TEXT_CHARACTERS.toLocaleString()} characters at a time. Review the saved source and translation, copy the result, or download it as a PDF or text file.</p></section><section className="translation-aside-note"><LockKeyhole size={16} /><p>Only the text you submit is sent to translation providers. The original stays in your account until its temporary files expire.</p></section></aside>
        </div>
      </main>
    </WorkspaceLayout>
  );
}

