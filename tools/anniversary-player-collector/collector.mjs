#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const PROGRAM_NAME = "3rd Anniversary";
const PROGRAM_URL = "https://renderz.app/programs/PROGRAM_ANN27-3rd-anniversary";
const OUTPUT_DIR = path.resolve("data");
const LISTING_FILE = path.join(OUTPUT_DIR, "anniversary-listing.json");
const RECORDS_FILE = path.join(OUTPUT_DIR, "anniversary-3rd-2026.json");
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, "checkpoint.json");
const DEFAULT_DELAY_MS = 1800;
const MIN_DELAY_MS = 1200;

function parseArgs(argv) {
  const options = {
    limit: 5,
    all: false,
    discover: false,
    refreshListing: false,
    downloadImages: false,
    captureProgression: false,
    keepSourceText: false,
    playerUrl: null,
    playerUrlInput: null,
    delayMs: DEFAULT_DELAY_MS,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--all") options.all = true;
    else if (arg === "--discover") options.discover = true;
    else if (arg === "--refresh-listing") options.refreshListing = true;
    else if (arg === "--download-images") options.downloadImages = true;
    else if (arg === "--capture-progression") options.captureProgression = true;
    else if (arg === "--keep-source-text") options.keepSourceText = true;
    else if (arg === "--player-url") {
      const value = argv[++i];
      if (!value) throw new Error("--player-url requires a RenderZ player URL.");
      let parsed;
      try { parsed = new URL(value); } catch { throw new Error("--player-url must be a valid URL."); }
      if (parsed.hostname !== "renderz.app" || !/^\/player\/[^/]+$/.test(parsed.pathname)) {
        throw new Error("--player-url must point to a RenderZ player detail page.");
      }
      // Ignore UI-state query parameters (rankUp, skillUpgrades, etc.) for canonical base-card collection.
      options.playerUrlInput = parsed.href;
      options.playerUrl = parsed.origin + parsed.pathname;
    }
    else if (arg === "--limit") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit must be a positive integer.");
      options.limit = value;
    } else if (arg === "--delay-ms") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < MIN_DELAY_MS) {
        throw new Error(`--delay-ms must be an integer >= ${MIN_DELAY_MS}.`);
      }
      options.delayMs = value;
    } else {
      throw new Error(`Unknown argument: ${arg}. Run with --help.`);
    }
  }

  if (options.all) options.limit = Number.POSITIVE_INFINITY;
  return options;
}

function printHelp() {
  console.log(`
FCMobiletools local Anniversary collector

Usage:
  node collector.mjs --discover
  node collector.mjs --limit 5
  node collector.mjs --limit 5 --download-images
  node collector.mjs --limit 5 --capture-progression
  node collector.mjs --player-url "https://renderz.app/player/123-example" --capture-progression
  node collector.mjs --all --download-images --capture-progression

Options:
  --discover          Refresh and save listing pages only; don't visit player details.
  --refresh-listing   Force a fresh listing crawl before collecting player details.
  --limit <number>    Number of player detail pages to collect (default: 5).
  --all               Explicitly collect all player cards discovered in the listing.
  --download-images   Download card background, player image, and detected club/league/nation images.
  --capture-progression Capture the visible stats at rank 1-5 and training levels 0-30 when controls and stats are available.
  --keep-source-text  Retain the raw page text in each record for parser debugging (off by default).
  --player-url <url>  Collect one specific RenderZ player page (useful for testing a card that displays stats).
  --delay-ms <n>      Delay between page visits; minimum 1200 ms (default: 1800).
  --help              Show this help.

Collection happens on this computer. HTTP 403/429 and challenge pages stop the run.
`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function safeFilePart(value) {
  return cleanText(value).normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "asset";
}

function parseListingCard(row) {
  const display = cleanText(row.text);
  const match = display.match(/\b(\d{2,3})\s+(GK|RWB|RB|CB|LB|LWB|CDM|RM|CM|CAM|LM|RW|RF|CF|ST|LF|LW)\b/i);
  const pathname = new URL(row.url).pathname;
  const slug = pathname.split("/").filter(Boolean).at(-1) || "";
  const idMatch = slug.match(/^(\d+)/);
  return {
    sourceCardId: idMatch?.[1] || slug,
    slug,
    nameFromListing: display.replace(/\s+/g, " "),
    ovrFromListing: match ? Number(match[1]) : null,
    positionFromListing: match ? match[2].toUpperCase() : null,
    detailUrl: row.url
  };
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
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}

async function goToPage(page, url) {
  let response = null;
  let lastNavigationError = null;
  const retryableNavigationError = /net::ERR_CONNECTION_ABORTED|net::ERR_CONNECTION_RESET|net::ERR_CONNECTION_CLOSED|net::ERR_TIMED_OUT|net::ERR_NETWORK_CHANGED|net::ERR_HTTP2_PROTOCOL_ERROR/i;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      lastNavigationError = null;
      break;
    } catch (error) {
      lastNavigationError = error;
      const message = String(error?.message || error);
      if (!retryableNavigationError.test(message) || attempt === 2) throw error;
      const waitMs = 1200 * (attempt + 1);
      console.warn(`  [navigation retry ${attempt + 1}/2] temporary connection error; retrying after ${waitMs} ms.`);
      await sleep(waitMs);
    }
  }

  if (lastNavigationError && !response) throw lastNavigationError;
  const status = response?.status();

  if (status === 403 || status === 429) {
    throw new Error(`RenderZ returned HTTP ${status}. Stopping without trying to bypass the restriction.`);
  }
  if (status && status >= 500) {
    throw new Error(`RenderZ returned HTTP ${status} for ${url}. Stopping so the run can be retried later.`);
  }

  await page.locator("body").waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);

  const title = cleanText(await page.title().catch(() => ""));
  const bodyStart = cleanText((await page.locator("body").innerText().catch(() => "")).slice(0, 1800));
  if (/just a moment|verify you are human|attention required|checking your browser|access denied/i.test(title + " " + bodyStart)) {
    throw new Error("A challenge or access-denied page was detected. Stopping; do not bypass it.");
  }

  return { status: status ?? null, title };
}

async function getListingRows(page) {
  return page.locator('a[href*="/player/"]').evaluateAll((anchors) =>
    anchors.map((anchor) => ({
      text: (anchor.innerText || anchor.textContent || "").replace(/\s+/g, " ").trim(),
      url: anchor.href
    })).filter((item) => {
      try {
        const url = new URL(item.url);
        return url.hostname === "renderz.app" && url.pathname.startsWith("/player/");
      } catch {
        return false;
      }
    })
  );
}

