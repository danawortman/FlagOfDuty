// Round-robin of every brain as a full squad, run headless.
//   npm run tournament            20 seeds per pairing, each pairing played from both sides
//   npm run tournament -- 100     100 seeds per pairing
import { BRAINS } from '../src/sim/brains';
import { SQUAD_SIZE } from '../src/sim/rules';
import type { Brain } from '../src/sim/types';
import { createWorld, runToEnd } from '../src/sim/world';

const seeds = Number(process.argv[2] ?? 20);
const squad = (b: Brain): Brain[] => Array(SQUAD_SIZE).fill(b);

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  captures: number;
}

function play(a: Brain, b: Brain): Tally {
  const t: Tally = { wins: 0, losses: 0, draws: 0, captures: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    for (const aIsBlue of [true, false]) {
      const world = createWorld({
        seed,
        blue: squad(aIsBlue ? a : b),
        red: squad(aIsBlue ? b : a),
      });
      runToEnd(world);
      const aTeam = aIsBlue ? 'blue' : 'red';
      if (world.winner === 'draw') t.draws++;
      else if (world.winner === aTeam) t.wins++;
      else t.losses++;
      t.captures += world.score.blue + world.score.red;
    }
  }
  return t;
}

const pad = (s: string | number, n: number): string => String(s).padStart(n);
const names = BRAINS.map((b) => b.id.slice(0, 7));
console.log(`win% of row against column (${seeds * 2} games per cell; draws count half)`);
console.log(' '.repeat(12) + names.map((n) => pad(n, 8)).join('') + pad('avg', 8));

for (const a of BRAINS) {
  const cells: string[] = [];
  let total = 0;
  let count = 0;
  for (const b of BRAINS) {
    const t = play(a, b);
    const games = t.wins + t.losses + t.draws;
    const rate = (100 * (t.wins + t.draws / 2)) / games;
    cells.push(pad(`${rate.toFixed(0)}`, 8));
    if (a !== b) {
      total += rate;
      count++;
    }
  }
  console.log(`${a.id.padEnd(9)}${pad(a.states.length, 3)}${cells.join('')}${pad((total / count).toFixed(0), 8)}`);
}

console.log('\ndiagonal mirror matches, blue vs red bias check:');
for (const b of BRAINS) {
  let blue = 0;
  let red = 0;
  let draw = 0;
  let caps = 0;
  for (let seed = 1; seed <= seeds * 2; seed++) {
    const w = runToEnd(createWorld({ seed, blue: squad(b), red: squad(b) }));
    if (w.winner === 'blue') blue++;
    else if (w.winner === 'red') red++;
    else draw++;
    caps += w.score.blue + w.score.red;
  }
  console.log(`${b.id.padEnd(10)} blue ${pad(blue, 3)}  red ${pad(red, 3)}  draw ${pad(draw, 3)}  captures/game ${(caps / (seeds * 2)).toFixed(1)}`);
}
