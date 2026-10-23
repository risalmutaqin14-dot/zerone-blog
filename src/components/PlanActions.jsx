import { useState } from 'react';
import { Sparkles, Pencil, CircleCheck, Loader2 } from 'lucide-react';
import DeleteButton from './DeleteButton.jsx';
import { iconBtn } from '../lib/ui.js';

// Kolom aksi list plan: buat artikel (buka Generate article dengan brief dari plan), tandai selesai (status 'drafted' = "Plan done"), edit (dialog dibuka PlanDialog via data-plan-id), hapus.
/** @param {{ id: string, title: string, status: string }} props */
export default function PlanActions({ id, title, status }) {
  const [busy, setBusy] = useState(false);

  const markDone = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plans/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'drafted' }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to mark as done');
      location.reload(); // halaman server-rendered: plan pindah ke card Plan done
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      {status !== 'drafted' && (
        <a href={`/dashboard/posts/new?plan=${id}`} aria-label={`Create article from ${title}`} title="Create article"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-sky-50 hover:text-brand-1 focus:outline-none focus:ring-2 focus:ring-brand-1">
          <Sparkles size={16} />
        </a>
      )}
      {status !== 'drafted' && (
        <button type="button" onClick={markDone} disabled={busy} aria-label={`Mark ${title} as done`} title="Mark as done"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-brand-1 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={16} />}
        </button>
      )}
      <button type="button" data-plan-id={id} aria-label={`Edit ${title}`} title="Edit" className={iconBtn}>
        <Pencil size={16} />
      </button>
      <DeleteButton endpoint={`/api/admin/plans/${id}`} label={title} />
    </div>
  );
}
