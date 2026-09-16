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
// unrelated 'Unterminated string literal' deep inside the CSS. Replace only
// that wrapper without using a fragile regex literal.
const start = source.indexOf("return '<!doctype html>");
const endMarker = "<script>'+js+'</script></body></html>';";
const end = source.indexOf(endMarker, start);
if (start !== -1 && end !== -1) {
  const bodyStart = start + "return '<!doctype html>".length;
  const body = source.slice(bodyStart, end);
  const safeBody = body.replace(/\$\{/g, '\\${');
  source = source.slice(0, start)
    + 'return `<!doctype html>' + safeBody + '<script>${js}</script></body></html>`;'
    + source.slice(end + endMarker.length);
}

await writeFile(file, source);
