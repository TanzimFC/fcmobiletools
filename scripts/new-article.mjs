#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv.slice(2).join(' ').trim();
if (!input) {
  console.error('Usage: npm run new:article -- "Your article title"');
  process.exit(1);
}

const slug = input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const date = new Date().toISOString().slice(0, 10);
const file = path.join(process.cwd(), 'src', 'content', 'blog', `${slug}.md`);

if (fs.existsSync(file)) {
  console.error(`Article already exists: ${file}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `---\ntitle: "${input.replaceAll('"', '\\"')}"\ndescription: "Write a one or two sentence summary for the article."\ntype: guide\ncategory: Guides\nauthor: TanzimFC\nstatus: draft\npublishedAt: ${date}\ntags: []\nrelatedPlayers: []\nrelatedEvents: []\nrelatedArticles: []\nrelatedTools: []\nrelatedCodes: []\nfeatured: false\nsources: []\n---\n\n# ${input}\n\nStart writing here. Use normal Markdown.\n\n## What you need to know\n\nWrite the article content here.\n`);

console.log(`Created ${path.relative(process.cwd(), file)}`);
console.log('Next: edit the Markdown, set status to published when ready, then run npm run build.');