async function getNextPageUrl(page) {
  return page.locator("a[href]").evaluateAll((anchors) => {
    const matches = anchors.map((anchor) => ({
      label: [
        anchor.innerText || anchor.textContent || "",
        anchor.getAttribute("aria-label") || "",
        anchor.getAttribute("title") || ""
      ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
      url: anchor.href
    })).filter((item) => /\bnext\b/i.test(item.label));

    return matches.find((item) => {
      try {
        const url = new URL(item.url);
        return url.hostname === "renderz.app" && url.pathname.includes("/programs/");
      } catch {
        return false;
      }
    })?.url || null;
  });
}

async function getNextButtonIndex(page) {
  return page.locator('button, [role="button"]').evaluateAll((elements) => {
    return elements.findIndex((element) => {
      const label = [
        element.innerText || element.textContent || "",
        element.getAttribute("aria-label") || "",
        element.getAttribute("title") || "",
        element.getAttribute("data-testid") || ""
      ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const disabled = element.disabled === true
        || element.hasAttribute("disabled")
        || element.getAttribute("aria-disabled") === "true";
      return !disabled && /\bnext\b/i.test(label);
    });
  });
}

async function discoverListing(browser, delayMs) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);
  const seenUrls = new Set();
  const seenSignatures = new Set();
  const cardsByUrl = new Map();
  const pageSummaries = [];
  let nextUrl = PROGRAM_URL;
  let pageAlreadyLoaded = false;
  let expectedPageCount = null;
  let paginationStoppedReason = null;

  try {
    for (let pageNumber = 1; pageNumber <= 30; pageNumber += 1) {
      let responseStatus = null;
      if (!pageAlreadyLoaded) {
        if (seenUrls.has(nextUrl)) {
          paginationStoppedReason = "A previously visited listing URL was encountered.";
          break;
        }
        seenUrls.add(nextUrl);
        console.log("[listing " + pageNumber + "] " + nextUrl);
        const navigation = await goToPage(page, nextUrl);
        responseStatus = navigation.status;
      }
      pageAlreadyLoaded = false;

      const bodyText = cleanText(await page.locator("body").innerText().catch(() => ""));
      const paginationMatch = bodyText.match(/\bPage\s+(\d+)\s+of\s+(\d+)\b/i);
      if (paginationMatch) {
        const reportedTotal = Number(paginationMatch[2]);
        if (Number.isInteger(reportedTotal) && reportedTotal > 0) {
          expectedPageCount = Math.max(expectedPageCount || 0, reportedTotal);
        }
      }

      const rows = await getListingRows(page);
      const signature = rows.map((row) => new URL(row.url).pathname).sort().join("|");
      if (!signature) {
        paginationStoppedReason = "No player-card links were found on this listing page.";
        break;
      }
      if (seenSignatures.has(signature)) {
        paginationStoppedReason = "Pagination returned a listing page already collected.";
        break;
      }
      seenSignatures.add(signature);

      let newOnThisPage = 0;
      for (const row of rows) {
        const normalizedUrl = new URL(row.url).href;
        if (!cardsByUrl.has(normalizedUrl)) {
          cardsByUrl.set(normalizedUrl, parseListingCard({ ...row, url: normalizedUrl }));
          newOnThisPage += 1;
        }
      }

      pageSummaries.push({
        url: page.url(),
        status: responseStatus,
        reportedPage: paginationMatch ? Number(paginationMatch[1]) : pageSummaries.length + 1,
        expectedPagesOnSource: expectedPageCount,
        linksFound: rows.length,
        newCardsFound: newOnThisPage
      });

      const candidate = await getNextPageUrl(page);
      if (candidate && candidate !== page.url() && !seenUrls.has(candidate)) {
        nextUrl = candidate;
        await sleep(delayMs);
        continue;
      }

      // Some RenderZ pagination controls are buttons rather than links.
      const nextButtonIndex = await getNextButtonIndex(page);
      if (nextButtonIndex < 0) {
        paginationStoppedReason = "No enabled Next link or button was found.";
        break;
      }

      await sleep(delayMs);
      await page.locator('button, [role="button"]').nth(nextButtonIndex).click({ timeout: 5000 });
      await page.waitForFunction((previousSignature) => {
        const paths = Array.from(document.querySelectorAll('a[href*="/player/"]'))
          .map((anchor) => {
            try { return new URL(anchor.href).pathname; } catch { return ""; }
          })
          .filter(Boolean)
          .sort();
        return paths.length > 0 && paths.join("|") !== previousSignature;
      }, signature, { timeout: 10000 }).catch(() => {});

      const nextRows = await getListingRows(page);
      const nextSignature = nextRows.map((row) => new URL(row.url).pathname).sort().join("|");
      if (!nextSignature || nextSignature === signature || seenSignatures.has(nextSignature)) {
        paginationStoppedReason = "Clicking Next did not produce a new, distinct set of player cards.";
        break;
      }

      nextUrl = page.url();
      pageAlreadyLoaded = true;
    }
  } finally {
    await page.close();
  }

  const cards = [...cardsByUrl.values()];
  if (cards.length === 0) {
    throw new Error("No player links found. The page structure may have changed; inspect the RenderZ page before adapting selectors.");
  }

  const complete = expectedPageCount === null || pageSummaries.length >= expectedPageCount;
  const listing = {
    sourceProgramUrl: PROGRAM_URL,
    program: PROGRAM_NAME,
    discoveredAt: new Date().toISOString(),
    listingPagesVisited: pageSummaries.length,
    expectedPageCount,
    complete,
    paginationStoppedReason,
    listingPages: pageSummaries,
    count: cards.length,
    cards
  };

  await writeJsonAtomic(LISTING_FILE, listing);
  console.log("Saved listing: " + LISTING_FILE + " (" + cards.length + " unique player URLs across " + pageSummaries.length + " page(s))");
  if (!complete) {
    console.error("INCOMPLETE LISTING: visited " + pageSummaries.length + " of " + expectedPageCount + " reported pages. Do not collect player details yet.");
    console.error("Reason: " + (paginationStoppedReason || "Pagination ended before all source pages were visited."));
  } else {
    console.log("Listing pagination verified: " + pageSummaries.length + (expectedPageCount ? " of " + expectedPageCount : "") + " page(s).");
  }
  return listing;
}

function pickMatch(text, regex) {
  const match = text.match(regex);
  return match?.[1] ? cleanText(match[1]) : null;
}

const STAT_GROUPS = [
  { key: "pace", label: "Pace", substats: ["Acceleration", "Sprint Speed"] },
  { key: "shooting", label: "Shooting", substats: ["Finishing", "Long Shot", "Shot Power", "Positioning", "Volley", "Penalties"] },
  { key: "passing", label: "Passing", substats: ["Short Passing", "Long Passing", "Vision", "Crossing", "Curve", "Free Kick"] },
  { key: "dribbling", label: "Dribbling", substats: ["Dribbling", "Balance", "Agility", "Reactions", "Ball Control"] },
  { key: "defending", label: "Defending", substats: ["Marking", "Standing Tackle", "Sliding Tackle", "Awareness", "Heading"] },
  { key: "physical", label: "Physical", substats: ["Strength", "Aggression", "Jumping", "Stamina"] }
];

const GOALKEEPER_STAT_GROUPS = [
  { key: "diving", label: "Diving", substats: ["GK Diving"] },
  { key: "positioning", label: "Positioning", substats: ["GK Positioning"] },
  { key: "handling", label: "Handling", substats: ["GK Handling"] },
  { key: "reflexes", label: "Reflexes", substats: ["GK Reflexes"] },
  { key: "jumping", label: "Jumping", substats: [] },
  { key: "kicking", label: "Kicking", substats: ["GK Kicking", "Long Passing"] },
  { key: "physical", label: "Physical", substats: ["Reactions", "Agility", "Sprint Speed", "Strength"] }
];

