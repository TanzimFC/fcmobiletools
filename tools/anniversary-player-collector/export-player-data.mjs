#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = path.join(TOOL_DIR, "programs.json");
const DATA_DIR = path.resolve(process.env.FCMT_OUTPUT_DIR || "data");
const COVERAGE_ONLY = process.argv.includes("--coverage-only");

function normalizePlayerUrl(value) {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return String(value || "");
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + ".tmp";
  await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(temporaryPath, filePath);
}

function recordQuality(record) {
  const stats = record.statExtraction?.status === "complete"
    ? 2
    : (record.statExtraction?.groupsFound ?? 0) > 0 ? 1 : 0;
  const validAssets = Array.isArray(record.assets)
    ? record.assets.filter((asset) => asset && !asset.downloadError).length
    : 0;
  return stats * 1000 + validAssets;
}

function classifyCategory(record) {
  const value = String(record.cardCategory || "").toLowerCase();
  if (value === "icon" || record.isIconCard === true) return "icon";
  if (value === "hero" || record.isHeroCard === true) return "hero";
  return value || "unknown";
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(CATALOG_FILE, "utf8"));
  const coverage = [];
  const merged = new Map();
  const categoryCounts = { icon: 0, hero: 0, base: 0, player: 0, unknown: 0 };
  let expectedCardCount = 0;
  let collectedListingCardCount = 0;
  let missingListingCardCount = 0;

  for (const program of catalog.programs) {
    const legacy = program.key === "anniversary-3rd-2026";
    const listingPath = path.join(DATA_DIR, legacy ? "anniversary-listing.json" : program.key + "-listing.json");
    const recordsPath = path.join(DATA_DIR, legacy ? "anniversary-3rd-2026.json" : program.key + "-records.json");
    const listing = await readJson(listingPath, null);
    const records = await readJson(recordsPath, []);
    const recordByUrl = new Map(records.map((record) => [normalizePlayerUrl(record.sourceUrl), record]));
    const listedUrls = new Set((listing?.cards || []).map((card) => normalizePlayerUrl(card.detailUrl)));
    const matchedUrls = new Set([...listedUrls].filter((url) => recordByUrl.has(url)));
    const missingUrls = [...listedUrls].filter((url) => !recordByUrl.has(url));
    const recordsWithCompleteStats = records.filter((record) => record.statExtraction?.status === "complete").length;
    const recordsWithAnyStats = records.filter((record) => (record.statExtraction?.groupsFound ?? 0) > 0).length;
    const iconCount = records.filter((record) => classifyCategory(record) === "icon").length;
    const heroCount = records.filter((record) => classifyCategory(record) === "hero").length;
    const listingComplete = listing?.complete === true;
    const programComplete = listingComplete && missingUrls.length === 0 && records.length >= (listing?.count ?? 0);

    if (Number.isInteger(listing?.count)) expectedCardCount += listing.count;
    collectedListingCardCount += matchedUrls.size;
    missingListingCardCount += missingUrls.length;

    coverage.push({
      key: program.key,
      program: program.name,
      sourceUrl: program.url,
      listingFileExists: Boolean(listing),
      listingComplete,
      listingPageCount: listing?.listingPagesVisited ?? 0,
      reportedListingPageCount: listing?.expectedPageCount ?? null,
      expectedCardCount: listing?.count ?? null,
      recordsOnDisk: records.length,
      matchedListingCards: matchedUrls.size,
      missingListingCards: missingUrls.length,
      sampleMissingUrls: missingUrls.slice(0, 20),
      recordsWithAnyStats,
      recordsWithCompleteStats,
      iconCards: iconCount,
      heroCards: heroCount,
      complete: programComplete
    });

    for (const record of records) {
      const url = normalizePlayerUrl(record.sourceUrl);
      if (!url) continue;
      const category = classifyCategory(record);
      const incoming = {
        ...record,
        sourceUrl: url,
        programs: [...new Set([...(Array.isArray(record.programs) ? record.programs : []), program.name])],
        sourceProgramUrls: [...new Set([...(Array.isArray(record.sourceProgramUrls) ? record.sourceProgramUrls : []), program.url])]
      };
      const previous = merged.get(url);
      if (!previous) {
        merged.set(url, incoming);
        continue;
      }

      const previousPrograms = Array.isArray(previous.programs) ? previous.programs : [previous.program].filter(Boolean);
      const nextPrograms = Array.isArray(incoming.programs) ? incoming.programs : [incoming.program].filter(Boolean);
      const previousSources = Array.isArray(previous.sourceProgramUrls) ? previous.sourceProgramUrls : [];
      const nextSources = Array.isArray(incoming.sourceProgramUrls) ? incoming.sourceProgramUrls : [];
      const preferred = recordQuality(incoming) > recordQuality(previous) ? incoming : previous;
      const retainedCategory = category !== "unknown" ? category : classifyCategory(previous);
      merged.set(url, {
        ...preferred,
        sourceUrl: url,
        programs: [...new Set([...previousPrograms, ...nextPrograms])],
        sourceProgramUrls: [...new Set([...previousSources, ...nextSources])],
        cardCategory: retainedCategory,
        isIconCard: retainedCategory === "icon",
        isHeroCard: retainedCategory === "hero"
      });
    }
  }

  const allCards = [...merged.values()].map((record) => {
    const cardCategory = classifyCategory(record);
    categoryCounts[cardCategory] = (categoryCounts[cardCategory] ?? 0) + 1;
    return { ...record, cardCategory, isIconCard: cardCategory === "icon", isHeroCard: cardCategory === "hero" };
  }).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || String(a.name || "").localeCompare(String(b.name || "")));

  const iconHeroCards = allCards.filter((record) => record.cardCategory === "icon" || record.cardCategory === "hero");
  const report = {
    generatedAt: new Date().toISOString(),
    sourceWindow: {
      firstProgram: catalog.programs[0]?.name ?? null,
      lastProgram: catalog.programs.at(-1)?.name ?? null,
      programCount: catalog.programs.length
    },
    listingsWithVerifiedPagination: coverage.filter((item) => item.listingComplete).length,
    programsFullyMatched: coverage.filter((item) => item.complete).length,
    programCount: coverage.length,
    expectedCardCountAcrossListings: expectedCardCount,
    matchedListingCardCountAcrossPrograms: collectedListingCardCount,
    missingListingCardCountAcrossPrograms: missingListingCardCount,
    uniqueCollectedCardCount: allCards.length,
    completeStatsCardCount: allCards.filter((record) => record.statExtraction?.status === "complete").length,
    partialStatsCardCount: allCards.filter((record) => (record.statExtraction?.groupsFound ?? 0) > 0 && record.statExtraction?.status !== "complete").length,
    cardsWithoutParsedStats: allCards.filter((record) => !(record.statExtraction?.groupsFound > 0)).length,
    iconCards: iconHeroCards.filter((record) => record.cardCategory === "icon").length,
    heroCards: iconHeroCards.filter((record) => record.cardCategory === "hero").length,
    iconHeroSubsetCount: iconHeroCards.length,
    categories: categoryCounts,
    allProgramsComplete: coverage.length === catalog.programs.length && coverage.every((item) => item.complete),
    note: "A program is complete only when its listing pagination is verified and every discovered card URL has a saved detail record. Icon/Hero output is a filtered subset of the event window, not a separate full-site crawl.",
    programs: coverage
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  if (!COVERAGE_ONLY) {
    await writeJsonAtomic(path.join(DATA_DIR, "player-cards-all-events.json"), {
      generatedAt: report.generatedAt,
      count: allCards.length,
      programs: catalog.programs.map(({ key, name, releaseDate, url }) => ({ key, name, releaseDate, url })),
      cards: allCards
    });
    await writeJsonAtomic(path.join(DATA_DIR, "icons-and-heroes.json"), {
      generatedAt: report.generatedAt,
      count: iconHeroCards.length,
      cards: iconHeroCards
    });
  }
  await writeJsonAtomic(path.join(DATA_DIR, "coverage-report.json"), report);

  console.log(JSON.stringify({
    allProgramsComplete: report.allProgramsComplete,
    programsFullyMatched: report.programsFullyMatched + "/" + report.programCount,
    expectedCardCountAcrossListings: report.expectedCardCountAcrossListings,
    matchedListingCardCountAcrossPrograms: report.matchedListingCardCountAcrossPrograms,
    missingListingCardCountAcrossPrograms: report.missingListingCardCountAcrossPrograms,
    uniqueCollectedCardCount: report.uniqueCollectedCardCount,
    completeStatsCardCount: report.completeStatsCardCount,
    iconCards: report.iconCards,
    heroCards: report.heroCards,
    outputFiles: COVERAGE_ONLY ? ["data/coverage-report.json"] : ["data/player-cards-all-events.json", "data/icons-and-heroes.json", "data/coverage-report.json"]
  }, null, 2));

  if (coverage.some((item) => item.listingFileExists && !item.complete)) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Export failed: " + error.message);
  process.exitCode = 1;
});
