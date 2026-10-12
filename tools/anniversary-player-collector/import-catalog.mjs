#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_FILE = path.resolve(ROOT, process.env.PLAYER_CATALOG_JSON || "data/anniversary-3rd-2026.json");
const ASSET_LIBRARY_FILE = path.resolve(ROOT, process.env.PLAYER_ASSET_LIBRARY_JSON || "data/asset-library.json");
const REPORT_FILE = path.resolve(ROOT, "data/catalog-import-report.json");
const SUPABASE_URL_DEFAULT = "https://moczgrwxtfexdbjthxpd.supabase.co";
const PROGRAM_KEY = "anniversary-3rd-2026";
const VALID_KINDS = new Set(["player-card-background", "player-image", "club-logo", "league-logo", "nation-flag"]);
const dryRun = process.argv.includes("--dry-run");
const help = process.argv.includes("--help") || process.argv.includes("-h");

function loadDotEnv(text) {
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

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function helpText() {
  console.log([
    "FC Mobile Anniversary catalog importer",
    "",
    "Run from tools/anniversary-player-collector:",
    "  npm run import:catalog:dry",
    "  npm run import:catalog",
    "",
    "Dry-run validates records and asset files without uploading anything.",
    "Real import stores versioned Cloudinary URLs for the two Anniversary templates and RenderZ URLs for other artwork, then upserts metadata to Supabase.",
    "",
    "Required local .env variables for real import:",
    "  SUPABASE_SERVICE_ROLE_KEY",
    "",
    "Optional:",
    "  SUPABASE_URL (defaults to this site's existing Supabase project)",
    "  ANNIVERSARY_LIVE_MIN_OVR (defaults to 117 only when exact card template metadata is unavailable)",
    "  PLAYER_CATALOG_JSON (defaults to data/anniversary-3rd-2026.json)",
    "  PLAYER_ASSET_LIBRARY_JSON (defaults to data/asset-library.json)",
    "  --publish (optional; publish only after you approve the preview)"
  ].join("\n"));
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return String(value || "");
  }
}

function normalizeKind(kind) {
  return kind === "action-shot" ? "player-image" : kind;
}

