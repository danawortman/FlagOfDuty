import { describe, expect, it } from 'vitest';
import { brainById } from '../../src/sim/brains';
import type { Agent } from '../../src/sim/types';
import { createWorld } from '../../src/sim/world';
import {
  ARM_SWING,
  FacingMemory,
  leftFootOffset,
  leftHandOffset,
  moveFacing,
  moveProgress,
  STARTING_FACING,
  STRIDE,
} from '../../src/ui/pose';
import { recolour } from '../../src/ui/sprites';

function agent(): Agent {
  const w = createWorld({ seed: 1, arena: 0, blue: Array(3).fill(brainById('rusher')), red: Array(3).fill(brainById('rusher')) });
  const a = w.agents[0];
  a.prev = { x: 5, y: 5 };
  a.pos = { x: 5, y: 5 };
  a.moveCooldown = 0;
  a.movePeriod = 3;
  return a;
}

describe('facing', () => {
  it.each([
    [{ x: 6, y: 5 }, 'right'],
    [{ x: 4, y: 5 }, 'left'],
    [{ x: 5, y: 6 }, 'down'],
    [{ x: 5, y: 4 }, 'up'],
  ] as const)('faces the way it moves to %o', (pos, expected) => {
    const a = agent();
    a.pos = { ...pos };
    expect(moveFacing(a)).toBe(expected);
  });

  it('keeps facing the last way it moved once it stops', () => {
    const a = agent();
    const memory = new FacingMemory();
    a.pos = { x: 5, y: 4 };
    expect(memory.facing(a)).toBe('up');
    a.prev = { ...a.pos };
    expect(memory.facing(a)).toBe('up');
  });

  it('faces the enemy half before its first move', () => {
    const a = agent();
    expect(new FacingMemory().facing(a)).toBe(STARTING_FACING[a.team]);
    expect(STARTING_FACING).toEqual({ blue: 'right', red: 'left' });
  });

  it('forgets on a new match', () => {
    const a = agent();
    const memory = new FacingMemory();
    a.pos = { x: 5, y: 4 };
    memory.facing(a);
    memory.clear();
    a.prev = { ...a.pos };
    expect(memory.facing(a)).toBe(STARTING_FACING[a.team]);
  });
});

describe('stepping', () => {
  it('keeps both feet tucked in when standing', () => {
    expect(leftFootOffset(agent(), 0.5)).toBe(0);
  });

  it('swings a foot out and back over one move', () => {
    const a = agent();
    a.pos = { x: 6, y: 5 };
    a.moveCooldown = 2; // just started
    expect(Math.abs(leftFootOffset(a, 0))).toBeCloseTo(0);
    a.moveCooldown = 1;
    expect(Math.abs(leftFootOffset(a, 0.5))).toBeCloseTo(STRIDE);
    a.moveCooldown = 0;
    expect(Math.abs(leftFootOffset(a, 1))).toBeCloseTo(0);
  });

  it('leads with the other foot on the next tile', () => {
    const a = agent();
    a.moveCooldown = 1;
    a.pos = { x: 6, y: 5 };
    const first = leftFootOffset(a, 0.5);
    a.prev = { x: 6, y: 5 };
    a.pos = { x: 7, y: 5 };
    expect(Math.sign(leftFootOffset(a, 0.5))).toBe(-Math.sign(first));
  });

  it('swings each hand against the foot on its side, and not as far', () => {
    const a = agent();
    a.pos = { x: 6, y: 5 };
    a.moveCooldown = 1;
    const foot = leftFootOffset(a, 0.5);
    const hand = leftHandOffset(a, 0.5);
    expect(Math.sign(hand)).toBe(-Math.sign(foot));
    expect(Math.abs(hand)).toBeCloseTo(ARM_SWING * STRIDE);
    expect(Math.abs(hand)).toBeLessThan(Math.abs(foot));
  });

  it('keeps the hands at the sides when standing', () => {
    expect(leftHandOffset(agent(), 0.5)).toBeCloseTo(0);
  });

  it('stays within a move whatever the frame timing', () => {
    const a = agent();
    a.pos = { x: 6, y: 5 };
    a.moveCooldown = 2;
    expect(moveProgress(a, -1)).toBe(0);
    a.moveCooldown = 0;
    expect(moveProgress(a, 5)).toBe(1);
  });
});

describe('sprite colours', () => {
  const svg = '<path fill="#4c9bff"/><path fill="#2f6fd0"/>';

  it('leaves blue art as drawn', () => {
    expect(recolour(svg, 'blue')).toBe(svg);
  });

  it('swaps every blue for red', () => {
    const red = recolour(svg, 'red');
    expect(red).not.toMatch(/#4c9bff|#2f6fd0/);
    expect(red).toContain('#ff6b5e');
    expect(red).toContain('#d4483c');
  });
});
