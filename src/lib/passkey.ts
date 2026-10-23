import { cookieOptions } from './auth';

export const PK_COOKIE = import.meta.env.PROD ? '__Host-pk' : 'pk';
export const pkCookie = { ...cookieOptions, maxAge: 300 };

/** RP ID + origin. Produksi: dikunci ke `site` di astro.config (bukan header request). Dev: dari URL request. */
export function rp(url: URL) {
  const u = import.meta.env.PROD ? new URL(import.meta.env.SITE) : url;
  return { rpID: u.hostname, origin: u.origin, rpName: 'Blog Zerone CMS' };
}

export const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64url');
export const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

export const MAX_PASSKEYS = 10;
