import { useEffect, useState } from 'react';
import { LogOut, X } from 'lucide-react';

export default function LogoutConfirmDialog({ open, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  async function confirmLogout() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal modal-open px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="modal-box relative max-w-[420px] rounded-2xl p-7" role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title" aria-describedby="logout-confirm-copy">
        <button className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3" type="button" onClick={onCancel} disabled={busy} aria-label="Close logout confirmation"><X size={18} /></button>
        <span className="mb-4 grid size-11 place-items-center rounded-xl bg-error/10 text-error"><LogOut size={20} /></span>
        <span className="badge badge-error badge-outline mb-2">ACCOUNT</span>
        <h2 id="logout-confirm-title" className="mb-2 text-2xl font-semibold">Log out?</h2>
        <p id="logout-confirm-copy" className="text-base-content/70 text-sm leading-relaxed">Are you sure you want to log out of your Transly account?</p>
        <div className="modal-action mt-6">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Stay</button>
          <button type="button" className="btn btn-error" onClick={() => void confirmLogout()} disabled={busy}><LogOut size={16} />{busy ? 'Logging out…' : 'Log out'}</button>
        </div>
      </section>
    </div>
  );
}
