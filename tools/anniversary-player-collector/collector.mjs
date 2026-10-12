#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
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
  node collector.mjs --all --download-images

Options:
  --discover          Refresh and save listing pages only; don't visit player details.
  --refresh-listing   Force a fresh listing crawl before collecting player details.
  --limit <number>    Number of player detail pages to collect (default: 5).
  --all               Explicitly collect all player cards discovered in the listing.
  --download-images   Download only the player card background and action shot.
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
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
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
  if (requestCache.has(asset.sourceUrl)) {
    const cached = requestCache.get(asset.sourceUrl);
    return {
      ...cached,
      ...asset,
      localPath: cached.localPath,
      bytes: cached.bytes,
      contentType: cached.contentType
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
    throw new Error(`Image host returned HTTP ${response.status}. Stopping without retrying around the restriction.`);
  }
  if (!response.ok) throw new Error(`Image download returned HTTP ${response.status}: ${asset.sourceUrl}`);

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Expected an image but received ${contentType || "unknown content type"}: ${asset.sourceUrl}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error(`Downloaded empty image: ${asset.sourceUrl}`);

  const extension = getExtensions(contentType, asset.sourceUrl);
  const outputPath = path.join(outputDir, `${asset.cardId}-${asset.kind}${extension}`);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, buffer);

  const result = {
    ...asset,
    localPath: path.relative(process.cwd(), outputPath).replaceAll(path.sep, "/"),
    bytes: buffer.length,
    contentType
  };
  requestCache.set(asset.sourceUrl, result);
  return result;
}

async function collectPlayer(browser, card, options, imageCache) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);

  try {
    const response = await goToPage(page, card.detailUrl);
    const title = cleanText(await page.locator("h1").first().innerText().catch(() => ""));
    const sourceText = (await page.locator("body").innerText()).replace(/\r/g, "").slice(0, 18000);
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
      .filter((image) => /player card background|action shot/i.test(image.alt))
      .map((image) => ({
        cardId: card.sourceCardId,
        kind: /player card background/i.test(image.alt) ? "player-card-background" : "action-shot",
        alt: image.alt,
        sourceUrl: image.sourceUrl,
        width: image.width,
        height: image.height
      }))
      .filter((image, index, all) => all.findIndex((candidate) => candidate.sourceUrl === image.sourceUrl && candidate.kind === image.kind) === index);

    const detailRecord = {
      sourceCardId: card.sourceCardId,
      sourceSlug: card.slug,
      name: pickMatch(title, /^(.+?)\s+[—–-]\s+\d{2,3}\s+OVR/i) || card.nameFromListing,
      ovr: Number(pickMatch(title, /[—–-]\s+(\d{2,3})\s+OVR/i)) || card.ovrFromListing,
      position: pickMatch(sourceText, /\bPosition\s+([A-Z]{2,3})\b/i) || card.positionFromListing,
      program: PROGRAM_NAME,
      sourceUrl: card.detailUrl,
      sourceProgramUrl: PROGRAM_URL,
      collectedAt: new Date().toISOString(),
      sourcePageStatus: response.status,
      sourcePageTitle: title,
      details: {
        alternatePositions: pickMatch(sourceText, /Alternate\s+Postions?\s+([^\n]+)/i),
        club: pickMatch(sourceText, /\bTEAM\s+([^\n]+)/i),
        league: pickMatch(sourceText, /\bLEAGUE\s+([^\n]+)/i),
        nation: pickMatch(sourceText, /\bNATION\/REGION\s+([^\n]+)/i),
        strongFootWeakFoot: pickMatch(sourceText, /STRONG\s+FOOT\s*\/\s*WEAK\s+FOOT\s+([^\n]+)/i),
        height: pickMatch(sourceText, /\bHeight\s+([^\n]+)/i),
        weight: pickMatch(sourceText, /\bWeight\s+([^\n]+)/i),
        attackingDefensiveWorkRate: pickMatch(sourceText, /Work\s+Rate\s*\(ATT\)\s*\/\s*Work\s+Rate\s*\(DEF\)\s*([^\n]+)/i),
        skillMoves: pickMatch(sourceText, /Skill\s+Moves\s*\((\d)\)/i)
      },
      assets: mainImages,
      sourceText
    };

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
    let listing;
    if (options.discover) {
      await discoverListing(browser, options.delayMs);
      return;
    }

    if (!options.refreshListing) {
      listing = await readJson(LISTING_FILE, null);
    }
    if (!listing?.cards?.length || listing.complete !== true || options.refreshListing) {
      listing = await discoverListing(browser, options.delayMs);
    } else {
      console.log(\`Using cached complete listing: \${LISTING_FILE} (\${listing.cards.length} cards; run with --refresh-listing to rescan)\`);
    }
    if (listing.complete !== true) {
      throw new Error("The Anniversary listing is incomplete. Fix pagination before collecting player details; partial collections are blocked.");
    }

    const existing = await readJson(RECORDS_FILE, []);
    const byUrl = new Map(existing.map((record) => [record.sourceUrl, record]));
    const imageCache = new Map();
    const errors = [];

    for (let index = 0; index < targetCards.length; index += 1) {
      const card = targetCards[index];
      console.log(`[player ${index + 1}/${targetCards.length}] ${card.nameFromListing} — ${card.detailUrl}`);
      await sleep(options.delayMs);

      try {
        const record = await collectPlayer(browser, card, options, imageCache);
        byUrl.set(record.sourceUrl, record);
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
        console.log(`  saved: ${record.name} | OVR ${record.ovr ?? "unknown"} | ${record.assets.length} selected image(s)`);
      } catch (error) {
        errors.push({ sourceUrl: card.detailUrl, message: String(error?.message || error), at: new Date().toISOString() });
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
      listingCount: listing.count,
      requestedDetailCount: targetCards.length,
      savedRecordCount: finalRecords.length,
      recordsWithActionShot: finalRecords.filter((record) => record.assets.some((asset) => asset.kind === "action-shot" && !asset.downloadError)).length,
      recordsWithCardBackground: finalRecords.filter((record) => record.assets.some((asset) => asset.kind === "player-card-background" && !asset.downloadError)).length,
      failuresThisRun: errors
    };
    await writeJsonAtomic(path.join(OUTPUT_DIR, "pilot-report.json"), report);
    console.log("\nRun complete.");
    console.log(JSON.stringify(report, null, 2));
    console.log("\nReview the saved records and images before attempting --all.");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`\nStopped: ${error.message}`);
  process.exitCode = 1;
});
