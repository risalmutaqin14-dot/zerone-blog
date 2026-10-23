import { useEffect, useState } from 'react';
import FormDialog from './FormDialog.jsx';
import { Check } from 'lucide-react';
import PlanIdeaCard from './PlanIdeaCard.jsx';
import PlanChat from './PlanChat.jsx';
import { input, label } from '../lib/ui.js';

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

// Generate Plan: opsi -> AI mengusulkan -> review/sunting -> simpan yang dipilih. Dibuka lewat atribut data-plan-ai.
/** @param {{ websites: { id: string, name: string }[], categories: { id: string, name: string }[], today: string, defaultWebsite?: string }} props */
export default function GeneratePlanDialog({ websites, categories, today, defaultWebsite = '' }) {
  const [open, setOpen] = useState(false);
  const [ideas, setIdeas] = useState(null); // null = tahap opsi; array = tahap review
  const [opts, setOpts] = useState({ website_ids: [], from: today, to: addDays(today, 13), per_site: 2, theme: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState([]); // riwayat chat revisi, hanya di memori
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    const onClick = (e) => {
      if (!e.target.closest('[data-plan-ai]')) return;
      setError('');
      setIdeas(null);
      setChat([]);
      setOpts((o) => ({ ...o, website_ids: [] })); // sengaja kosong: editor memilih sendiri
      setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const post = async (url, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed');
    return data;
  };

  const generate = async () => {
    if (!opts.website_ids.length) return setError('Pick at least one website');
    setBusy(true);
    setError('');
    try {
      const data = await post('/api/admin/ai/plan', opts);
      if (!data.ideas.length) throw new Error('AI found no strong topic for this range. Try another range or add a theme.');
      setIdeas(data.ideas.map((i) => ({ ...i, keep: true })));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  // Minta AI merevisi card. Patch diterapkan ke state saat ini (edit manual editor tidak ditimpa di luar field yang diminta).
  const revise = async (message) => {
    const history = chat.map((m) => ({ role: m.role, text: m.text }));
    setChat((c) => [...c, { role: 'user', text: message }]);
    setChatBusy(true);
    setError('');
    try {
      const data = await post('/api/admin/ai/plan-revise', {
        message, history, from: opts.from, to: opts.to,
        ideas: ideas.map(({ keep: _k, status: _s, ...i }) => i),
      });
      const touched = data.changes.map((c) => c.n);
      if (data.changes.length) {
        setIdeas((list) => list.map((x, n) => ({ ...x, ...(data.changes.find((c) => c.n === n + 1)?.patch ?? {}) })));
      }
      const note = [
        touched.length ? `Updated ${touched.map((n) => `#${n}`).join(', ')}` : '',
        data.rejected.length ? `Title for ${data.rejected.map((n) => `#${n}`).join(', ')} kept: new title already used in the last 6 months` : '',
      ].filter(Boolean).join('. ');
      setChat((c) => [...c, { role: 'ai', text: data.reply, note }]);
    } catch (e) {
      setChat((c) => [...c, { role: 'ai', text: `Failed: ${e.message}` }]);
    }
    setChatBusy(false);
  };

  // Sekuensial; yang sudah tersimpan dicabut dari daftar supaya retry tidak membuat duplikat.
  const save = async () => {
    const chosen = ideas.filter((i) => i.keep);
    if (!chosen.length) return setError('Select at least one plan');
    setBusy(true);
    setError('');
    let left = ideas;
    try {
      for (const i of chosen) {
        const { keep: _k, ...body } = i;
        await post('/api/admin/plans', body);
        left = left.filter((x) => x !== i);
        setIdeas(left);
      }
      location.reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const toggleSite = (id) =>
    setOpts((o) => ({ ...o, website_ids: o.website_ids.includes(id) ? o.website_ids.filter((x) => x !== id) : [...o.website_ids, id] }));
  const setIdea = (idx) => (k) => (e) =>
    setIdeas((list) => list.map((x, n) => (n === idx ? { ...x, [k]: k === 'keep' ? e.target.checked : e.target.value } : x)));
  const setOpt = (k) => (e) => setOpts({ ...opts, [k]: e.target.value });

  return (
    <FormDialog
      title={ideas ? `Review AI plans (${ideas.filter((i) => i.keep).length}/${ideas.length})` : 'Generate plan'}
      submitLabel={ideas ? 'Save selected' : 'Generate'}
      busy={busy || chatBusy}
      error={error}
      onClose={() => setOpen(false)}
      onSubmit={ideas ? save : generate}
      width={ideas ? 'min(96vw,76rem)' : 'min(94vw,48rem)'}
    >
      {ideas ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {ideas.map((idea, n) => (
              <PlanIdeaCard key={n} n={n} idea={idea} today={today} websites={websites} categories={categories} set={setIdea(n)} />
            ))}
            <button type="button" disabled={busy || chatBusy} onClick={() => setIdeas(null)} className="text-sm text-slate-500 underline">Back to options</button>
          </div>
          <PlanChat messages={chat} busy={chatBusy} onSend={revise} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className={label}>Websites <span className="font-normal text-slate-400">(pick one or more)</span></legend>
            <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
              {websites.map((w) => {
                const on = opts.website_ids.includes(w.id);
                return (
                  <label
                    key={w.id}
                    className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition focus-within:ring-4 focus-within:ring-brand-1/20 ${
                      on ? 'border-brand-1 bg-brand-1/10 text-slate-900 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleSite(w.id)} />
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${on ? 'border-brand-1 bg-brand-1 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {w.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div>
            <label htmlFor="gp-from" className={label}>From</label>
            <input id="gp-from" type="date" required min={today} value={opts.from} onChange={setOpt('from')} className={input} />
          </div>
          <div>
            <label htmlFor="gp-to" className={label}>To</label>
            <input id="gp-to" type="date" required min={opts.from} value={opts.to} onChange={setOpt('to')} className={input} />
          </div>
          <div>
            <label htmlFor="gp-n" className={label}>Max ideas per website</label>
            <select id="gp-n" value={opts.per_site} onChange={(e) => setOpts({ ...opts, per_site: Number(e.target.value) })} className={input}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gp-theme" className={label}>Theme / focus (optional)</label>
            <input id="gp-theme" maxLength={300} value={opts.theme} onChange={setOpt('theme')} className={input} placeholder="e.g. new school year, exam season" />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            No live news: ideas follow recurring Indonesian seasons and evergreen problems. Verify every &quot;Perlu verifikasi&quot; item. Nothing is saved until you press Save.
          </p>
        </div>
      )}
    </FormDialog>
  );
}
