#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = path.join(TOOL_DIR, "programs.json");
const COLLECTOR_FILE = path.join(TOOL_DIR, "collector.mjs");
const EXPORT_FILE = path.join(TOOL_DIR, "export-player-data.mjs");
const DEFAULT_LIMIT = 5;
const DEFAULT_DELAY_MS = 900;
const MIN_DELAY_MS = 600;

function parseArgs(argv) {
  const options = {
    discover: false,
    all: false,
    fresh: false,
    refreshListing: false,
    refreshCategories: false,
    downloadImages: false,
    captureProgression: false,
    keepSourceText: false,
    resume: true,
    limit: DEFAULT_LIMIT,
    delayMs: DEFAULT_DELAY_MS,
    programs: [],
    from: null,
    to: null,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--discover") options.discover = true;
    else if (arg === "--all") options.all = true;
    else if (arg === "--fresh") options.fresh = true;
    else if (arg === "--refresh-existing") options.resume = false;
    else if (arg === "--refresh-listing") options.refreshListing = true;
    else if (arg === "--refresh-categories") options.refreshCategories = true;
    else if (arg === "--download-images") options.downloadImages = true;
    else if (arg === "--capture-progression") options.captureProgression = true;
    else if (arg === "--keep-source-text") options.keepSourceText = true;
    else if (arg === "--program") {
      const value = argv[++i];
      if (!value) throw new Error("--program requires a program key; run --help to see options.");
      options.programs.push(value);
    } else if (arg === "--from") {
      options.from = argv[++i];
      if (!options.from) throw new Error("--from requires a program key.");
    } else if (arg === "--to") {
      options.to = argv[++i];
      if (!options.to) throw new Error("--to requires a program key.");
    } else if (arg === "--limit") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit must be a positive integer.");
      options.limit = value;
    } else if (arg === "--delay-ms") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < MIN_DELAY_MS) throw new Error(`--delay-ms must be an integer >= ${MIN_DELAY_MS}.`);
      options.delayMs = value;
    } else {
      throw new Error(`Unknown argument: ${arg}. Run with --help.`);
    }
  }

  if (options.programs.length && (options.from || options.to)) {
    throw new Error("Use either --program or --from/--to, not both.");
  }
  if (Boolean(options.from) !== Boolean(options.to)) {
    throw new Error("--from and --to must be supplied together.");
  }
  if (options.fresh && (!options.all || options.discover)) {
    throw new Error("--fresh requires a full --all card run, not discovery or a pilot.");
  }
  return options;
}

function printHelp(programs) {
  console.log(`
FCMobiletools sequential multi-program player collector

Program keys:
${programs.map((item) => "  " + item.key.padEnd(24) + item.name).join("\n")}

Examples:
  # Discover and verify each program listing without visiting player details
  node collect-programs.mjs --discover

  # Five-card pilot for one program
  node collect-programs.mjs --program tots-26 --limit 5

  # Full collection for one program
  node collect-programs.mjs --program tots-26 --all --download-images

  # Full chronological sweep from TOTS 26 to 3rd Anniversary
  node collect-programs.mjs --from tots-26 --to anniversary-3rd-2026 --all --download-images

  # Resume a single program cleanly while preserving its verified listing and shared asset cache
  node collect-programs.mjs --program anniversary-3rd-2026 --all --fresh

Options:
  --discover            Listing-only run; verifies pagination but collects no player detail pages.
  --program <key>       Select one program. Repeat to select more than one.
  --from <key> --to <key> Select an inclusive chronological range.
  --limit <number>      Cards to collect per selected program (default: 5).
  --all                 Collect every discovered card for each selected program.
  --download-images     Download detected images into the deduplicated shared asset library.
  --refresh-listing     Re-scan listing pages before collecting details.
  --refresh-categories  Revisit saved generic "player" records to correct Icon/Hero/Base labels without deleting stats.
  --capture-progression Sample rank/training states (slow and experimental).
  --keep-source-text    Include filtered source text in records for parser debugging.
  --delay-ms <n>        Delay between navigations; minimum ${MIN_DELAY_MS} ms (default: ${DEFAULT_DELAY_MS}).
  --fresh               Reset records/checkpoints for one selected program before a full run.
  --refresh-existing    Revisit saved cards instead of skipping verified records (use sparingly).
  --help                Show this help.

The runner is sequential. It stops when a child run fails, including HTTP 403/429 or a challenge page,
and leaves saved records/checkpoints in place for review and resumption. Use only within the source's
permission and request limits. It does not bypass access restrictions.
`);
}

