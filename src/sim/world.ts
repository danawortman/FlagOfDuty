import { runAction } from './actions';
import { startBrain, stepBrain } from './fsm';
import { arenaForSeed, createArena, inHalf, manhattan, tileCost, type GameMap } from './map';
import {
  CAPTURES_TO_WIN,
  FLAG_RETURN_TICKS,
  MATCH_TICKS,
  MOVE_PERIOD,
  REACTION_JITTER_TICKS,
  RESPAWN_TICKS,
  TAG_RECHARGE_TICKS,
} from './rules';
import { nextRandom } from './rng';
import { otherTeam, readSensor } from './sensors';
import { TEAMS, type Agent, type Brain, type Flag, type Team, type Tile, type World } from './types';

export interface MatchSetup {
  seed: number;
  blue: Brain[];
  red: Brain[];
  arena?: number; // chosen from the seed unless given
}

// Each spawn starts with a small seeded delay, so that otherwise identical agents
// fall out of step and different seeds give different matches.
function reactionDelay(world: World): number {
  const r = nextRandom(world.rng);
  world.rng = r.state;
  return r.value % (REACTION_JITTER_TICKS + 1);
}

function createFlag(map: GameMap, team: Team): Flag {
  return { team, pos: { ...map.flagHome[team] }, status: 'home', carrier: null, returnTimer: 0 };
}

export function createWorld(setup: MatchSetup): World {
  const map = createArena(setup.arena ?? arenaForSeed(setup.seed));
  const agents: Agent[] = [];
  for (const team of TEAMS) {
    setup[team].forEach((brain, slot) => {
      const spawn = map.spawns[team][slot % map.spawns[team].length];
      agents.push({
        id: agents.length,
        team,
        slot,
        brain,
        runtime: startBrain(brain, 0),
        pos: { ...spawn },
        prev: { ...spawn },
        spawn,
        moveCooldown: 0,
        movePeriod: MOVE_PERIOD,
        tagCooldown: 0,
        respawn: 0,
        patrolIndex: 0,
      });
    });
  }
  const world: World = {
    map,
    tick: 0,
    rng: setup.seed | 0,
    agents,
    flags: { blue: createFlag(map, 'blue'), red: createFlag(map, 'red') },
    score: { blue: 0, red: 0 },
    winner: null,
  };
  for (const agent of agents) agent.moveCooldown = reactionDelay(world);
  return world;
}

function sendFlagHome(world: World, flag: Flag): void {
  flag.pos = { ...world.map.flagHome[flag.team] };
  flag.status = 'home';
  flag.carrier = null;
  flag.returnTimer = 0;
}

function decide(world: World, agent: Agent): Tile | null {
  const action = stepBrain(agent.brain, agent.runtime, world.tick, (sensor, timeInState) =>
    readSensor(world, agent, sensor, timeInState),
  );
  const next = runAction(world, agent, action);
  return agent.moveCooldown > 0 ? null : next;
}

function resolveTags(world: World): void {
  // A tag lands on an enemy in the tagger's half, and only a tagger standing in
  // its own half can make it, so defenders are safe and raiders are at risk.
  // Each tag costs the tagger a recharge, so a coordinated raid can beat a defence.
  const tagged = new Set<Agent>();
  for (const tagger of world.agents) {
    if (tagger.respawn > 0 || tagger.tagCooldown > 0 || !inHalf(world.map, tagger.team, tagger.pos)) continue;
    const target = world.agents.find(
      (t) =>
        t.team !== tagger.team &&
        t.respawn === 0 &&
        !tagged.has(t) &&
        inHalf(world.map, tagger.team, t.pos) &&
        manhattan(tagger.pos, t.pos) <= 1,
    );
    if (target) {
      tagged.add(target);
      tagger.tagCooldown = TAG_RECHARGE_TICKS;
    }
  }
  for (const agent of tagged) {
    const flag = world.flags[otherTeam(agent.team)];
    if (flag.carrier === agent.id) {
      flag.carrier = null;
      flag.status = 'dropped';
      flag.returnTimer = FLAG_RETURN_TICKS;
      flag.pos = { ...agent.pos };
    }
    agent.respawn = RESPAWN_TICKS;
    agent.pos = { ...agent.spawn };
    agent.prev = { ...agent.spawn };
    agent.moveCooldown = 0;
    agent.movePeriod = MOVE_PERIOD;
  }
}

