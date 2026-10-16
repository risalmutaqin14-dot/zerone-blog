import { useEffect, useState } from 'react';
import { Pencil, X, Loader2, ImagePlus, ShieldCheck } from 'lucide-react';
import DeleteButton from './DeleteButton.jsx';
import FormDialog from './FormDialog.jsx';
import PasswordInput from './PasswordInput.jsx';

import { card, input, chip, iconBtn } from '../lib/ui.js';

async function send(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal');
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Upload gagal');
  return body.url;
}

// Dipakai untuk categories & users (authors).
// fields: [{ key, label, textarea?, image?, type?, options?, max?, hint? }] - field tambahan selain name.
//   image: true -> upload file, nilai disimpan sebagai URL.
//   type: 'email' | 'password' | 'select' (select memakai options: [{ value, label }]; default = opsi terakhir).
//   password: wajib saat tambah; saat edit kosong = tidak diganti dan tidak dikirim.
// items: { id, name, posts, slug?, can_edit?, can_delete?, ...fields }  (can_* default true)
// reauth: aksi sensitif (tambah user; ubah email/password/role) minta password pelaku saat ini.
/** @param {{ items: any[], endpoint: string, noun: string, reauth?: boolean, fields?: { key: string, label: string, textarea?: boolean, image?: boolean, type?: 'email' | 'password' | 'select', options?: { value: string, label: string }[], max?: number, hint?: string }[] }} props */
export default function NameManager({ items, endpoint, noun, fields = [], reauth = false }) {
  const blank = { name: '', current_password: '', confirm_password: '', ...Object.fromEntries(fields.map((f) => [f.key, f.type === 'select' ? f.options?.[f.options.length - 1]?.value ?? '' : ''])) };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null); // null = mode tambah
  const [orig, setOrig] = useState(null); // email/role awal, untuk mendeteksi perubahan sensitif
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pickImage = async (e, key, value, onChange) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      onChange({ ...value, [key]: await uploadImage(file) });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Tombol 'Tambah' ada di header halaman (slot Astro, di luar island ini), jadi dihubungkan lewat atribut data-open-add.
  useEffect(() => {
    const onClick = (e) => {
      if (!e.target.closest('[data-open-add]')) return;
      setError('');
      setEditId(null);
      setOrig(null);
      setForm(blank);
      setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const startEdit = (c) => {
    setError('');
    setEditId(c.id);
    setOrig({ email: c.email ?? '', role: c.role ?? '' });
    setOpen(true);
    setForm({
      ...blank,
      name: c.name,
      ...Object.fromEntries(fields.map((f) => [f.key, f.type === 'password' ? '' : Array.isArray(c[f.key]) ? c[f.key].join('\n') : (c[f.key] ?? '')])),
    });
  };

  const needsReauth =
    reauth && (editId === null || !!form.password || (!!orig && (form.email !== orig.email || (form.role ?? '') !== orig.role)));

  // Ulangi password: saat tambah, atau saat edit dan password baru diisi.
  const needsConfirm = fields.some((f) => f.type === 'password') && (editId === null || !!form.password);

  const submit = () =>
    run(() => {
      const body = { ...form };
      // Cek salah ketik saja (bukan keamanan): server tidak menerima confirm_password, dan tetap memvalidasi password.
      if (needsConfirm && body.password !== body.confirm_password) throw new Error('Konfirmasi password tidak sama');
      delete body.confirm_password;
      if (editId !== null && !body.password) delete body.password; // kosong = tidak diganti
      if (!needsReauth) delete body.current_password;
      return send(editId ? `${endpoint}/${editId}` : endpoint, editId ? 'PUT' : 'POST', body);
    });

  // Fungsi biasa (bukan komponen) supaya input tidak remount & kehilangan fokus tiap ketikan.
  const renderFields = (value, onChange, idPrefix) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="mb-1 block text-xs font-medium text-slate-600">Nama</label>
        <input id={`${idPrefix}-name`} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} required maxLength={80} placeholder={`Nama ${noun}`} className={input} />
      </div>
      {fields.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const set = (e) => onChange({ ...value, [f.key]: e.target.value });
        return (
          <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">{f.label}</label>
            {f.image ? (
              <div className="flex items-center gap-3">
                {value[f.key] ? (
                  <img src={value[f.key]} alt="" className="size-14 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400"><ImagePlus size={20} /></span>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand-1">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                  {uploading ? 'Mengunggah...' : value[f.key] ? 'Ganti' : 'Upload'}
                  <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploading}
                    onChange={(e) => pickImage(e, f.key, value, onChange)} />
                </label>
                {value[f.key] && !uploading && (
                  <button type="button" aria-label="Hapus gambar" onClick={() => onChange({ ...value, [f.key]: '' })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                )}
              </div>
            ) : f.type === 'select' ? (
              <select id={id} value={value[f.key]} onChange={set} className={input}>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'password' ? (
              <>
                <PasswordInput id={id} value={value[f.key]} onChange={set} maxLength={128} minLength={editId === null ? 12 : undefined}
                  required={editId === null} autoComplete="new-password" placeholder={f.hint} className={input} />
                {needsConfirm && (
                  <div className="mt-3">
                    <label htmlFor={`${id}-confirm`} className="mb-1 block text-xs font-medium text-slate-600">Ulangi password</label>
                    <PasswordInput id={`${id}-confirm`} value={value.confirm_password} onChange={(e) => onChange({ ...value, confirm_password: e.target.value })}
                      maxLength={128} required autoComplete="new-password" className={input} />
                  </div>
                )}
              </>
            ) : f.textarea ? (
              <textarea id={id} rows={3} value={value[f.key]} maxLength={f.max} placeholder={f.hint} onChange={set} className={input} />
            ) : (
              <input id={id} type={f.type === 'email' ? 'email' : 'text'} required={f.type === 'email'} autoComplete={f.type === 'email' ? 'off' : undefined}
                value={value[f.key]} maxLength={f.type === 'email' ? 254 : f.max} placeholder={f.hint} onChange={set} className={input} />
            )}
          </div>
        );
      })}
      {needsReauth && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:col-span-2">
          <label htmlFor={`${idPrefix}-cur`} className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800"><ShieldCheck size={14} /> Konfirmasi: password Anda saat ini</label>
          <PasswordInput id={`${idPrefix}-cur`} required maxLength={128} autoComplete="current-password" value={value.current_password}
            onChange={(e) => onChange({ ...value, current_password: e.target.value })} className={input} />
          <p className="mt-1 text-xs text-amber-700">Diperlukan untuk menambah user atau mengubah email, password, dan role.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {error && !open && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className={card}>
        {items.length === 0 && <p className="p-10 text-center text-slate-500">Belum ada {noun}.</p>}
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-5 py-4 transition first:rounded-t-3xl last:rounded-b-3xl hover:bg-slate-50/70">
              {c.avatar_url
                ? <img src={c.avatar_url} alt="" className="size-10 shrink-0 rounded-full object-cover shadow ring-2 ring-white" />
                : <span className={`${chip} size-10 rounded-full text-sm font-bold`}>{c.name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                  {c.name}
                  {c.role && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.role === 'superadmin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{c.role}</span>
                  )}
                  {c.role && !c.has_login && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">belum bisa login</span>}
                </p>
                {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                {c.slug && <p className="font-mono text-xs text-slate-400">{c.slug}</p>}
                {fields.filter((f) => f.textarea).map((f) => c[f.key] && <p key={f.key} className="mt-1 line-clamp-2 text-xs text-slate-500">{c[f.key]}</p>)}
              </div>
              <span className="mt-1 rounded-full bg-brand-1/10 px-2.5 py-0.5 text-xs font-semibold text-brand-1">{c.posts} post</span>
              {c.can_edit !== false && <button type="button" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)} className={iconBtn}><Pencil size={16} /></button>}
              {c.can_delete !== false && <DeleteButton endpoint={`${endpoint}/${c.id}`} label={c.name} />}
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <FormDialog
          title={editId ? `Edit ${noun}` : `Tambah ${noun}`}
          submitLabel={editId ? 'Simpan' : 'Tambah'}
          busy={busy || uploading}
          error={error}
          onClose={() => setOpen(false)}
          onSubmit={submit}
        >
          {renderFields(form, setForm, 'f')}
        </FormDialog>
      )}
    </div>
  );
}
