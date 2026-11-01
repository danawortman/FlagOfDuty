import type { Brain, CompareOp, Condition, ConditionRow, StateDef, TransitionDef } from './types';

// The opponents. These helpers shorten the authoring; what they build is plain JSON.

const is = (sensor: string, op: CompareOp, value: number): ConditionRow => ({ sensor, op, value });
const all = (...rows: ConditionRow[]): Condition => ({ mode: 'all', rows });
const any = (...rows: ConditionRow[]): Condition => ({ mode: 'any', rows });
const state = (id: string, name: string, action: string): StateDef => ({ id, name, action });

function machine(
  initial: string,
  states: StateDef[],
  arrows: [string, string, Condition][],
): Pick<Brain, 'initial' | 'states' | 'transitions'> {
  const transitions: TransitionDef[] = arrows.map(([from, to, when], i) => ({ id: `t${i}`, from, to, when }));
  return { initial, states, transitions };
}

const carrying = is('iHaveFlag', '==', 1);
const notCarrying = is('iHaveFlag', '==', 0);
const flagHome = is('ourFlagHome', '==', 1);
const flagTaken = is('ourFlagTaken', '==', 1);
const flagDropped = is('ourFlagDropped', '==', 1);
const inEnemyHalf = is('inOwnHalf', '==', 0);
const inOwnHalf = is('inOwnHalf', '==', 1);
const seesEnemy = is('enemyVisible', '==', 1);
const seesNoEnemy = is('enemyVisible', '==', 0);
const enemyWithin = (tiles: number): ConditionRow => is('nearestEnemyDist', '<=', tiles);
const after = (ticks: number): ConditionRow => is('timeInState', '>=', ticks);

// Runs straight at the flag and straight back. Ignores everything else.
const rusher: Brain = {
  id: 'rusher',
  name: 'Rusher',
  ...machine(
    'charge',
    [state('charge', 'Charge', 'goEnemyFlag'), state('runHome', 'Run Home', 'goHome')],
    [
      ['charge', 'runHome', all(carrying)],
      ['runHome', 'charge', all(notCarrying)],
    ],
  ),
};

// Never attacks. Circles the base and runs down anyone who enters its half.
const sentry: Brain = {
  id: 'sentry',
  name: 'Sentry',
  ...machine(
    'patrol',
    [
      state('patrol', 'Patrol', 'patrolBase'),
      state('intercept', 'Intercept', 'chaseIntruder'),
      state('chaseCarrier', 'Chase Carrier', 'goOurFlag'),
      state('retrieve', 'Retrieve', 'goOurFlag'),
    ],
    [
      ['patrol', 'chaseCarrier', all(flagTaken)],
      ['patrol', 'retrieve', all(flagDropped)],
      ['patrol', 'intercept', all(is('nearestIntruderDist', '<=', 12))],
      ['intercept', 'chaseCarrier', all(flagTaken)],
      ['intercept', 'retrieve', all(flagDropped)],
      ['intercept', 'patrol', all(is('intruderCount', '==', 0))],
      ['chaseCarrier', 'retrieve', all(flagDropped)],
      ['chaseCarrier', 'patrol', all(flagHome)],
      ['retrieve', 'chaseCarrier', all(flagTaken)],
      ['retrieve', 'patrol', all(flagHome)],
    ],
  ),
};

// Holds the midfield, then sorties for the flag whenever things go quiet.
const picket: Brain = {
  id: 'picket',
  name: 'Picket',
  ...machine(
    'picket',
    [
      state('picket', 'Picket', 'patrolMidfield'),
      state('engage', 'Engage', 'chaseIntruder'),
      state('retrieve', 'Retrieve', 'goOurFlag'),
      state('sortie', 'Sortie', 'goEnemyFlag'),
      state('runHome', 'Run Home', 'goHome'),
    ],
    [
      ['picket', 'retrieve', any(flagDropped, flagTaken)],
      ['picket', 'engage', all(is('intruderCount', '>=', 1))],
      ['picket', 'sortie', all(after(60))],
      ['engage', 'retrieve', any(flagDropped, flagTaken)],
      ['engage', 'picket', all(is('intruderCount', '==', 0))],
      ['retrieve', 'picket', all(flagHome)],
      ['sortie', 'runHome', all(carrying)],
      ['sortie', 'picket', any(is('nearestIntruderDist', '<=', 6), flagTaken, flagDropped)],
      ['runHome', 'picket', all(notCarrying)],
    ],
  ),
};

