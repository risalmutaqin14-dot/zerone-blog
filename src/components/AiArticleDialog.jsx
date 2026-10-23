import { useState } from 'react';
import { Sparkles, ArrowLeft, CircleCheck, TriangleAlert, RefreshCw } from 'lucide-react';
import FormDialog from './FormDialog.jsx';
import PlanChat from './PlanChat.jsx';
import { input, label, btnPrimary } from '../lib/ui.js';

// Popup 3 tahap: brief -> kerangka lengkap (editable, tombol generate) -> artikel final + checklist.
// Hasil tidak disimpan di sini: "Apply to editor" mengirim event 'ai-article' yang ditangkap PostForm.

async function call(path, payload) {
  const res = await fetch(`/api/admin/ai/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

const TITLES = { brief: 'AI article · Brief', outline: 'AI article · Review outline', result: 'AI article · Result' };
const SUBMIT = { brief: 'Generate outline', outline: 'Write final article', result: 'Apply to editor' };
const EMPTY_BP = { title: '', slug: '', excerpt: '', meta_title: '', meta_description: '', sections: '' };

const STEPS = [['brief', 'Brief'], ['outline', 'Outline'], ['result', 'Article']];

const OUTLINE_HINTS = ['Buat judul lebih menarik', 'Tambahkan satu section tentang biaya', 'Perpendek meta description'];

const Stepper = ({ step }) => {
  const cur = STEPS.findIndex(([k]) => k === step);
  return (
    <ol aria-label="Progress" className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
      {STEPS.map(([k, name], i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <li key={k} aria-current={active ? 'step' : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done || active ? 'bg-brand-1 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {done ? <CircleCheck size={14} /> : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{name}</span>
            {i < STEPS.length - 1 && <span className={`h-px flex-1 ${done ? 'bg-brand-1' : 'bg-slate-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
};

const Counter = ({ value, max }) => (
  <span className="ml-1 font-normal" style={{ color: value > max ? '#dc2626' : '#94a3b8' }}>{value}/{max}</span>
);

/** @param {{ plan?: { keyword: string, brief: string } | null }} props plan = dari tombol Create article di list plan; dialog langsung terbuka dengan brief terisi */
export default function AiArticleDialog({ plan = null }) {
  const [open, setOpen] = useState(!!plan);
  const [step, setStep] = useState('brief');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [bp, setBp] = useState(EMPTY_BP);
  const [chat, setChat] = useState([]); // riwayat chat revisi outline, hanya di memori
  const [chatBusy, setChatBusy] = useState(false);
  const [f, setF] = useState({ keyword: plan?.keyword ?? '', related: '', brief: plan?.brief ?? '', language: 'id', tone: '', minWords: 800, sources: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setB = (k) => (e) => setBp((p) => ({ ...p, [k]: e.target.value }));

  const brief = () => ({
    ...f,
    related: f.related.split(',').map((s) => s.trim()).filter(Boolean),
    minWords: Number(f.minWords) || 800,
  });

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const makeOutline = () => run(async () => {
    setBp(await call('outline', brief()));
    setChat([]); // outline baru: riwayat chat lama tidak relevan
    setStep('outline');
  });

  // Chat revisi: AI mengembalikan hanya field yang berubah; sisanya (termasuk sunting manual) tidak disentuh.
  const revise = async (message) => {
    const history = chat.map((m) => ({ role: m.role, text: m.text }));
    setChat((c) => [...c, { role: 'user', text: message }]);
    setChatBusy(true);
    setError('');
    try {
      const data = await call('outline-revise', { ...brief(), blueprint: bp, message, history });
      const keys = Object.keys(data.patch);
      if (keys.length) setBp((p) => ({ ...p, ...data.patch }));
      setChat((c) => [...c, { role: 'ai', text: data.reply, note: keys.length ? `Updated ${keys.join(', ')}` : '' }]);
    } catch (e) {
      setError(e.message);
      setChat((c) => c.slice(0, -1)); // pesan gagal dibuang supaya bisa dikirim ulang
    }
    setChatBusy(false);
  };

  const submit = () => {
    if (step === 'brief') return makeOutline();
    if (step === 'outline') {
      return run(async () => {
        setResult(await call('article', { ...brief(), blueprint: bp }));
        setStep('result');
      });
    }
    window.dispatchEvent(new CustomEvent('ai-article', { detail: result }));
    setOpen(false);
  };

  const back = (to) => (
    <button type="button" disabled={busy} onClick={() => { setError(''); setStep(to); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-1">
      <ArrowLeft size={14} /> Back
    </button>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        <Sparkles size={16} /> Generate article
      </button>

      {open && (
        <FormDialog title={TITLES[step]} submitLabel={busy ? 'Working… (can take up to a minute)' : SUBMIT[step]} busy={busy || chatBusy} error={error} onSubmit={submit} onClose={() => !busy && !chatBusy && setOpen(false)} width={step === 'outline' ? 'min(96vw,76rem)' : 'min(94vw,48rem)'}>
          <Stepper step={step} />
          {step === 'brief' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ai-kw" className={label}>Main keyword</label>
                  <input id="ai-kw" required maxLength={120} value={f.keyword} onChange={set('keyword')} className={input} placeholder="e.g. IHSG" />
                </div>
                <div>
                  <label htmlFor="ai-rel" className={label}>Related keywords <span className="font-normal text-slate-400">(comma separated)</span></label>
                  <input id="ai-rel" value={f.related} onChange={set('related')} className={input} />
                </div>
              </div>
              <div>
                <label htmlFor="ai-brief" className={label}>Brief</label>
                <textarea id="ai-brief" required rows={6} maxLength={4000} value={f.brief} onChange={set('brief')} className={input} placeholder="Goal, angle, audience, key facts, what to avoid." />
              </div>
              <div>
                <label htmlFor="ai-src" className={label}>References <span className="font-normal text-slate-400">(optional, one per line)</span></label>
                <textarea id="ai-src" rows={4} maxLength={6000} value={f.sources} onChange={set('sources')} className={input} placeholder={'Websites, other blogs, journals, Google Scholar, etc.\nhttps://example.com/article\nAuthor (2023). Title. Journal. https://doi.org/...'} />
                <p className="mt-1 text-xs text-slate-500">Listed under a References section at the end, exactly as typed. AI cannot open these links; paste key facts into the brief if the article must use them.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="ai-lang" className={label}>Language</label>
                  <select id="ai-lang" value={f.language} onChange={set('language')} className={input}>
                    <option value="id">Indonesian</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ai-words" className={label}>Min words</label>
                  <input id="ai-words" type="number" min={300} max={3000} step={50} value={f.minWords} onChange={set('minWords')} className={input} />
                </div>
                <div>
                  <label htmlFor="ai-tone" className={label}>Tone <span className="font-normal text-slate-400">(optional)</span></label>
                  <input id="ai-tone" maxLength={100} value={f.tone} onChange={set('tone')} className={input} placeholder="professional" />
                </div>
              </div>
            </>
          )}

          {step === 'outline' && (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                {back('brief')}
                <button type="button" disabled={busy} onClick={makeOutline} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-1 hover:bg-slate-100 disabled:opacity-60">
                  <RefreshCw size={14} /> Regenerate outline
                </button>
              </div>
              <p className="text-xs text-slate-500">Edit anything below. The final article follows exactly what you approve. Regenerating replaces your edits.</p>
              <div>
                <label htmlFor="ai-title" className={label}>Title <Counter value={bp.title.length} max={60} /></label>
                <input id="ai-title" required maxLength={200} value={bp.title} onChange={setB('title')} className={input} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ai-slug" className={label}>Slug</label>
                  <input id="ai-slug" maxLength={120} value={bp.slug} onChange={setB('slug')} className={`${input} font-mono`} />
                </div>
                <div>
                  <label htmlFor="ai-mt" className={label}>Meta title <Counter value={bp.meta_title.length} max={60} /></label>
                  <input id="ai-mt" maxLength={70} value={bp.meta_title} onChange={setB('meta_title')} className={input} />
                </div>
              </div>
              <div>
                <label htmlFor="ai-md" className={label}>Meta description <Counter value={bp.meta_description.length} max={160} /></label>
                <textarea id="ai-md" rows={2} maxLength={160} value={bp.meta_description} onChange={setB('meta_description')} className={input} />
              </div>
              <div>
                <label htmlFor="ai-ex" className={label}>Excerpt</label>
                <textarea id="ai-ex" rows={2} maxLength={500} value={bp.excerpt} onChange={setB('excerpt')} className={input} />
              </div>
              <div>
                <label htmlFor="ai-sec" className={label}>Article structure <span className="font-normal text-slate-400">(headings, paragraph points, table, FAQ, references)</span></label>
                <textarea id="ai-sec" required rows={16} maxLength={8000} value={bp.sections} onChange={setB('sections')} className={`${input} font-mono`} />
              </div>
            </div>
            <PlanChat
              messages={chat}
              busy={chatBusy}
              onSend={revise}
              subtitle='Ask for changes, e.g. "tambah section tentang biaya"'
              intro="AI edits the outline on the left. Only the fields you ask about change; your manual edits are kept."
              hints={OUTLINE_HINTS}
            />
            </div>
          )}

          {step === 'result' && result && (
            <>
              {back('outline')}
              <div className="rounded-xl bg-slate-50 p-3.5">
                <p className="font-semibold text-slate-900">{result.title}</p>
                <p className="mt-1 text-sm text-slate-600">{result.meta_description}</p>
              </div>
              <ul className="space-y-1.5">
                {result.checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    {c.ok
                      ? <CircleCheck size={16} className="mt-0.5 shrink-0" style={{ color: '#059669' }} />
                      : <TriangleAlert size={16} className="mt-0.5 shrink-0" style={{ color: '#d97706' }} />}
                    <span>
                      <span className="font-medium text-slate-800">{c.label}</span>{' '}
                      <span className="text-slate-500">· {c.actual} (target {c.target})</span>
                    </span>
                  </li>
                ))}
              </ul>
              {result.claims_to_verify.length > 0 && (
                <div className="rounded-xl p-3.5 text-sm" style={{ background: '#fffbeb', color: '#92400e' }}>
                  <p className="font-semibold">Verify before publishing</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {result.claims_to_verify.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Applying replaces title, slug, excerpt, SEO fields, and content in the form. Nothing is saved or published until you click Save. Images, links, and reference names are not generated: add them in the editor.
              </p>
            </>
          )}
        </FormDialog>
      )}
    </>
  );
}