function normName(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function templateFromAsset(asset) {
  const source = canonicalUrl(asset?.canonicalSourceUrl || asset?.sourceUrl || "");
  if (/ANNIVERSARY27_LIVE_STATIC$/i.test(source)) return "anniversary27-live";
  if (/ANNIVERSARY27_BASE_STATIC$/i.test(source)) return "anniversary27-base";
  return null;
}

function exactRecordTemplate(record, assets) {
  const wantedOvr = Number(record.ovr);
  const slugWords = String(record.sourceSlug || "").replace(/^\d+-/, "").replace(/-/g, " ");
  const wantedNames = [
    normName(record.name || record.player_name),
    normName(resolveCardDisplayName(record)),
    normName(slugWords)
  ].filter(Boolean);
  const currentCandidates = assets.filter((asset) => {
    if (normalizeKind(asset.kind) !== "player-card-background" || !templateFromAsset(asset)) return false;
    const alt = normName(asset.alt || "");
    const matchingName = wantedNames.some((name) => name && alt.includes(name));
    return matchingName && new RegExp("\\b" + wantedOvr + "\\s*OVR\\b", "i").test(alt);
  });
  if (currentCandidates.length === 1) return templateFromAsset(currentCandidates[0]);
  if (currentCandidates.length > 1) {
    const live = currentCandidates.find((asset) => templateFromAsset(asset) === "anniversary27-live");
    return templateFromAsset(live || currentCandidates[0]);
  }
  return null;
}

function selectAsset(record, kind) {
  const assets = Array.isArray(record.assets) ? record.assets : [];
  const matches = assets.filter((asset) => normalizeKind(asset.kind) === kind);
  if (!matches.length) return null;
  // For the card template, use the exact card's named asset if one exists. The importer
  // deliberately excludes related-card backgrounds from the required per-player asset list.
  if (kind === "player-card-background") {
    const name = normName(record.name);
    const ovr = Number(record.ovr);
    const exact = matches.find((asset) => {
      const alt = normName(asset.alt || "");
      return alt.includes(name) && new RegExp("\\b" + ovr + "\\s*OVR\\b", "i").test(alt) && templateFromAsset(asset);
    });
    if (exact) return exact;
    return matches.find((asset) => templateFromAsset(asset)) || null;
  }
  return matches.find((asset) => asset.localPath) || matches[0];
}

function deriveAssetKey(asset) {
  if (asset.assetKey) return String(asset.assetKey);
  return createHash("sha256").update(normalizeKind(asset.kind) + "|" + canonicalUrl(asset.canonicalSourceUrl || asset.sourceUrl)).digest("hex").slice(0, 20);
}

function safeLocalPath(asset) {
  if (!asset?.localPath) return null;
  const root = path.resolve(ROOT);
  const full = path.resolve(ROOT, asset.localPath);
  if (!full.startsWith(root + path.sep)) throw new Error("Asset path escapes the collector directory: " + asset.localPath);
  return full;
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

function extensionFor(filePath, contentType) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"].includes(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  const type = String(contentType || "").split(";")[0].toLowerCase();
  const types = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/avif": ".avif", "image/gif": ".gif", "image/svg+xml": ".svg" };
  return types[type] || ".bin";
}

function publicUrl(base, objectKey) {
  const encoded = objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return base.replace(/\/+$/, "") + "/" + encoded;
}

const CLOUDINARY_BACKGROUND_URLS = {
  "5b7a16deacdd0a0099e5": "https://res.cloudinary.com/b0qikv7n/image/upload/v1791830025/player-card-background-5b7a16deacdd0a0099e5.webp",
  "6310d43df9e82264f22d": "https://res.cloudinary.com/b0qikv7n/image/upload/v1791830265/player-card-background-6310d43df9e82264f22d.webp"
};

function deliveredAssetUrl(asset) {
  const key = deriveAssetKey(asset);
  if (CLOUDINARY_BACKGROUND_URLS[key]) return CLOUDINARY_BACKGROUND_URLS[key];
  return String(asset?.sourceUrl || asset?.canonicalSourceUrl || "").trim();
}


function resolveCardDisplayName(record) {
  const explicit = String(record.cardDisplayName || record.card_display_name || "").trim();
  if (explicit) return explicit;
  const sourceText = String(record.sourceText || "").replace(/\r/g, "");
  const lines = sourceText.split("\n").map((line) => line.trim()).filter(Boolean);
  const targetOvr = String(record.ovr || "");
  const targetPosition = String(record.position || "").toUpperCase();
  for (let index = 0; index < lines.length - 2; index += 1) {
    if (lines[index] !== targetOvr || lines[index + 1].toUpperCase() !== targetPosition) continue;
    const candidate = lines[index + 2];
    if (candidate && candidate.length <= 32 && !/^\d+$/.test(candidate) && !/^(pace|shooting|passing|dribbling|defending|physical|diving|handling|reflexes|kicking)$/i.test(candidate)) return candidate;
  }
  const name = String(record.name || "Unknown Player").trim();
  const slug = String(record.sourceSlug || "").replace(/^\d+-/, "");
  const wanted = slug.split("-").map((word) => word.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
  const parts = name.split(/\s+/).filter(Boolean);
  const matched = [];
  for (const word of wanted) {
    const found = parts.find((part) => part.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === word);
    if (found && !matched.includes(found)) matched.push(found);
  }
  if (matched.length) return matched.join(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function cardData(record, references, backgroundTemplate) {
  const details = record.details && typeof record.details === "object" ? record.details : {};
  const alternateRaw = details.alternatePositions;
  const alternatePositions = Array.isArray(alternateRaw)
    ? alternateRaw
    : String(alternateRaw || "").split(",").map((value) => value.trim()).filter((value) => /^[A-Z]{2,3}$/i.test(value) && value.toUpperCase() !== String(record.position || "").toUpperCase());
  const statExtraction = record.statExtraction || {};
  const isStatsComplete = statExtraction.status === "complete";
  const hasPlayerImage = Boolean(references.playerImage);
  const hasCardBackground = Boolean(references.cardBackground);
  const isPublished = isStatsComplete && hasPlayerImage && hasCardBackground;
  return {
    source_card_id: String(record.sourceCardId),
    source_slug: String(record.sourceSlug || ""),
    player_name: String(record.name || "Unknown Player"),
    card_display_name: resolveCardDisplayName(record),
    ovr: Number(record.ovr),
    position: String(record.position || "NA").toUpperCase(),
    alternate_positions: alternatePositions,
    program_name: String(record.program || "3rd Anniversary"),
    program_key: PROGRAM_KEY,
    card_tier: backgroundTemplate === "anniversary27-live" ? "high" : "base",
    template_key: backgroundTemplate,
    source_url: canonicalUrl(record.sourceUrl),
    source_program_url: record.sourceProgramUrl || null,
    stats: record.stats || {},
    stat_extraction: statExtraction,
    details,
    play_styles: Array.isArray(record.playStyles) ? record.playStyles : [],
    skill_points_to_spend: Number.isInteger(record.skillPointsToSpend) ? record.skillPointsToSpend : null,
    skill_points_to_spend_label: record.skillPointsToSpendLabel || "Skill Points to Spend",
    player_image_asset_key: references.playerImage?.assetKey || null,
    card_background_asset_key: references.cardBackground?.assetKey || null,
    club_logo_asset_key: references.clubLogo?.assetKey || null,
    league_logo_asset_key: references.leagueLogo?.assetKey || null,
    nation_flag_asset_key: references.nationFlag?.assetKey || null,
    player_image_url: references.playerImage?.publicUrl || null,
    card_background_url: references.cardBackground?.publicUrl || null,
    club_logo_url: references.clubLogo?.publicUrl || null,
    league_logo_url: references.leagueLogo?.publicUrl || null,
    nation_flag_url: references.nationFlag?.publicUrl || null,
    is_published: isPublished,
    collected_at: record.collectedAt || null,
    stats_collected_at: record.statsCollectedAt || null,
    updated_at: new Date().toISOString()
  };
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!response.ok) {
    const message = json?.message || json?.error_description || text || response.statusText;
    throw new Error("HTTP " + response.status + " for " + url + ": " + String(message).slice(0, 500));
  }
  return json;
}

async function upsertSupabase(table, rows, supabaseUrl, serviceKey) {
  const chunkSize = 75;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await requestJson(supabaseUrl.replace(/\/+$/, "") + "/rest/v1/" + table + "?on_conflict=" + (table === "fc_player_assets" ? "asset_key" : "source_card_id"), {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(chunk)
    });
    console.log("  Supabase " + table + ": upserted " + Math.min(index + chunkSize, rows.length) + "/" + rows.length);
  }
}

async function main() {
  if (help) {
    helpText();
    return;
  }

  try {
    loadDotEnv(await readFile(path.join(ROOT, ".env"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const configuredLiveMinOvr = Number.parseInt(process.env.ANNIVERSARY_LIVE_MIN_OVR || "117", 10);
  const liveMinOvr = Number.isInteger(configuredLiveMinOvr) && configuredLiveMinOvr >= 1 && configuredLiveMinOvr <= 150
    ? configuredLiveMinOvr
    : 117;

  const records = JSON.parse(await readFile(DATA_FILE, "utf8"));
  if (!Array.isArray(records) || !records.length) throw new Error("Player JSON must be a non-empty array: " + DATA_FILE);

  let library = [];
  try {
    const parsed = JSON.parse(await readFile(ASSET_LIBRARY_FILE, "utf8"));
    if (Array.isArray(parsed)) library = parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const assetIndex = new Map();
  const addAsset = (asset) => {
    if (!asset || !asset.kind || !VALID_KINDS.has(normalizeKind(asset.kind))) return;
    const normalized = { ...asset, kind: normalizeKind(asset.kind) };
    normalized.assetKey = deriveAssetKey(normalized);
    const previous = assetIndex.get(normalized.assetKey);
    // Prefer library metadata if it has a real local file path; per-card references fill gaps.
    assetIndex.set(normalized.assetKey, previous
      ? { ...normalized, ...previous, kind: normalized.kind, assetKey: normalized.assetKey, localPath: previous.localPath || normalized.localPath }
      : normalized);
  };
  library.forEach(addAsset);
  records.forEach((record) => (Array.isArray(record.assets) ? record.assets : []).forEach(addAsset));

  const templateAssets = {};
  for (const asset of assetIndex.values()) {
    const template = templateFromAsset(asset);
    if (template && asset.kind === "player-card-background") {
      const current = templateAssets[template];
      if (!current || (asset.localPath && !current.localPath)) templateAssets[template] = asset;
    }
  }
  for (const template of ["anniversary27-live", "anniversary27-base"]) {
    if (!templateAssets[template]) throw new Error("Missing shared " + template + " background in data/asset-library.json. Collect one card of each Anniversary type before import.");
    templateAssets[template].kind = "player-card-background";
    assetIndex.set(templateAssets[template].assetKey, templateAssets[template]);
  }

  const prepared = [];
  const issues = [];
  const requiredAssetKeys = new Set();
  let completeStats = 0;
  let publishable = 0;

  for (const record of records) {
    const sourceId = String(record.sourceCardId || "");
    if (!sourceId || !Number.isFinite(Number(record.ovr)) || !record.name) {
      issues.push({ sourceCardId: sourceId || null, issue: "missing-player-identity" });
      continue;
    }

    const specificTemplate = exactRecordTemplate(record, record.assets || []);
    const templateKey = specificTemplate || (Number(record.ovr) >= liveMinOvr ? "anniversary27-live" : "anniversary27-base");
    const selected = {
      playerImage: selectAsset(record, "player-image"),
      clubLogo: selectAsset(record, "club-logo"),
      leagueLogo: selectAsset(record, "league-logo"),
      nationFlag: selectAsset(record, "nation-flag"),
      cardBackground: templateAssets[templateKey]
    };
    const references = {};
    for (const [field, asset] of Object.entries(selected)) {
      if (!asset) {
        references[field] = null;
        continue;
      }
      const key = deriveAssetKey(asset);
      const indexed = assetIndex.get(key) || asset;
      indexed.kind = normalizeKind(indexed.kind || asset.kind);
      indexed.assetKey = key;
      references[field] = { ...indexed, assetKey: key, publicUrl: null };
      requiredAssetKeys.add(key);
    }

    const recordIssues = [];
    if (!references.playerImage) recordIssues.push("missing-player-image");
    if (!references.clubLogo) recordIssues.push("missing-club-logo");
    if (!references.leagueLogo) recordIssues.push("missing-league-logo");
    if (!references.nationFlag) recordIssues.push("missing-nation-flag");
    if (record.statExtraction?.status !== "complete") recordIssues.push("incomplete-stats");
    if (recordIssues.length) issues.push({ sourceCardId: sourceId, player: record.name, issues: recordIssues });

    if (record.statExtraction?.status === "complete") completeStats += 1;
    if (recordIssues.length === 0) publishable += 1;
    prepared.push({ record, templateKey, references, recordIssues });
  }

  for (const asset of assetIndex.values()) {
    if (requiredAssetKeys.has(asset.assetKey)) continue;
    // The only assets outside per-card references are the two reusable templates.
    const template = templateFromAsset(asset);
    if (template) requiredAssetKeys.add(asset.assetKey);
  }

  const neededAssets = [...requiredAssetKeys].map((key) => assetIndex.get(key)).filter(Boolean);
  const assetsMissingUrls = neededAssets.filter((asset) => !deliveredAssetUrl(asset));
  if (assetsMissingUrls.length) {
    issues.push(...assetsMissingUrls.map((asset) => ({
      issue: "missing-source-image-url",
      assetKey: asset.assetKey,
      kind: asset.kind
    })));
  }

  const initialReport = {
    program: "3rd Anniversary",
    sourceJson: path.relative(ROOT, DATA_FILE).replaceAll(path.sep, "/"),
    inputRecords: records.length,
    uniqueRequiredAssets: neededAssets.length,
    completeStats,
    publishableBeforeUpload: publishable,
    missingLocalAssets: 0,
    missingSourceUrls: assetsMissingUrls.length,
    cloudinaryTemplateAssets: Object.keys(CLOUDINARY_BACKGROUND_URLS),
    dryRun,
    publishRequested: process.argv.includes("--publish"),
    issues
  };

  if (dryRun) {
    await writeFile(REPORT_FILE, JSON.stringify(initialReport, null, 2) + "\n");
    console.log(JSON.stringify(initialReport, null, 2));
    if (assetsMissingUrls.length) process.exitCode = 1;
    return;
  }

  const supabaseUrl = env("SUPABASE_URL", SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY in the local .env file before importing.");
  if (assetsMissingUrls.length) throw new Error("Import stopped: " + assetsMissingUrls.length + " referenced assets have no usable URL.");
  if (records.length !== 151) console.warn("Expected 151 Anniversary cards in this snapshot; found " + records.length + ". Continuing with the actual data.");

  // Cloudinary's two versioned Anniversary backgrounds are permanent references;
  // the remaining image URLs use RenderZ directly until an owned image pipeline is added.
  const urlByKey = new Map();
  const assetRows = [];
  for (const asset of neededAssets) {
    const key = deriveAssetKey(asset);
    const url = deliveredAssetUrl(asset);
    const isCloudinary = Boolean(CLOUDINARY_BACKGROUND_URLS[key]);
    const ext = isCloudinary ? "webp" : extensionFor(asset.localPath, asset.contentType).replace(/^\./, "");
    const objectKey = (isCloudinary ? "cloudinary/" : "renderz/") + key + "." + ext;
    const canonical = canonicalUrl(asset.canonicalSourceUrl || asset.sourceUrl);
    const contentType = isCloudinary ? "image/webp" : (asset.contentType || "image/png");
    urlByKey.set(key, url);
    assetRows.push({
      asset_key: key,
      kind: normalizeKind(asset.kind),
      canonical_source_url: canonical,
      object_key: objectKey,
      public_url: url,
      content_type: contentType,
      byte_size: Number.isFinite(Number(asset.bytes)) ? Number(asset.bytes) : 0,
      sha256: asset.contentHash || null,
      width: asset.width !== null && asset.width !== undefined && asset.width !== "" && Number.isFinite(Number(asset.width)) ? Number(asset.width) : null,
      height: asset.height !== null && asset.height !== undefined && asset.height !== "" && Number.isFinite(Number(asset.height)) ? Number(asset.height) : null,
      is_public: true,
      updated_at: new Date().toISOString()
    });
  }

  await upsertSupabase("fc_player_assets", assetRows, supabaseUrl, serviceKey);

  const publishRequested = process.argv.includes("--publish");
  const cards = prepared.map(({ record, templateKey, references, recordIssues }) => {
    const urls = {};
    for (const [field, asset] of Object.entries(references)) {
      if (!asset) { urls[field] = null; continue; }
      urls[field] = urlByKey.get(asset.assetKey) || deliveredAssetUrl(asset) || null;
    }
    const built = cardData(record, {
      playerImage: references.playerImage ? { ...references.playerImage, publicUrl: urls.playerImage } : null,
      cardBackground: references.cardBackground ? { ...references.cardBackground, publicUrl: urls.cardBackground } : null,
      clubLogo: references.clubLogo ? { ...references.clubLogo, publicUrl: urls.clubLogo } : null,
      leagueLogo: references.leagueLogo ? { ...references.leagueLogo, publicUrl: urls.leagueLogo } : null,
      nationFlag: references.nationFlag ? { ...references.nationFlag, publicUrl: urls.nationFlag } : null
    }, templateKey);

    // Keep imported cards hidden unless a human explicitly requests publication.
    built.is_published = publishRequested && built.is_published && recordIssues.length === 0;
    return built;
  });

  await upsertSupabase("fc_player_cards", cards, supabaseUrl, serviceKey);

  const report = {
    ...initialReport,
    missingSourceUrls: 0,
    assetMetadataRows: assetRows.length,
    cardRowsUpserted: cards.length,
    cloudinaryTemplateUrls: Object.entries(CLOUDINARY_BACKGROUND_URLS).map(([assetKey, url]) => ({ assetKey, url })),
    renderzAssetUrls: assetRows.filter((asset) => asset.object_key.startsWith("renderz/")).length,
    cloudinaryAssets: assetRows.filter((asset) => asset.object_key.startsWith("cloudinary/")).length,
    publishedCards: cards.filter((card) => card.is_published).length,
    unpublishedCards: cards.filter((card) => !card.is_published).length,
    importedAt: new Date().toISOString()
  };
  await writeFile(REPORT_FILE, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({
    inputRecords: report.inputRecords,
    assetMetadataRows: report.assetMetadataRows,
    cardRowsUpserted: report.cardRowsUpserted,
    renderzAssetUrls: report.renderzAssetUrls,
    cloudinaryAssets: report.cloudinaryAssets,
    publishedCards: report.publishedCards,
    unpublishedCards: report.unpublishedCards,
    reportFile: "data/catalog-import-report.json",
    previewRoute: "/anniversary-player-preview/"
  }, null, 2));
}

main().catch((error) => {
  console.error("Catalog import failed: " + String(error?.message || error));
  process.exitCode = 1;
});
