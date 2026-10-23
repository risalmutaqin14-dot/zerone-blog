export const RANGES = ['1m', '2m', '3m', '4m', '5m', '6m', 'ytd', '1y'] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = '1m';

export const parseRange = (v: string | null): Range =>
  (RANGES as readonly string[]).includes(v ?? '') ? (v as Range) : DEFAULT_RANGE;

export const rangeLabel = (r: Range) => r.toUpperCase();

export type Mode = 'date' | 'total';
export const parseMode = (v: string | null): Mode => (v === 'total' ? 'total' : 'date');

// Satu warna per website (urutan nama). Dipakai di grafik, kartu, dan badge.
export const SITE_COLORS = ['#1e98c0', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e'];

const DAY = 86_400_000;
const WIB = 7 * 3_600_000; // Asia/Jakarta, tanpa DST
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Semua waktu di sini "WIB-shifted": field UTC = jam dinding Jakarta.
const addMonths = (t: number, n: number) => {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), last));
};

// Rentang <= 92 hari dibucket per minggu (Senin), sisanya per bulan.
export function buildBuckets(range: Range, now = new Date()) {
  const n = now.getTime() + WIB;
  const today = n - (n % DAY);
  const start =
    range === 'ytd'
      ? Date.UTC(new Date(today).getUTCFullYear(), 0, 1)
      : addMonths(today, -(range === '1y' ? 12 : parseInt(range)));
  const weekly = (today - start) / DAY <= 92;

  const starts: number[] = [];
  if (weekly) {
    const dow = (new Date(start).getUTCDay() + 6) % 7;
    for (let t = start - dow * DAY; t <= n; t += 7 * DAY) starts.push(t);
  } else {
    const s = new Date(start);
    for (let t = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1); t <= n; t = addMonths(t, 1)) starts.push(t);
  }

  const labels = starts.map((t) => {
    const d = new Date(t);
    if (weekly) return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
    return MON[d.getUTCMonth()] + (range === '1y' ? ` ${String(d.getUTCFullYear()).slice(2)}` : '');
  });

  return { starts, labels, weekly, fromISO: new Date(starts[0] - WIB).toISOString() };
}

export function countByBucket(starts: number[], times: string[]) {
  const counts = starts.map(() => 0);
  for (const iso of times) {
    const t = new Date(iso).getTime() + WIB;
    let i = starts.length - 1;
    while (i >= 0 && starts[i] > t) i--;
    if (i >= 0) counts[i]++;
  }
  return counts;
}

// Hitungan kumulatif per bucket; base = jumlah sebelum bucket pertama.
export const cumulative = (counts: number[], base = 0) => {
  let sum = base;
  return counts.map((c) => (sum += c));
};

// Kurva monotonik (Fritsch-Carlson): halus tapi tidak pernah melewati nilai data (tak ada undershoot di bawah 0).
export function smoothPath(xs: number[], ys: number[]) {
  const n = xs.length;
  const f = (v: number) => +v.toFixed(2);
  if (n === 0) return '';
  if (n === 1) return `M${f(xs[0])},${f(ys[0])}`;
  const d = xs.slice(1).map((x, i) => x - xs[i]);
  const s = ys.slice(1).map((y, i) => (y - ys[i]) / d[i]);
  const m = xs.map((_, i) =>
    i === 0 ? s[0] : i === n - 1 ? s[n - 2] : s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2,
  );
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / s[i];
    const b = m[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * s[i];
      m[i + 1] = t * b * s[i];
    }
  }
  let p = `M${f(xs[0])},${f(ys[0])}`;
  for (let i = 0; i < n - 1; i++) {
    p += `C${f(xs[i] + d[i] / 3)},${f(ys[i] + (m[i] * d[i]) / 3)} ${f(xs[i + 1] - d[i] / 3)},${f(ys[i + 1] - (m[i + 1] * d[i]) / 3)} ${f(xs[i + 1])},${f(ys[i + 1])}`;
  }
  return p;
}

