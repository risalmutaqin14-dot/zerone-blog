// Buat / reset superadmin. Satu-satunya cara membuat superadmin pertama.
// Pakai: node --env-file=.env scripts/create-superadmin.mjs <email> "<Nama>"
// Password ditanya interaktif (tidak tampil, tidak masuk shell history).
import { createClient } from '@supabase/supabase-js';
import { hashPassword, validatePassword } from '../src/lib/password.js';
import { slugify } from '../src/lib/slug.js';

const [emailArg, ...nameParts] = process.argv.slice(2);
const email = (emailArg ?? '').trim().toLowerCase();
const name = nameParts.join(' ').trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
  console.error('Pakai: node --env-file=.env scripts/create-superadmin.mjs <email> "<Nama>"');
  process.exit(1);
}
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (pakai --env-file=.env).');
  process.exit(1);
}

function ask(q) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let s = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(s);
        }
        if (ch === '\u0003') process.exit(130);
        if (ch === '\u007f' || ch === '\b') s = s.slice(0, -1);
        else s += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await ask('Password (min. 12 karakter): ');
const problem = validatePassword(password, email);
if (problem) {
  console.error(problem);
  process.exit(1);
}
if (password !== (await ask('Ulangi password: '))) {
  console.error('Password tidak sama.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const password_hash = await hashPassword(password);
const creds = { email, password_hash, role: 'superadmin', failed_attempts: 0, locked_until: null };

const { data: existing, error: e1 } = await db.from('authors').select('id').eq('email', email).maybeSingle();
if (e1) throw e1;

if (existing) {
  const { error } = await db.from('authors').update(creds).eq('id', existing.id);
  if (error) throw error;
  await db.from('sessions').delete().eq('user_id', existing.id); // paksa login ulang di semua perangkat
  console.log(`Superadmin diperbarui: ${email} (semua sesi lama dicabut)`);
} else {
  const base = slugify(name) || 'superadmin';
  let slug = base;
  for (let i = 0; i < 3; i++) {
    const { error } = await db.from('authors').insert({ name, slug, ...creds });
    if (!error) {
      console.log(`Superadmin dibuat: ${email}`);
      process.exit(0);
    }
    if (error.code === '23505' && /slug/i.test(error.message)) slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    else throw error;
  }
  throw new Error('Gagal membuat slug unik.');
}
