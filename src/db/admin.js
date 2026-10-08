import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from 'astro:env/server';

// Server-only. Service role melewati RLS: jangan impor dari komponen client.
const url = import.meta.env.PUBLIC_SUPABASE_URL;

if (!url) throw new Error('Set PUBLIC_SUPABASE_URL.');

export const admin = createClient(url, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