function cleanLocalizedValue(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  if (/^(?:NationName|LeagueName|ClubName|TeamName|NAME_SKILL|skillmove_name|celebration_name|traits_title)_\d+$/i.test(cleaned)) return null;
  return cleaned;
}

function parseGameTraitKeys(sourceText) {
  const matches = String(sourceText || "").matchAll(/\b(skillmove_name|celebration_name|traits_title)_(\d+)\b/gi);
  const seen = new Set();
  const traits = [];
  for (const match of matches) {
    const type = match[1].toLowerCase();
    const id = Number(match[2]);
    const key = type + "_" + id;
    if (seen.has(key)) continue;
    seen.add(key);
    traits.push({
      type: type === "skillmove_name" ? "skill-move" : type === "celebration_name" ? "celebration" : "trait",
      id,
      sourceKey: key,
      displayName: null
    });
  }
  return traits;
}

function parseSkillTree(sourceText) {
  const lines = String(sourceText || "").replace(/\r/g, "").split("\n").map(cleanText).filter(Boolean);
  const nodes = [];
  const byId = new Map();

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^NAME_SKILL_(\d+)(?:\s+LVL(\d+))?$/i);
    if (!match) continue;
    const id = Number(match[1]);
    const next = lines[index + 1] || "";
    const levelFromNext = next.match(/^LVL(\d+)$/i);
    const unlock = next.match(/Unlocks after NAME_SKILL_(\d+) is LVL(\d+)/i);
    const current = {
      id,
      nameKey: "NAME_SKILL_" + id,
      level: match[2] !== undefined ? Number(match[2]) : levelFromNext ? Number(levelFromNext[1]) : null,
      unlocksAfter: unlock ? { skillId: Number(unlock[1]), level: Number(unlock[2]) } : null
    };
    if (!byId.has(id)) {
      byId.set(id, current);
      nodes.push(current);
    }
  }

  for (const node of nodes) {
    const index = lines.findIndex((line) => line === node.nameKey || line.startsWith(node.nameKey + " "));
    if (index >= 0) {
      const next = lines[index + 1] || "";
      const unlock = next.match(/Unlocks after NAME_SKILL_(\d+) is LVL(\d+)/i);
      if (unlock) node.unlocksAfter = { skillId: Number(unlock[1]), level: Number(unlock[2]) };
    }
  }
  return nodes;
}

function parseRequestedViewState(url) {
  try {
    const parsed = new URL(url);
    const numericParam = (key) => {
      const value = parsed.searchParams.get(key);
      return value !== null && /^\d+$/.test(value) ? Number(value) : null;
    };
    const raw = parsed.searchParams.get("skillUpgrades");
    const skillUpgrades = raw
      ? raw.split("-").map((entry) => {
          const match = entry.match(/^(\d+)\.(\d+)$/);
          return match ? { skillId: Number(match[1]), level: Number(match[2]) } : null;
        }).filter(Boolean)
      : [];
    return {
      rankUp: numericParam("rankUp"),
      trainingLevel: numericParam("level"),
      skillUpgradesRaw: raw,
      skillUpgrades
    };
  } catch {
    return null;
  }
}

function getNumberAfterLabel(lines, label, startIndex = 0, endIndex = lines.length) {
  const wanted = label.toLowerCase();
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = cleanText(lines[index]);
    const lowered = line.toLowerCase();
    if (lowered !== wanted && !lowered.startsWith(wanted + " ") && !lowered.startsWith(wanted + ":")) continue;

    let remainder = line.slice(label.length).trim().replace(/^[:\-]\s*/, "").trim();
    if (/^\d{1,3}$/.test(remainder)) return { index, value: Number(remainder) };
    if (!remainder && /^\d{1,3}$/.test(lines[index + 1] || "")) {
      return { index, value: Number(lines[index + 1]) };
    }
  }
  return null;
}

function parsePlayerStats(sourceText, positionHint = null) {
  const lines = String(sourceText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);

  const hintedPosition = cleanText(positionHint).toUpperCase();
  const isGoalkeeper = hintedPosition
    ? hintedPosition === "GK"
    : /(?:^|\n)GK(?:\n|$)/i.test(lines.slice(0, 60).join("\n"));
  const groups = isGoalkeeper ? GOALKEEPER_STAT_GROUPS : STAT_GROUPS;
  const starts = new Map();
  for (const group of groups) {
    const found = getNumberAfterLabel(lines, group.label);
    if (found) starts.set(group.key, found);
  }

  const presentGroups = groups.filter((group) => starts.has(group.key));
  const result = {};
  for (const group of groups) {
    const start = starts.get(group.key);
    const nextStarts = presentGroups
      .map((candidate) => starts.get(candidate.key))
      .filter((candidate) => candidate && candidate.index > (start?.index ?? -1))
      .map((candidate) => candidate.index);
    const end = nextStarts.length ? Math.min(...nextStarts) : lines.length;
    const substats = {};

    for (const substat of group.substats) {
      const found = start
        ? getNumberAfterLabel(lines, substat, start.index + 1, end)
        : null;
      const key = substat.replace(/\bGK\b/gi, "gk").replace(/[^a-zA-Z0-9]+(.)/g, (_, letter) => letter.toUpperCase()).replace(/^[A-Z]/, (letter) => letter.toLowerCase());
      substats[key] = found?.value ?? null;
    }

    result[group.key] = {
      value: start?.value ?? null,
      ...substats
    };
  }

  const missingGroups = groups.filter((group) => !starts.has(group.key)).map((group) => group.key);
  const foundSubstats = Object.values(result).reduce((count, group) => {
    return count + Object.entries(group).filter(([key, value]) => key !== "value" && Number.isInteger(value)).length;
  }, 0);
  const expectedSubstats = groups.reduce((count, group) => count + group.substats.length, 0);
  const complete = presentGroups.length === groups.length && foundSubstats === expectedSubstats;

  return {
    stats: result,
    extraction: {
      playerType: isGoalkeeper ? "goalkeeper" : "outfield",
      status: complete ? "complete" : presentGroups.length > 0 ? "partial" : "not-visible",
      groupsFound: presentGroups.length,
      groupsExpected: groups.length,
      substatsFound: foundSubstats,
      substatsExpected: expectedSubstats,
      missingGroups
    }
  };
}

function parsePlayStyles(sourceText) {
  const lines = String(sourceText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);
  const start = lines.findIndex((line) => /^playstyles?$/i.test(line));
  if (start < 0) return [];

  const endFound = lines.findIndex((line, index) => index > start && /^select\s+rank$/i.test(line));
  const end = endFound < 0 ? lines.length : endFound;
  const section = lines.slice(start + 1, end);
  const styles = [];

  for (let index = 0; index < section.length - 1; index += 1) {
    const levelMatch = section[index + 1].match(/^Level\s+(\d+)$/i);
    if (!levelMatch) continue;
    const name = section[index];
    if (!name || /^(read more|playstyles?)$/i.test(name)) continue;

    const descriptionParts = [];
    for (let cursor = index + 2; cursor < section.length; cursor += 1) {
      if (/^Read more$/i.test(section[cursor])) break;
      if (/^Level\s+\d+$/i.test(section[cursor])) break;
      if (cursor + 1 < section.length && /^Level\s+\d+$/i.test(section[cursor + 1])) break;
      descriptionParts.push(section[cursor]);
    }

    styles.push({
      name,
      level: Number(levelMatch[1]),
      description: descriptionParts.join(" ") || null
    });
  }

  return styles.filter((style, index, all) => all.findIndex((candidate) => candidate.name === style.name && candidate.level === style.level) === index);
}

