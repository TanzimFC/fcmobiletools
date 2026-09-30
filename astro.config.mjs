import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';

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
  build: { format: 'directory' },
  integrations: [sitemap({
    filter: (page) => !new URL(page).pathname.startsWith('/admin')
  })],
  markdown: { remarkPlugins: [remarkGfm] },
  redirects: {
    '/about': '/legal/about/',
    '/about/': '/legal/about/',
    '/trivia': '/a-nations-story/',
    '/blog/category/event guides': '/blog/category/event-guides/',
    '/blog/category/fc mobile 27 news': '/blog/category/fc-mobile-27-news/',
    ...nationRedirects
  },
  experimental: {
    preserveScriptOrder: true
  }
});
