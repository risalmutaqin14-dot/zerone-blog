import { useEffect, useRef } from 'react';
import { Loader2, TriangleAlert, KeyRound, X } from 'lucide-react';

const TONES = {
  danger: { ring: 'from-rose-500 to-orange-400', glow: 'bg-rose-400/30', btn: 'from-rose-600 to-orange-500 shadow-rose-500/30 focus-visible:ring-rose-500/40', Icon: TriangleAlert },
  brand: { ring: 'from-brand-1 to-brand-2', glow: 'bg-brand-1/30', btn: 'from-brand-1 to-brand-2 shadow-brand-1/30 focus-visible:ring-brand-1/40', Icon: KeyRound },
};

/**
 * Dialog konfirmasi berbasis <dialog> bawaan (fokus terkunci, Esc menutup).
 * @param {{ open: boolean, title: string, children?: any, warning?: string, confirmLabel?: string, tone?: 'danger'|'brand', busy?: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
export default function ConfirmDialog({ open, title, children, warning, confirmLabel = 'Ya, lanjutkan', tone = 'danger', busy = false, onConfirm, onCancel }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  const t = TONES[tone];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancelRef.current?.focus(); // fokus awal di Batal: Enter tidak sengaja mengonfirmasi
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="cd-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      onClick={(e) => { if (e.target === ref.current && !busy) onCancel(); }}
      className="m-auto w-[min(92vw,26rem)] bg-transparent p-0 text-slate-900 backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
    >
      <div className="cd-pop relative overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5">
        <div aria-hidden className={`pointer-events-none absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full blur-3xl ${t.glow}`} />
        <button type="button" aria-label="Tutup" disabled={busy} onClick={onCancel}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
          <X size={16} />
        </button>

        <div className="relative flex flex-col items-center text-center">
          <span className={`grid size-16 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-8 ring-white ${t.ring}`}>
            <t.Icon size={30} strokeWidth={2.2} />
          </span>
          <h2 id="cd-title" className="mt-4 text-lg font-bold tracking-tight">{title}</h2>
          <div className="mt-1.5 text-sm leading-relaxed text-slate-600">{children}</div>
        </div>

        {warning && (
          <p role="note" className="relative mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-left text-xs font-medium leading-relaxed text-amber-800 ring-1 ring-amber-200">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {warning}
          </p>
        )}

        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300/50 disabled:opacity-50">
            Batal
          </button>
          <button type="button" disabled={busy} onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 disabled:opacity-70 ${t.btn}`}>
            {busy && <Loader2 size={16} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
