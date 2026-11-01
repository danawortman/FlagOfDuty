import type { Tile } from './types';

// Each arena is authored as the top-left quadrant plus centre row of the blue half.
// Mirroring top/bottom and left/right guarantees both teams get the same field.
//   # wall   . floor   ~ mud   B flag base   S spawn point
export interface ArenaDef {
  name: string;
  rows: string[];
  // Blue-side waypoints. Red uses the left/right mirror of each.
  basePatrol: Tile[];
  midfieldPatrol: Tile[];
  flank: Tile;
}

const STANDARD_PATROL: Tile[] = [{ x: 3, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 11 }, { x: 3, y: 11 }];
const STANDARD_MIDFIELD: Tile[] = [{ x: 13, y: 3 }, { x: 13, y: 8 }, { x: 13, y: 13 }];

export const ARENAS: ArenaDef[] = [
  {
    name: 'Crossroads',
    rows: [
      '################',
      '#...............',
      '#.S.......##....',
      '#.........##....',
      '#...##........##',
      '#...#.....#...##',
      '#.........#.....',
      '#.....#...#.....',
      '#SB...#.........',
    ],
    basePatrol: STANDARD_PATROL,
    midfieldPatrol: STANDARD_MIDFIELD,
    flank: { x: 15, y: 14 },
  },
  {
    name: 'The Bog',
    rows: [
      '################',
      '#..........~~~~~',
      '#.S.......~~~~~~',
      '#.....##..~~~...',
      '#.....##........',
      '#..........##...',
      '#...~~.....##...',
      '#...~~..........',
      '#SB.~~......~~~~',
    ],
    basePatrol: STANDARD_PATROL,
    midfieldPatrol: [{ x: 13, y: 4 }, { x: 10, y: 8 }, { x: 13, y: 12 }],
    flank: { x: 15, y: 13 },
  },
  {
    name: 'Trenches',
    rows: [
      '################',
      '#.....#.........',
      '#.S...#..####...',
      '#.....#.....#...',
      '#.###...###.#.~~',
      '#...#...#.....~~',
      '#...#.###..##...',
      '#.........#.....',
      '#SB.......#.....',
    ],
    basePatrol: [{ x: 3, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 11 }, { x: 3, y: 11 }],
    midfieldPatrol: STANDARD_MIDFIELD,
    flank: { x: 15, y: 13 },
  },
  {
    name: 'Canals',
    rows: [
      '################',
      '#......~~.......',
      '#.S....~~...##..',
      '#......~~...##..',
      '#..##..~~.......',
      '#..##.......##..',
      '#......~~...##..',
      '#......~~.......',
      '#SB....~~.....~~',
    ],
    basePatrol: [{ x: 5, y: 5 }, { x: 9, y: 5 }, { x: 9, y: 11 }, { x: 5, y: 11 }],
    midfieldPatrol: [{ x: 14, y: 3 }, { x: 10, y: 8 }, { x: 14, y: 13 }],
    flank: { x: 15, y: 13 },
  },
];
