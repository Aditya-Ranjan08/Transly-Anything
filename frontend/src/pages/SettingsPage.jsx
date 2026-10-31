import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Languages, LoaderCircle, LockKeyhole, Moon, Sun, UserRound, X } from 'lucide-react';
import WorkspaceLayout from '../components/WorkspaceLayout.jsx';
import api from '../lib/api.js';

const languages = [['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French']];

export default function SettingsPage({ dark, setDark, user, syncUser, onLogout }) {
  const [language, setLanguage] = useState(user?.preferredLanguage || 'en');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccessOpen, setPasswordSuccessOpen] = useState(false);

  async function saveLanguage(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.patch('/auth/preferences', { preferredLanguage: language });
      syncUser(data.user);
      setMessage(data.message || 'Preference saved.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save your preference.');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const { data } = await api.patch('/auth/password', { currentPassword, newPassword });
      setPasswordMessage(data.message || 'Your password has been changed.');
      setPasswordSuccessOpen(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setPasswordError(requestError.response?.data?.message || 'We could not change your password. Please try again.');
    } finally {
      setPasswordSaving(false);
    }
  }

  return <WorkspaceLayout active="settings" dark={dark} setDark={setDark} user={user} onLogout={onLogout} searchPlaceholder="Search settings">
    <main className="settings-content">
      <div className="document-breadcrumb"><Link to="/dashboard">Dashboard</Link><ArrowRight size={13} /><span>Settings</span></div>
      <header className="settings-heading"><span className="settings-heading-icon"><Languages size={23} /></span><div><span className="welcome-kicker">YOUR WORKSPACE</span><h1>Settings</h1><p>Manage your Transly preferences and account details.</p></div></header>
      <div className="settings-grid">
        <section className="settings-card"><div className="settings-card-heading"><span><UserRound size={18} /></span><div><h2>Account</h2><p>Your signed-in profile</p></div></div><dl className="settings-account"><div><dt>Name</dt><dd>{user?.name || 'â€”'}</dd></div><div><dt>Email</dt><dd>{user?.email || 'â€”'}</dd></div></dl></section>
        <section className="settings-card"><div className="settings-card-heading"><span><LockKeyhole size={18} /></span><div><h2>Change password</h2><p>Update your account password securely</p></div></div><form className="settings-password-form" onSubmit={(event) => void changePassword(event)}><label>Current password<input className="input input-bordered w-full" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label>New password<input className="input input-bordered w-full" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label>Confirm new password<input className="input input-bordered w-full" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label><button className="btn btn-primary settings-password-submit" type="submit" disabled={passwordSaving}>{passwordSaving ? <><LoaderCircle size={15} className="password-saving-icon" /> Updating passwordâ€¦</> : 'Update password'} {!passwordSaving && <ArrowRight size={15} />}</button></form>{passwordMessage && <p className="settings-feedback is-success" role="status">{passwordMessage}</p>}{passwordError && <p className="settings-feedback is-error" role="alert">{passwordError}</p>}</section>
        <section className="settings-card"><div className="settings-card-heading"><span>{dark ? <Moon size={18} /> : <Sun size={18} />}</span><div><h2>Appearance</h2><p>Choose how your workspace looks</p></div></div><button className="btn settings-theme-choice mt-2 h-auto min-h-[57px] w-full justify-start gap-3 border border-base-300 bg-base-100 px-3 py-2 text-left aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary" type="button" onClick={() => setDark(false)} aria-pressed={!dark}><Sun size={18} /><span className="grid flex-1 gap-1 text-left"><b className="font-semibold">Light</b><small className="text-xs text-base-content/65">Bright, clean workspace</small></span>{!dark && <Check size={17} />}</button><button className="btn settings-theme-choice mt-2 h-auto min-h-[57px] w-full justify-start gap-3 border border-base-300 bg-base-100 px-3 py-2 text-left aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary" type="button" onClick={() => setDark(true)} aria-pressed={dark}><Moon size={18} /><span className="grid flex-1 gap-1 text-left"><b className="font-semibold">Dark</b><small className="text-xs text-base-content/65">Comfortable in low light</small></span>{dark && <Check size={17} />}</button></section>
        <section className="settings-card settings-language-card"><div className="settings-card-heading"><span><Languages size={18} /></span><div><h2>Translation preference</h2><p>Default target language when supported by your provider</p></div></div><form onSubmit={(event) => void saveLanguage(event)}><label className="settings-language-label">Preferred target language<select className="select select-bordered w-full" value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label><button className="btn btn-primary settings-save" type="submit" disabled={saving}>{saving ? 'Savingâ€¦' : 'Save preference'} <ArrowRight size={15} /></button></form>{message && <p className="settings-feedback is-success" role="status">{message}</p>}{error && <p className="settings-feedback is-error" role="alert">{error}</p>}</section>
        <section className="settings-card"><div className="settings-card-heading"><span><LockKeyhole size={18} /></span><div><h2>File storage</h2><p>Temporary translation files</p></div></div><p className="settings-help">Uploaded files, generated PDFs and saved text are temporary and expire after 24 hours. Completed jobs remain in your history, but expired files can no longer be downloaded.</p><Link className="settings-history-link" to="/history">Open translation history <ArrowRight size={15} /></Link></section>
      </div>
  </main>
  {passwordSuccessOpen && <div className="modal modal-open bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasswordSuccessOpen(false); }}>
    <section className="modal-box relative w-full max-w-[390px] rounded-2xl p-8 text-center">
      <button className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3" type="button" onClick={() => setPasswordSuccessOpen(false)} aria-label="Close notification"><X size={18} /></button>
      <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-success/10 text-success"><CheckCircle2 size={28} /></span>
      <h2 className="mb-2 text-2xl font-semibold">Password updated</h2>
      <p className="text-base-content/70 text-sm leading-relaxed">Your password has been changed successfully.</p>
      <button className="btn btn-primary mt-6 w-full sm:w-auto" type="button" onClick={() => setPasswordSuccessOpen(false)}>Done <Check size={16} /></button>
    </section>
  </div>}
  </WorkspaceLayout>;
}


