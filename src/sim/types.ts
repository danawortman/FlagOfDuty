import type { GameMap } from './map';

export type Team = 'blue' | 'red';
export const TEAMS: Team[] = ['blue', 'red'];

export interface Tile {
  x: number;
  y: number;
}

// --- Brain data ---

export type CompareOp = '<' | '<=' | '==' | '!=' | '>=' | '>';

export interface ConditionRow {
  sensor: string;
  op: CompareOp;
  value: number;
}

export interface Condition {
  mode: 'all' | 'any';
  rows: ConditionRow[]; // no rows = always true
}

export interface TransitionDef {
  id: string;
  from: string;
  to: string;
  when: Condition;
}

export interface StateDef {
  id: string;
  name: string;
  action: string;
}

export interface Brain {
  id: string;
  name: string;
  initial: string;
  states: StateDef[];
  transitions: TransitionDef[]; // listed order is priority order
}

// --- Runtime state ---

export interface BrainRuntime {
  state: string;
  enteredAt: number; // tick the state was entered
}

export interface Agent {
  id: number;
  team: Team;
  slot: number;
  brain: Brain;
  runtime: BrainRuntime;
  pos: Tile;
  prev: Tile; // tile the agent is moving from, for render interpolation
  spawn: Tile;
  moveCooldown: number;
  movePeriod: number; // length of the current move, for render interpolation
  tagCooldown: number; // ticks until this agent can tag again
  respawn: number; // ticks left out of play; 0 = active
  patrolIndex: number;
}

export interface Flag {
  team: Team;
  pos: Tile;
  status: 'home' | 'carried' | 'dropped';
  carrier: number | null;
  returnTimer: number;
}

export interface World {
  map: GameMap;
  tick: number;
  rng: number;
  agents: Agent[];
  flags: Record<Team, Flag>;
  score: Record<Team, number>;
  winner: Team | 'draw' | null;
}
