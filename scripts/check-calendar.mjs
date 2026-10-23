// node --experimental-strip-types scripts/check-calendar.mjs
import assert from 'node:assert/strict';
import { monthGrid, parseMonth, shiftMonth, wibDay } from '../src/lib/calendar.ts';

// Okt 2026: 1 Okt = Kamis -> grid mulai Sen 28 Sep, 5 minggu, berakhir Min 1 Nov.
let g = monthGrid('2026-10');
assert.equal(g.days.length, 35);
assert.equal(g.days[0], '2026-09-28');
assert.equal(g.days.at(-1), '2026-11-01');
assert.equal(g.fromISO, '2026-09-27T17:00:00.000Z'); // 00:00 WIB
assert.equal(g.toISO, '2026-11-01T17:00:00.000Z'); // eksklusif: awal Senin 2 Nov WIB

// Feb 2027 mulai Senin & 28 hari -> pas 4 minggu. Agu 2026 butuh 6 minggu.
assert.equal(monthGrid('2027-02').days.length, 28);
assert.equal(monthGrid('2026-02').days.length, 35); // 1 Feb 2026 = Minggu
assert.equal(monthGrid('2026-08').days.length, 42);

// 01:00 WIB tanggal 1 = 18:00 UTC hari sebelumnya.
assert.equal(wibDay('2026-09-30T18:00:00Z'), '2026-10-01');
assert.equal(wibDay('2026-09-30T16:59:00Z'), '2026-09-30');

assert.equal(shiftMonth('2026-12', 1), '2027-01');
assert.equal(shiftMonth('2026-01', -1), '2025-12');
assert.equal(parseMonth('2026-13'), wibDay(new Date()).slice(0, 7));
assert.equal(parseMonth('2026-05'), '2026-05');
assert.equal(parseMonth('2026-10', new Date('2030-01-01')), '2026-10');
console.log('calendar ok');
