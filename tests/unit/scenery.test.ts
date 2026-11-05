import { describe, expect, it } from 'vitest';
import { ARENAS } from '../../src/sim/arenas';
import { createArena, isWall } from '../../src/sim/map';
import { isEdge, mirroredHash, propsFor, type Prop } from '../../src/ui/scenery';

const tilesOf = (p: Prop): string[] => {
  const out: string[] = [];
  for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) out.push(`${x},${y}`);
  return out;
};

describe.each(ARENAS.map((arena, i) => [arena.name, i] as const))('scenery for %s', (_name, index) => {
  const map = createArena(index);
  const props = propsFor(map);

  it('covers every wall tile inside the fence exactly once, and nothing else', () => {
    const covered = props.flatMap(tilesOf);
    expect(new Set(covered).size).toBe(covered.length);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const inside = isWall(map, x, y) && !isEdge(map, x, y);
        expect(covered.includes(`${x},${y}`), `${x},${y}`).toBe(inside);
      }
    }
  });

  it('gives both teams the same props, mirrored', () => {
    const key = (p: Prop) => `${p.kind} ${p.x},${p.y} ${p.w}x${p.h} ${p.vertical} ${p.variant}`;
    const mirrored = props.map((p) => key({ ...p, x: map.width - p.x - p.w }));
    expect(new Set(mirrored)).toEqual(new Set(props.map(key)));
    const flipped = props.map((p) => key({ ...p, y: map.height - p.y - p.h }));
    expect(new Set(flipped)).toEqual(new Set(props.map(key)));
  });
});

describe('prop choice', () => {
  const crossroads = propsFor(createArena(0));
  const find = (x: number, y: number) => crossroads.find((p) => tilesOf(p).includes(`${x},${y}`))!;

  it('turns a large solid block into a shipping container', () => {
    expect(find(15, 4)).toMatchObject({ kind: 'container', x: 14, y: 4, w: 4, h: 2, vertical: false });
  });

  it('puts a pile of cover on a 2 by 2 block', () => {
    expect(['crates', 'tyres']).toContain(find(10, 2).kind);
    expect(find(10, 2)).toMatchObject({ w: 2, h: 2 });
  });

  it('lines up jersey barriers along a straight run, turned to match it', () => {
    expect(find(6, 8)).toMatchObject({ kind: 'barrier', vertical: true });
  });

  it('puts a concrete block at a corner and barriers along each arm', () => {
    expect(find(4, 4).kind).toBe('concrete');
    expect(find(5, 4)).toMatchObject({ kind: 'barrier', vertical: false });
    expect(find(4, 5)).toMatchObject({ kind: 'barrier', vertical: true });
  });

  it('alternates 2 by 2 blocks between crate stacks and tyre piles', () => {
    const kinds = new Set(ARENAS.flatMap((_a, i) => propsFor(createArena(i))).filter((p) => p.w === 2 && p.h === 2).map((p) => p.kind));
    expect(kinds).toEqual(new Set(['crates', 'tyres']));
  });

  it('puts a single prop on a lone tile', () => {
    const trenches = propsFor(createArena(2));
    const lone = trenches.filter((p) => p.kind === 'tyres' || p.kind === 'crate');
    for (const p of lone) expect([p.w, p.h]).toEqual([1, 1]);
  });

  it('hashes mirrored tiles the same', () => {
    const map = createArena(0);
    expect(mirroredHash(map, 3, 2)).toBe(mirroredHash(map, map.width - 4, 2));
    expect(mirroredHash(map, 3, 2)).toBe(mirroredHash(map, 3, map.height - 3));
  });
});
