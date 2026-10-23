import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

// Tombol hapus + modal konfirmasi. `endpoint` mis. /api/admin/posts/<id>
export default function DeleteButton({ endpoint, label }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to delete');
      location.reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Delete ${label}`} title="Delete"
        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition focus:outline-none focus:ring-2 focus:ring-red-400">
        <Trash2 size={16} />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" onKeyDown={(e) => e.key === 'Escape' && !busy && setOpen(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete item?</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium">"{label}"</span> will be permanently deleted and cannot be restored.
            </p>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" autoFocus disabled={busy} onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" disabled={busy} onClick={confirm}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busy && <Loader2 size={14} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