function parseSkillPointsToSpend(sourceText) {
  const match = String(sourceText || "").match(/Skill\s*points?\s+to\s+spend\s*:?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function getUpgradeControls(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const inputs = Array.from(document.querySelectorAll("input, [role='slider']")).map((element) => {
      const context = clean(element.parentElement?.parentElement?.innerText || element.parentElement?.innerText || "");
      return {
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || element.getAttribute("role") || "",
        min: element.getAttribute("min"),
        max: element.getAttribute("max"),
        value: element.value ?? element.getAttribute("aria-valuenow"),
        ariaLabel: element.getAttribute("aria-label"),
        html: (element.outerHTML || "").slice(0, 400),
        context: context.slice(0, 220)
      };
    });
    const rankLabel = Array.from(document.querySelectorAll("body *")).find((element) =>
      element.children.length === 0 && /^select\s+rank$/i.test(clean(element.textContent))
    );
    const trainingLabel = Array.from(document.querySelectorAll("body *")).find((element) =>
      element.children.length === 0 && /^select\s+training$/i.test(clean(element.textContent))
    );
    const trainingButton = Array.from(document.querySelectorAll("button, [role='button']"))
      .find((element) => visible(element) && /^Training Level\s+\d+$/i.test(clean(element.innerText || element.textContent)));
    const rankContext = clean(rankLabel?.parentElement?.parentElement?.innerText || rankLabel?.parentElement?.innerText || "");
    const trainingContext = clean(trainingLabel?.parentElement?.parentElement?.innerText || trainingLabel?.parentElement?.innerText || "");
    const hierarchy = [];
    let node = trainingButton;
    for (let depth = 0; depth < 5 && node; depth += 1, node = node.parentElement) {
      hierarchy.push({
        depth,
        tag: node.tagName.toLowerCase(),
        role: node.getAttribute("role"),
        className: typeof node.className === "string" ? node.className.slice(0, 200) : "",
        text: clean(node.innerText || node.textContent).slice(0, 300),
        html: (node.outerHTML || "").slice(0, 700)
      });
    }
    const clickable = Array.from(document.querySelectorAll("button, [role='button'], [role='radio'], [role='option'], [role='menuitem'], label, [tabindex]"))
      .filter(visible)
      .map((element) => ({
        text: clean(element.innerText || element.textContent),
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        ariaPressed: element.getAttribute("aria-pressed"),
        ariaSelected: element.getAttribute("aria-selected"),
        ariaChecked: element.getAttribute("aria-checked"),
        dataState: element.getAttribute("data-state"),
        className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
        context: clean(element.parentElement?.innerText || "").slice(0, 160)
      }))
      .filter((item) => item.text && (["1", "2", "3", "4", "5"].includes(item.text) || /training|rank/i.test(item.text)))
      .slice(0, 60);
    return {
      inputs,
      rankContext: rankContext.slice(0, 500),
      trainingContext: trainingContext.slice(0, 500),
      trainingButton: trainingButton ? {
        text: clean(trainingButton.innerText || trainingButton.textContent),
        html: (trainingButton.outerHTML || "").slice(0, 1200)
      } : null,
      trainingButtonHierarchy: hierarchy,
      clickable,
      currentUrl: location.href
    };
  });
}

async function setSelectedRank(page, rank) {
  return page.evaluate((wantedRank) => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const label = Array.from(document.querySelectorAll("body *")).find((element) =>
      element.children.length === 0 && /^select\s+rank$/i.test(clean(element.textContent))
    );
    if (!label) return false;

    let scope = label;
    for (let depth = 0; depth < 8 && scope; depth += 1, scope = scope.parentElement) {
      const candidates = Array.from(scope.querySelectorAll("button, [role='button'], [role='radio'], label, [tabindex]"))
        .filter((element) => clean(element.innerText || element.textContent) === String(wantedRank));
      if (candidates.length) {
        candidates[0].click();
        return true;
      }
    }
    return false;
  }, rank);
}

async function readCurrentRankState(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const label = Array.from(document.querySelectorAll("body *")).find((element) =>
      element.children.length === 0 && /^select\s+rank$/i.test(clean(element.textContent))
    );
    const candidates = [];
    if (label) {
      let scope = label;
      for (let depth = 0; depth < 8 && scope; depth += 1, scope = scope.parentElement) {
        const found = Array.from(scope.querySelectorAll("button, [role='button'], [role='radio'], label, [tabindex]"))
          .filter((element) => /^[1-5]$/.test(clean(element.innerText || element.textContent)));
        if (found.length) {
          for (const element of found) {
            const input = element.matches("input") ? element : element.querySelector("input");
            const radioLabel = element.tagName.toLowerCase() === "label" && element.htmlFor
              ? document.getElementById(element.htmlFor)
              : null;
            const associatedInput = input || (radioLabel?.matches("input") ? radioLabel : null);
            const stateText = [
              element.getAttribute("aria-checked"),
              element.getAttribute("aria-pressed"),
              element.getAttribute("aria-selected"),
              element.getAttribute("data-state"),
              typeof element.className === "string" ? element.className : ""
            ].filter(Boolean).join(" ");
            const active = associatedInput?.checked === true
              || /^(true|checked|on)$/i.test(element.getAttribute("aria-checked") || "")
              || /^(true|checked|on)$/i.test(element.getAttribute("aria-pressed") || "")
              || /^true$/i.test(element.getAttribute("aria-selected") || "")
              || /(^|\s)(active|selected|checked|current)(\s|$)/i.test(stateText)
              || /(?:^|[-_])(active|selected|checked|current)(?:$|[-_])/i.test(stateText);
            candidates.push({
              rank: Number(clean(element.innerText || element.textContent)),
              active,
              inputChecked: associatedInput?.checked ?? null,
              ariaChecked: element.getAttribute("aria-checked"),
              ariaPressed: element.getAttribute("aria-pressed"),
              ariaSelected: element.getAttribute("aria-selected"),
              dataState: element.getAttribute("data-state"),
              className: typeof element.className === "string" ? element.className : ""
            });
          }
          break;
        }
      }
    }
    const activeRanks = candidates.filter((candidate) => candidate.active).map((candidate) => candidate.rank);
    const params = new URL(location.href).searchParams;
    const rankParam = params.get("rankUp");
    return {
      selectedRank: activeRanks.length === 1 ? activeRanks[0] : null,
      activeRanks,
      rankParam,
      candidates,
      url: location.href
    };
  });
}

