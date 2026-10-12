#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const dataPath = path.resolve("data/anniversary-3rd-2026.json");
const assetLibraryPath = path.resolve("data/asset-library.json");
const reportPath = path.resolve("data/validation-report.json");

function addIssue(list, severity, code, cardId, message) {
  list.push({ severity, code, cardId: cardId ?? null, message });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const issues = [];
  if (!(await exists(dataPath))) {
    console.error("No collected data found. Run npm run pilot first.");
    process.exitCode = 1;
    return;
  }

  let records;
  try {
    records = JSON.parse(await fs.readFile(dataPath, "utf8"));
  } catch (error) {
    console.error("Could not parse " + dataPath + ": " + error.message);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(records) || records.length === 0) {
    console.error("The player data file must contain a non-empty JSON array.");
    process.exitCode = 1;
    return;
  }

  const seenUrls = new Set();
  const seenIds = new Map();
  let recordsWithPlayerImage = 0;
  let recordsWithBackground = 0;
  let recordsWithCompleteStats = 0;
  let recordsWithPartialStats = 0;
  let recordsWithoutStats = 0;
  let recordsWithProgressionSnapshots = 0;
  const assetReferenceCounts = {
    "player-card-background": 0,
    "player-image": 0,
    "action-shot": 0,
    "club-logo": 0,
    "league-logo": 0,
    "nation-flag": 0
  };
  let localImagesVerified = 0;
  let localImagesMissing = 0;

  for (const record of records) {
    const id = record.sourceCardId ?? null;
    const label = record.name ?? record.sourceUrl ?? String(id ?? "unknown");

    if (!id) addIssue(issues, "error", "missing-card-id", id, label + ": missing source card ID");
    if (!Number.isInteger(record.ovr) || record.ovr < 1 || record.ovr > 150) {
      addIssue(issues, "error", "invalid-ovr", id, label + ": missing or invalid OVR");
    }
    if (!record.position || !/^[A-Z]{2,4}$/i.test(record.position)) {
      addIssue(issues, "warning", "missing-position", id, label + ": primary position was not parsed");
    }
    if (!record.name || /^\d{2,3}\s+(GK|RWB|RB|CB|LB|LWB|CDM|RM|CM|CAM|LM|RW|RF|CF|ST|LF|LW)\b/i.test(record.name)) {
      addIssue(issues, "warning", "review-name", id, label + ": name may still contain the listing label; review against the source page");
    }
    if (!record.sourceUrl || !/^https:\/\/renderz\.app\/player\//i.test(record.sourceUrl)) {
      addIssue(issues, "error", "invalid-source-url", id, label + ": source URL is not a RenderZ player detail URL");
    } else {
      if (seenUrls.has(record.sourceUrl)) addIssue(issues, "error", "duplicate-source-url", id, label + ": duplicate source URL");
      seenUrls.add(record.sourceUrl);
    }

    if (id) {
      if (seenIds.has(id) && seenIds.get(id) !== record.sourceUrl) {
        addIssue(issues, "warning", "duplicate-card-id", id, label + ": same source card ID appears under more than one URL");
      }
      seenIds.set(id, record.sourceUrl);
    }

    if (record.statExtraction?.status === "complete") recordsWithCompleteStats += 1;
    else if ((record.statExtraction?.groupsFound ?? 0) > 0) {
      recordsWithPartialStats += 1;
      addIssue(issues, "warning", "partial-player-stats", id, label + ": only " + record.statExtraction.groupsFound + "/" + (record.statExtraction.groupsExpected ?? 6) + " stat groups were parsed");
    } else {
      recordsWithoutStats += 1;
      addIssue(issues, "warning", "player-stats-not-visible", id, label + ": the source page did not expose parseable main player stats");
    }
    if ((record.progression?.rankTrainingSnapshots?.length ?? 0) > 0) recordsWithProgressionSnapshots += 1;
    if (record.progression && record.progression.status !== "captured") {
      addIssue(issues, "warning", "incomplete-progression", id, label + ": progression status is " + record.progression.status);
    }

    const assets = Array.isArray(record.assets) ? record.assets : [];
    const playerImage = assets.some((asset) => ["player-image", "action-shot"].includes(asset.kind) && !asset.downloadError);
    const background = assets.some((asset) => asset.kind === "player-card-background" && !asset.downloadError);
    if (playerImage) recordsWithPlayerImage += 1;
    if (background) recordsWithBackground += 1;

    for (const asset of assets) {
      if (Object.hasOwn(assetReferenceCounts, asset.kind)) assetReferenceCounts[asset.kind] += 1;
      if (!asset.localPath) continue;
      const localPath = path.resolve(asset.localPath);
      if (await exists(localPath)) localImagesVerified += 1;
      else {
        localImagesMissing += 1;
        addIssue(issues, "error", "missing-local-image", id, label + ": expected local asset does not exist: " + asset.localPath);
      }
    }
  }

  let assetLibrary = [];
  try {
    const rawLibrary = JSON.parse(await fs.readFile(assetLibraryPath, "utf8"));
    if (Array.isArray(rawLibrary)) assetLibrary = rawLibrary;
    else addIssue(issues, "warning", "invalid-asset-library", null, "Asset library file is not a JSON array.");
  } catch (error) {
    if (error?.code !== "ENOENT") addIssue(issues, "warning", "invalid-asset-library", null, "Could not read asset library: " + error.message);
  }

  const uniqueAssetsByKind = {
    "player-card-background": 0,
    "player-image": 0,
    "club-logo": 0,
    "league-logo": 0,
    "nation-flag": 0
  };
  let uniqueAssetFilesVerified = 0;
  let uniqueAssetFilesMissing = 0;
  const seenAssetKeys = new Set();
  for (const asset of assetLibrary) {
    if (!asset?.assetKey || seenAssetKeys.has(asset.assetKey)) continue;
    seenAssetKeys.add(asset.assetKey);
    if (Object.hasOwn(uniqueAssetsByKind, asset.kind)) uniqueAssetsByKind[asset.kind] += 1;
    if (!asset.localPath) continue;
    if (await exists(path.resolve(asset.localPath))) uniqueAssetFilesVerified += 1;
    else {
      uniqueAssetFilesMissing += 1;
      addIssue(issues, "error", "missing-library-asset", asset.assetKey, "Asset library file is missing: " + asset.localPath);
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), dataPath).replaceAll(path.sep, "/"),
    totalRecords: records.length,
    recordsWithPlayerImage,
    recordsWithCardBackground: recordsWithBackground,
    recordsWithCompleteStats,
    recordsWithPartialStats,
    recordsWithoutStats,
    recordsWithProgressionSnapshots,
    assetReferencesByKind: assetReferenceCounts,
    uniqueAssetsInLibrary: seenAssetKeys.size,
    uniqueAssetsByKind,
    uniqueAssetFilesVerified,
    uniqueAssetFilesMissing,
    localImagesVerified,
    localImagesMissing,
    errors,
    warnings,
    issues
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log("\nSaved report: " + path.relative(process.cwd(), reportPath));
  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
