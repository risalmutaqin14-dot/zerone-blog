import assert from 'node:assert/strict';
import { putChallenge, takeChallenge } from '../src/lib/challenge.js';

const k = putChallenge({ challenge: 'abc', purpose: 'auth' });
assert.deepEqual(takeChallenge(k), { challenge: 'abc', purpose: 'auth' });
assert.equal(takeChallenge(k), null, 'sekali pakai');
assert.equal(takeChallenge('nope'), null);
assert.equal(takeChallenge(undefined), null);
console.log('check-passkey ok');
