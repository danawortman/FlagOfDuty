import { describe, expect, it } from 'vitest';
import { activeState, compare, evaluate, startBrain, stepBrain, validateBrain } from '../../src/sim/fsm';
import type { Brain, CompareOp } from '../../src/sim/types';

const row = (sensor: string, op: CompareOp, value: number) => ({ sensor, op, value });
const when = (...rows: ReturnType<typeof row>[]) => ({ mode: 'all' as const, rows });

const brain: Brain = {
  id: 'sample',
  name: 'Sample',
  initial: 'one',
  states: [
    { id: 'one', name: 'One', action: 'hold' },
    { id: 'two', name: 'Two', action: 'goEnemyFlag' },
    { id: 'three', name: 'Three', action: 'goHome' },
  ],
  transitions: [
    { id: 'a', from: 'one', to: 'two', when: when(row('iHaveFlag', '==', 1)) },
    { id: 'b', from: 'one', to: 'three', when: when(row('ourFlagTaken', '==', 1)) },
    { id: 'c', from: 'two', to: 'three', when: when(row('ourFlagDropped', '==', 1)) },
    { id: 'd', from: 'three', to: 'one', when: when(row('ourFlagHome', '==', 1)) },
  ],
};

const sensors = (values: Record<string, number>) => (id: string) => values[id] ?? 0;

describe('conditions', () => {
  it.each<[number, CompareOp, number, boolean]>([
    [1, '<', 2, true],
    [2, '<=', 2, true],
    [2, '==', 2, true],
    [2, '!=', 2, false],
    [2, '>=', 3, false],
    [3, '>', 2, true],
  ])('%d %s %d is %s', (a, op, b, expected) => {
    expect(compare(a, op, b)).toBe(expected);
  });

  it('ALL needs every row, ANY needs one, and an empty condition always holds', () => {
    const read = (r: { sensor: string }) => (r.sensor === 'yes' ? 1 : 0);
    const rows = [row('yes', '==', 1), row('no', '==', 1)];
    expect(evaluate({ mode: 'all', rows }, read)).toBe(false);
    expect(evaluate({ mode: 'any', rows }, read)).toBe(true);
    expect(evaluate({ mode: 'all', rows: [] }, read)).toBe(true);
    expect(evaluate({ mode: 'any', rows: [] }, read)).toBe(true);
  });
});

describe('stepping', () => {
  it('begins in the initial state', () => {
    expect(activeState(brain, startBrain(brain, 0)).id).toBe('one');
  });

  it('stays put when no condition holds', () => {
    const rt = startBrain(brain, 0);
    expect(stepBrain(brain, rt, 1, sensors({}))).toBe('hold');
    expect(rt.state).toBe('one');
  });

  it('runs the action of the state it just entered, so no tick is lost', () => {
    const rt = startBrain(brain, 0);
    expect(stepBrain(brain, rt, 1, sensors({ iHaveFlag: 1 }))).toBe('goEnemyFlag');
    expect(rt.state).toBe('two');
  });

  it('takes the first listed transition when several hold', () => {
    const rt = startBrain(brain, 0);
    stepBrain(brain, rt, 1, sensors({ iHaveFlag: 1, ourFlagTaken: 1 }));
    expect(rt.state).toBe('two');
  });

  it('fires at most one transition per tick', () => {
    const rt = startBrain(brain, 0);
    stepBrain(brain, rt, 1, sensors({ iHaveFlag: 1, ourFlagDropped: 1 }));
    expect(rt.state).toBe('two');
  });

  it('counts time in state from the moment of entry', () => {
    const rt = startBrain(brain, 0);
    stepBrain(brain, rt, 5, sensors({ iHaveFlag: 1 }));
    expect(rt.enteredAt).toBe(5);

    const seen: number[] = [];
    stepBrain(brain, rt, 7, (_id, timeInState) => {
      seen.push(timeInState);
      return 0;
    });
    expect(seen).toEqual([2]);
  });
});

describe('validation', () => {
  it('accepts a well-formed brain', () => {
    expect(validateBrain(brain)).toEqual([]);
  });

  it('catches each kind of data mistake', () => {
    const errors = validateBrain({
      id: 'broken',
      name: 'Broken',
      initial: 'missing',
      states: [
        { id: 'a', name: 'A', action: 'hold' },
        { id: 'a', name: 'A again', action: 'nonsense' },
      ],
      transitions: [{ id: 't', from: 'a', to: 'ghost', when: when(row('nope', '==', 1)) }],
    }).join('\n');
    expect(errors).toMatch(/duplicate state id/);
    expect(errors).toMatch(/initial state "missing"/);
    expect(errors).toMatch(/unknown action "nonsense"/);
    expect(errors).toMatch(/to unknown state "ghost"/);
    expect(errors).toMatch(/unknown sensor "nope"/);
  });
});
