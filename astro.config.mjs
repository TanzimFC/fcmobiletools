import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://tanzimfc.fcmobiletools.workers.dev',
  output: 'static',
  integrations: [mdx()],
  publicDir: './assets'
});
