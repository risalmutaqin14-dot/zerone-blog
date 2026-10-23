// Aturan akses dashboard. JS murni supaya bisa dites tanpa Astro.
// DEFAULT DENY: admin hanya boleh path yang terdaftar di sini. Halaman/endpoint baru otomatis
// tertutup untuk admin sampai didaftarkan. Allowlist (bukan denylist) juga menutup trik path
// ter-encode seperti /dashboard/%77ebsites yang lolos dari pencocokan string.

/** @typedef {'superadmin' | 'admin'} Role */

const ADMIN_ALLOWED = [
  /^\/dashboard\/?$/,
  /^\/dashboard\/(posts|categories|authors|security)(\/|$)/,
  /^\/api\/admin\/(posts|categories|authors|upload|passkeys)(\/|$)/,
];

/** @param {Role} role @param {string} pathname */
export const canAccessPath = (role, pathname) =>
  role === 'superadmin' ||
  // Path mencurigakan (traversal, encoding, backslash, //) ditolak mentah-mentah; id sah (uuid) tidak pernah memuatnya.
  (!/\.\.|%|\\|\/\//.test(pathname) && ADMIN_ALLOWED.some((re) => re.test(pathname)));

/** Edit user: diri sendiri, atau superadmin untuk siapa saja. @param {{ id: string, role: Role }} actor @param {string} targetId */
export const canEditUser = (actor, targetId) => actor.role === 'superadmin' || actor.id === targetId;
