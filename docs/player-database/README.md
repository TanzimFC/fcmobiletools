# Player database architecture

The public player catalog is powered by the Zenith FC Mobile API through the existing Cloudflare Worker. Supabase remains available as an optional persistence/cache layer, but the public catalog does not depend on a successful bulk import.

## Public data flow

```text
Zenith API
   ↓
Cloudflare Worker /api/players
   ↓
FCMobiletools /players/
   ↓
/player/<slug>
```

The Worker requests only the page needed by the visitor and keeps a small in-memory cache per Worker isolate. The browser never receives a Supabase server-side secret.

## Build-time player index

`scripts/player-data/generate-top-players.mjs` refreshes `src/data/top-players.json` from Zenith only when explicitly requested. It is intentionally not part of the normal production build.

The index stores stable player IDs rather than duplicating the full player database. The player detail route uses that index to pre-render the configured top-player tier.

Default limits:

- Top-player index: 10,000 IDs
- Player detail pre-render: 100 pages by default
- Public listing page size: 48 cards
- Worker API maximum listing request: 100 cards

The normal build pre-renders only the top 100 indexed players so deployments stay fast. For a deliberate larger rebuild, set `TOP_PLAYERS_PRERENDER_LIMIT` in the build environment, for example:

```text
TOP_PLAYERS_PRERENDER_LIMIT=1000
```

To refresh the 10,000-ID index itself, run `npm run refresh-player-index` separately. That network operation is not part of `npm run build`.

The public listing can still search and paginate against Zenith records outside the pre-rendered tier. Those cards should only be treated as SEO-pre-rendered when they are included in the current build index.

## Player data carried from Zenith

The normalized player contract includes:

- Stable player ID and generated slug
- Name and full name
- OVR, primary and alternate positions
- Club, league, nation and event
- Skill Moves, Weak Foot and work rates
- Height, weight and foot information
- Base attribute stats
- Player render and card background URLs
- Nation, club and league asset URLs
- PlayStyle/skill names and trait names
- Colour metadata and current source price when supplied

Missing upstream fields remain empty. The site does not invent player stats.

## PlayStyle assets

Local PlayStyle graphics live in:

`assets/images/playstyle/`

The importer/indexing layer recognizes Zenith PlayStyle names and can map them to the local level files:

```text
*_PLAYSTYLE_<NAME>_0.png
*_PLAYSTYLE_<NAME>_1.png
*_PLAYSTYLE_<NAME>_2.png
```

These files are referenced from the site's own asset path rather than renamed on every import.

## Supabase bulk import

The mass collector and Supabase importer are still kept in the repository for archival/cache use:

```text
Zenith API
   ↓
collector
   ↓
normalization / quality gate
   ↓
Supabase
```

A missing GitHub Actions Supabase secret must not make the public player catalog disappear. The public site uses the live Zenith path independently.

## Old 580-player pilot

The former 580 Star Signings pilot is not part of the active public source of truth. It should not be mixed back into the Zenith catalog.

## Security

The public site uses only the Zenith API through the Worker. Supabase server-side credentials belong only in trusted Worker or GitHub Actions secrets and must never be committed to source or sent to the browser.
