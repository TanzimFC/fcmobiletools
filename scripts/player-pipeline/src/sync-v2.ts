import { discoverAll } from "./sourceClient.ts";
import { normalize } from "./normalize.ts";
import { saveRaw, saveNormalized } from "./storage.ts";
import { gateBatch } from "./strictValidation.ts";
import { importFull } from "./supabaseFullImport.ts";

const raw=await discoverAll();
await saveRaw(raw);

const normalized=raw.map(row=>normalize(row));
await saveNormalized(normalized);

const report=gateBatch(normalized);
console.log(JSON.stringify(report,null,2));

if (!report.valid) {
  throw new Error("Quality gate rejected one or more records. No player import performed.");
}

const result=await importFull(normalized);
console.log(JSON.stringify(result,null,2));