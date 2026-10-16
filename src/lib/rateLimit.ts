// ponytail: counter di memori proses. Cukup untuk satu server Node (adapter standalone).
// Di serverless/multi-instance tiap instance punya counter sendiri; pindah ke tabel DB atau Redis bila itu terjadi.
// Pertahanan utama tetap lockout per-akun di DB (kolom authors.locked_until).
const hits = new Map<string, { n: number; reset: number }>();

/** true = masih boleh. Memanggil fungsi ini sudah menghitung satu percobaan. */
export function hit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n++;
  return h.n <= max;
}
