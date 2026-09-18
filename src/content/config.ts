import { defineCollection, z } from 'astro:content';

const ARTICLE_TYPES = ['news','guide','player-review','ranking','analysis','event-guide','explanation','opinion','leaks'] as const;
const ARTICLE_STATUSES = ['draft','review','published','archived'] as const;
const FACT_STATUSES = ['verified','partially-verified','community-reported'] as const;
const stringArray = z.array(z.string()).default([]);

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.coerce.string().optional(),
    slug: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string(),
    type: z.enum(ARTICLE_TYPES).default('guide'),
    category: z.string().default('Guides'),
    author: z.string().default('TanzimFC'),
    status: z.enum(ARTICLE_STATUSES).default('published'),
    createdBy: z.string().optional(),
    reviewNotes: z.string().optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    publishedAt: z.coerce.date().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageCaption: z.string().optional(),
    thumbnail: z.string().optional(),
    excerpt: z.string().optional(),
    tags: stringArray,
    relatedPlayers: stringArray,
    relatedEvents: stringArray,
    relatedArticles: stringArray,
    relatedTools: stringArray,
    relatedCodes: stringArray,
    featured: z.boolean().default(false),
    readingTime: z.number().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    canonicalUrl: z.preprocess((v)=>typeof v==='string' && !v.trim() ? undefined : v, z.string().url().optional()),
    lastReviewed: z.preprocess((v)=>typeof v==='string' && !v.trim() ? undefined : v, z.coerce.date().optional()),
    sources: stringArray,
    factStatus: z.enum(FACT_STATUSES).optional(),
    series: z.string().optional(),
    seriesOrder: z.number().int().optional(),
    playerReview: z.object({
      playerId: z.string(),
      overallRating: z.number().min(0).max(10),
      paceRating: z.number().min(0).max(10).optional(),
      shootingRating: z.number().min(0).max(10).optional(),
      passingRating: z.number().min(0).max(10).optional(),
      dribblingRating: z.number().min(0).max(10).optional(),
      physicalRating: z.number().min(0).max(10).optional(),
      bestPosition: z.string().optional(),
      bestFormation: z.string().optional(),
      strengths: stringArray,
      weaknesses: stringArray,
      recommendedFor: z.string().optional(),
      worthBuying: z.boolean().optional(),
      verdict: z.string().optional()
    }).optional(),
    draft: z.boolean().default(false)
  })
});

export { ARTICLE_TYPES, ARTICLE_STATUSES, FACT_STATUSES };
export const collections = { blog };
