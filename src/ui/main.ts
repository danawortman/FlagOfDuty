import { BRAINS, brainById } from '../sim/brains';
import { activeState } from '../sim/fsm';
import { nextSeed } from '../sim/rng';
import { MATCH_TICKS, SQUAD_SIZE, TICKS_PER_SECOND } from '../sim/rules';
import { TEAMS, type Team, type World } from '../sim/types';
import { createWorld, stateHash, stepWorld } from '../sim/world';
import { FacingMemory } from './pose';
import { renderWorld, type Art } from './render';
import { loadSprites } from './sprites';

// URL parameters make any moment reproducible, which is what the screenshot tests
// rely on: ?seed=7&blue=rusher,sentry,raider&red=picket,picket,picket&tick=240&arena=1
const params = new URLSearchParams(location.search);
const COUNTDOWN_SECONDS = 3;
const DEFAULTS: Record<Team, string[]> = {
  blue: ['raider', 'rusher', 'sentry'],
  red: ['picket', 'shadow', 'goalkeeper'],
};

function squadFromUrl(team: Team): string[] {
  const ids = (params.get(team) ?? '').split(',').filter((id) => BRAINS.some((b) => b.id === id));
  return ids.length === SQUAD_SIZE ? ids : DEFAULTS[team];
}

const byTestId = <T extends HTMLElement>(id: string): T => document.querySelector<T>(`[data-testid="${id}"]`)!;

const canvas = byTestId<HTMLCanvasElement>('arena');
const ctx = canvas.getContext('2d')!;
const playButton = byTestId<HTMLButtonElement>('play');
const seedInput = byTestId<HTMLInputElement>('seed');
const countdownEl = byTestId('countdown');

const squads: Record<Team, string[]> = { blue: squadFromUrl('blue'), red: squadFromUrl('red') };
let seed = Number(params.get('seed') ?? 1) | 0;
let world!: World;
let running = false;
let art: Art | null = null;
const facing = new FacingMemory();
let countdown = 0; // seconds left before kick-off; 0 when not counting
let carry = 0; // fraction of a tick accumulated between frames
let lastFrame = 0;
const slotStates = new Map<number, HTMLElement>();

function newMatch(): void {
  facing.clear();
  world = createWorld({
    seed,
    blue: squads.blue.map(brainById),
    red: squads.red.map(brainById),
    arena: params.has('arena') ? Number(params.get('arena')) : undefined,
  });
  carry = 0;
  setRunning(false);
  seedInput.value = String(seed);
  refresh();
}

function setRunning(on: boolean): void {
  running = on && !world.winner;
  countdown = 0;
  playButton.textContent = running ? 'Pause' : 'Play';
  lastFrame = performance.now();
}

function startCountdown(): void {
  running = false;
  countdown = COUNTDOWN_SECONDS;
  playButton.textContent = 'Pause';
}

// A finished match rolls straight into the next one, until the player stops it.
function kickOff(): void {
  if (world.winner) {
    seed = nextSeed(seed);
    newMatch();
  }
  setRunning(true);
}

function showCountdown(): void {
  countdownEl.hidden = countdown === 0;
  if (countdown > 0) {
    countdownEl.textContent = `${world.winner ? 'Next match' : 'Kick-off'} in ${Math.ceil(countdown)}`;
  }
}

function advance(ticks: number): void {
  for (let i = 0; i < ticks && !world.winner; i++) stepWorld(world);
}

function clockText(tick: number): string {
  const left = Math.ceil((MATCH_TICKS - tick) / TICKS_PER_SECOND);
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function resultText(): string {
  if (world.winner === 'draw') return 'Draw';
  return `${world.winner === 'blue' ? 'Blue' : 'Red'} wins ${world.score.blue} : ${world.score.red}`;
}

function refresh(): void {
  byTestId('score-blue').textContent = String(world.score.blue);
  byTestId('score-red').textContent = String(world.score.red);
  byTestId('clock').textContent = clockText(world.tick);
  byTestId('tick').textContent = world.winner ? resultText() : `tick ${world.tick}`;
  byTestId('arena-name').textContent = world.map.name;

  for (const agent of world.agents) {
    const el = slotStates.get(agent.id)!;
    el.textContent = agent.respawn > 0 ? 'Respawning…' : activeState(agent.brain, agent.runtime).name;
  }
}

function buildSquadPanels(): void {
  for (const team of TEAMS) {
    const panel = byTestId(`squad-${team}`);
    squads[team].forEach((brainId, slot) => {
      const agentId = (team === 'blue' ? 0 : SQUAD_SIZE) + slot;
      const row = document.createElement('div');
      row.className = 'slot';

      const badge = document.createElement('span');
      badge.className = 'slot-id';
      badge.textContent = String(slot + 1);

      const select = document.createElement('select');
      select.dataset.testid = `brain-${team}-${slot}`;
      select.setAttribute('aria-label', `${team} agent ${slot + 1} brain`);
      for (const brain of BRAINS) select.add(new Option(brain.name, brain.id));
      select.value = brainId;
      select.addEventListener('change', () => {
        squads[team][slot] = select.value;
        newMatch();
      });

      const state = document.createElement('span');
      state.className = 'slot-state';
      state.dataset.testid = `state-${team}-${slot}`;
      slotStates.set(agentId, state);

      row.append(badge, select, state);
      panel.append(row);
    });
  }
}

function frame(now: number): void {
  const dt = Math.min(now - lastFrame, 250);
  lastFrame = now;
  if (countdown > 0) {
    countdown = Math.max(0, countdown - dt / 1000);
    if (countdown === 0) kickOff();
  }
  if (running) {
    carry += (dt / 1000) * TICKS_PER_SECOND;
    const whole = Math.floor(carry);
    if (whole > 0) {
      carry -= whole;
      advance(whole);
      refresh();
      if (world.winner) startCountdown();
    }
  }
  renderWorld(ctx, world, running ? carry : 0, art);
  showCountdown();
  requestAnimationFrame(frame);
}

playButton.addEventListener('click', () => {
  if (running || countdown > 0) setRunning(false);
  else if (world.tick === 0 || world.winner) startCountdown();
  else setRunning(true);
});
byTestId('step').addEventListener('click', () => {
  setRunning(false);
  advance(1);
  refresh();
});
byTestId('restart').addEventListener('click', newMatch);
seedInput.addEventListener('change', () => {
  seed = Number(seedInput.value) | 0;
  newMatch();
});

buildSquadPanels();
newMatch();
const startTick = Number(params.get('tick') ?? 0);
if (startTick > 0) {
  advance(startTick);
  refresh();
}
requestAnimationFrame(frame);

// Automation hook for Playwright. The canvas has no DOM to query, so tests read
// the true simulation state here rather than inferring it from pixels.
const hook = {
  tick: () => world.tick,
  hash: () => stateHash(world),
  advance: (ticks: number) => {
    setRunning(false);
    advance(ticks);
    refresh();
  },
};
declare global {
  interface Window {
    flagOfDuty: typeof hook;
  }
}
// Tests start once the sprites are in, so every screenshot shows finished art.
void loadSprites().then((sprites) => {
  art = { sprites, facing };
  window.flagOfDuty = hook;
});
