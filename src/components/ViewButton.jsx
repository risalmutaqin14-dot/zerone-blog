import { useState } from 'react';
import { Eye, Loader2, X } from 'lucide-react';

const fmt = (d) =>
  d ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(d)) : '-';

const Row = ({ label, children }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm text-slate-800">{children}</dd>
  </div>
);

// Tombol lihat + popup detail post. Konten sudah di-sanitize server saat disimpan.
// ponytail: author statis "Admin" (schema belum punya kolom author); tambah kolom bila multi-user.
export default function ViewButton({ id, label }) {
  const [open, setOpen] = useState(false);
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  const show = async () => {
    setOpen(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/posts/${id}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal memuat');
      setPost(await res.json());
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <button type="button" onClick={show} aria-label={`Lihat ${label}`} title="Lihat"
        className="rounded-lg p-2 text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition focus:outline-none focus:ring-2 focus:ring-sky-400">
        <Eye size={16} />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={label} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-sm p-4 text-left">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Detail Blog</h3>
              <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Tutup"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {!post && !error && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Memuat...</p>}
              {post && (
                <div className="space-y-5">
                  <h2 className="text-2xl font-bold text-slate-900">{post.title}</h2>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Row label="Author">Admin</Row>
                    <Row label="Kategori">{post.category?.name ?? '-'}</Row>
                    <Row label="Created at">{fmt(post.created_at)}</Row>
                    <Row label="Modified at">{fmt(post.updated_at)}</Row>
                    <Row label="Tag">
                      {post.tags?.length
                        ? <span className="flex flex-wrap gap-1">{post.tags.map((t) => <span key={t} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">#{t}</span>)}</span>
                        : '-'}
                    </Row>
                  </dl>
                  <Row label="Meta image">
                    {post.cover_url
                      ? <img src={post.cover_url} alt="" className="max-h-64 rounded-xl object-cover ring-1 ring-slate-200" />
                      : '-'}
                  </Row>
                  <Row label="Excerpt"><p className="whitespace-pre-line">{post.excerpt || '-'}</p></Row>
                  <Row label="Konten">
                    <div className="tiptap !min-h-0 !p-0" dangerouslySetInnerHTML={{ __html: post.content || '-' }} />
                  </Row>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
