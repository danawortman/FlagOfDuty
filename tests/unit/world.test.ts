import { describe, expect, it } from 'vitest';
import { BRAINS, brainById } from '../../src/sim/brains';
import { validateBrain } from '../../src/sim/fsm';
import { createArena, hasLineOfSight, inHalf, isWall, mirrorX } from '../../src/sim/map';
import { pathDistance, UNREACHABLE } from '../../src/sim/path';
import {
  CAPTURES_TO_WIN,
  FLAG_RETURN_TICKS,
  MATCH_TICKS,
  RESPAWN_TICKS,
  TAG_RECHARGE_TICKS,
} from '../../src/sim/rules';
import { readSensor } from '../../src/sim/sensors';
import type { Agent, Brain, Tile, World } from '../../src/sim/types';
import { createWorld, runToEnd, stateHash, stepWorld } from '../../src/sim/world';

const idle: Brain = {
  id: 'idle',
  name: 'Idle',
  initial: 'stay',
  states: [{ id: 'stay', name: 'Stay', action: 'hold' }],
  transitions: [],
};

function idleWorld(): World {
  const world = createWorld({ seed: 1, blue: [idle, idle, idle], red: [idle, idle, idle] });
  world.agents.forEach((a) => (a.moveCooldown = 0));
  return world;
}

function place(agent: Agent, tile: Tile): void {
  agent.pos = { ...tile };
  agent.prev = { ...tile };
}

const blue = (w: World, i = 0) => w.agents[i];
const red = (w: World, i = 0) => w.agents[3 + i];

describe('arena', () => {
  const map = createArena();

  it('is mirror-symmetric left to right and top to bottom', () => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        expect(isWall(map, x, y)).toBe(isWall(map, map.width - 1 - x, y));
        expect(isWall(map, x, y)).toBe(isWall(map, x, map.height - 1 - y));
      }
    }
  });

  it('connects every floor tile to both flags', () => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (isWall(map, x, y)) continue;
        expect(pathDistance(map, { x, y }, map.flagHome.blue)).toBeLessThan(UNREACHABLE);
        expect(pathDistance(map, { x, y }, map.flagHome.red)).toBeLessThan(UNREACHABLE);
      }
    }
  });

  it('places every waypoint and spawn on floor, mirrored for red', () => {
    const tiles = [
      ...map.spawns.blue,
      ...map.basePatrol.blue,
      ...map.midfieldPatrol.blue,
      map.flank.blue,
    ];
    for (const t of tiles) expect(isWall(map, t.x, t.y)).toBe(false);
    expect(map.flagHome.red).toEqual(mirrorX(map.width, map.flagHome.blue));
    expect(map.spawns.blue).toHaveLength(3);
  });

  it('has symmetric line of sight, blocked by walls', () => {
    const a = { x: 3, y: 3 };
    const b = { x: 9, y: 7 };
    expect(hasLineOfSight(map, a, b)).toBe(hasLineOfSight(map, b, a));
    expect(hasLineOfSight(map, { x: 8, y: 2 }, { x: 13, y: 2 })).toBe(false); // wall at x=10
    expect(hasLineOfSight(map, { x: 1, y: 1 }, { x: 14, y: 1 })).toBe(true);
  });
});

describe('determinism', () => {
  const setup = (seed: number) => ({
    seed,
    blue: ['raider', 'rusher', 'sentry'].map(brainById),
    red: ['picket', 'rusher', 'sentry'].map(brainById),
  });

  it('gives the same match for the same seed', () => {
    const a = createWorld(setup(42));
    const b = createWorld(setup(42));
    for (let i = 0; i < 600; i++) {
      stepWorld(a);
      stepWorld(b);
      expect(stateHash(a)).toBe(stateHash(b));
    }
  });

  it('gives different seeds different matches', () => {
    const hashes = new Set([1, 2, 3, 4, 5].map((s) => stateHash(runToEnd(createWorld(setup(s))))));
    expect(hashes.size).toBeGreaterThan(1);
  });
});

