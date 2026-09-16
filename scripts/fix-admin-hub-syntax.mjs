import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/cms/admin-hub.mjs');
let source = await readFile(file, 'utf8');

// adminHtml() embeds browser JavaScript inside an outer template literal. Keep
// literal backticks out of that embedded browser code so Wrangler/esbuild can
// parse the Worker reliably.
source = source.replace("s=s.replace(/`([^`]+)`/g,'<code>$1</code>')", "s=s.replace(/\\x60([^\\x60]+)\\x60/g,'<code>$1</code>')");
source = source.replace("Code:'`'+sel+'`'", "Code:String.fromCharCode(96)+sel+String.fromCharCode(96)");

// The generated HTML wrapper used a giant single-quoted string. Any apostrophe
// added to that HTML can terminate the string and make esbuild report an
// unrelated 'Unterminated string literal' deep inside the CSS. Use a template
// literal for the HTML wrapper instead; escape interpolation markers in the
// static HTML so only the existing ${js} placeholder is evaluated.
const htmlReturn = /return '<!doctype html>([\\s\\S]*?)<script>'\\+js\\+'<\\/script><\\/body><\\/html>';/;
source = source.replace(htmlReturn, (_, body) => {
  const safeBody = body.replace(/\\$\\{/g, '\\\\${');
  return 'return `<!doctype html>' + safeBody + '<script>${js}</script></body></html>`;';
});

await writeFile(file, source);
