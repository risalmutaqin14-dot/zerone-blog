// Aturan akses dashboard. JS murni supaya bisa dites tanpa Astro.
// Admin boleh hampir semua, KECUALI halaman/API Websites (memuat API key rahasia).
// Edit user lain dijaga per-aksi di endpoint authors (canEditUser, cek role, re-auth).
// ponytail: denylist = fitur baru otomatis terbuka untuk admin. Kalau ada area sensitif baru, tambah ke ADMIN_DENIED.

/** @typedef {'superadmin' | 'admin'} Role */

const ADMIN_DENIED = [/^\/(dashboard|api\/admin)\/websites(\/|$)/i];

/** @param {Role} role @param {string} pathname */
export const canAccessPath = (role, pathname) =>
  role === 'superadmin' ||
  // Path mencurigakan (traversal, encoding, backslash, //) ditolak mentah-mentah; id sah (uuid) tidak pernah memuatnya.
  (!/\.\.|%|\\|\/\//.test(pathname) && !ADMIN_DENIED.some((re) => re.test(pathname)));

/** Edit user: diri sendiri, atau superadmin untuk siapa saja. @param {{ id: string, role: Role }} actor @param {string} targetId */
export const canEditUser = (actor, targetId) => actor.role === 'superadmin' || actor.id === targetId;
