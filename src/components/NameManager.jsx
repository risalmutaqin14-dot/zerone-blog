import { useState } from 'react';
import { Pencil, Check, X, Plus, Loader2 } from 'lucide-react';
import DeleteButton from './DeleteButton.jsx';

const input = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

async function send(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal');
}

export default function CategoryManager({ categories }) {
  const [name, setName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      location.reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); run(() => send('/api/admin/categories', 'POST', { name })); }} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Nama kategori baru" aria-label="Nama kategori baru" className={`${input} flex-1`} />
        <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambah
        </button>
      </form>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {categories.length === 0 && <p className="p-10 text-center text-slate-500">Belum ada kategori.</p>}
        <ul className="divide-y divide-slate-100">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
              {editId === c.id ? (
                <>
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Nama kategori" className={`${input} flex-1`}
                    onKeyDown={(e) => e.key === 'Enter' && run(() => send(`/api/admin/categories/${c.id}`, 'PUT', { name: editName }))} />
                  <button type="button" aria-label="Simpan" disabled={busy} onClick={() => run(() => send(`/api/admin/categories/${c.id}`, 'PUT', { name: editName }))} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><Check size={16} /></button>
                  <button type="button" aria-label="Batal" onClick={() => setEditId(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs font-mono text-slate-400">{c.slug}</p>
                  </div>
                  <span className="text-xs text-slate-400">{c.posts} post</span>
                  <button type="button" aria-label={`Edit ${c.name}`} onClick={() => { setEditId(c.id); setEditName(c.name); }} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={16} /></button>
                  <DeleteButton endpoint={`/api/admin/categories/${c.id}`} label={c.name} />
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
