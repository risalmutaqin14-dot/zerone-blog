import { UUID } from './posts';

export const PLAN_STATUS = ['idea', 'planned', 'drafted', 'rejected'] as const;

// Validasi payload plan. Return { error } atau { data }. source/created_by diisi server saat insert.
export function parsePlan(b: any): { error: string } | { data: Record<string, unknown> } {
  const title = String(b?.title ?? '').trim();
  if (!title) return { error: 'Title is required' };
  if (title.length > 200) return { error: 'Title must be at most 200 characters' };
  if (!UUID.test(String(b.website_id ?? ''))) return { error: 'Website is required' };

  const day = String(b.planned_for ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day)
    return { error: 'Invalid plan date' };

  const status = String(b.status ?? 'planned');
  if (!(PLAN_STATUS as readonly string[]).includes(status)) return { error: 'Invalid status' };
  if (b.category_id && !UUID.test(String(b.category_id))) return { error: 'Invalid category' };

  return {
    data: {
      website_id: b.website_id,
      title,
      keyword: String(b.keyword ?? '').trim().slice(0, 100),
      brief: String(b.brief ?? '').trim().slice(0, 2000),
      outline: String(b.outline ?? '').trim().slice(0, 5000),
      category_id: b.category_id || null,
      planned_for: day,
      status,
    },
  };
}
