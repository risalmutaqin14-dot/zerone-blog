import { useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Plus, Trash2, Cloud, ShieldCheck } from 'lucide-react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';

import { card, input, label, btnPrimary, iconBtn } from '../lib/ui.js';
import FormDialog from './FormDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import PasswordInput from './PasswordInput.jsx';

async function call(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal');
  return data;
}

// Nama awal yang masuk akal, mis. "Mac · Chrome". User bisa menggantinya.
function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Perangkat';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}

const when = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'belum pernah';

const registrationError = (e) =>
  e?.name === 'NotAllowedError' ? 'Dibatalkan atau waktu habis.'
    : e?.name === 'InvalidStateError' ? 'Passkey dari perangkat ini sudah terdaftar di akun Anda.'
      : e?.message || 'Gagal menambah passkey.';

/** @param {{ items: { id: string, name: string, device_type: string, backed_up: boolean, created_at: string, last_used_at: string | null }[], unavailable?: boolean }} props */
export default function PasskeyManager({ items, unavailable = false }) {
  const [list, setList] = useState(items);
  const [supported, setSupported] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // passkey yang akan dihapus

  useEffect(() => setSupported(browserSupportsWebAuthn()), []);

  const open = () => {
    setName(deviceName());
    setPassword('');
    setError('');
    setAdding(true);
  };

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const optionsJSON = await call('/api/admin/passkeys/options', 'POST', { currentPassword: password });
      const response = await startRegistration({ optionsJSON });
      const created = await call('/api/admin/passkeys', 'POST', { response, name });
      setList([...list, created]);
      setAdding(false);
    } catch (e) {
      setError(registrationError(e));
    } finally {
      setPassword('');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await call(`/api/admin/passkeys/${pending.id}`, 'DELETE');
      setList(list.filter((p) => p.id !== pending.id));
      setPending(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={`${card} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-1 to-brand-2 text-white shadow-sm"><Fingerprint size={20} /></span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Passkey</h2>
              <p className="mt-0.5 max-w-xl text-sm text-slate-500">
                Masuk tanpa password memakai sidik jari, Face ID, atau PIN perangkat. Passkey tidak bisa dicuri lewat halaman palsu dan tetap butuh perangkat Anda.
              </p>
            </div>
          </div>
          <button type="button" onClick={open} disabled={!supported || unavailable} className={btnPrimary}><Plus size={16} /> Tambah passkey</button>
        </div>

        {unavailable && <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2 text-sm text-amber-800">Passkey belum aktif di server (tabel passkeys belum dibuat).</p>}
        {!supported && !unavailable && <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2 text-sm text-amber-800">Browser ini belum mendukung passkey. Coba Chrome, Edge, Safari, atau Firefox versi terbaru.</p>}
        {error && !adding && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-2 text-sm text-red-700">{error}</p>}

        <ul className="mt-5 divide-y divide-slate-100">
          {list.length === 0 && <li className="py-6 text-center text-sm text-slate-400">Belum ada passkey. Tambahkan untuk masuk tanpa password.</li>}
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-1/10 text-brand-1"><KeyRound size={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-800">
                  {p.name}
                  {p.backed_up && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"><Cloud size={11} /> Tersinkron</span>}
                </p>
                <p className="text-xs text-slate-500">Ditambahkan {when(p.created_at)} · Terakhir dipakai {when(p.last_used_at)}</p>
              </div>
              <button type="button" aria-label={`Hapus ${p.name}`} onClick={() => { setError(''); setPending(p); }} className={iconBtn}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          <ShieldCheck size={15} className="mt-px shrink-0 text-emerald-600" />
          Menambah passkey selalu meminta password Anda. Saat password diganti, semua passkey akun ini dicabut dan perlu ditambahkan lagi.
        </p>
      </section>

      {adding && (
        <FormDialog title="Tambah passkey" submitLabel="Lanjut" busy={busy} error={error} onSubmit={add} onClose={() => setAdding(false)}>
          <p className="text-sm text-slate-500">Setelah klik Lanjut, perangkat akan meminta sidik jari, Face ID, atau PIN.</p>
          <div>
            <label htmlFor="pk-name" className={label}>Nama passkey</label>
            <input id="pk-name" className={input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="mis. MacBook kantor" />
          </div>
          <div>
            <label htmlFor="pk-pass" className={label}>Password saat ini</label>
            <PasswordInput id="pk-pass" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </div>
        </FormDialog>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Hapus passkey?"
        warning={pending ? `"${pending.name}" tidak bisa dipakai login lagi. Hapus juga dari pengelola password perangkat bila perlu.` : ''}
        confirmLabel="Ya, hapus"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
