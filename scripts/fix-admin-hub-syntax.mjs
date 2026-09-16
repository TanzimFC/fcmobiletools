import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/cms/admin-hub.mjs');
let source = await readFile(file, 'utf8');

// adminHtml() embeds browser JavaScript inside an outer template literal. Keep
// literal backticks out of that embedded browser code so Wrangler/esbuild can
// parse the Worker reliably. Use plain string operations so this helper itself
// has no regex/template-literal parser hazards.
source = source.split("s=s.replace(/`([^`]+)`/g,'<code>$1</code>')").join("s=s.replace(/\\x60([^\\x60]+)\\x60/g,'<code>$1</code>')");
source = source.split("Code:'`'+sel+'`'").join("Code:String.fromCharCode(96)+sel+String.fromCharCode(96)");

// The generated HTML wrapper used a giant single-quoted string. Any apostrophe
// in the HTML can terminate that string and make esbuild report an unrelated
// 'Unterminated string literal' deep inside the CSS. Replace that wrapper using
// literal string boundaries rather than a regex.
const startMarker = "return '<!doctype html>";
const endMarker = "<script>'+js+'</script></body></html>';";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);
if (start !== -1 && end !== -1) {
  const bodyStart = start + startMarker.length;
  const body = source.slice(bodyStart, end);
  const safeBody = body.split('${').join('\\${');
  source = source.slice(0, start)
    + 'return `<!doctype html>' + safeBody + '<script>${js}</script></body></html>`;'
    + source.slice(end + endMarker.length);
}

await writeFile(file, source);

// Deployment trigger: intentionally create a fresh connected Cloudflare/Deno build.
