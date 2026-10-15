// Curated, fictional tournament examples that can be shown publicly.
// Exact-slug allowlisting keeps future internal format tests private by default.
export const TOURNAMENT_SAMPLES = Object.freeze([
  {
    "slug": "fcmobiletools-sample-championship",
    "name": "FCMOBILETOOLS Sample Championship",
    "format": "Single elimination",
    "entrants": 8,
    "summary": "A complete eight-player cup, from opening fixtures to the final."
  },
  {
    "slug": "format-test-single-elimination",
    "name": "Single-Elimination Cup Showcase",
    "format": "Knockout cup",
    "entrants": 8,
    "summary": "Follow each knockout round through to the sample champion."
  },
  {
    "slug": "format-test-groups-knockout",
    "name": "Groups + Knockout Showcase",
    "format": "Groups + knockout",
    "entrants": 8,
    "summary": "Group tables determine the entrants and order for a single-leg knockout."
  },
  {
    "slug": "format-test-round-robin",
    "name": "Round-Robin League Showcase",
    "format": "Round robin",
    "entrants": 6,
    "summary": "A complete table with fixtures, points and a finished league season."
  },
  {
    "slug": "format-test-world-cup",
    "name": "World Cup Format Showcase",
    "format": "World Cup format",
    "entrants": 32,
    "summary": "Eight groups of four followed by the knockout rounds."
  },
  {
    "slug": "format-test-champions-league",
    "name": "Champions League Format Showcase",
    "format": "League + playoffs",
    "entrants": 24,
    "summary": "A 24-team league phase, knockout playoffs and two-leg ties."
  },
  {
    "slug": "format-test-home-away-league",
    "name": "Home & Away League Showcase",
    "format": "Double round robin",
    "entrants": 6,
    "summary": "A home-and-away league with return fixtures and full standings."
  },
  {
    "slug": "format-test-league-playoffs",
    "name": "League + Playoffs Showcase",
    "format": "League to playoffs",
    "entrants": 8,
    "summary": "League standings feed into a two-leg playoff bracket."
  },
  {
    "slug": "format-test-two-leg-knockout",
    "name": "Two-Leg Knockout Showcase",
    "format": "Two-leg knockout",
    "entrants": 8,
    "summary": "See two-leg ties and aggregate progression through the bracket."
  },
  {
    "slug": "format-test-fifa-asean-cup",
    "name": "FIFA ASEAN Cup Showcase",
    "format": "Groups + finals",
    "entrants": 8,
    "summary": "Groups, semifinals, a final and a third-place match on one page."
  },
  {
    "slug": "format-test-asean-championship",
    "name": "ASEAN Championship Showcase",
    "format": "Groups + two-leg finals",
    "entrants": 10,
    "summary": "Group play leads into home-and-away semifinals and a final."
  },
  {
    "slug": "format-test-round-of-16",
    "name": "Round of 16 Knockout Showcase",
    "format": "Round of 16",
    "entrants": 16,
    "summary": "A full 16-player bracket with simulated scores through the final."
  },
  {
    "slug": "format-test-groups-two-leg",
    "name": "Groups + Two-Leg Knockout Showcase",
    "format": "Groups + two-leg ties",
    "entrants": 8,
    "summary": "A group stage feeds into home-and-away knockout ties."
  },
  {
    "slug": "format-test-custom-competition",
    "name": "Custom Competition Showcase",
    "format": "Custom format",
    "entrants": 8,
    "summary": "A configurable group stage followed by a custom finals stage."
  }
]);

const SAMPLE_SLUGS = new Set(TOURNAMENT_SAMPLES.map((sample) => sample.slug));

export function isTournamentSampleSlug(value) {
  return SAMPLE_SLUGS.has(String(value || '').trim().toLowerCase());
}

export function isHiddenInternalTournamentSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  const looksInternal = slug.startsWith('format-test-') || slug === 'fcmobiletools-sample-championship';
  return looksInternal && !SAMPLE_SLUGS.has(slug);
}