async function readCurrentTrainingValue(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const button = Array.from(document.querySelectorAll("button, [role='button']")).find((element) =>
      /^Training Level\s+\d+$/i.test(clean(element.innerText || element.textContent))
    );
    const buttonMatch = button && clean(button.innerText || button.textContent).match(/^Training Level\s+(\d+)$/i);
    if (buttonMatch) return Number(buttonMatch[1]);

    const matches = Array.from(document.querySelectorAll("input[type='range'], input[type='number'], [role='slider']"));
    const target = matches.find((element) => {
      const context = clean(element.parentElement?.parentElement?.innerText || element.parentElement?.innerText || "");
      return /select\s+training/i.test(context);
    }) || (matches.length === 1 ? matches[0] : null);
    const raw = target ? (target.value ?? target.getAttribute("aria-valuenow")) : null;
    return raw === null || raw === undefined || raw === "" ? null : Number(raw);
  });
}

async function getAvailableTrainingLevels(page) {
  const levels = await page.evaluate(async () => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const button = Array.from(document.querySelectorAll("button, [role='button']")).find((element) =>
      visible(element) && /^Training Level\s+\d+$/i.test(clean(element.innerText || element.textContent))
    );
    if (!button) return { levels: [], reason: "Training Level dropdown button not found." };

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const rootSelectors = [
      "[role='listbox']",
      "[role='menu']",
      "[data-radix-popper-content-wrapper]",
      "[role='dialog']",
      ".dropdown-menu",
      ".select-content",
      "[data-state='open']"
    ];
    const roots = rootSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter((root) => visible(root) && !root.contains(button));
    const preferredRoots = roots.filter((root) =>
      root.matches("[role='listbox'], [role='menu'], [data-radix-popper-content-wrapper], [role='dialog'], .dropdown-menu, .select-content")
    );
    const searchRoots = preferredRoots.length ? preferredRoots : roots;
    const found = new Set();

    for (const root of searchRoots) {
      for (const element of Array.from(root.querySelectorAll("*"))) {
        if (!visible(element)) continue;
        const text = clean(element.innerText || element.textContent);
        const match = text.match(/^(?:Training Level\s*)?(\d{1,2})$/i);
        if (!match) continue;
        const value = Number(match[1]);
        if (value >= 0 && value <= 30) found.add(value);
      }
    }

    return {
      levels: [...found].sort((a, b) => a - b),
      menuCount: searchRoots.length,
      menus: searchRoots.map((root) => ({
        role: root.getAttribute("role"),
        className: typeof root.className === "string" ? root.className.slice(0, 180) : "",
        text: clean(root.innerText || root.textContent).slice(0, 700)
      }))
    };
  });

  await page.keyboard.press("Escape").catch(() => {});
  return levels;
}

async function setTrainingLevel(page, level) {
  return page.evaluate(async (wantedLevel) => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const readButtonValue = () => {
      const button = Array.from(document.querySelectorAll("button, [role='button']")).find((element) =>
        /^Training Level\s+\d+$/i.test(clean(element.innerText || element.textContent))
      );
      const match = button && clean(button.innerText || button.textContent).match(/^Training Level\s+(\d+)$/i);
      return match ? Number(match[1]) : null;
    };

    const button = Array.from(document.querySelectorAll("button, [role='button']")).find((element) =>
      visible(element) && /^Training Level\s+\d+$/i.test(clean(element.innerText || element.textContent))
    );

    if (button) {
      const current = readButtonValue();
      if (current === wantedLevel) {
        return { ok: true, value: current, min: 0, max: 30, mode: "dropdown", unchanged: true };
      }

      button.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const rootSelectors = [
        "[role='listbox']",
        "[role='menu']",
        "[data-radix-popper-content-wrapper]",
        "[data-state='open']",
        "[role='dialog']",
        ".dropdown-menu",
        ".select-content"
      ];
      const roots = rootSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((root) => visible(root) && !root.contains(button));
      const preferredRoots = roots.filter((root) =>
        root.matches("[role='listbox'], [role='menu'], [data-radix-popper-content-wrapper], [role='dialog'], .dropdown-menu, .select-content")
      );
      const searchRoots = preferredRoots.length ? preferredRoots : roots;
      const clickableSelector = "button, [role='button'], [role='option'], [role='menuitem'], [role='radio'], label, li, [tabindex], [data-value]";
      let candidates = searchRoots.flatMap((root) =>
        Array.from(root.querySelectorAll(clickableSelector)).filter((element) => {
          if (!visible(element)) return false;
          const text = clean(element.innerText || element.textContent);
          return text === String(wantedLevel)
            || element.getAttribute("data-value") === String(wantedLevel)
            || element.getAttribute("value") === String(wantedLevel);
        })
      );

      if (!candidates.length && searchRoots.length) {
        candidates = searchRoots.flatMap((root) =>
          Array.from(root.querySelectorAll("*")).filter((element) =>
            visible(element) && element.children.length === 0
            && clean(element.textContent) === String(wantedLevel)
          )
        ).map((leaf) => {
          let candidate = leaf;
          for (let depth = 0; depth < 3 && candidate.parentElement; depth += 1) {
            const parent = candidate.parentElement;
            if (searchRoots.some((root) => root === parent || root.contains(parent)) &&
                (parent.matches(clickableSelector) || parent.getAttribute("role") || parent.hasAttribute("tabindex"))) {
              candidate = parent;
            } else {
              break;
            }
          }
          return candidate;
        });
      }

      const uniqueCandidates = [...new Set(candidates)];
      const option = uniqueCandidates.find((element) => {
        const text = clean(element.innerText || element.textContent);
        return text === String(wantedLevel)
          || element.getAttribute("data-value") === String(wantedLevel)
          || element.getAttribute("value") === String(wantedLevel);
      });
      if (option) {
        option.click();
        await new Promise((resolve) => setTimeout(resolve, 120));
        const observed = readButtonValue();
        return {
          ok: observed === wantedLevel,
          value: observed,
          min: 0,
          max: 30,
          mode: "dropdown",
          optionText: clean(option.innerText || option.textContent),
          optionRole: option.getAttribute("role")
        };
      }

      // Last resort for RenderZ builds where the numeric training input is rendered
      // but the dropdown options are not exposed as normal interactive elements.
      const trainingInput = Array.from(document.querySelectorAll("input")).find((element) => {
        const context = clean(element.parentElement?.parentElement?.innerText || element.parentElement?.innerText || "");
        const value = clean(element.value);
        return /select\s+training/i.test(context) && /^\d{1,2}$/.test(value);
      });
      if (trainingInput && wantedLevel >= 0 && wantedLevel <= 30) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(trainingInput, String(wantedLevel));
        else trainingInput.value = String(wantedLevel);
        trainingInput.dispatchEvent(new Event("input", { bubbles: true }));
        trainingInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 120));
        const inputValue = Number(trainingInput.value);
        const buttonValue = readButtonValue();
        if (inputValue === wantedLevel && buttonValue === wantedLevel) {
          return { ok: true, value: buttonValue, min: 0, max: 30, mode: "training-input-fallback" };
        }
      }

      return {
        ok: false,
        value: readButtonValue(),
        min: 0,
        max: 30,
        mode: "dropdown",
        reason: "Training dropdown opened, but the requested level option was not found.",
        visibleMenus: searchRoots.map((root) => ({
          role: root.getAttribute("role"),
          className: typeof root.className === "string" ? root.className : "",
          text: clean(root.innerText || root.textContent).slice(0, 700)
        }))
      };
    }

    // Fallback for versions of the page that expose a native range/number input.
    const matches = Array.from(document.querySelectorAll("input[type='range'], input[type='number'], [role='slider']"));
    const target = matches.find((element) => {
      const context = clean(element.parentElement?.parentElement?.innerText || element.parentElement?.innerText || "");
      return /select\s+training/i.test(context);
    }) || (matches.length === 1 ? matches[0] : null);
    if (!target || target.tagName.toLowerCase() !== "input") {
      return { ok: false, value: null, min: null, max: null, mode: "unknown-control" };
    }

    const min = Number(target.min || 0);
    const max = Number(target.max || 30);
    if (wantedLevel < min || wantedLevel > max) {
      return { ok: false, value: Number(target.value), min, max, mode: "input" };
    }

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(target, String(wantedLevel));
    else target.value = String(wantedLevel);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    const value = Number(target.value);
    return { ok: value === wantedLevel, value, min, max, mode: "input" };
  }, level);
}

