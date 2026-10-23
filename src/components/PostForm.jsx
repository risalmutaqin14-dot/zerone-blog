import { useEffect, useRef, useState } from 'react';
import { Loader2, ImagePlus, X, Save, FileText, Search, Settings2, Image as ImageIcon } from 'lucide-react';
import RichEditor from './RichEditor.jsx';
import { slugify } from '../lib/slug.js';
import { card, input as field, label, btnPrimary, chip } from '../lib/ui.js';

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
  return body; // { url, width, height }
}

const Section = ({ icon: Icon, title, hint, children }) => (
  <section className={`${card} p-6`}>
    <div className="mb-5 flex items-center gap-3">
      <span className={chip}><Icon size={18} /></span>
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
    <div className="space-y-5">{children}</div>
  </section>
);

/** @param {{ post?: any, categories?: { id: string, name: string }[], authors?: { id: string, name: string }[], websites?: { id: string, name: string }[] }} props */
export default function PostForm({ post, categories = [], authors = [], websites = [], defaultAuthorId = '' }) {
  const [f, setF] = useState({
    website_id: post?.website_id ?? '',
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    excerpt: post?.excerpt ?? '',
    content: post?.content ?? '',
    cover_url: post?.cover_url ?? '',
    cover_alt: post?.cover_alt ?? '',
    cover_width: post?.cover_width ?? null,
    cover_height: post?.cover_height ?? null,
    canonical_url: post?.canonical_url ?? '',
    og_image: post?.og_image ?? '',
    noindex: post?.noindex ?? false,
    meta_title: post?.meta_title ?? '',
    meta_description: post?.meta_description ?? '',
    author_id: post?.author_id ?? defaultAuthorId,
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

  // Hasil AI Article Generator (AiArticleDialog). Hanya mengisi form; tersimpan sebagai draft saat user klik Save.
  const fRef = useRef(f);
  fRef.current = f;
  const [editorKey, setEditorKey] = useState(0); // RichEditor hanya membaca `value` sekali, jadi di-remount
  useEffect(() => {
    const onAi = (e) => {
      const d = e.detail;
      const cur = fRef.current;
      if ((cur.content || cur.title.trim()) && !window.confirm('Replace the current title, content, and SEO fields with the AI article?')) return;
      setF((p) => ({
        ...p,
        title: d.title.slice(0, 200),
        slug: d.slug,
        excerpt: d.excerpt,
        meta_title: d.meta_title,
        meta_description: d.meta_description,
        content: d.content,
        tags: [...new Set([...p.tags, ...d.tags])].slice(0, 10),
      }));
      setSlugTouched(true);
      setEditorKey((k) => k + 1);
    };
    window.addEventListener('ai-article', onAi);
    return () => window.removeEventListener('ai-article', onAi);
  }, []);

  // Import .md: frontmatter hanya mengisi field yang masih kosong; slug dari file menang atas slug otomatis (belum diedit manual).
  const onImportMd = (m) => {
    const mdSlug = slugTouched ? '' : slugify(m.slug);
    if (mdSlug) setSlugTouched(true);
    setF((p) => {
      const title = p.title.trim() ? p.title : (m.title || '').slice(0, 200);
      return {
        ...p,
        title,
        slug: mdSlug || (slugTouched || p.slug ? p.slug : slugify(title)),
        excerpt: p.excerpt.trim() ? p.excerpt : m.excerpt.slice(0, 500),
        meta_title: p.meta_title.trim() ? p.meta_title : m.meta_title.slice(0, 70),
        meta_description: p.meta_description.trim() ? p.meta_description : m.meta_description.slice(0, 160),
        tags: [...new Set([...p.tags, ...m.tags])].slice(0, 10),
      };
    });
  };

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
      const { url, width, height } = await upload(file);
      setF((p) => ({ ...p, cover_url: url, cover_width: width, cover_height: height }));
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
      author_id: f.author_id || null,
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
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <Section icon={FileText} title="Konten" hint="Judul, slug, ringkasan, dan isi artikel.">
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
          <div>
            <RichEditor key={editorKey} value={f.content} onChange={(v) => set('content', v)} onUploadImage={upload}
              takeTitle={!f.title.trim()}
              onImportMd={onImportMd} />
          </div>
        </Section>

        <Section icon={Search} title="SEO" hint="Tampilan di Google dan preview share.">
          <div>
            <label htmlFor="mtitle" className={label}>Meta title <span className="text-slate-400">({f.meta_title.length}/70)</span></label>
            <input id="mtitle" maxLength={70} value={f.meta_title} className={field} placeholder={f.title || 'Kosong = pakai judul'}
              onChange={(e) => set('meta_title', e.target.value)} />
          </div>
          <div>
            <label htmlFor="mdesc" className={label}>Meta description <span className="text-slate-400">({f.meta_description.length}/160)</span></label>
            <textarea id="mdesc" rows={3} maxLength={160} value={f.meta_description} className={field} placeholder="Kosong = pakai excerpt"
              onChange={(e) => set('meta_description', e.target.value)} />
          </div>
          <div>
            <label htmlFor="canon" className={label}>Canonical URL</label>
            <input id="canon" type="url" maxLength={500} value={f.canonical_url} className={field} placeholder="Kosong = URL artikel ini sendiri"
              onChange={(e) => set('canonical_url', e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Isi hanya kalau artikel ini salinan dari halaman lain.</p>
          </div>
          <div>
            <label htmlFor="og" className={label}>OG image</label>
            <input id="og" type="url" maxLength={500} value={f.og_image} className={field} placeholder="Kosong = pakai cover"
              onChange={(e) => set('og_image', e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Gambar untuk preview share. Disarankan 1200x630.</p>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={f.noindex} onChange={(e) => set('noindex', e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300" />
            <span>
              <span className="font-medium">Noindex</span>
              <span className="block text-xs text-slate-500">Opsional. Biarkan mati agar post terindeks Google. Aktifkan hanya untuk menyembunyikan post ini di website utama (meta robots + sitemap).</span>
            </span>
          </label>
        </Section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <section className={`${card} space-y-4 p-6`}>
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
          <button disabled={busy || uploading} className={`${btnPrimary} w-full py-3`}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {post ? 'Simpan perubahan' : 'Simpan post'}
          </button>
        </section>

        <Section icon={Settings2} title="Pengaturan">
          <div>
            <label htmlFor="site" className={label}>Website</label>
            <select id="site" required value={f.website_id} onChange={(e) => set('website_id', e.target.value)} className={field}>
              <option value="">Pilih website</option>
              {websites.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cat" className={label}>Kategori</label>
            <select id="cat" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} className={field}>
              <option value="">Tanpa kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="author" className={label}>Penulis</label>
            <select id="author" value={f.author_id} onChange={(e) => set('author_id', e.target.value)} className={field}>
              <option value="">Tanpa penulis</option>
              {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-brand-1/10 px-2 py-1 text-xs font-medium text-brand-1">
                  #{t}
                  <button type="button" aria-label={`Hapus tag ${t}`} onClick={() => set('tags', f.tags.filter((x) => x !== t))}><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section icon={ImageIcon} title="Cover">
          {f.cover_url ? (
            <div className="relative">
              <img src={f.cover_url} alt={f.cover_alt} className="aspect-video w-full rounded-xl object-cover" />
              <button type="button" aria-label="Hapus cover" onClick={() => setF((p) => ({ ...p, cover_url: '', cover_alt: '', cover_width: null, cover_height: null }))}
                className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-slate-900"><X size={14} /></button>
            </div>
          ) : (
            <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 text-sm text-slate-500 transition hover:border-brand-1 hover:bg-brand-1/5 hover:text-brand-1 focus-within:ring-2 focus-within:ring-brand-1">
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {uploading ? 'Mengunggah...' : 'Upload gambar (maks 5MB)'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={onCover} disabled={uploading} />
            </label>
          )}
          {f.cover_url && (
            <div>
              <label htmlFor="calt" className={label}>Alt text gambar</label>
              <input id="calt" maxLength={200} value={f.cover_alt} className={field} placeholder="Deskripsikan gambar"
                onChange={(e) => set('cover_alt', e.target.value)} />
            </div>
          )}
        </Section>
      </aside>
    </form>
  );
}
