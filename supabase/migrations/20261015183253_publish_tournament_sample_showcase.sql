-- Publish only the curated tournament demo records for the public showcase.
-- Keep all player and result data illustrative, and leave unknown format-test slugs hidden by the Worker allowlist.
update public.tournaments
set
  is_public = true,
  status = 'completed',
  name = case slug
    when 'fcmobiletools-sample-championship' then 'FCMOBILETOOLS Sample Championship'
    when 'format-test-round-of-16' then 'Round of 16 Knockout Showcase'
    when 'format-test-asean-championship' then 'ASEAN Championship Showcase'
    when 'format-test-champions-league' then 'Champions League Format Showcase'
    when 'format-test-custom-competition' then 'Custom Competition Showcase'
    when 'format-test-fifa-asean-cup' then 'FIFA ASEAN Cup Showcase'
    when 'format-test-groups-knockout' then 'Groups + Knockout Showcase'
    when 'format-test-groups-two-leg' then 'Groups + Two-Leg Knockout Showcase'
    when 'format-test-home-away-league' then 'Home & Away League Showcase'
    when 'format-test-league-playoffs' then 'League + Playoffs Showcase'
    when 'format-test-round-robin' then 'Round-Robin League Showcase'
    when 'format-test-single-elimination' then 'Single-Elimination Cup Showcase'
    when 'format-test-two-leg-knockout' then 'Two-Leg Knockout Showcase'
    when 'format-test-world-cup' then 'World Cup Format Showcase'
    else name
  end,
  description = case slug
    when 'fcmobiletools-sample-championship' then 'Sample eight-player cup showing the public bracket, match scores and route to the final. All entrants and results are illustrative.'
    when 'format-test-round-of-16' then 'Sample 16-player knockout bracket showing the Round of 16 through the final. All entrants and results are illustrative.'
    when 'format-test-asean-championship' then 'Sample ASEAN-style championship with group play and two-leg semifinals and final. All entrants and results are illustrative.'
    when 'format-test-champions-league' then 'Sample 24-team league phase followed by knockout playoffs and two-leg ties. All entrants and results are illustrative.'
    when 'format-test-custom-competition' then 'Sample custom event with a group stage and a configured finals stage. All entrants and results are illustrative.'
    when 'format-test-fifa-asean-cup' then 'Sample cup with groups, semifinals, a final and a third-place match. All entrants and results are illustrative.'
    when 'format-test-groups-knockout' then 'Sample group-stage competition where standings determine a single-leg knockout bracket. All entrants and results are illustrative.'
    when 'format-test-groups-two-leg' then 'Sample group stage feeding into a home-and-away knockout. All entrants and results are illustrative.'
    when 'format-test-home-away-league' then 'Sample double round-robin league with return fixtures and a full standings table. All entrants and results are illustrative.'
    when 'format-test-league-playoffs' then 'Sample league table feeding into a two-leg playoff bracket. All entrants and results are illustrative.'
    when 'format-test-round-robin' then 'Sample round-robin league with a full table and completed fixtures. All entrants and results are illustrative.'
    when 'format-test-single-elimination' then 'Sample single-elimination cup showing results and progression to the final. All entrants and results are illustrative.'
    when 'format-test-two-leg-knockout' then 'Sample knockout cup using two-leg ties and aggregate progression. All entrants and results are illustrative.'
    when 'format-test-world-cup' then 'Sample 32-player World Cup format with eight groups of four followed by knockouts. All entrants and results are illustrative.'
    else description
  end,
  published_at = coalesce(published_at, clock_timestamp()),
  updated_at = clock_timestamp()
where slug in (
  'fcmobiletools-sample-championship',
  'format-test-round-of-16',
  'format-test-asean-championship',
  'format-test-champions-league',
  'format-test-custom-competition',
  'format-test-fifa-asean-cup',
  'format-test-groups-knockout',
  'format-test-groups-two-leg',
  'format-test-home-away-league',
  'format-test-league-playoffs',
  'format-test-round-robin',
  'format-test-single-elimination',
  'format-test-two-leg-knockout',
  'format-test-world-cup'
);
