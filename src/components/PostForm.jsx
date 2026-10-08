import { useState } from 'react';
import { Loader2, ImagePlus, X, Save } from 'lucide-react';
import RichEditor from './RichEditor.jsx';
import { slugify } from '../lib/slug.js';

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

async function upload(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Upload gagal');
  return body.url;
}

const field = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const label = 'mb-1.5 block text-sm font-medium text-slate-700';

export default function PostForm({ post, categories = [] }) {
  const [f, setF] = useState({
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    excerpt: post?.excerpt ?? '',
    content: post?.content ?? '',
    cover_url: post?.cover_url ?? '',
    category_id: post?.category_id ?? '',
    tags: post?.tags ?? [],
    status: post?.status ?? 'draft',
    published_at: toLocalInput(post?.published_at),
  });
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (t && !f.tags.includes(t) && f.tags.length < 10) set('tags', [...f.tags, t]);
    setTagInput('');
  };

  const onCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      set('cover_url', await upload(file));
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload = {
      ...f,
      category_id: f.category_id || null,
      published_at: f.published_at ? new Date(f.published_at).toISOString() : null,
    };
    try {
      const res = await fetch(post ? `/api/admin/posts/${post.id}` : '/api/admin/posts', {
        method: post ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal menyimpan');
      if (post) {
        setMsg({ ok: true, text: 'Perubahan tersimpan.' });
        setBusy(false);
      } else {
        location.href = '/dashboard/posts';
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-5">
          <div>
            <label htmlFor="title" className={label}>Judul</label>
            <input id="title" required maxLength={200} value={f.title} className={`${field} text-lg font-semibold`}
              placeholder="Judul artikel"
              onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} />
          </div>
          <div>
            <label htmlFor="slug" className={label}>Slug</label>
            <input id="slug" value={f.slug} className={`${field} font-mono`} placeholder="otomatis-dari-judul"
              onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
          </div>
          <div>
            <label htmlFor="excerpt" className={label}>Excerpt <span className="text-slate-400">({f.excerpt.length}/500)</span></label>
            <textarea id="excerpt" rows={3} maxLength={500} value={f.excerpt} className={field}
              onChange={(e) => set('excerpt', e.target.value)} />
          </div>
        </div>
        <div>
          <span className={label}>Konten</span>
          <RichEditor value={f.content} onChange={(v) => set('content', v)} onUploadImage={upload} />
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
          <div>
            <label htmlFor="status" className={label}>Status</label>
            <select id="status" value={f.status} onChange={(e) => set('status', e.target.value)} className={field}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          {f.status === 'published' && (
            <div>
              <label htmlFor="pub" className={label}>Publish at</label>
              <input id="pub" type="datetime-local" value={f.published_at} onChange={(e) => set('published_at', e.target.value)} className={field} />
              <p className="mt-1 text-xs text-slate-500">Kosong = sekarang. Tanggal masa depan = terjadwal.</p>
            </div>
          )}
          {post && <p className="text-xs text-slate-500">Terakhir diubah: {new Date(post.updated_at).toLocaleString('id-ID')}</p>}
          {msg && (
            <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>
          )}
          <button disabled={busy || uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {post ? 'Simpan perubahan' : 'Simpan post'}
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
          <div>
            <label htmlFor="cat" className={label}>Kategori</label>
            <select id="cat" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} className={field}>
              <option value="">Tanpa kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tag" className={label}>Tags</label>
            <input id="tag" value={tagInput} className={field} placeholder="Ketik lalu Enter"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                else if (e.key === 'Backspace' && !tagInput && f.tags.length) set('tags', f.tags.slice(0, -1));
              }}
              onBlur={addTag} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                  #{t}
                  <button type="button" aria-label={`Hapus tag ${t}`} onClick={() => set('tags', f.tags.filter((x) => x !== t))}><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <span className={label}>Cover</span>
          {f.cover_url ? (
            <div className="relative">
              <img src={f.cover_url} alt="Cover" className="aspect-video w-full rounded-xl object-cover" />
              <button type="button" aria-label="Hapus cover" onClick={() => set('cover_url', '')}
                className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-slate-900"><X size={14} /></button>
            </div>
          ) : (
            <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500">
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {uploading ? 'Mengunggah...' : 'Upload gambar (maks 5MB)'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={onCover} disabled={uploading} />
            </label>
          )}
        </div>
      </aside>
    </form>
  );
}
