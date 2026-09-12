import { defineConfig } from 'astro/config';

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
  site: 'https://tanzimfc.fcmobiletools.workers.dev',
  output: 'static',
  build: { format: 'directory' },
  redirects: {
    '/trivia': '/a-nations-story/',
    '/trivia/': '/a-nations-story/',
    ...nationRedirects
  },
  experimental: {
    preserveScriptOrder: true
  }
});