describe('tagging', () => {
  it('tags an intruder next to a defender in the defender\'s half', () => {
    const w = idleWorld();
    place(blue(w), { x: 8, y: 8 });
    place(red(w), { x: 9, y: 8 });
    stepWorld(w);
    expect(red(w).respawn).toBe(RESPAWN_TICKS);
    expect(red(w).pos).toEqual(red(w).spawn);
    expect(blue(w).respawn).toBe(0);
    expect(blue(w).tagCooldown).toBe(TAG_RECHARGE_TICKS);
  });

  it('never tags an agent in its own half', () => {
    const w = idleWorld();
    place(blue(w), { x: 15, y: 8 });
    place(red(w), { x: 16, y: 8 });
    stepWorld(w);
    expect(blue(w).respawn).toBe(0);
    expect(red(w).respawn).toBe(0);
  });

  it('needs the tagger in its own half', () => {
    const w = idleWorld();
    place(blue(w), { x: 16, y: 8 }); // both in red's half: only red may tag
    place(red(w), { x: 17, y: 8 });
    stepWorld(w);
    expect(blue(w).respawn).toBe(RESPAWN_TICKS);
    expect(red(w).respawn).toBe(0);
  });

  it('lets a tagger land one tag, then blocks it until recharged', () => {
    const w = idleWorld();
    place(blue(w), { x: 8, y: 8 });
    place(red(w, 0), { x: 9, y: 8 });
    place(red(w, 1), { x: 7, y: 8 });
    stepWorld(w);
    expect([red(w, 0).respawn, red(w, 1).respawn].sort()).toEqual([0, RESPAWN_TICKS]);
    for (let i = 0; i < TAG_RECHARGE_TICKS - 1; i++) stepWorld(w);
    expect(red(w, 1).respawn).toBe(0);
    stepWorld(w);
    expect(red(w, 1).respawn).toBe(RESPAWN_TICKS);
  });

  it('restarts the brain when the agent comes back', () => {
    const w = createWorld({ seed: 1, blue: [idle, idle, idle], red: Array(3).fill(brainById('raider')) });
    place(blue(w), { x: 8, y: 8 });
    place(red(w), { x: 9, y: 8 });
    red(w).runtime.state = 'runHome';
    stepWorld(w);
    for (let i = 0; i < RESPAWN_TICKS; i++) stepWorld(w);
    expect(red(w).respawn).toBe(0);
    expect(red(w).runtime.state).toBe('approach');
  });
});

describe('flags', () => {
  it('is picked up by an enemy and rides with the carrier', () => {
    const w = idleWorld();
    place(red(w, 0), { x: 20, y: 2 }); // red's spawn is next to its flag and would tag the thief
    place(red(w, 1), { x: 21, y: 2 });
    place(red(w, 2), { x: 22, y: 2 });
    place(blue(w), w.map.flagHome.red);
    stepWorld(w);
    expect(w.flags.red.status).toBe('carried');
    expect(w.flags.red.carrier).toBe(0);
    place(blue(w), { x: 24, y: 2 });
    stepWorld(w);
    expect(w.flags.red.pos).toEqual({ x: 24, y: 2 });
  });

  it('is not picked up by its own team while at home', () => {
    const w = idleWorld();
    place(red(w), w.map.flagHome.red);
    stepWorld(w);
    expect(w.flags.red.status).toBe('home');
  });

  it('scores when the carrier reaches base, even with its own flag away', () => {
    const w = idleWorld();
    w.flags.red.status = 'carried';
    w.flags.red.carrier = 0;
    w.flags.blue.status = 'carried';
    w.flags.blue.carrier = 3;
    place(blue(w), w.map.flagHome.blue);
    stepWorld(w);
    expect(w.score.blue).toBe(1);
    expect(w.flags.red.status).toBe('home');
    expect(w.flags.red.pos).toEqual(w.map.flagHome.red);
  });

  it('drops where the carrier is tagged', () => {
    const w = idleWorld();
    w.flags.blue.status = 'carried';
    w.flags.blue.carrier = 3;
    const spot = { x: 8, y: 8 };
    place(red(w), spot);
    place(blue(w), { x: 8, y: 7 });
    stepWorld(w);
    expect(w.flags.blue.status).toBe('dropped');
    expect(w.flags.blue.pos).toEqual(spot);
    expect(w.flags.blue.returnTimer).toBeGreaterThan(0);
  });

  it('returns when an owner touches it, and that beats a simultaneous pickup', () => {
    const w = idleWorld();
    const spot = { x: 8, y: 2 };
    w.flags.blue.status = 'dropped';
    w.flags.blue.pos = { ...spot };
    w.flags.blue.returnTimer = FLAG_RETURN_TICKS;
    place(blue(w), spot);
    place(red(w), spot);
    blue(w).tagCooldown = 999; // keep the tag out of this test
    stepWorld(w);
    expect(w.flags.blue.status).toBe('home');
  });

  it('returns on its own after the timeout', () => {
    const w = idleWorld();
    w.flags.blue.status = 'dropped';
    w.flags.blue.pos = { x: 8, y: 2 };
    w.flags.blue.returnTimer = FLAG_RETURN_TICKS;
    for (let i = 0; i < FLAG_RETURN_TICKS - 1; i++) stepWorld(w);
    expect(w.flags.blue.status).toBe('dropped');
    stepWorld(w);
    expect(w.flags.blue.status).toBe('home');
  });
});

