export const fmtDate = (d?: string | null) =>
  d
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(d))
    : '-';

export type PostStatus = 'draft' | 'published' | 'scheduled';

export const postStatus = (p: { status: string; published_at: string | null }): PostStatus =>
  p.status !== 'published' ? 'draft' : p.published_at && new Date(p.published_at) > new Date() ? 'scheduled' : 'published';

export const STATUS_STYLE: Record<PostStatus, string> = {
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  scheduled: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  draft: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
