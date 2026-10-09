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
  server: {
    port: 3000,
    host: true
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: false
    },
    workerEntryPoint: {
      path: 'src/worker.mjs',
      namedExports: []
    }
  }),
  build: { format: 'directory' },
  integrations: [sitemap({
    filter: (page) => {
      const pathname = new URL(page).pathname;
      return ![
        '/admin',
        '/admin/',
        '/creator/login',
        '/creator/login/',
        '/reset-center',
        '/reset-center/',
        '/account',
        '/account/',
        '/profile',
        '/profile/',
        '/profile/public',
        '/profile/public/',
        '/settings',
        '/settings/',
        '/missions',
        '/missions/',
        '/achievements',
        '/achievements/',
        '/leaderboard',
        '/leaderboard/',
        '/rewards',
        '/rewards/',
        '/surveys',
        '/surveys/'
      ].includes(pathname);
    }
  })],
  markdown: { remarkPlugins: [remarkGfm] },
  redirects: {
    '/trivia': '/a-nations-story/',
    '/fcmtv': '/academy/',
    ...nationRedirects
  },
  experimental: {
    preserveScriptOrder: true
  }
});
