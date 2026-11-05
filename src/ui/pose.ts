import type { Agent, Team } from '../sim/types';

// How an agent is posed on screen, worked out from its current move alone, so
// drawing never feeds back into the simulation.

export type Facing = 'up' | 'right' | 'down' | 'left';

export const FACING_ANGLE: Record<Facing, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

// Standing agents face the enemy half until they first move.
export const STARTING_FACING: Record<Team, Facing> = { blue: 'right', red: 'left' };

export function moveFacing(agent: Agent): Facing | null {
  const dx = agent.pos.x - agent.prev.x;
  const dy = agent.pos.y - agent.prev.y;
  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  if (dy > 0) return 'down';
  if (dy < 0) return 'up';
  return null;
}

// How far through the current move the agent is drawn, from 0 to 1.
export function moveProgress(agent: Agent, alpha: number): number {
  const { moveCooldown, movePeriod } = agent;
  return Math.min(1, Math.max(0, (movePeriod - moveCooldown - 1 + alpha) / movePeriod));
}

// One step per tile: the leading foot alternates from tile to tile and swings
// out and back again as the move plays out. Returns the left foot's offset, in
// the sprite's units, ahead of the body; the right foot mirrors it.
export const STRIDE = 26;

export function leftFootOffset(agent: Agent, alpha: number): number {
  if (!moveFacing(agent)) return 0;
  const lead = (agent.pos.x + agent.pos.y) % 2 === 0 ? 1 : -1;
  return lead * STRIDE * Math.sin(Math.PI * moveProgress(agent, alpha));
}

// Arms swing against the legs, and not as far: the left hand comes forward as the
// left foot goes back. Returns the left hand's offset; the right hand mirrors it.
export const ARM_SWING = 0.6;

export function leftHandOffset(agent: Agent, alpha: number): number {
  return -ARM_SWING * leftFootOffset(agent, alpha);
}

// Remembers the last direction each agent moved, so it keeps facing that way
// after it stops.
export class FacingMemory {
  private last = new Map<number, Facing>();

  facing(agent: Agent): Facing {
    const now = moveFacing(agent);
    if (now) this.last.set(agent.id, now);
    return this.last.get(agent.id) ?? STARTING_FACING[agent.team];
  }

  clear(): void {
    this.last.clear();
  }
}
