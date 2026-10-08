import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ADMIN_PASSWORD, SESSION_SECRET } from 'astro:env/server';

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

const sign = (v: string) => createHmac('sha256', SESSION_SECRET).update(v).digest('hex');

const safeEqual = (a: string, b: string) => {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
};

export const checkPassword = (input: string) => safeEqual(input, ADMIN_PASSWORD);

export const createSession = () => {
  const exp = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${exp}.${sign(exp)}`;
};

export const verifySession = (token?: string) => {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
};
