import { input, label } from '../lib/ui.js';

// Warna border atas per kartu (berulang) supaya tiap usulan mudah dibedakan.
const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#6366f1', '#ec4899', '#84cc16'];

const STATUSES = [
  { value: 'idea', label: 'Idea (suggestion)' },
  { value: 'planned', label: 'Planned' },
];

// Satu usulan AI yang bisa disunting sebelum disimpan. State dipegang GeneratePlanDialog.
/** @param {{ n: number, idea: any, today: string, websites: { id: string, name: string }[], categories: { id: string, name: string }[], set: (k: string) => (e: any) => void }} props */
export default function PlanIdeaCard({ n, idea: i, today, websites, categories, set }) {
  const color = COLORS[n % COLORS.length];
  return (
    <div
      style={{ borderTopColor: color }}
      className={`grid gap-3 rounded-2xl border border-t-[6px] border-slate-200 bg-white p-4 shadow-sm transition sm:grid-cols-2 ${i.keep ? '' : 'opacity-50 grayscale'}`}
    >
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: color }}>#{n + 1}</span>
        <label className="inline-flex cursor-pointer select-none items-center gap-3 text-sm font-semibold text-slate-700">
          Save this plan
          <input type="checkbox" role="switch" className="peer sr-only" checked={i.keep} onChange={set('keep')} />
          <span
            aria-hidden="true"
            className={`relative h-7 w-13 shrink-0 rounded-full transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-brand-1/30 ${
              i.keep ? 'bg-linear-to-r from-brand-1 to-brand-2 shadow-inner' : 'bg-slate-300'
            }`}
          >
            <span className={`absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-md transition-transform duration-200 ${i.keep ? 'translate-x-6' : 'translate-x-0'}`} />
          </span>
        </label>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`gp-t${n}`} className={label}>Working title</label>
        <input id={`gp-t${n}`} maxLength={200} value={i.title} onChange={set('title')} className={input} />
      </div>
      <div>
        <label htmlFor={`gp-w${n}`} className={label}>Website</label>
        <select id={`gp-w${n}`} value={i.website_id} onChange={set('website_id')} className={input}>
          {websites.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`gp-d${n}`} className={label}>Plan date</label>
        <input id={`gp-d${n}`} type="date" min={today} value={i.planned_for} onChange={set('planned_for')} className={input} />
      </div>
      <div>
        <label htmlFor={`gp-s${n}`} className={label}>Status</label>
        <select id={`gp-s${n}`} value={i.status} onChange={set('status')} className={input}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`gp-c${n}`} className={label}>Category</label>
        <select id={`gp-c${n}`} value={i.category_id} onChange={set('category_id')} className={input}>
          <option value="">-</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`gp-k${n}`} className={label}>Main keyword</label>
        <input id={`gp-k${n}`} maxLength={100} value={i.keyword} onChange={set('keyword')} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`gp-b${n}`} className={label}>Brief</label>
        <textarea id={`gp-b${n}`} rows={4} maxLength={2000} value={i.brief} onChange={set('brief')} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`gp-o${n}`} className={label}>Outline (optional)</label>
        <textarea id={`gp-o${n}`} rows={4} maxLength={5000} value={i.outline} onChange={set('outline')} className={input} />
      </div>
    </div>
  );
}
