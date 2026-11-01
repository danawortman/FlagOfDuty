import { isAction } from './actions';
import { isSensor } from './sensors';
import type { Brain, BrainRuntime, CompareOp, Condition, ConditionRow, StateDef } from './types';

// Semantics, once per tick:
//  1. Try the active state's transitions in listed order. The first whose
//     condition holds fires, so at most one transition fires per tick.
//  2. The action of the state now active runs, so a transition never loses a tick.

export type SensorReader = (sensor: string, timeInState: number) => number;

export function compare(a: number, op: CompareOp, b: number): boolean {
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '==': return a === b;
    case '!=': return a !== b;
    case '>=': return a >= b;
    case '>': return a > b;
  }
}

export function evaluate(condition: Condition, read: (row: ConditionRow) => number): boolean {
  const test = (row: ConditionRow): boolean => compare(read(row), row.op, row.value);
  return condition.mode === 'all' ? condition.rows.every(test) : condition.rows.some(test) || condition.rows.length === 0;
}

export function activeState(brain: Brain, runtime: BrainRuntime): StateDef {
  const state = brain.states.find((s) => s.id === runtime.state);
  if (!state) throw new Error(`Unknown state: ${runtime.state}`);
  return state;
}

export function startBrain(brain: Brain, tick: number): BrainRuntime {
  return { state: brain.initial, enteredAt: tick };
}

// Returns the id of the action to run this tick.
export function stepBrain(brain: Brain, runtime: BrainRuntime, tick: number, sense: SensorReader): string {
  const timeInState = tick - runtime.enteredAt;
  const fired = brain.transitions.find(
    (t) => t.from === runtime.state && evaluate(t.when, (row) => sense(row.sensor, timeInState)),
  );
  if (fired) {
    runtime.state = fired.to;
    runtime.enteredAt = tick;
  }
  return activeState(brain, runtime).action;
}

// Checks that a brain's data is well formed. The test suite runs this over every brain.
export function validateBrain(brain: Brain): string[] {
  const errors: string[] = [];
  const ids = new Set(brain.states.map((s) => s.id));
  if (ids.size !== brain.states.length) errors.push(`${brain.id}: duplicate state id`);
  if (!ids.has(brain.initial)) errors.push(`${brain.id}: initial state "${brain.initial}" does not exist`);
  for (const state of brain.states) {
    if (!isAction(state.action)) errors.push(`${brain.id}/${state.id}: unknown action "${state.action}"`);
  }
  for (const t of brain.transitions) {
    if (!ids.has(t.from)) errors.push(`${brain.id}: transition ${t.id} from unknown state "${t.from}"`);
    if (!ids.has(t.to)) errors.push(`${brain.id}: transition ${t.id} to unknown state "${t.to}"`);
    for (const row of t.when.rows) {
      if (!isSensor(row.sensor)) errors.push(`${brain.id}: transition ${t.id} reads unknown sensor "${row.sensor}"`);
    }
  }
  return errors;
}
