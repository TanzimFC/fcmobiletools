import { discoverAll } from "./sourceClient.ts";
import { normalize } from "./normalize.ts";
import { validateBatch } from "./validation.ts";
import { saveNormalized, saveRaw, loadRaw, loadNormalized } from "./storage.ts";
import { importPlayers } from "./importer.ts";

const command = process.argv[2] ?? "help";

if (command === "discover") {
  const rows = await discoverAll();
  console.log("discovered", rows.length);
  await saveRaw(rows);
} else if (command === "normalize") {
  const rows = await loadRaw();
  const normalized = rows.map(row => normalize(row));
  console.log(validateBatch(normalized));
  await saveNormalized(normalized);
} else if (command === "validate") {
  const rows = await loadNormalized();
  const report = validateBatch(rows);
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
} else if (command === "import") {
  const rows = await loadNormalized();
  const report = validateBatch(rows);
  if (!report.valid) throw new Error("Import blocked by quality gate");
  console.log(await importPlayers(rows));
} else if (command === "sync") {
  const raw = await discoverAll();
  await saveRaw(raw);
  const normalized = raw.map(row => normalize(row));
  await saveNormalized(normalized);
  const report = validateBatch(normalized);
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) throw new Error("Sync blocked by quality gate");
  console.log(await importPlayers(normalized));
} else {
  console.log("discover | normalize | validate | import | sync");
}