// node --experimental-strip-types scripts/check-chart.mjs
import assert from 'node:assert/strict';
import { buildBuckets, countByBucket, parseRange } from '../src/lib/chart.ts';

const now = new Date('2026-10-16T05:00:00Z'); // Jum, 12:00 WIB

let b = buildBuckets('3m', now);
assert.equal(b.weekly, true);
assert.equal(b.labels.length, 14);
assert.equal(b.labels[0], '13 Jul');
assert.equal(b.labels.at(-1), '12 Oct');

b = buildBuckets('6m', now);
assert.equal(b.weekly, false);
assert.deepEqual(b.labels, ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);

b = buildBuckets('1y', now);
assert.equal(b.labels.length, 13);
assert.equal(b.labels[0], 'Oct 25');

assert.equal(buildBuckets('ytd', now).labels.length, 10);
const early = buildBuckets('ytd', new Date('2026-02-10T05:00:00Z'));
assert.equal(early.weekly, true);
assert.equal(early.labels[0], '29 Dec');

// 1 Okt 01:00 WIB (= 30 Sep 18:00 UTC) masuk Oct, bukan Sep.
b = buildBuckets('6m', now);
const c = countByBucket(b.starts, ['2026-10-15T09:11:00+00:00', '2026-09-30T18:00:00Z', '2026-09-30T16:00:00Z']);
assert.deepEqual(c, [0, 0, 0, 0, 0, 1, 2]);

assert.equal(parseRange('x'), '1m');
assert.equal(parseRange('ytd'), 'ytd');
console.log('chart ok');
