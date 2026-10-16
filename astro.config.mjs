// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, envField, fontProviders } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://admin.zerone.id',
  output: 'server',
  integrations: [mdx(), sitemap(), react()],

  env: {
    schema: {
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret' }),
      // API key & origin per website ada di tabel `websites` (menu Websites), bukan di env.
      // Webhook revalidate: URL per website (kolom websites.revalidate_url). Secret dipakai bersama.
      REVALIDATE_SECRET: envField.string({ context: 'server', access: 'secret', default: '' }),
      // Secret untuk GET/POST /api/cron/publish (dipanggil scheduler eksternal). Kosong = endpoint mati.
      CRON_SECRET: envField.string({ context: 'server', access: 'secret', default: '' }),
    },
  },

  fonts: [
      {
          provider: fontProviders.local(),
          name: 'Atkinson',
          cssVariable: '--font-atkinson',
          fallbacks: ['sans-serif'],
          options: {
              variants: [
                  {
                      src: ['./src/assets/fonts/atkinson-regular.woff'],
                      weight: 400,
                      style: 'normal',
                      display: 'swap',
                  },
                  {
                      src: ['./src/assets/fonts/atkinson-bold.woff'],
                      weight: 700,
                      style: 'normal',
                      display: 'swap',
                  },
              ],
          },
      },
    ],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: 'standalone',
  }),
});