import { isWall } from '../sim/map';
import { TEAMS, type Agent, type Team, type Tile, type World } from '../sim/types';

export const TILE = 48;

const COLORS = {
  floorBlue: '#1c2735',
  floorRed: '#2f2125',
  wall: '#3f4a5b',
  mud: '#5a4a32',
  blue: '#4c9bff',
  red: '#ff6b5e',
  outline: '#0d1117',
};

const teamColor = (team: Team): string => COLORS[team];

function drawArena(ctx: CanvasRenderingContext2D, world: World): void {
  const { map } = world;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (isWall(map, x, y)) ctx.fillStyle = COLORS.wall;
      else if (map.mud[y * map.width + x]) ctx.fillStyle = COLORS.mud;
      else ctx.fillStyle = x < map.width / 2 ? COLORS.floorBlue : COLORS.floorRed;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  for (const team of TEAMS) {
    const home = map.flagHome[team];
    ctx.beginPath();
    ctx.arc((home.x + 0.5) * TILE, (home.y + 0.5) * TILE, TILE * 0.62, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = teamColor(team);
    ctx.stroke();
  }
}

function drawFlagGlyph(ctx: CanvasRenderingContext2D, team: Team, x: number, y: number, size: number): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 3;
  ctx.fillStyle = teamColor(team);
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 1.1, y - size * 0.62);
  ctx.lineTo(x, y - size * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#e8ecf2';
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size * 0.5);
  ctx.stroke();
}

function agentPosition(agent: Agent, alpha: number): Tile {
  const { prev, pos, moveCooldown, movePeriod } = agent;
  const t = Math.min(1, (movePeriod - moveCooldown - 1 + alpha) / movePeriod);
  return { x: prev.x + (pos.x - prev.x) * t, y: prev.y + (pos.y - prev.y) * t };
}

function drawAgent(ctx: CanvasRenderingContext2D, world: World, agent: Agent, alpha: number): void {
  if (agent.respawn > 0) return;
  const at = agentPosition(agent, alpha);
  const cx = (at.x + 0.5) * TILE;
  const cy = (at.y + 0.5) * TILE;
  const radius = TILE * 0.38;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = teamColor(agent.team);
  ctx.fill();

  ctx.fillStyle = COLORS.outline;
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(agent.slot + 1), cx, cy + 1);

  const carried = TEAMS.find((t) => world.flags[t].carrier === agent.id);
  if (carried) drawFlagGlyph(ctx, carried, cx + radius * 0.5, cy - radius * 0.5, 24);
}

export function renderWorld(ctx: CanvasRenderingContext2D, world: World, alpha: number): void {
  drawArena(ctx, world);
  for (const team of TEAMS) {
    const flag = world.flags[team];
    if (flag.status !== 'carried') {
      drawFlagGlyph(ctx, team, (flag.pos.x + 0.42) * TILE, (flag.pos.y + 0.62) * TILE, 28);
    }
  }
  for (const agent of world.agents) drawAgent(ctx, world, agent, alpha);
}
