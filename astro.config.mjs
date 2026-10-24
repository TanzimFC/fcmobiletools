// Emergency public static mode: keep public traffic on the known-good asset path.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';
import cloudflare from '@astrojs/cloudflare';
import { optimizeMarkdownImages } from './src/lib/image-delivery.js';
import { buildNationQuestions } from './src/lib/triviaNations.js';
import { stripLocale, withTrailingSlash } from './src/i18n/routes.js';
import { LOCALES, NON_DEFAULT_LOCALES } from './src/i18n/locales.js';

const NATIONS = ['japan', 'netherlands', 'mexico', 'france', 'brazil'];
const DAYS = Array.from({ length: 9 }, (_, i) => `day-${i + 1}`);

// A Nation's Story now lives at /trivia/a-nations-story/. Old URLs are 301'd page by
// page (keeps their search ranking). /a-nations-story/ itself stays as a "we moved" landing page.
const nationRedirects = Object.fromEntries(
  NATIONS.flatMap((country) => [
    [`/trivia/${country}/`, `/trivia/a-nations-story/${country}/`],
    [`/a-nations-story/${country}/`, `/trivia/a-nations-story/${country}/`],
    ...DAYS.flatMap((day) => [
      [`/trivia/${country}/${day}/`, `/trivia/a-nations-story/${country}/${day}/`],
      [`/a-nations-story/${country}/${day}/`, `/trivia/a-nations-story/${country}/${day}/`]
    ])
  ])
);
const questionRedirects = Object.fromEntries(
  buildNationQuestions().map((question) => [question.legacyUrl, question.url])
);
const redirectPaths = new Set([...Object.keys(nationRedirects), ...Object.keys(questionRedirects)]);

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
    // Localized pages are matched by their English path, so /bn/account/ is excluded exactly like
    // /account/. Alternates are only written for pages that really exist in the sitemap.
    i18n: {
      defaultLocale: 'en',
      locales: {
        en: LOCALES.en.hreflang,
        ...Object.fromEntries(NON_DEFAULT_LOCALES.map((code) => [LOCALES[code].prefix, LOCALES[code].hreflang]))
      }
    },
    filter: (page) => {
      const pathname = new URL(page).pathname;
      const englishPath = stripLocale(pathname);
      return ![
        '/a-nations-story/',
        '/trivia/play/',
        '/admin/',
        '/giveaways/claim/',
        '/creator/login/',
        '/reset-center/',
        '/account/',
        '/profile/',
        '/profile/public/',
        '/settings/',
        '/missions/',
        '/achievements/',
        '/leaderboard/',
        '/rewards/',
        '/surveys/'
      ].includes(withTrailingSlash(englishPath)) && !redirectPaths.has(pathname);
    }
  })],
  markdown: { remarkPlugins: [remarkGfm], rehypePlugins: [optimizeMarkdownImages] },
  redirects: {
    '/trivia/season-recap/': '/trivia/extra-time/season-recap/',
    ...nationRedirects,
    ...questionRedirects
  },
  experimental: {
    preserveScriptOrder: true
  }
});
