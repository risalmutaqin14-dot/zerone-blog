import { useEffect, useState } from 'react';
import FormDialog from './FormDialog.jsx';
import { input, label } from '../lib/ui.js';

const STATUSES = [
  { value: 'idea', label: 'Idea (suggestion)' },
  { value: 'planned', label: 'Planned' },
  { value: 'drafted', label: 'Drafted (already a post)' },
  { value: 'rejected', label: 'Rejected' },
];

// Add/edit plan popup. Opened from the calendar via attributes data-plan-new (data-day) dan data-plan-id.
/** @param {{ plans: any[], websites: { id: string, name: string }[], categories: { id: string, name: string }[], defaultWebsite?: string }} props */
export default function PlanDialog({ plans, websites, categories, defaultWebsite = '' }) {
  const blank = (day = '') => ({
    website_id: defaultWebsite || websites[0]?.id || '',
    title: '', planned_for: day, status: 'planned', category_id: '', keyword: '', brief: '', outline: '',
  });
  const [form, setForm] = useState(null); // null = tertutup
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const onClick = (e) => {
      const add = e.target.closest('[data-plan-new]');
      const edit = e.target.closest('[data-plan-id]');
      if (!add && !edit) return;
      setError('');
      setConfirmDel(false);
      if (edit) {
        const p = plans.find((x) => x.id === edit.dataset.planId);
        if (!p) return;
        setEditId(p.id);
        setForm({ ...blank(), ...p, category_id: p.category_id ?? '' });
      } else {
        setEditId(null);
        setForm(blank(add.dataset.day));
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const call = async (url, method, body) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      location.reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (!form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = () => call(editId ? `/api/admin/plans/${editId}` : '/api/admin/plans', editId ? 'PUT' : 'POST', form);

  return (
    <FormDialog title={editId ? 'Edit plan' : 'New plan'} submitLabel={editId ? 'Save' : 'Add'} busy={busy} error={error} onClose={() => setForm(null)} onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="pl-title" className={label}>Working title</label>
          <input id="pl-title" required maxLength={200} value={form.title} onChange={set('title')} className={input} autoFocus />
        </div>
        <div>
          <label htmlFor="pl-web" className={label}>Website</label>
          <select id="pl-web" required value={form.website_id} onChange={set('website_id')} className={input}>
            {websites.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pl-day" className={label}>Plan date</label>
          <input id="pl-day" type="date" required value={form.planned_for} onChange={set('planned_for')} className={input} />
        </div>
        <div>
          <label htmlFor="pl-status" className={label}>Status</label>
          <select id="pl-status" value={form.status} onChange={set('status')} className={input}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pl-cat" className={label}>Category</label>
          <select id="pl-cat" value={form.category_id} onChange={set('category_id')} className={input}>
            <option value="">-</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pl-kw" className={label}>Main keyword</label>
          <input id="pl-kw" maxLength={100} value={form.keyword} onChange={set('keyword')} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pl-brief" className={label}>Brief</label>
          <textarea id="pl-brief" rows={3} maxLength={2000} value={form.brief} onChange={set('brief')} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pl-outline" className={label}>Outline</label>
          <textarea id="pl-outline" rows={4} maxLength={5000} value={form.outline} onChange={set('outline')} className={input} />
        </div>
      </div>
      {editId && (
        <div className="pt-1">
          {confirmDel ? (
            <p className="text-sm text-red-700">
              Delete this plan permanently?{' '}
              <button type="button" disabled={busy} onClick={() => call(`/api/admin/plans/${editId}`, 'DELETE')} className="font-semibold underline">Yes, delete</button>{' '}
              <button type="button" onClick={() => setConfirmDel(false)} className="text-slate-500 underline">Cancel</button>
            </p>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className="text-sm text-red-600 hover:underline">Delete plan</button>
          )}
        </div>
      )}
    </FormDialog>
  );
}
