// Emergency public static mode: keep public traffic on the known-good asset path.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';
import cloudflare from '@astrojs/cloudflare';

const nationRedirects = Object.fromEntries(
  ['japan', 'netherlands', 'mexico', 'france', 'brazil'].flatMap((country) => [
    [`/trivia/${country}/`, `/a-nations-story/${country}/`],
    ...Array.from({ length: 9 }, (_, index) => {
      const day = `day-${index + 1}`;
      return [`/trivia/${country}/${day}/`, `/a-nations-story/${country}/${day}/`];
    })
  ])
);

export default defineConfig({
  site: 'https://fcmobiletools.online',
  output: 'static',
  adapter: cloudflare(),
  build: { format: 'directory' },
  integrations: [sitemap({
    filter: (page) => !new URL(page).pathname.startsWith('/admin')
  })],
  markdown: { remarkPlugins: [remarkGfm] },
  redirects: {
    '/trivia': '/a-nations-story/',
    ...nationRedirects
  },
  experimental: {
    preserveScriptOrder: true
  }
});