describe('match end', () => {
  it('ends at the capture limit', () => {
    const w = idleWorld();
    w.score.blue = CAPTURES_TO_WIN;
    stepWorld(w);
    expect(w.winner).toBe('blue');
    const tick = w.tick;
    stepWorld(w);
    expect(w.tick).toBe(tick); // finished worlds no longer advance
  });

  it('calls a draw when time runs out level', () => {
    const w = runToEnd(idleWorld());
    expect(w.tick).toBe(MATCH_TICKS);
    expect(w.winner).toBe('draw');
  });

  it('awards a timed-out match to the leader', () => {
    const w = idleWorld();
    w.score.red = 1;
    expect(runToEnd(w).winner).toBe('red');
  });
});

describe('sensors', () => {
  it('reads the flag state from each team\'s point of view', () => {
    const w = idleWorld();
    w.flags.blue.status = 'carried';
    w.flags.blue.carrier = 3;
    expect(readSensor(w, blue(w), 'ourFlagTaken', 0)).toBe(1);
    expect(readSensor(w, red(w), 'iHaveFlag', 0)).toBe(1);
    expect(readSensor(w, red(w), 'ourFlagHome', 0)).toBe(1);
  });

  it('counts intruders and treats halves by team', () => {
    const w = idleWorld();
    place(red(w), { x: 8, y: 8 });
    expect(inHalf(w.map, 'blue', red(w).pos)).toBe(true);
    expect(readSensor(w, blue(w, 1), 'intruderCount', 0)).toBe(1);
    expect(readSensor(w, red(w), 'inOwnHalf', 0)).toBe(0);
  });

  it('cannot see through walls', () => {
    const w = idleWorld();
    place(blue(w), { x: 8, y: 2 });
    place(red(w), { x: 13, y: 2 });
    expect(readSensor(w, blue(w), 'enemyVisible', 0)).toBe(0);
    expect(readSensor(w, blue(w), 'nearestEnemyDist', 0)).toBe(99);
  });
});

describe('brains', () => {
  it('has only structurally valid brains', () => {
    for (const brain of BRAINS) expect(validateBrain(brain), brain.id).toEqual([]);
  });

  it('plays full matches with every brain', () => {
    for (const brain of BRAINS) {
      const w = runToEnd(createWorld({ seed: 3, blue: Array(3).fill(brain), red: Array(3).fill(brainById('picket')) }));
      expect(w.winner, brain.id).not.toBeNull();
    }
  });

  it('forms a cycle of counters, so no brain is simply best', () => {
    const wins = (a: string, b: string): number => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const w = runToEnd(createWorld({ seed, blue: Array(3).fill(brainById(a)), red: Array(3).fill(brainById(b)) }));
        if (w.winner === 'blue') total++;
        else if (w.winner === 'red') total--;
      }
      return total;
    };
    expect(wins('rusher', 'raider')).toBeGreaterThan(0);
    expect(wins('raider', 'picket')).toBeGreaterThan(0);
    expect(wins('picket', 'rusher')).toBeGreaterThan(0);
  });
});
