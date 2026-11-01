import type { Team, Tile } from './types';

// The arena is authored as the top-left quadrant plus centre row of the blue half.
// Mirroring top/bottom and left/right guarantees both teams get the same field.
//   # wall   . floor   B flag base   S spawn point
const ARENA_LEFT_TOP = [
  '################',
  '#...............',
  '#.S.......##....',
  '#.........##....',
  '#...##........##',
  '#...#.....#...##',
  '#.........#.....',
  '#.....#...#.....',
  '#SB...#.........',
];

// Blue-side waypoints. Red uses the left/right mirror of each.
const BASE_PATROL: Tile[] = [{ x: 3, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 11 }, { x: 3, y: 11 }];
const MIDFIELD_PATROL: Tile[] = [{ x: 13, y: 3 }, { x: 13, y: 8 }, { x: 13, y: 13 }];
const FLANK: Tile = { x: 15, y: 14 };

export interface GameMap {
  width: number;
  height: number;
  walls: boolean[]; // indexed by y * width + x
  flagHome: Record<Team, Tile>;
  spawns: Record<Team, Tile[]>;
  basePatrol: Record<Team, Tile[]>;
  midfieldPatrol: Record<Team, Tile[]>;
  flank: Record<Team, Tile>;
  fields: Map<number, Int32Array>; // lazily built BFS cache, not part of game state
}

export function mirrorX(width: number, t: Tile): Tile {
  return { x: width - 1 - t.x, y: t.y };
}

export function createArena(): GameMap {
  const leftHalf = [...ARENA_LEFT_TOP, ...ARENA_LEFT_TOP.slice(0, -1).reverse()];
  const rows = leftHalf.map((row) => row + [...row].reverse().join(''));
  const height = rows.length;
  const width = rows[0].length;

  const walls: boolean[] = [];
  const flags: Tile[] = [];
  const spawns: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = rows[y][x];
      walls.push(c === '#');
      if (x < width / 2 && c === 'B') flags.push({ x, y });
      if (x < width / 2 && c === 'S') spawns.push({ x, y });
    }
  }

  const both = (t: Tile): Record<Team, Tile> => ({ blue: t, red: mirrorX(width, t) });
  const bothList = (l: Tile[]): Record<Team, Tile[]> => ({ blue: l, red: l.map((t) => mirrorX(width, t)) });

  return {
    width,
    height,
    walls,
    flagHome: both(flags[0]),
    spawns: bothList(spawns),
    basePatrol: bothList(BASE_PATROL),
    midfieldPatrol: bothList(MIDFIELD_PATROL),
    flank: both(FLANK),
    fields: new Map(),
  };
}

export function tileIndex(map: GameMap, t: Tile): number {
  return t.y * map.width + t.x;
}

export function isWall(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
  return map.walls[y * map.width + x];
}

export function inHalf(map: GameMap, team: Team, t: Tile): boolean {
  return team === 'blue' ? t.x < map.width / 2 : t.x >= map.width / 2;
}

export function manhattan(a: Tile, b: Tile): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Bresenham between two tiles. Endpoints are ordered first so that a sees b
// exactly when b sees a.
export function hasLineOfSight(map: GameMap, a: Tile, b: Tile): boolean {
  const swap = a.x > b.x || (a.x === b.x && a.y > b.y);
  const from = swap ? b : a;
  const to = swap ? a : b;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  let x = from.x;
  let y = from.y;
  while (x !== to.x || y !== to.y) {
    if (isWall(map, x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return !isWall(map, to.x, to.y);
}
