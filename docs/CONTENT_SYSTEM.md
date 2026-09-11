# TanzimFC Content System

The blog is now a content system, not a collection of hand-built pages. Every article lives in `src/content/blog/` and uses the same Astro content collection and article route.

## The easy developer workflow

Create an article:

```bash
npm run new:article -- "Best STs in FC Mobile"
```

That creates:

```text
src/content/blog/best-sts-in-fc-mobile.md
```

Open that one Markdown file, write the article, set `status: published` when it is ready, and build/deploy. No new `.astro` page is required.

## Frontmatter

```yaml
---
title: "Best STs in FC Mobile"
subtitle: "The forwards worth building around"
description: "A practical ranking of the best strikers for different budgets."
type: ranking
category: Rankings
author: TanzimFC
status: published
publishedAt: 2026-09-12
updatedAt: 2026-09-12
tags: [ST, Ranking, F2P]
relatedPlayers: [player-id]
relatedEvents: []
relatedArticles: []
relatedTools: [team-ovr]
relatedCodes: []
featured: true
sources: ["EA official information", "In-game testing"]
factStatus: verified
---
```

Supported types: `news`, `guide`, `player-review`, `ranking`, `analysis`, `event-guide`, `explanation`, `opinion`.

Supported statuses: `draft`, `review`, `scheduled`, `published`, `archived`.

Only `published` content is public. Old content is never deleted just because it becomes outdated.

## Why this is easier

- One Markdown file per article
- No manual route creation
- No manual homepage card creation
- Shared article layout
- Shared metadata validation
- Reusable tags and entity references
- Reading time can be calculated by the presentation layer
- SEO fields stay in the article data instead of the page template
- New article types can be added without rebuilding the publishing architecture

## Relationships

Use IDs in `relatedPlayers`, `relatedEvents`, `relatedArticles`, `relatedTools`, and `relatedCodes`. Do not copy an entity's full data into an article. This keeps the website's data centralized and lets native cards/components be added later without rewriting old articles.

## Player reviews

For a player review, add the optional `playerReview` object:

```yaml
playerReview:
  playerId: player-id
  overallRating: 9.2
  paceRating: 9
  shootingRating: 9.5
  passingRating: 8.5
  dribblingRating: 9.1
  physicalRating: 8.7
  bestPosition: ST
  bestFormation: 4-2-3-1
  strengths: [Finishing, Pace]
  weaknesses: [Weak foot]
  recommendedFor: Players who attack in behind
  worthBuying: true
  verdict: Excellent endgame striker
```

## Content blocks

The article body uses Markdown, which is already structured into headings, paragraphs, lists, tables, quotes, images and links by Astro's content renderer. Native FC Mobile blocks can be introduced as reusable components later without changing the Article data model.

## Future editor

A browser-based editor should be added only when the site has a server-side persistence/auth layer. Until then, a fake browser editor that cannot safely commit content would create a worse developer workflow. The CLI + Markdown workflow is intentionally simple, version-controlled, reviewable, and deploy-safe.
