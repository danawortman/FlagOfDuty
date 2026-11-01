import { isWall, tileCost, tileIndex, type GameMap } from './map';
import type { Team, Tile } from './types';

// Neighbour order breaks ties, so red uses the left/right mirror of blue's order.
// Otherwise one team would systematically prefer "towards the enemy" on equal paths.
const NEIGHBOURS: Record<Team, Tile[]> = {
  blue: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
  red: [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
};

export const UNREACHABLE = 999;

// Cheapest cost from every tile to the target. Costs are small integers, so tiles can
// be bucketed by distance rather than kept in a priority queue.
export function distanceField(map: GameMap, target: Tile): Int32Array {
  const key = tileIndex(map, target);
  const cached = map.fields.get(key);
  if (cached) return cached;

  const field = new Int32Array(map.width * map.height).fill(UNREACHABLE);
  field[key] = 0;
  const buckets: Tile[][] = [[target]];
  for (let d = 0; d < buckets.length; d++) {
    for (const t of buckets[d] ?? []) {
      if (field[tileIndex(map, t)] !== d) continue;
      const cost = d + tileCost(map, t); // stepping onto t is what costs
      for (const n of NEIGHBOURS.blue) {
        const x = t.x + n.x;
        const y = t.y + n.y;
        if (isWall(map, x, y)) continue;
        const i = y * map.width + x;
        if (cost < field[i]) {
          field[i] = cost;
          (buckets[cost] ??= []).push({ x, y });
        }
      }
    }
  }
  map.fields.set(key, field);
  return field;
}

export function pathDistance(map: GameMap, a: Tile, b: Tile): number {
  return distanceField(map, b)[tileIndex(map, a)];
}

export function openNeighbours(map: GameMap, from: Tile, team: Team): Tile[] {
  const out: Tile[] = [];
  for (const n of NEIGHBOURS[team]) {
    const x = from.x + n.x;
    const y = from.y + n.y;
    if (!isWall(map, x, y)) out.push({ x, y });
  }
  return out;
}

export function stepToward(map: GameMap, from: Tile, target: Tile, team: Team): Tile | null {
  const field = distanceField(map, target);
  if (field[tileIndex(map, from)] === 0) return null;
  let best: Tile | null = null;
  let bestCost = UNREACHABLE;
  for (const n of openNeighbours(map, from, team)) {
    const cost = field[tileIndex(map, n)] + tileCost(map, n);
    if (cost < bestCost) {
      bestCost = cost;
      best = n;
    }
  }
  return best;
}

// Move to the neighbour furthest from the threat, preferring the one nearer home,
// so fleeing agents drift towards safety instead of pinning themselves in corners.
export function stepAway(map: GameMap, from: Tile, threat: Tile, home: Tile, team: Team): Tile | null {
  const threatField = distanceField(map, threat);
  const homeField = distanceField(map, home);
  let best: Tile | null = null;
  let bestThreat = threatField[tileIndex(map, from)];
  let bestHome = homeField[tileIndex(map, from)];
  for (const n of openNeighbours(map, from, team)) {
    const i = tileIndex(map, n);
    const t = threatField[i];
    const h = homeField[i];
    if (t > bestThreat || (t === bestThreat && h < bestHome)) {
      best = n;
      bestThreat = t;
      bestHome = h;
    }
  }
  return best;
}