// A careful thief. Dodges defenders, loops round the flank, jukes on the way home.
const raider: Brain = {
  id: 'raider',
  name: 'Raider',
  ...machine(
    'approach',
    [
      state('approach', 'Approach', 'goEnemyFlag'),
      state('dodge', 'Dodge', 'flee'),
      state('loop', 'Loop Round', 'goFlank'),
      state('runHome', 'Run Home', 'goHome'),
      state('juke', 'Juke', 'flee'),
    ],
    [
      ['approach', 'runHome', all(carrying)],
      ['approach', 'dodge', all(inEnemyHalf, seesEnemy, enemyWithin(4))],
      ['dodge', 'runHome', all(carrying)],
      ['dodge', 'loop', any(after(12), seesNoEnemy)],
      ['loop', 'runHome', all(carrying)],
      ['loop', 'approach', any(is('distFlank', '<=', 1), after(50))],
      ['runHome', 'approach', all(notCarrying)],
      ['runHome', 'juke', all(inEnemyHalf, seesEnemy, enemyWithin(3))],
      ['juke', 'approach', all(notCarrying)],
      ['juke', 'runHome', any(after(6), seesNoEnemy)],
    ],
  ),
};

// Stays on the flag and only leaves it to meet an enemy who gets close.
const goalkeeper: Brain = {
  id: 'goalkeeper',
  name: 'Goalkeeper',
  ...machine(
    'guard',
    [
      state('guard', 'Guard', 'goHome'),
      state('stand', 'Stand', 'hold'),
      state('block', 'Block', 'chaseIntruder'),
      state('recover', 'Recover', 'goOurFlag'),
    ],
    [
      ['guard', 'recover', any(flagTaken, flagDropped)],
      ['guard', 'block', all(is('nearestIntruderDist', '<=', 6))],
      ['guard', 'stand', all(after(30))],
      ['stand', 'recover', any(flagTaken, flagDropped)],
      ['stand', 'block', all(is('nearestIntruderDist', '<=', 6))],
      ['block', 'recover', any(flagTaken, flagDropped)],
      ['block', 'guard', all(is('nearestIntruderDist', '>', 9))],
      ['recover', 'guard', all(flagHome)],
    ],
  ),
};

// Lurks in the midfield and slips past while the enemy is busy attacking.
const shadow: Brain = {
  id: 'shadow',
  name: 'Shadow',
  ...machine(
    'lurk',
    [
      state('lurk', 'Lurk', 'patrolMidfield'),
      state('sneak', 'Sneak', 'goEnemyFlag'),
      state('dodge', 'Dodge', 'flee'),
      state('slip', 'Slip Home', 'goHome'),
      state('duck', 'Duck', 'flee'),
    ],
    [
      ['lurk', 'sneak', any(is('intruderCount', '>=', 1), after(90))],
      ['sneak', 'slip', all(carrying)],
      ['sneak', 'dodge', all(inEnemyHalf, seesEnemy, enemyWithin(3))],
      ['sneak', 'lurk', all(inOwnHalf, is('intruderCount', '==', 0), after(120))],
      ['dodge', 'slip', all(carrying)],
      ['dodge', 'sneak', any(after(8), seesNoEnemy)],
      ['slip', 'lurk', all(notCarrying)],
      ['slip', 'duck', all(inEnemyHalf, seesEnemy, enemyWithin(3))],
      ['duck', 'lurk', all(notCarrying)],
      ['duck', 'slip', any(after(6), seesNoEnemy)],
    ],
  ),
};

export const BRAINS: Brain[] = [rusher, sentry, picket, raider, goalkeeper, shadow];

export function brainById(id: string): Brain {
  const brain = BRAINS.find((b) => b.id === id);
  if (!brain) throw new Error(`Unknown brain: ${id}`);
  return brain;
}
