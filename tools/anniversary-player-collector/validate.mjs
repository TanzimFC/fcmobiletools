#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const dataPath = path.resolve("data/anniversary-3rd-2026.json");
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
  let recordsWithActionShot = 0;
  let recordsWithBackground = 0;
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

    const assets = Array.isArray(record.assets) ? record.assets : [];
    const actionShot = assets.some((asset) => asset.kind === "action-shot" && !asset.downloadError);
    const background = assets.some((asset) => asset.kind === "player-card-background" && !asset.downloadError);
    if (actionShot) recordsWithActionShot += 1;
    if (background) recordsWithBackground += 1;

    for (const asset of assets) {
      if (!asset.localPath) continue;
      const localPath = path.resolve(asset.localPath);
      if (await exists(localPath)) localImagesVerified += 1;
      else {
        localImagesMissing += 1;
        addIssue(issues, "error", "missing-local-image", id, label + ": expected local asset does not exist: " + asset.localPath);
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), dataPath).replaceAll(path.sep, "/"),
    totalRecords: records.length,
    recordsWithActionShot,
    recordsWithCardBackground: recordsWithBackground,
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
