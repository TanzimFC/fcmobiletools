import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/cms/admin-hub.mjs');
let source = await readFile(file, 'utf8');

// adminHtml() embeds browser JavaScript inside a template literal. Literal backticks
// inside that embedded code terminate the outer template literal before Wrangler
// bundles the Worker. Keep the generated browser code identical without using raw
// backtick characters in the outer template.
source = source.replace("s=s.replace(/`([^`]+)`/g,'<code>$1</code>')", "s=s.replace(/\\x60([^\\x60]+)\\x60/g,'<code>$1</code>')");
source = source.replace("Code:'`'+sel+'`'", "Code:String.fromCharCode(96)+sel+String.fromCharCode(96)");

await writeFile(file, source);
