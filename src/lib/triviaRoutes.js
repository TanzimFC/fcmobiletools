// Single source of truth for Trivia URLs.
export const TRIVIA_ROUTE = '/trivia/';
export const PLAY_ROUTE = '/trivia/play/';
export const EXTRA_TIME_ROUTE = '/trivia/extra-time/';
export const SEASON_RECAP_ROUTE = '/trivia/extra-time/season-recap/';
export const NATIONS_ROUTE = '/trivia/a-nations-story/';
export const OLD_NATIONS_ROUTE = '/a-nations-story/';

/**
 * Link into the Play page. Every "Start" / "Practice" control is a plain <a href>
 * built with this helper, so it works before (and without) any JavaScript.
 *   playUrl({ set: 'nations-story', nation: 'japan', day: 3, mode: 'attack' })
 */
export function playUrl({ set, mode, nation, topic, day, length } = {}) {
  const q = new URLSearchParams();
  if (set) q.set('set', set);
  if (mode) q.set('mode', mode);
  if (nation) q.set('nation', nation);
  if (topic) q.set('topic', topic);
  if (day) q.set('day', String(day));
  if (length) q.set('length', String(length));
  const s = q.toString();
  return s ? `${PLAY_ROUTE}?${s}` : PLAY_ROUTE;
}
