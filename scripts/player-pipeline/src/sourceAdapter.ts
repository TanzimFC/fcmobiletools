import type { RawPlayer, SearchPage } from "./types.ts";

export interface PlayerSourceAdapter {
  search(searchAfter?: unknown[] | null): Promise<SearchPage>;
  discoverAll(): Promise<RawPlayer[]>;
}

export function createSourceAdapter(
  search: (searchAfter?: unknown[] | null) => Promise<SearchPage>
): PlayerSourceAdapter {
  return {
    search,
    async discoverAll() {
      const all: RawPlayer[] = [];
      let cursor: unknown[] | null = null;

      while (true) {
        const page = await search(cursor);
        all.push(...page.items);

        if (!page.items.length || !page.nextCursor) break;
        cursor = page.nextCursor;
      }

      return all;
    }
  };
}