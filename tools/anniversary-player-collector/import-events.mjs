#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(process.env.FCMT_OUTPUT_DIR || "data");
const INPUT_FILE = path.resolve(process.env.PLAYER_EVENTS_JSON || path.join(DATA_DIR, "player-cards-all-events.json"));
const CATALOG_FILE = path.join(TOOL_DIR, "programs.json");
const REPORT_FILE = path.join(DATA_DIR, "events-import-report.json");
const COMMIT = process.argv.includes("--commit") && !process.argv.includes("--dry-run");
const DEFAULT_SUPABASE_URL = "https://moczgrwxtfexdbjthxpd.supabase.co";
const CHUNK_SIZE = 75;
const EXISTING_FIELDS = [
  "source_card_id", "source_url", "source_slug", "player_name", "card_display_name",
  "is_published", "template_key", "card_tier", "card_category",
  "player_image_asset_key", "card_background_asset_key", "club_logo_asset_key",
  "league_logo_asset_key", "nation_flag_asset_key",
  "player_image_url", "card_background_url", "club_logo_url", "league_logo_url", "nation_flag_url"
];

function readEnvFile(text) {
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const index = normalized.indexOf("=");
    if (index < 1) continue;
    const key = normalized.slice(0, index).trim();
    let value = normalized.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function loadDotEnv() {
  try {
    readEnvFile(await fs.readFile(path.join(TOOL_DIR, ".env"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  // Preserve the common root-level local .env setup too.
  try {
    readEnvFile(await fs.readFile(path.resolve(TOOL_DIR, "../../.env"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function canonicalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.origin + url.pathname;
  } catch {
    return String(value || "");
  }
}

function norm(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function alternates(record) {
  const raw = record.details?.alternatePositions ?? record.alternatePositions ?? [];
  const values = Array.isArray(raw) ? raw : String(raw || "").split(",");
  return [...new Set(values.map((value) => String(value).trim().toUpperCase())
    .filter((value) => /^[A-Z]{2,3}$/.test(value)))];
}

function categoryOf(record) {
  const value = String(record.cardCategory || "").toLowerCase();
  return ["icon", "hero", "base", "player", "event", "unknown"].includes(value) ? value : "unknown";
}

function slugFromUrl(value) {
  try {
    return new URL(value).pathname.split("/").filter(Boolean).at(-1) || "";
  } catch {
    return "";
  }
}

function makeProgramLookups(catalog) {
  const byName = new Map();
  const byUrl = new Map();
  for (const program of catalog.programs || []) {
    byName.set(norm(program.name), program);
    byUrl.set(canonicalUrl(program.url), program);
  }
  return { byName, byUrl };
}

function associationsFor(record, lookups) {
  const names = Array.isArray(record.programs) && record.programs.length
    ? record.programs
    : [record.program || "Unknown program"];
  const urls = Array.isArray(record.sourceProgramUrls) ? record.sourceProgramUrls : [];
  const associations = new Map();
  for (let index = 0; index < names.length; index += 1) {
    const name = String(names[index] || "").trim();
    const byName = lookups.byName.get(norm(name));
    const byUrl = urls.map((url) => lookups.byUrl.get(canonicalUrl(url))).find(Boolean);
    const program = byName || (names.length === 1 ? byUrl : null);
    if (!program) continue;
    associations.set(program.key, {
      program_key: program.key,
      program_name: program.name,
      source_program_url: program.url,
      release_date: program.releaseDate || null
    });
  }
  if (associations.size === 0) {
    const fallback = lookups.byName.get(norm(record.program));
    if (fallback) associations.set(fallback.key, {
      program_key: fallback.key,
      program_name: fallback.name,
      source_program_url: fallback.url,
      release_date: fallback.releaseDate || null
    });
  }
  return [...associations.values()];
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(REPORT_FILE), { recursive: true });
  const temp = REPORT_FILE + ".tmp";
  await fs.writeFile(temp, JSON.stringify(report, null, 2) + "\n", "utf8");
  await fs.rename(temp, REPORT_FILE);
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const bodyText = await response.text();
  let body = null;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = null; }
  if (!response.ok) {
    const message = body?.message || body?.error_description || bodyText || response.statusText;
    throw new Error("HTTP " + response.status + " for " + url + ": " + String(message).slice(0, 500));
  }
  return body;
}

function authHeaders(serviceKey, extra = {}) {
  return { apikey: serviceKey, Authorization: "Bearer " + serviceKey, ...extra };
}

function chunks(array, size = CHUNK_SIZE) {
  const result = [];
  for (let index = 0; index < array.length; index += size) result.push(array.slice(index, index + size));
  return result;
}

function quoteFilter(value) {
  return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

async function getExistingRows(baseUrl, serviceKey, ids) {
  const all = [];
  for (const batch of chunks(ids, 75)) {
    const params = new URLSearchParams();
    params.set("select", EXISTING_FIELDS.join(","));
    params.set("source_card_id", "in.(" + batch.map(quoteFilter).join(",") + ")");
    const rows = await requestJson(baseUrl + "/rest/v1/fc_player_cards?" + params.toString(), {
      headers: authHeaders(serviceKey)
    });
    if (Array.isArray(rows)) all.push(...rows);
  }
  return new Map(all.map((row) => [String(row.source_card_id), row]));
}

function buildCardRow(record, associationList, existing) {
  const sourceUrl = canonicalUrl(record.sourceUrl);
  const mainProgram = associationList.find((item) => item.program_name === record.program)
    || associationList[0]
    || { program_key: "unknown", program_name: String(record.program || "Unknown program"), source_program_url: null };
  const row = {
    source_card_id: String(record.sourceCardId),
    source_slug: String(record.sourceSlug || record.slug || slugFromUrl(sourceUrl) || record.sourceCardId),
    player_name: String(record.name || record.playerName || "Unknown player"),
    card_display_name: String(record.cardDisplayName || record.name || record.playerName || "Unknown player"),
    ovr: Number(record.ovr),
    position: String(record.position || record.positionFromListing || "NA").toUpperCase(),
    alternate_positions: alternates(record),
    program_name: mainProgram.program_name,
    program_key: mainProgram.program_key,
    source_url: sourceUrl,
    source_program_url: mainProgram.source_program_url,
    stats: obj(record.stats),
    stat_extraction: obj(record.statExtraction),
    details: obj(record.details),
    play_styles: Array.isArray(record.playStyles) ? record.playStyles : [],
    skill_points_to_spend: Number.isInteger(record.skillPointsToSpend) ? record.skillPointsToSpend : null,
    skill_points_to_spend_label: String(record.skillPointsToSpendLabel || "Skill Points to Spend"),
    card_category: categoryOf(record),
    collected_at: record.collectedAt || null,
    stats_collected_at: record.statsCollectedAt || null,
    updated_at: new Date().toISOString()
  };

  // New records remain private and use the generic event renderer until reviewed.
  row.card_tier = existing?.card_tier || "event";
  row.template_key = existing?.template_key || "event-generic";
  row.is_published = existing?.is_published === true;
  for (const field of [
    "card_display_name", "player_image_asset_key", "card_background_asset_key",
    "club_logo_asset_key", "league_logo_asset_key", "nation_flag_asset_key",
    "player_image_url", "card_background_url", "club_logo_url", "league_logo_url", "nation_flag_url"
  ]) {
    if (existing && existing[field] !== undefined && existing[field] !== null) row[field] = existing[field];
  }
  return row;
}

async function upsert(baseUrl, serviceKey, table, conflict, rows) {
  for (const [index, batch] of chunks(rows).entries()) {
    const url = baseUrl + "/rest/v1/" + table + "?on_conflict=" + encodeURIComponent(conflict);
    await requestJson(url, {
      method: "POST",
      headers: authHeaders(serviceKey, {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify(batch)
    });
    console.log("  " + table + ": " + Math.min((index + 1) * CHUNK_SIZE, rows.length) + "/" + rows.length);
  }
}

async function main() {
  await loadDotEnv();
  const exportDoc = await readJson(INPUT_FILE);
  const catalog = await readJson(CATALOG_FILE);
  const records = Array.isArray(exportDoc) ? exportDoc : exportDoc.cards;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Expected a non-empty cards array in " + INPUT_FILE + ". Rebuild it with npm run programs:export.");
  }

  const lookups = makeProgramLookups(catalog);
  const issues = [];
  const skippedIncomplete = [];
  const uniqueById = new Map();

  for (const record of records) {
    const id = String(record.sourceCardId || "").trim();
    const url = canonicalUrl(record.sourceUrl);
    if (!id || !url || !record.name || !Number.isFinite(Number(record.ovr)) ||
        Number(record.ovr) < 1 || Number(record.ovr) > 150) {
      issues.push({ sourceCardId: id || null, issue: "missing-or-invalid-identity" });
      continue;
    }
    if (record.statExtraction?.status !== "complete") {
      skippedIncomplete.push({ sourceCardId: id, player: record.name, status: record.statExtraction?.status || "missing" });
      continue;
    }
    const previous = uniqueById.get(id);
    if (previous && canonicalUrl(previous.sourceUrl) !== url) {
      throw new Error("Two different player URLs share sourceCardId " + id + ". Resolve this ID collision before importing.");
    }
    if (!previous) uniqueById.set(id, record);
  }

  const prepared = [...uniqueById.values()];
  const associationRows = [];
  const normalizedCards = prepared.map((record) => {
    const associations = associationsFor(record, lookups);
    if (!associations.length) issues.push({ sourceCardId: String(record.sourceCardId), issue: "no-known-program-association" });
    for (const association of associations) associationRows.push({
      source_card_id: String(record.sourceCardId),
      ...association,
      updated_at: new Date().toISOString()
    });
    return { record, associations };
  });
  const uniqueAssociations = new Map();
  for (const association of associationRows) {
    uniqueAssociations.set(association.source_card_id + "|" + association.program_key, association);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: COMMIT ? "commit" : "dry-run",
    inputFile: path.relative(TOOL_DIR, INPUT_FILE).replaceAll(path.sep, "/"),
    programsInManifest: catalog.programs?.length || 0,
    inputRecords: records.length,
    uniqueValidatedCards: prepared.length,
    skippedIncompleteStats: skippedIncomplete.length,
    skippedInvalidRecords: issues.filter((issue) => issue.issue === "missing-or-invalid-identity").length,
    cardProgramAssociations: uniqueAssociations.size,
    newRecordsStayUnpublished: true,
    assetPolicy: "No image upload or asset-table changes are performed by this importer.",
    issues: issues.slice(0, 100),
    incompleteSamples: skippedIncomplete.slice(0, 20)
  };

  if (!COMMIT) {
    report.nextCommand = "npm run import:events -- --commit";
    await writeReport(report);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Put it only in a local .env file; never commit it.");
  }

  const ids = prepared.map((record) => String(record.sourceCardId));
  const existingRows = await getExistingRows(supabaseUrl, serviceKey, ids);
  const cardRows = [];
  const idConflicts = [];

  for (const entry of normalizedCards) {
    const record = entry.record;
    const id = String(record.sourceCardId);
    const existing = existingRows.get(id);
    if (existing && canonicalUrl(existing.source_url) && canonicalUrl(existing.source_url) !== canonicalUrl(record.sourceUrl)) {
      idConflicts.push({
        sourceCardId: id,
        existingUrl: canonicalUrl(existing.source_url),
        incomingUrl: canonicalUrl(record.sourceUrl)
      });
      continue;
    }
    cardRows.push(buildCardRow(record, entry.associations, existing));
  }

  if (idConflicts.length) {
    report.idConflicts = idConflicts;
    report.mode = "blocked";
    await writeReport(report);
    throw new Error("Import blocked: " + idConflicts.length + " source ID collision(s). See data/events-import-report.json.");
  }

  report.existingCardRowsMatched = existingRows.size;
  report.newCardRows = cardRows.length - existingRows.size;
  report.cardRowsToUpsert = cardRows.length;
  report.associationRowsToUpsert = uniqueAssociations.size;

  // Cards first so the program-association foreign key can resolve. Both operations are idempotent.
  await upsert(supabaseUrl, serviceKey, "fc_player_cards", "source_card_id", cardRows);
  await upsert(supabaseUrl, serviceKey, "fc_player_card_programs", "source_card_id,program_key", [...uniqueAssociations.values()]);

  report.importedAt = new Date().toISOString();
  report.mode = "committed";
  await writeReport(report);
  console.log(JSON.stringify({
    mode: report.mode,
    cardRowsToUpsert: report.cardRowsToUpsert,
    existingCardRowsMatched: report.existingCardRowsMatched,
    newCardRows: report.newCardRows,
    associationRowsToUpsert: report.associationRowsToUpsert,
    skippedIncompleteStats: report.skippedIncompleteStats,
    reportFile: "data/events-import-report.json"
  }, null, 2));
}

main().catch((error) => {
  console.error("Event catalog import failed: " + String(error?.message || error));
  process.exitCode = 1;
});
