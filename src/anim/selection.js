/**
 * The selected keyframe: a time (all keys at that moment) in a lane of the timeline
 * ('all' = every property). Shared by the timeline and the Animate tab.
 */
export const selection = { time: null, lane: 'all' };
const subs = new Set();

export function select(time, lane = 'all') {
  selection.time = time;
  selection.lane = lane;
  for (const fn of subs) fn(selection);
}

export const clearSelection = () => select(null, 'all');

/** Be told when the selection changes. Returns an unsubscribe function. */
export function onSelect(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
