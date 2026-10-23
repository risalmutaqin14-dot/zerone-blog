import { useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import { btnPrimary, btnGhost } from '../lib/ui.js';

/**
 * Popup form berbasis <dialog>. Render hanya saat dibuka (mount = showModal).
 * Klik backdrop sengaja tidak menutup: isian form bisa hilang tanpa sengaja. Close via Esc, X, or Cancel.
 * @param {{ title: string, submitLabel: string, busy?: boolean, error?: string, onSubmit: () => void, onClose: () => void, children: any, width?: string }} props
 */
export default function FormDialog({ title, submitLabel, busy = false, error = '', onSubmit, onClose, children, width = 'min(94vw,36rem)' }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="fd-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      style={{ width }}
      className="m-auto max-h-[92vh] bg-transparent p-0 backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
    >
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="cd-pop flex max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-linear-to-r from-brand-1/10 to-transparent px-6 py-4">
          <h2 id="fd-title" className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"><X size={18} /></button>
        </div>

        <div className="space-y-3 overflow-y-auto px-6 py-5">
          {children}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button type="button" disabled={busy} onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy && <Loader2 size={16} className="animate-spin" />} {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
