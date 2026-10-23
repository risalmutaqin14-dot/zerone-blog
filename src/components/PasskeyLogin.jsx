import { useEffect, useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication } from '@simplewebauthn/browser';

async function getOptions() {
  const res = await fetch('/api/auth/passkey/options', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login passkey sedang tidak tersedia.');
  return data;
}

async function finish(response) {
  const res = await fetch('/api/auth/passkey/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login passkey gagal.');
  location.href = data.redirect || '/dashboard';
}

const message = (e) =>
  e?.name === 'NotAllowedError' ? 'Login passkey dibatalkan atau waktu habis.' : e?.message || 'Login passkey gagal.';

/** Tombol "Masuk dengan passkey" + autofill passkey di kolom email (autocomplete="username webauthn"). */
export default function PasskeyLogin() {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    setSupported(true);
    // Autofill: passkey ikut muncul di saran kolom email. Dibatalkan otomatis kalau tombol diklik.
    browserSupportsWebAuthnAutofill().then(async (ok) => {
      if (!ok) return;
      try {
        const response = await startAuthentication({ optionsJSON: await getOptions(), useBrowserAutofill: true });
        setBusy(true);
        await finish(response);
      } catch (e) {
        if (e?.name !== 'AbortError' && e?.name !== 'NotAllowedError') setError(message(e));
        setBusy(false);
      }
    });
  }, []);

  const login = async () => {
    setError('');
    setBusy(true);
    try {
      await finish(await startAuthentication({ optionsJSON: await getOptions() }));
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  if (!supported) return null;
  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-white/10" /> atau <span className="h-px flex-1 bg-white/10" />
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-2.5">{error}</p>
      )}
      <button
        type="button"
        onClick={login}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-1 disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />} Masuk dengan passkey
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">Sidik jari, Face ID, atau PIN perangkat.</p>
    </div>
  );
}
