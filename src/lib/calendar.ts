// Kalender bulanan. Semua tanggal \"YYYY-MM-DD\" menurut WIB (Asia/Jakarta, tanpa DST), minggu mulai Senin.
const DAY = 86_400_000;
const WIB = 7 * 3_600_000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const wibDay = (iso: string | Date) => new Date(new Date(iso).getTime() + WIB).toISOString().slice(0, 10);

export const parseMonth = (v: string | null, now = new Date()) => (MONTH.test(v ?? '') ? v! : wibDay(now).slice(0, 7));

export function shiftMonth(m: string, n: number) {
  const [, y, mo] = MONTH.exec(m)!;
  return new Date(Date.UTC(+y, +mo - 1 + n, 1)).toISOString().slice(0, 7);
}

export const monthLabel = (m: string) => {
  const [, y, mo] = MONTH.exec(m)!;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(+y, +mo - 1, 1)));
};

// Grid penuh minggu (Sen-Min) yang menutupi bulan. fromISO inklusif, toISO eksklusif (UTC, untuk query timestamptz).
export function monthGrid(m: string) {
  const [, y, mo] = MONTH.exec(m)!;
  const first = Date.UTC(+y, +mo - 1, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const count = Math.ceil((lead + new Date(Date.UTC(+y, +mo, 0)).getUTCDate()) / 7) * 7;
  const start = first - lead * DAY;
  const days = Array.from({ length: count }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
  return { days, fromISO: new Date(start - WIB).toISOString(), toISO: new Date(start + count * DAY - WIB).toISOString() };
}
