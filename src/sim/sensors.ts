import { hasLineOfSight, inHalf, manhattan } from './map';
import { pathDistance } from './path';
import { NOT_SEEN, VISION_RANGE } from './rules';
import type { Agent, Team, World } from './types';

const SENSORS = new Set([
  'iHaveFlag',
  'ourFlagHome',
  'ourFlagTaken',
  'ourFlagDropped',
  'inOwnHalf',
  'enemyVisible',
  'nearestEnemyDist',
  'intruderCount',
  'nearestIntruderDist',
  'distFlank',
  'timeInState',
]);

export const isSensor = (id: string): boolean => SENSORS.has(id);

export function otherTeam(team: Team): Team {
  return team === 'blue' ? 'red' : 'blue';
}

export function livingEnemies(world: World, agent: Agent): Agent[] {
  return world.agents.filter((a) => a.team !== agent.team && a.respawn === 0);
}

export function canSee(world: World, a: Agent, b: Agent): boolean {
  return manhattan(a.pos, b.pos) <= VISION_RANGE && hasLineOfSight(world.map, a.pos, b.pos);
}

export function nearestVisibleEnemy(world: World, agent: Agent): Agent | null {
  let best: Agent | null = null;
  let bestDist = Infinity;
  for (const e of livingEnemies(world, agent)) {
    if (!canSee(world, agent, e)) continue;
    const d = pathDistance(world.map, agent.pos, e.pos);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export function nearestIntruder(world: World, agent: Agent): Agent | null {
  let best: Agent | null = null;
  let bestDist = Infinity;
  for (const e of livingEnemies(world, agent)) {
    if (!inHalf(world.map, agent.team, e.pos)) continue;
    const d = pathDistance(world.map, agent.pos, e.pos);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

const bool = (b: boolean): number => (b ? 1 : 0);

export function readSensor(world: World, agent: Agent, id: string, timeInState: number): number {
  const { map } = world;
  const team = agent.team;
  const enemy = otherTeam(team);
  const ourFlag = world.flags[team];
  const theirFlag = world.flags[enemy];
  switch (id) {
    case 'iHaveFlag':
      return bool(theirFlag.carrier === agent.id);
    case 'ourFlagHome':
      return bool(ourFlag.status === 'home');
    case 'ourFlagTaken':
      return bool(ourFlag.status === 'carried');
    case 'ourFlagDropped':
      return bool(ourFlag.status === 'dropped');
    case 'inOwnHalf':
      return bool(inHalf(map, team, agent.pos));
    case 'enemyVisible':
      return bool(nearestVisibleEnemy(world, agent) !== null);
    case 'nearestEnemyDist': {
      const e = nearestVisibleEnemy(world, agent);
      return e ? pathDistance(map, agent.pos, e.pos) : NOT_SEEN;
    }
    case 'intruderCount':
      return livingEnemies(world, agent).filter((e) => inHalf(map, team, e.pos)).length;
    case 'nearestIntruderDist': {
      const e = nearestIntruder(world, agent);
      return e ? pathDistance(map, agent.pos, e.pos) : NOT_SEEN;
    }
    case 'distFlank':
      return pathDistance(map, agent.pos, map.flank[team]);
    case 'timeInState':
      return timeInState;
    default:
      throw new Error(`Unknown sensor: ${id}`);
  }
}
