import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const admin = read('admin/articles/index.html');
const lexical = read('admin/articles/lexical-editor.js');
const blog = read('src/lib/blog-supabase.js');
const worker = read('src/worker.mjs');
const blogDir = path.join(root, 'src/content/blog');
const editorialSourceFiles = fs.readdirSync(blogDir).filter((name) => name.endsWith('.md') && name !== '_template.md');
const sourceFieldRe = /^sources:\s*([\\s\\S]*?)(?=^\\S|\\s*$)/m;
const allowedEditorialSource = (url, file) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'ea.com' || host.endsWith('.ea.com') || (file === 'fc-mobile-hall-of-fut-explained.md' && host === 'fut.gg');
  } catch {
    return false;
  }
};
const editorialSourceViolations = [];
for (const file of editorialSourceFiles) {
  const content = read(`src/content/blog/${file}`);
  const frontMatter = content.match(/^---\n([\s\S]*?)\n---/m)?.[1] || '';
  const sourceBlock = frontMatter.match(sourceFieldRe)?.[1] || '';
  for (const match of sourceBlock.matchAll(/https?:\/\/[^\s\"'\],]+/g)) {
    if (!allowedEditorialSource(match[0], file)) editorialSourceViolations.push(`${file}: ${match[0]}`);
  }
}


const checks = [
  [!admin.includes("marked@"), 'admin article hydration must not reparse Supabase HTML with marked'],
  [admin.includes('contentJson') && admin.includes('loadLexical(editor,html,contentJson'), 'admin editor must hydrate Lexical JSON when available'],
  [admin.includes('setFontSize') && admin.includes('setFontFamily'), 'admin font controls must use the Lexical style API'],
  [admin.includes('createModal') || admin.includes('openModal') && admin.includes('editorLinkApply'), 'article link insertion must use the in-app link UI'],
  [admin.includes('currentArticleId') && admin.includes('result?.articleId'), 'new articles must adopt their database ID after first save'],
  [lexical.includes("lexical@0.50.0"), 'editor must use the verified Lexical runtime version'],
  [/registerLink\(editor,/.test(lexical), 'Lexical link plugin must be registered'],
  [lexical.includes('registerTablePlugin(editor)'), 'Lexical table plugin must be registered'],
  [lexical.includes('registerTableSelectionObserver(editor,true)'), 'Lexical table selection observer must be registered'],
  [lexical.includes('$insertTableRowAtSelection') && lexical.includes('$insertTableColumnAtSelection'), 'table row/column actions must use Lexical table utilities'],
  [lexical.includes('$patchStyleText'), 'font/color/highlight styling must use Lexical style patching'],
  [!blog.includes('cacheTtl:15') && blog.includes("cache:'no-store'"), 'public Supabase reads must not use the old edge cache'],
  [!blog.includes("Authorization:'Bearer '"), 'public Supabase reads must use the publishable-key API contract'],
  [!worker.includes('\\\\') , 'Worker must not contain doubled backslash regex escapes'],
  [worker.includes("'cache-control':'no-store'"), 'editorial API responses must be uncacheable'],
  [editorialSourceViolations.length === 0, 'article Sources must contain only EA URLs, except FUT.GG in the Hall of FUT article']
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error('EDITORIAL CHECK FAILED:', message);
  if (editorialSourceViolations.length) for (const item of editorialSourceViolations) console.error('EDITORIAL SOURCE VIOLATION:', item);
  process.exit(1);
}
console.log('Editorial runtime checks passed:', checks.length);