function resolvePrograms(catalog, options) {
  const byKey = new Map(catalog.programs.map((program) => [program.key, program]));
  if (options.programs.length) {
    const unknown = options.programs.filter((key) => !byKey.has(key));
    if (unknown.length) throw new Error("Unknown program key(s): " + unknown.join(", "));
    const selected = new Set(options.programs);
    return catalog.programs.filter((program) => selected.has(program.key));
  }
  if (options.from && options.to) {
    const start = catalog.programs.findIndex((program) => program.key === options.from);
    const end = catalog.programs.findIndex((program) => program.key === options.to);
    if (start < 0 || end < 0) throw new Error("Unknown --from/--to key. Run --help for the catalog.");
    if (start > end) throw new Error("--from must appear before --to in the catalog.");
    return catalog.programs.slice(start, end + 1);
  }
  return catalog.programs;
}

function runChild(args, env, label) {
  console.log("\n" + "=".repeat(72));
  console.log(label);
  console.log("Command: node " + path.basename(args[0]) + " " + args.slice(1).join(" "));
  const result = spawnSync(process.execPath, args, {
    cwd: TOOL_DIR,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(label + " was interrupted by signal " + result.signal + ".");
  return result.status ?? 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = JSON.parse(await fs.readFile(CATALOG_FILE, "utf8"));
  if (options.help) {
    printHelp(catalog.programs);
    return;
  }

  const selected = resolvePrograms(catalog, options);
  if (options.fresh && selected.length !== 1) {
    throw new Error("--fresh is restricted to exactly one selected program to prevent accidental bulk deletion.");
  }

  console.log("Selected programs: " + selected.map((program) => program.name).join(" -> "));
  console.log("Mode: " + (options.discover ? "listing discovery only" : options.all ? "full card collection" : `pilot (${options.limit} card(s) per program)`));
  console.log("Pacing: " + options.delayMs + " ms between navigations; program jobs run one at a time.");

  let exitCode = 0;
  for (const program of selected) {
    const env = {
      FCMT_PROGRAM_KEY: program.key,
      FCMT_PROGRAM_NAME: program.name,
      FCMT_PROGRAM_URL: program.url
    };
    const childArgs = [COLLECTOR_FILE];
    if (options.discover) childArgs.push("--discover");
    else if (options.all) childArgs.push("--all");
    else childArgs.push("--limit", String(options.limit));
    if (options.refreshListing) childArgs.push("--refresh-listing");
    if (options.refreshCategories) childArgs.push("--refresh-categories");
    if (options.downloadImages) childArgs.push("--download-images");
    if (options.captureProgression) childArgs.push("--capture-progression");
    if (options.keepSourceText) childArgs.push("--keep-source-text");
    if (options.fresh) childArgs.push("--fresh");
    else if (options.resume) childArgs.push("--resume");
    childArgs.push("--delay-ms", String(options.delayMs));

    const status = runChild(childArgs, env, "[" + program.key + "] " + program.name);
    if (status !== 0) {
      console.error("\nStopping the sweep after a failed program. Review its report/checkpoint before resuming.");
      exitCode = status;
      break;
    }
  }

  if (!options.discover) {
    const exportStatus = runChild([EXPORT_FILE], {}, "Export combined event cards, Icon/Hero subset, and coverage report");
    if (exportStatus !== 0 && exitCode === 0) exitCode = exportStatus;
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error("\nStopped: " + error.message);
  process.exitCode = 1;
});