function resolveFlags(world: World): void {
  for (const team of TEAMS) {
    const flag = world.flags[team];
    if (flag.status === 'carried') continue;
    const here = world.agents.filter(
      (a) => a.respawn === 0 && a.pos.x === flag.pos.x && a.pos.y === flag.pos.y,
    );
    const owner = here.find((a) => a.team === team);
    const thief = here.find((a) => a.team !== team);
    if (flag.status === 'dropped' && owner) {
      sendFlagHome(world, flag); // returning beats a simultaneous pickup, for both teams
    } else if (thief) {
      flag.status = 'carried';
      flag.carrier = thief.id;
      flag.returnTimer = 0;
    } else if (flag.status === 'dropped' && --flag.returnTimer <= 0) {
      sendFlagHome(world, flag);
    }
  }
  for (const team of TEAMS) {
    const flag = world.flags[team];
    if (flag.carrier !== null) flag.pos = { ...world.agents[flag.carrier].pos };
  }
}

function resolveCaptures(world: World): void {
  for (const team of TEAMS) {
    const theirs = world.flags[otherTeam(team)];
    // Our own flag need not be home, so matches cannot deadlock with both flags held.
    if (theirs.carrier === null) continue;
    const carrier = world.agents[theirs.carrier];
    if (manhattan(carrier.pos, world.map.flagHome[team]) === 0) {
      world.score[team]++;
      sendFlagHome(world, theirs);
    }
  }
}

function checkFinished(world: World): void {
  const { blue, red } = world.score;
  if (blue < CAPTURES_TO_WIN && red < CAPTURES_TO_WIN && world.tick < MATCH_TICKS) return;
  world.winner = blue > red ? 'blue' : red > blue ? 'red' : 'draw';
}

export function stepWorld(world: World): void {
  if (world.winner) return;
  world.tick++;

  // Decide from one shared snapshot, then move everyone at once, so neither team
  // gains from being processed first.
  const moves: (Tile | null)[] = world.agents.map((agent) => {
    if (agent.respawn > 0) return null;
    return decide(world, agent);
  });

  world.agents.forEach((agent, i) => {
    if (agent.respawn > 0) {
      if (--agent.respawn === 0) {
        agent.runtime = startBrain(agent.brain, world.tick);
        agent.moveCooldown = reactionDelay(world);
      }
      return;
    }
    const idle = agent.moveCooldown === 0;
    if (agent.moveCooldown > 0) agent.moveCooldown--;
    if (agent.tagCooldown > 0) agent.tagCooldown--;
    const next = moves[i];
    if (!next && idle) agent.prev = { ...agent.pos };
    if (next) {
      agent.prev = { ...agent.pos };
      agent.pos = next;
      agent.movePeriod = MOVE_PERIOD * tileCost(world.map, next);
      agent.moveCooldown = agent.movePeriod - 1;
    }
  });

  resolveTags(world);
  resolveFlags(world);
  resolveCaptures(world);
  checkFinished(world);
}

export function stateHash(world: World): number {
  const parts: (number | string)[] = [world.tick, world.rng, world.score.blue, world.score.red];
  for (const a of world.agents) {
    parts.push(a.pos.x, a.pos.y, a.moveCooldown, a.tagCooldown, a.respawn, a.patrolIndex, a.runtime.state);
  }
  for (const team of TEAMS) {
    const f = world.flags[team];
    parts.push(f.pos.x, f.pos.y, f.status, f.carrier ?? -1, f.returnTimer);
  }
  let hash = 0x811c9dc5;
  for (const ch of parts.join(',')) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193);
  return hash >>> 0;
}

export function runToEnd(world: World): World {
  while (!world.winner) stepWorld(world);
  return world;
}