async function collectProgression(page, positionHint = null) {
  const initialText = (await page.locator("body").innerText().catch(() => "")).replace(/\r/g, "");
  const initialStats = parsePlayerStats(initialText, positionHint);
  const controls = await getUpgradeControls(page);

  if (initialStats.extraction.groupsFound === 0) {
    return {
      status: "not-captured-stats-not-visible",
      supportedTrainingLevels: [],
      rankLevelsCaptured: [],
      expectedSnapshotCount: 0,
      validSnapshotCount: 0,
      rankTrainingSnapshots: [],
      controls
    };
  }

  const snapshots = [];
  const supportedTrainingLevels = [];
  const rankLevelsCaptured = [];
  const ranks = [1, 2, 3, 4, 5];
  const trainingLevelsByRank = {};
  let expectedSnapshotCount = 0;
  let rankControlDetected = false;

  for (const rank of ranks) {
    const clicked = await setSelectedRank(page, rank);
    if (!clicked) {
      snapshots.push({ rank, status: "rank-control-not-settable" });
      continue;
    }
    rankControlDetected = true;
    await page.waitForTimeout(140);
    const rankState = await readCurrentRankState(page);
    const rankConfirmed = rankState.selectedRank === rank || rankState.rankParam === String(rank);

    const trainingOptions = await getAvailableTrainingLevels(page);
    const availableLevels = Array.isArray(trainingOptions.levels)
      ? trainingOptions.levels.filter((level) => Number.isInteger(level) && level >= 0 && level <= 30)
      : [];
    trainingLevelsByRank[rank] = availableLevels;
    if (!availableLevels.length) {
      snapshots.push({
        rank,
        status: "training-level-options-not-detected",
        rankConfirmed,
        rankState,
        trainingOptions
      });
      continue;
    }

    expectedSnapshotCount += availableLevels.length;
    if (rankConfirmed && availableLevels.includes(0)) rankLevelsCaptured.push(rank);
    if (rank === 5) supportedTrainingLevels.push(...availableLevels);

    for (const level of availableLevels) {
      const changed = await setTrainingLevel(page, level);
      if (!changed.ok) {
        snapshots.push({
          rank,
          trainingLevel: level,
          status: "training-control-not-settable",
          rankConfirmed,
          rankState,
          trainingError: changed
        });
        continue;
      }

      await page.waitForTimeout(110);
      const observedTrainingValue = await readCurrentTrainingValue(page);
      if (observedTrainingValue !== level) {
        snapshots.push({
          rank,
          trainingLevel: level,
          status: "training-value-not-confirmed",
          observedTrainingValue,
          rankConfirmed,
          rankState
        });
        continue;
      }

      const currentText = (await page.locator("body").innerText().catch(() => "")).replace(/\r/g, "");
      const parsed = parsePlayerStats(currentText, positionHint);
      const skillPointsToSpend = parseSkillPointsToSpend(currentText);
      const title = cleanText(await page.locator("h1").first().innerText().catch(() => ""));
      const titleOvrMatch = title.match(/[—–-]\s*(\d{2,3})\s*OVR/i);
      const visibleOvrMatch = currentText.match(/\b(\d{2,3})\s+(GK|RWB|RB|CB|LB|LWB|CDM|RM|CM|CAM|LM|RW|RF|CF|ST|LF|LW)\b/i);
      snapshots.push({
        rank,
        trainingLevel: level,
        ovr: visibleOvrMatch ? Number(visibleOvrMatch[1]) : titleOvrMatch ? Number(titleOvrMatch[1]) : null,
        skillPointsToSpend,
        rankConfirmed,
        rankState,
        stats: parsed.stats,
        statExtraction: parsed.extraction
      });
    }
  }

  const validSnapshots = snapshots.filter((item) =>
    Number.isInteger(item.trainingLevel)
    && item.statExtraction?.status === "complete"
    && item.rankConfirmed === true
  );
  const uniqueStatStates = new Set(validSnapshots.map((item) => JSON.stringify(item.stats)));
  const rankLevelsCapturedSorted = [...new Set(validSnapshots
    .filter((item) => item.trainingLevel === 0)
    .map((item) => item.rank))].sort((a, b) => a - b);
  const allRanksHaveLevels = ranks.every((rank) => (trainingLevelsByRank[rank]?.length ?? 0) > 0);
  const allStatesCaptured = allRanksHaveLevels
    && validSnapshots.length === expectedSnapshotCount
    && rankLevelsCapturedSorted.length === ranks.length
    && ranks.every((rank) => trainingLevelsByRank[rank].every((level) =>
      validSnapshots.some((item) => item.rank === rank && item.trainingLevel === level)
    ));

  let status = "controls-detected-stats-missing";
  if (validSnapshots.length > 0 && uniqueStatStates.size === 1 && validSnapshots.length > 1) {
    status = "controls-detected-but-stats-never-changed";
  } else if (allStatesCaptured) {
    status = "captured";
  } else if (validSnapshots.length > 0) {
    status = "partial";
  } else if (rankControlDetected) {
    status = "rank-training-controls-detected-but-not-confirmed";
  }

  return {
    status,
    supportedTrainingLevels: [...new Set(supportedTrainingLevels)].sort((a, b) => a - b),
    trainingLevelsByRank,
    rankLevelsCaptured: rankLevelsCapturedSorted,
    expectedSnapshotCount,
    validSnapshotCount: validSnapshots.length,
    rankTrainingSnapshots: snapshots,
    uniqueStatStates: uniqueStatStates.size,
    controls
  };
}

function canonicalAssetUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    return url.origin + url.pathname;
  } catch {
    return String(sourceUrl || "");
  }
}

function makeAssetKey(asset) {
  return createHash("sha256")
    .update(String(asset.kind || "asset") + "|" + canonicalAssetUrl(asset.sourceUrl))
    .digest("hex")
    .slice(0, 20);
}

