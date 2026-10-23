// node scripts/check-auth.mjs
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, validatePassword } from '../src/lib/password.js';
import { canAccessPath, canEditUser } from '../src/lib/permissions.js';

// --- hash ---
const pw = 'kuda-biru-melompat-99';
const h1 = await hashPassword(pw);
const h2 = await hashPassword(pw);
assert.notEqual(h1, h2, 'salt harus acak');
assert.ok(h1.startsWith('scrypt$32768$8$1$'));
assert.ok(await verifyPassword(pw, h1));
assert.ok(!(await verifyPassword(pw + 'x', h1)));
assert.ok(!(await verifyPassword(pw, '')), 'hash kosong ditolak');
assert.ok(!(await verifyPassword(pw, 'bcrypt$x$y')), 'skema asing ditolak');
const parts = h1.split('$');
parts[5] = (parts[5][0] === 'A' ? 'B' : 'A') + parts[5].slice(1); // ubah byte pertama hash (bukan padding '=')
assert.ok(!(await verifyPassword(pw, parts.join('$'))), 'hash rusak ditolak');

// --- kebijakan password ---
assert.ok(validatePassword('pendek1'));
assert.ok(validatePassword('a'.repeat(129)));
assert.ok(validatePassword('aaaaaaaaaaaaaa'));
assert.ok(validatePassword('budisantoso-2024!', 'budisantoso@x.id'), 'mengandung email');
assert.equal(validatePassword(pw, 'budi@x.id'), '');

// --- izin ---
const dash = ['/dashboard/chart', '/dashboard', '/dashboard/', '/dashboard/posts', '/dashboard/posts/new', '/dashboard/posts/abc/edit',
  '/dashboard/categories', '/dashboard/authors', '/api/admin/posts', '/api/admin/posts/1', '/api/admin/categories/1',
  '/api/admin/authors', '/api/admin/authors/1', '/api/admin/upload',
  '/dashboard/calendar', '/api/admin/ai/article', '/api/admin/ai/outline-revise', '/api/admin/plans', '/api/admin/plans/1'];
const locked = ['/dashboard/websites', '/dashboard/websites/', '/api/admin/websites/1', '/api/admin/websites/1/key',
  '/dashboard/%77ebsites', '/dashboard/posts/../websites', '/dashboard/Websites', '/api/admin/WEBSITES/1',
  '/dashboard//websites', '/dashboard/posts%2f..%2fwebsites'];
for (const p of dash) assert.ok(canAccessPath('admin', p), `admin harus boleh ${p}`);
for (const p of locked) assert.ok(!canAccessPath('admin', p), `admin harus DITOLAK ${p}`);
for (const p of [...dash, ...locked]) assert.ok(canAccessPath('superadmin', p));

assert.ok(canEditUser({ id: 'a', role: 'admin' }, 'a'));
assert.ok(!canEditUser({ id: 'a', role: 'admin' }, 'b'));
assert.ok(canEditUser({ id: 's', role: 'superadmin' }, 'b'));

console.log('check-auth: OK');
