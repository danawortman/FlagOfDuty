import { describe, expect, it } from 'vitest';
import { brainById } from '../../src/sim/brains';
import { SQUAD_SIZE } from '../../src/sim/rules';
import { createWorld } from '../../src/sim/world';
import { agentAt, agentOnCanvas } from '../../src/ui/render';

function world() {
  const squad = Array(SQUAD_SIZE).fill(brainById('rusher'));
  return createWorld({ seed: 1, arena: 0, blue: squad, red: squad });
}

describe('picking an agent', () => {
  it('finds the agent drawn under a point', () => {
    const w = world();
    const a = w.agents[2];
    expect(agentAt(w, a.pos.x + 0.5, a.pos.y + 0.5, 0)).toBe(a);
    expect(agentAt(w, a.pos.x + 0.8, a.pos.y + 0.3, 0)).toBe(a);
  });

  it('finds nothing on empty ground', () => {
    const w = world();
    expect(agentAt(w, 16, 1.5, 0)).toBeNull();
  });

  it('follows the agent part way through a move', () => {
    const w = world();
    const a = w.agents[0];
    a.prev = { x: 5, y: 1 };
    a.pos = { x: 6, y: 1 };
    a.movePeriod = 3;
    a.moveCooldown = 2; // just set off, so still drawn on its old tile
    expect(agentAt(w, 5.5, 1.5, 0)).toBe(a);
    expect(agentAt(w, 6.5, 1.5, 0)).toBeNull();
  });

  it('ignores agents out of play', () => {
    const w = world();
    const a = w.agents[1];
    a.respawn = 10;
    expect(agentAt(w, a.pos.x + 0.5, a.pos.y + 0.5, 0)).toBeNull();
  });

  it('places an agent on the canvas as fractions of the arena', () => {
    const w = world();
    const a = w.agents[SQUAD_SIZE];
    const at = agentOnCanvas(w, a, 0);
    expect(at.x).toBeCloseTo((a.pos.x + 0.5) / w.map.width);
    expect(at.y).toBeCloseTo((a.pos.y + 0.5) / w.map.height);
  });
});