function classifyImageAlt(alt) {
  const label = cleanText(alt).toLowerCase();
  if (/player card background/.test(label)) return "player-card-background";
  if (/action shot/.test(label)) return "player-image";
  if (/\bclub\b/.test(label)) return "club-logo";
  if (/\bleague\b/.test(label)) return "league-logo";
  if (/\bnation\b/.test(label)) return "nation-flag";
  return null;
}

function getExtensions(contentType, url) {
  const mime = (contentType || "").split(";")[0].trim().toLowerCase();
  const byMime = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/svg+xml": ".svg"
  };
  if (byMime[mime]) return byMime[mime];
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (/^\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  } catch {}
  return ".img";
}

async function downloadImage(asset, playerUrl, outputDir, requestCache) {
  const assetKey = asset.assetKey || makeAssetKey(asset);
  if (requestCache.has(assetKey)) {
    const cached = requestCache.get(assetKey);
    return {
      ...cached,
      ...asset,
      assetKey,
      localPath: cached.localPath,
      bytes: cached.bytes,
      contentType: cached.contentType,
      contentHash: cached.contentHash,
      reusedFromCache: true
    };
  }

  const response = await fetch(asset.sourceUrl, {
    headers: {
      "Referer": playerUrl,
      "User-Agent": "FCMobiletools-Anniversary-Collector/0.1 (local authorized collection)"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error(`Image host returned HTTP ${response.status}. Stopping without trying to bypass the restriction.`);
  }
  if (!response.ok) throw new Error(`Image download returned HTTP ${response.status}: ${asset.sourceUrl}`);

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Expected an image but received ${contentType || "unknown content type"}: ${asset.sourceUrl}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error(`Downloaded empty image: ${asset.sourceUrl}`);

  const extension = getExtensions(contentType, asset.sourceUrl);
  const outputPath = path.join(outputDir, `${asset.kind}-${assetKey}${extension}`);
  await fs.mkdir(outputDir, { recursive: true });
  if (!(await fs.stat(outputPath).catch(() => null))) {
    await fs.writeFile(outputPath, buffer);
  }

  const result = {
    ...asset,
    assetKey,
    localPath: path.relative(process.cwd(), outputPath).replaceAll(path.sep, "/"),
    bytes: buffer.length,
    contentType,
    contentHash: createHash("sha256").update(buffer).digest("hex"),
    reusedFromCache: false
  };
  requestCache.set(assetKey, result);
  return result;
}

async function collectPlayer(browser, card, options, imageCache) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);

  try {
    const response = await goToPage(page, card.detailUrl);
    // RenderZ sometimes hydrates stat sections after the first document paint.
    await page.waitForFunction(() => {
      const text = document.body?.innerText || "";
      return /(?:^|\n)Pace\s*\n\s*\d{2,3}/i.test(text)
        || /(?:^|\n)Shooting\s*\n\s*\d{2,3}/i.test(text);
    }, null, { timeout: 2200 }).catch(() => {});
    const title = cleanText(await page.locator("h1").first().innerText().catch(() => ""));
    const sourceText = (await page.locator("body").innerText()).replace(/\r/g, "").slice(0, 30000);
    const parsedPosition = pickMatch(sourceText, /\bPosition\s+([A-Z]{2,3})\b/i) || card.positionFromListing;
    const parsedStats = parsePlayerStats(sourceText, parsedPosition);
    const progression = options.captureProgression ? await collectProgression(page, parsedPosition) : null;
    const imageElements = await page.locator("img").evaluateAll((images) => images.map((img) => {
      const source = img.currentSrc || img.src || img.getAttribute("data-src") || "";
      return {
        alt: (img.getAttribute("alt") || "").replace(/\s+/g, " ").trim(),
        sourceUrl: source,
        width: img.naturalWidth || img.width || null,
        height: img.naturalHeight || img.height || null
      };
    }));

    const mainImages = imageElements
      .filter((image) => image.sourceUrl && /^https?:/i.test(image.sourceUrl))
      .map((image) => {
        const kind = classifyImageAlt(image.alt);
        if (!kind) return null;
        const asset = {
          cardId: card.sourceCardId,
          kind,
          alt: image.alt,
          sourceUrl: image.sourceUrl,
          canonicalSourceUrl: canonicalAssetUrl(image.sourceUrl),
          width: image.width,
          height: image.height
        };
        asset.assetKey = makeAssetKey(asset);
        return asset;
      })
      .filter(Boolean)
      .filter((asset, index, all) => all.findIndex((candidate) => candidate.canonicalSourceUrl === asset.canonicalSourceUrl && candidate.kind === asset.kind) === index);

    const detailRecord = {
      sourceCardId: card.sourceCardId,
      sourceSlug: card.slug,
      name: pickMatch(title, /^(.+?)\s+[—–-]\s+\d{2,3}\s+OVR/i) || card.nameFromListing,
      ovr: Number(pickMatch(title, /[—–-]\s+(\d{2,3})\s+OVR/i)) || card.ovrFromListing,
      position: parsedPosition,
      program: PROGRAM_NAME,
      sourceUrl: new URL(card.detailUrl).origin + new URL(card.detailUrl).pathname,
      requestedViewUrl: options.playerUrlInput || null,
      sourceProgramUrl: PROGRAM_URL,
      collectedAt: new Date().toISOString(),
      sourcePageStatus: response.status,
      sourcePageTitle: title,
      details: {
        alternatePositions: pickMatch(sourceText, /Alternate\s+Postions?\s+([^\n]+)/i),
        club: cleanLocalizedValue(pickMatch(sourceText, /\bTEAM\s+([^\n]+)/i)),
        league: cleanLocalizedValue(pickMatch(sourceText, /\bLEAGUE\s+([^\n]+)/i)),
        nation: cleanLocalizedValue(pickMatch(sourceText, /\bNATION\/REGION\s+([^\n]+)/i)),
        strongFootWeakFoot: (pickMatch(sourceText, /STRONG\s+FOOT\s*\/\s*WEAK\s+FOOT\s+([^\n]+)/i) || "").replace(/\bCommon_Right\b/gi, "RIGHT").replace(/\bCommon_Left\b/gi, "LEFT") || null,
        height: pickMatch(sourceText, /\bHeight\s+([^\n]+)/i),
        weight: pickMatch(sourceText, /\bWeight\s+([^\n]+)/i),
        attackingDefensiveWorkRate: pickMatch(sourceText, /Work\s+Rate\s*\(ATT\)\s*\/\s*Work\s+Rate\s*\(DEF\)\s*([^\n]+)/i),
        skillMoves: pickMatch(sourceText, /Skill\s+Moves\s*\((\d)\)/i)
      },
      stats: parsedStats.stats,
      statExtraction: parsedStats.extraction,
      skillPointsToSpend: parseSkillPointsToSpend(sourceText),
      playStyles: parsePlayStyles(sourceText),
      skillTree: parseSkillTree(sourceText),
      gameTraits: parseGameTraitKeys(sourceText),
      requestedViewState: options.playerUrlInput ? parseRequestedViewState(options.playerUrlInput) : null,
      progression,
      assets: mainImages
    };

    if (options.keepSourceText) detailRecord.sourceText = sourceText;

    if (options.downloadImages && mainImages.length) {
      const assetDir = path.join(OUTPUT_DIR, "assets");
      const downloaded = [];
      for (const asset of mainImages) {
        await sleep(Math.min(options.delayMs, 2500));
        try {
          downloaded.push(await downloadImage(asset, card.detailUrl, assetDir, imageCache));
        } catch (error) {
          if (/HTTP 403|HTTP 429/.test(String(error?.message || error))) throw error;
          console.warn(`  [asset warning] ${asset.kind}: ${error.message}`);
          downloaded.push({ ...asset, downloadError: error.message });
        }
      }
      detailRecord.assets = downloaded;
    }

    return detailRecord;
  } finally {
    await page.close();
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();

  console.log(`Source: ${PROGRAM_URL}`);
  console.log(`Delay between navigations: ${options.delayMs} ms; output stays local in ${OUTPUT_DIR}`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    let listing = null;
    if (options.discover) {
      await discoverListing(browser, options.delayMs);
      return;
    }

    if (options.playerUrl) {
      listing = await readJson(LISTING_FILE, null);
      console.log("Using explicit player URL for a focused extraction test.");
    } else {
      if (!options.refreshListing) {
        listing = await readJson(LISTING_FILE, null);
      }
      if (!listing?.cards?.length || listing.complete !== true || options.refreshListing) {
        listing = await discoverListing(browser, options.delayMs);
      } else {
        console.log("Using cached complete listing: " + LISTING_FILE + " (" + listing.cards.length + " cards; run with --refresh-listing to rescan)");
      }
      if (listing.complete !== true) {
        throw new Error("The Anniversary listing is incomplete. Fix pagination before collecting player details; partial collections are blocked.");
      }
    }

    let targetCards;
    if (options.playerUrl) {
      const parsedUrl = new URL(options.playerUrl);
      const slug = parsedUrl.pathname.split("/").filter(Boolean).at(-1) || "";
      const idMatch = slug.match(/^(\d+)/);
      const nameFromSlug = slug.replace(/^\d+-?/, "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || slug;
      targetCards = [{
        sourceCardId: idMatch?.[1] || slug,
        slug,
        nameFromListing: nameFromSlug,
        ovrFromListing: null,
        positionFromListing: null,
        detailUrl: parsedUrl.href
      }];
    } else {
      targetCards = listing.cards.slice(0, options.limit);
    }
    if (targetCards.length === 0) {
      throw new Error("No player cards selected for detail collection.");
    }
    console.log("Preparing " + targetCards.length + " player detail page(s).");

    const existing = await readJson(RECORDS_FILE, []);
    const byUrl = new Map(existing.map((record) => {
      let canonicalUrl = record.sourceUrl;
      try {
        const parsed = new URL(record.sourceUrl);
        canonicalUrl = parsed.origin + parsed.pathname;
      } catch {}
      return [canonicalUrl, { ...record, sourceUrl: canonicalUrl }];
    }));
    const imageCache = new Map();
    const errors = [];
    const completedThisRun = [];
    const failedThisRun = [];

    for (let index = 0; index < targetCards.length; index += 1) {
      const card = targetCards[index];
      console.log(`[player ${index + 1}/${targetCards.length}] ${card.nameFromListing} — ${card.detailUrl}`);
      await sleep(options.delayMs);

      try {
        const record = await collectPlayer(browser, card, options, imageCache);
        byUrl.set(record.sourceUrl, record);
        completedThisRun.push({
          sourceCardId: record.sourceCardId,
          sourceUrl: record.sourceUrl,
          name: record.name,
          statStatus: record.statExtraction?.status ?? "unknown",
          assetCount: Array.isArray(record.assets) ? record.assets.length : 0
        });
        await writeJsonAtomic(RECORDS_FILE, [...byUrl.values()]);
        await writeJsonAtomic(CHECKPOINT_FILE, {
          program: PROGRAM_NAME,
          sourceProgramUrl: PROGRAM_URL,
          targetCount: targetCards.length,
          savedCount: byUrl.size,
          lastCompletedUrl: record.sourceUrl,
          lastCompletedAt: record.collectedAt,
          errors
        });
        console.log(`  saved: ${record.name} | OVR ${record.ovr ?? "unknown"} | stats: ${record.statExtraction.status} (${record.statExtraction.groupsFound}/6 groups)${record.progression ? " | progression: " + record.progression.status : ""} | ${record.assets.length} selected image(s)`);
      } catch (error) {
        const failure = { sourceUrl: card.detailUrl, message: String(error?.message || error), at: new Date().toISOString() };
        errors.push(failure);
        failedThisRun.push(failure);
        await writeJsonAtomic(CHECKPOINT_FILE, {
          program: PROGRAM_NAME,
          sourceProgramUrl: PROGRAM_URL,
          targetCount: targetCards.length,
          savedCount: byUrl.size,
          lastAttemptedUrl: card.detailUrl,
          errors
        });
        console.error(`  failed: ${error.message}`);
        if (/HTTP 403|HTTP 429|challenge|access-denied/i.test(error.message)) throw error;
      }
    }

    const finalRecords = [...byUrl.values()];
    const report = {
      program: PROGRAM_NAME,
      sourceProgramUrl: PROGRAM_URL,
      runAt: new Date().toISOString(),
      listingCount: listing?.count ?? null,
      requestedDetailCount: targetCards.length,
      succeededThisRun: completedThisRun.length,
      failedThisRun: failedThisRun.length,
      completedPlayersThisRun: completedThisRun,
      savedRecordCount: finalRecords.length,
      recordsWithStats: finalRecords.filter((record) => (record.statExtraction?.groupsFound ?? 0) > 0).length,
      recordsWithCompleteStats: finalRecords.filter((record) => record.statExtraction?.status === "complete").length,
      recordsWithProgressionSnapshots: finalRecords.filter((record) => (record.progression?.rankTrainingSnapshots?.length ?? 0) > 0).length,
      progressionRequested: options.captureProgression,
      recordsWithActionShot: finalRecords.filter((record) => record.assets.some((asset) => ["player-image", "action-shot"].includes(asset.kind) && !asset.downloadError)).length,
      recordsWithCardBackground: finalRecords.filter((record) => record.assets.some((asset) => asset.kind === "player-card-background" && !asset.downloadError)).length,
      assetKindCounts: Object.fromEntries(["player-card-background", "player-image", "club-logo", "league-logo", "nation-flag"].map((kind) => [
        kind,
        finalRecords.reduce((count, record) => count + (Array.isArray(record.assets) ? record.assets.filter((asset) => asset.kind === kind && !asset.downloadError).length : 0), 0)
      ])),
      failuresThisRun: errors
    };
    await writeJsonAtomic(path.join(OUTPUT_DIR, "pilot-report.json"), report);
    if (errors.length) {
      console.error("\nRun finished with " + errors.length + " failed player page(s). Existing records were preserved; this run is PARTIAL.");
      process.exitCode = 1;
    } else {
      console.log("\nRun complete. All requested player pages were collected.");
    }
    console.log(JSON.stringify(report, null, 2));
    console.log("\nStored-record totals include records from earlier runs; see succeededThisRun for this invocation.");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`\nStopped: ${error.message}`);
  process.exitCode = 1;
});
