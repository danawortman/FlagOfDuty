import { manhattan } from './map';
import { stepAway, stepToward } from './path';
import { nearestIntruder, nearestVisibleEnemy, otherTeam } from './sensors';
import type { Agent, Tile, World } from './types';

export interface ActionInfo {
  id: string;
  run: (world: World, agent: Agent) => Tile | null; // next tile, or null to stay
}

function follow(world: World, agent: Agent, route: Tile[]): Tile | null {
  if (agent.patrolIndex >= route.length) agent.patrolIndex = 0;
  if (manhattan(agent.pos, route[agent.patrolIndex]) === 0) {
    agent.patrolIndex = (agent.patrolIndex + 1) % route.length;
  }
  return stepToward(world.map, agent.pos, route[agent.patrolIndex], agent.team);
}

export const ACTIONS: ActionInfo[] = [
  { id: 'hold', run: () => null },
  {
    id: 'goEnemyFlag',
    run: (w, a) => stepToward(w.map, a.pos, w.flags[otherTeam(a.team)].pos, a.team),
  },
  {
    id: 'goOurFlag',
    run: (w, a) => stepToward(w.map, a.pos, w.flags[a.team].pos, a.team),
  },
  {
    id: 'goHome',
    run: (w, a) => stepToward(w.map, a.pos, w.map.flagHome[a.team], a.team),
  },
  {
    id: 'chaseIntruder',
    run: (w, a) => {
      const e = nearestIntruder(w, a);
      return e ? stepToward(w.map, a.pos, e.pos, a.team) : null;
    },
  },
  {
    id: 'flee',
    run: (w, a) => {
      const e = nearestVisibleEnemy(w, a);
      return e ? stepAway(w.map, a.pos, e.pos, w.map.flagHome[a.team], a.team) : null;
    },
  },
  {
    id: 'goFlank',
    run: (w, a) => stepToward(w.map, a.pos, w.map.flank[a.team], a.team),
  },
  {
    id: 'patrolBase',
    run: (w, a) => follow(w, a, w.map.basePatrol[a.team]),
  },
  {
    id: 'patrolMidfield',
    run: (w, a) => follow(w, a, w.map.midfieldPatrol[a.team]),
  },
];

const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));
export const isAction = (id: string): boolean => BY_ID.has(id);

export function runAction(world: World, agent: Agent, id: string): Tile | null {
  const action = BY_ID.get(id);
  if (!action) throw new Error(`Unknown action: ${id}`);
  return action.run(world, agent);
}
