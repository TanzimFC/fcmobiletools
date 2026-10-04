import { config } from "./config.ts";
import type { RawPlayer, SearchPage } from "./types.ts";

export async function searchPlayers(cursor: unknown[] | null = null): Promise<SearchPage> {
  const body: Record<string, unknown> = { size: config.pageSize, sort: [{ assetId: "asc" }] };
  if (cursor) body.search_after = cursor;

  const response = await fetch(new URL(config.searchEndpoint, config.sourceBaseUrl), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error("source request failed: " + response.status);

  const payload = await response.json() as { hits?: { hits?: Array<{ _source?: RawPlayer; sort?: unknown[] }> } };
  const hits = payload.hits?.hits ?? [];
  const last = hits[hits.length - 1];

  return {
    items: hits.map(hit => hit._source ?? {}),
    nextCursor: Array.isArray(last?.sort) ? last.sort : null
  };
}

export async function discoverAll(): Promise<RawPlayer[]> {
  const all: RawPlayer[] = [];
  let cursor: unknown[] | null = null;

  while (true) {
    const page = await searchPlayers(cursor);
    all.push(...page.items);
    console.log("discovered", all.length);
    if (!page.items.length || !page.nextCursor) return all;
    cursor = page.nextCursor;
  }
}