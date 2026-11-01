// Seeded mulberry32. The state is a single integer stored on the World, so the
// same seed and squads always give the same match.

export function nextRandom(state: number): { state: number; value: number } {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: s, value: (t ^ (t >>> 14)) >>> 0 };
}

// The seed for the match after this one, so a run of matches is reproducible too.
export function nextSeed(seed: number): number {
  return nextRandom(seed).value % 1_000_000;
}
