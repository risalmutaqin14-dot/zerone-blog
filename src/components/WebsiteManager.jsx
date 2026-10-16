import { useState } from 'react';
import { Pencil, Check, X, KeyRound, Copy, Loader2 } from 'lucide-react';

import { card, input, btnGhost, iconBtn } from '../lib/ui.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const lbl = 'mb-1 block text-xs font-medium text-slate-600';
const COLORS = ['#1e98c0', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e']; // sama dengan SITE_COLORS di chart.ts

async function call(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal');
  return data;
}

const Field = ({ id, label, wide, ...props }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <label htmlFor={id} className={lbl}>{label}</label>
    <input id={id} className={input} {...props} />
  </div>
);

/** @param {{ items: { id: string, name: string, slug: string, allowed_origin: string, revalidate_url: string, has_key: boolean, posts: number }[] }} props */
export default function WebsiteManager({ items }) {
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(null); // { id, key } - hanya di memori, hilang saat reload
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(null); // website yang akan di-regenerate key-nya
  const up = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await call(`/api/admin/websites/${editId}`, 'PUT', edit);
      location.reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const regenerate = async () => {
    const w = pending;
    setBusy(true);
    setError('');
    try {
      const { key } = await call(`/api/admin/websites/${w.id}/key`, 'POST');
      setShown({ id: w.id, key });
      setCopied(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shown.key);
    setCopied(true);
  };

  const editForm = (w) => (
    <div className="flex items-start gap-3">
      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        <Field id={`n-${w.id}`} label="Nama" value={edit.name} maxLength={60} onChange={up('name')} />
        <Field id={`s-${w.id}`} label="Slug" value={edit.slug} maxLength={60} onChange={up('slug')} />
        <Field wide id={`o-${w.id}`} label="Origin CORS (pisahkan koma bila lebih dari satu)" value={edit.allowed_origin}
          placeholder="https://latihan.id,https://www.latihan.id" onChange={up('allowed_origin')} />
        <Field wide id={`r-${w.id}`} label="URL webhook revalidate (kosong = mati)" value={edit.revalidate_url}
          placeholder="https://latihan.id/api/revalidate" onChange={up('revalidate_url')} />
      </div>
      <button type="button" aria-label="Simpan" disabled={busy} onClick={save} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><Check size={16} /></button>
      <button type="button" aria-label="Batal" onClick={() => setEditId(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
    </div>
  );

  const keyBox = () => (
    <div role="status" className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
      <p className="text-xs font-semibold text-amber-800">Salin sekarang. Key tidak akan ditampilkan lagi.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800">{shown.key}</code>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700">
          <Copy size={14} /> {copied ? 'Tersalin' : 'Salin'}
        </button>
        <button type="button" aria-label="Tutup" onClick={() => { setShown(null); location.reload(); }} className="rounded-lg p-2 text-slate-500 hover:bg-amber-100"><X size={14} /></button>
      </div>
    </div>
  );

  const row = (w, i) => (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-sm" style={{ background: COLORS[i % COLORS.length] }}>
        {w.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{w.name} <span className="font-mono text-xs font-normal text-slate-400">{w.slug}</span></p>
        <p className="mt-1 text-xs text-slate-500">Origin: {w.allowed_origin || '-'}</p>
        <p className="text-xs text-slate-500">Webhook: {w.revalidate_url || '-'}</p>
        <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${w.has_key ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          <span className={`size-1.5 rounded-full ${w.has_key ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {w.has_key ? 'API key aktif' : 'Belum ada API key: API menolak semua request'}
        </p>
      </div>
      <span className="mt-1 rounded-full bg-brand-1/10 px-2.5 py-0.5 text-xs font-semibold text-brand-1">{w.posts} post</span>
      <button type="button" disabled={busy} onClick={() => setPending(w)} className={`${btnGhost} px-3 py-2 text-xs`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {w.has_key ? 'Regenerate key' : 'Buat key'}
      </button>
      <button type="button" aria-label={`Edit ${w.name}`}
        onClick={() => { setEditId(w.id); setEdit({ name: w.name, slug: w.slug, allowed_origin: w.allowed_origin, revalidate_url: w.revalidate_url }); }}
        className={iconBtn}><Pencil size={16} /></button>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <ul className={`divide-y divide-slate-100 ${card}`}>
        {items.map((w, i) => (
          <li key={w.id} className="space-y-3 px-5 py-5 transition hover:bg-slate-50/70 first:rounded-t-3xl last:rounded-b-3xl">
            {editId === w.id ? editForm(w) : row(w, i)}
            {shown?.id === w.id && keyBox()}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!pending}
        busy={busy}
        tone={pending?.has_key ? 'danger' : 'brand'}
        title={pending?.has_key ? 'Regenerate API key?' : 'Buat API key'}
        confirmLabel={pending?.has_key ? 'Ya, buat key baru' : 'Buat key'}
        warning={pending?.has_key ? 'Key lama langsung berhenti bekerja. Perbarui env website sebelum menutup halaman ini.' : undefined}
        onConfirm={regenerate}
        onCancel={() => setPending(null)}
      >
        {pending?.has_key
          ? <>Anda akan mengganti key untuk <strong className="text-slate-900">{pending?.name}</strong>. Key baru hanya tampil satu kali.</>
          : <>Buat key akses API untuk <strong className="text-slate-900">{pending?.name}</strong>. Key hanya tampil satu kali.</>}
      </ConfirmDialog>
    </div>
  );
}
