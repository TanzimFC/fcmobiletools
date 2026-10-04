import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.ts";
import type { NormalizedPlayer, RawPlayer } from "./types.ts";

await mkdir(config.outputDir, { recursive: true });

export async function saveRaw(rows: RawPlayer[]) {
  const file = join(config.outputDir, "raw-players.json");
  await writeFile(file, JSON.stringify(rows));
  return file;
}

export async function saveNormalized(rows: NormalizedPlayer[]) {
  const file = join(config.outputDir, "normalized-players.json");
  await writeFile(file, JSON.stringify(rows));
  return file;
}

export async function loadRaw(): Promise<RawPlayer[]> {
  return JSON.parse(await readFile(join(config.outputDir, "raw-players.json"), "utf8"));
}

export async function loadNormalized(): Promise<NormalizedPlayer[]> {
  return JSON.parse(await readFile(join(config.outputDir, "normalized-players.json"), "utf8"));
}