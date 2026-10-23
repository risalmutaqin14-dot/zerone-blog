import { useEffect, useRef, useState } from 'react';
import { Loader2, SendHorizontal, Sparkles } from 'lucide-react';

const HINTS = ['Buat judul #1 lebih menarik', 'Ganti semua tanggal ke hari Selasa', 'Tambahkan outline untuk semua plan'];

// Panel chat di samping area review (Generate plan dan Review outline). State pesan dipegang dialog pemanggil; komponen ini hanya tampilan + input.
// Teks bawaan untuk Generate plan; dialog lain mengganti lewat props.
/** @param {{ messages: { role: 'user' | 'ai', text: string, note?: string }[], busy: boolean, onSend: (text: string) => void, subtitle?: string, intro?: string, hints?: string[] }} props */
export default function PlanChat({
  messages,
  busy,
  onSend,
  subtitle = 'Ask for changes, e.g. "#2 judul lebih tajam"',
  intro = 'Cards are numbered. Refer to them as #1, #2, ... Only the cards you mention change.',
  hints = HINTS,
}) {
  const [text, setText] = useState('');
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, busy]);

  const send = (t = text) => {
    const v = t.trim();
    if (!v || busy) return;
    setText('');
    onSend(v);
  };

  return (
    <aside className="flex h-[min(34rem,70vh)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-0">
      <header className="flex items-center gap-2 border-b border-slate-100 bg-linear-to-r from-brand-1/10 to-transparent px-4 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-linear-to-br from-brand-1 to-brand-2 text-white"><Sparkles size={14} /></span>
        <div>
          <p className="text-sm font-bold text-slate-900">Refine with AI</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{intro}</p>
            {hints.map((h) => (
              <button key={h} type="button" disabled={busy} onClick={() => send(h)} className="block w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-brand-1 hover:bg-brand-1/5 disabled:opacity-50">
                {h}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'rounded-br-md bg-linear-to-r from-brand-1 to-brand-2 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}>
              {m.text}
              {m.note && <span className="mt-1 block text-xs font-semibold opacity-70">{m.note}</span>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> AI is revising...</div>
        )}
        <div ref={end} />
      </div>

      <div className="flex items-end gap-2 border-t border-slate-100 p-3">
        <textarea
          rows={2}
          maxLength={1000}
          value={text}
          disabled={busy}
          aria-label="Message to AI"
          placeholder="Tell AI what to fix..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault(); // Enter = kirim; jangan sampai men-submit form "Save selected"
              send();
            }
          }}
          className="min-h-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:border-brand-1 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-1/15 disabled:opacity-60"
        />
        <button type="button" onClick={() => send()} disabled={busy || !text.trim()} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-r from-brand-1 to-brand-2 text-white shadow-md shadow-brand-1/25 transition hover:brightness-105 disabled:opacity-50">
          <SendHorizontal size={16} />
        </button>
      </div>
    </aside>
  );
}
