import { isWall, type GameMap } from '../sim/map';

// Turns an arena's walls into urban cover. Each connected run of wall becomes a
// prop chosen by its shape alone, so both teams' sides always get matching props.

export type PropKind = 'container' | 'crates' | 'crate' | 'tyres' | 'barrier' | 'concrete';

export interface Prop {
  kind: PropKind;
  x: number; // tiles
  y: number;
  w: number;
  h: number;
  vertical: boolean; // containers and barriers run along their long side
  variant: number; // picks a colour or style, the same for mirrored props
}

export function isEdge(map: GameMap, x: number, y: number): boolean {
  return x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
}

// A hash of the tile's distance from the nearest corner, so mirrored tiles agree.
export function mirroredHash(map: GameMap, x: number, y: number): number {
  const cx = Math.min(x, map.width - 1 - x);
  const cy = Math.min(y, map.height - 1 - y);
  let h = Math.imul(cx + 1, 73856093) ^ Math.imul(cy + 1, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

// Even and odd answers from the hash's upper bits; its low bits follow tile parity.
const pick = (variant: number): boolean => ((variant >>> 16) & 1) === 0;

// The wall tiles inside the fence, grouped into 4-connected runs.
function wallRuns(map: GameMap): { x: number; y: number }[][] {
  const seen = new Set<number>();
  const runs: { x: number; y: number }[][] = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (!isWall(map, x, y) || seen.has(y * map.width + x)) continue;
      const run: { x: number; y: number }[] = [];
      const stack = [{ x, y }];
      seen.add(y * map.width + x);
      while (stack.length) {
        const t = stack.pop()!;
        run.push(t);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = t.x + dx;
          const ny = t.y + dy;
          const key = ny * map.width + nx;
          if (isEdge(map, nx, ny) || !isWall(map, nx, ny) || seen.has(key)) continue;
          seen.add(key);
          stack.push({ x: nx, y: ny });
        }
      }
      runs.push(run);
    }
  }
  return runs;
}

export function propsFor(map: GameMap): Prop[] {
  const props: Prop[] = [];
  for (const run of wallRuns(map)) {
    const minX = Math.min(...run.map((t) => t.x));
    const minY = Math.min(...run.map((t) => t.y));
    const w = Math.max(...run.map((t) => t.x)) - minX + 1;
    const h = Math.max(...run.map((t) => t.y)) - minY + 1;
    const solid = run.length === w * h;
    // Mirrored props share the corner of their box that is nearest the arena's.
    const variant = mirroredHash(map, Math.min(minX, map.width - minX - w), Math.min(minY, map.height - minY - h));
    const box = { x: minX, y: minY, w, h, vertical: h > w, variant };

    if (solid && w === 1 && h === 1) props.push({ ...box, kind: pick(variant) ? 'tyres' : 'crate' });
    else if (solid && w === 2 && h === 2) props.push({ ...box, kind: pick(variant) ? 'crates' : 'tyres' });
    else if (solid && Math.min(w, h) >= 2 && Math.max(w, h) >= 3) props.push({ ...box, kind: 'container' });
    else if (solid) {
      // A straight run one tile wide: a line of jersey barriers.
      for (const t of run) props.push({ ...box, kind: 'barrier', x: t.x, y: t.y, w: 1, h: 1 });
    } else {
      // Any other shape is a barrier line: straight stretches are jersey barriers,
      // and corners and junctions are concrete blocks.
      const inRun = new Set(run.map((t) => `${t.x},${t.y}`));
      for (const t of run) {
        const across = inRun.has(`${t.x - 1},${t.y}`) || inRun.has(`${t.x + 1},${t.y}`);
        const along = inRun.has(`${t.x},${t.y - 1}`) || inRun.has(`${t.x},${t.y + 1}`);
        const tile = { ...box, x: t.x, y: t.y, w: 1, h: 1 };
        if (across && along) props.push({ ...tile, kind: 'concrete', vertical: false });
        else props.push({ ...tile, kind: 'barrier', vertical: along });
      }
    }
  }
  return props;
}
