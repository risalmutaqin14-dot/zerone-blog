import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { admin } from '../../../db/admin';
import { json } from '../../../lib/posts';

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX = 5 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const file = (await request.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) return json({ error: 'File wajib diisi' }, 400);
  const ext = TYPES[file.type];
  if (!ext) return json({ error: 'Hanya JPG, PNG, WEBP, GIF' }, 400);
  if (file.size > MAX) return json({ error: 'Maksimal 5MB' }, 400);

  const buf = Buffer.from(await file.arrayBuffer());
  // Sekaligus validasi: file yang bukan gambar asli ditolak.
  const meta = await sharp(buf).metadata().catch(() => null);
  if (!meta?.width || !(meta.pageHeight ?? meta.height)) return json({ error: 'File gambar tidak valid' }, 400);
  // EXIF orientation 5-8 = diputar 90 derajat, ukuran tampil tertukar. pageHeight = tinggi satu frame (GIF animasi).
  const swap = (meta.orientation ?? 1) >= 5;
  const h = (meta.pageHeight ?? meta.height)!;
  const width = swap ? h : meta.width;
  const height = swap ? meta.width : h;

  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('blog-images').upload(path, buf, { contentType: file.type });
  if (error) return json({ error: error.message }, 500);
  return json({ url: admin.storage.from('blog-images').getPublicUrl(path).data.publicUrl, width, height });
};
