import { isWall } from '../sim/map';
import { TEAMS, type Agent, type Team, type Tile, type World } from '../sim/types';
import { FACING_ANGLE, leftFootOffset, leftHandOffset, moveProgress, type FacingMemory } from './pose';
import type { Sprites } from './sprites';

export const TILE = 48;
const SPRITE = TILE * 1.2; // drawn size of the 100-unit agent sprite; shoulders span about 0.9 tile
const UNIT = SPRITE / 100;
const FOOT_X = 20; // sprite units either side of centre
const FOOT_Y = 8; // tucked under the shoulders when standing
const HAND_X = 41; // at the ends of the shoulders
const HAND_Y = 8;

const COLORS = {
  floorBlue: '#1c2735',
  floorRed: '#2f2125',
  wall: '#3f4a5b',
  mud: '#5a4a32',
  blue: '#4c9bff',
  red: '#ff6b5e',
  outline: '#0d1117',
  number: '#f4f6fa',
};

export interface Art {
  sprites: Sprites;
  facing: FacingMemory;
}

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
  const { prev, pos } = agent;
  const t = moveProgress(agent, alpha);
  return { x: prev.x + (pos.x - prev.x) * t, y: prev.y + (pos.y - prev.y) * t };
}

// The number sits on the cap's crown, which is just behind the centre of the sprite.
function numberShift(art: Art, agent: Agent): { x: number; y: number } {
  const angle = FACING_ANGLE[art.facing.facing(agent)];
  const back = 1 * UNIT;
  return { x: -Math.sin(angle) * back, y: Math.cos(angle) * back + 1 };
}

function drawAgent(ctx: CanvasRenderingContext2D, world: World, agent: Agent, alpha: number, art: Art): void {
  if (agent.respawn > 0) return;
  const at = agentPosition(agent, alpha);
  const cx = (at.x + 0.5) * TILE;
  const cy = (at.y + 0.5) * TILE;
  const { hand, shoe } = art.sprites;
  const shoeW = shoe.width * UNIT;
  const shoeH = shoe.height * UNIT;
  const handSize = hand.width * UNIT;
  const step = leftFootOffset(agent, alpha);
  const swing = leftHandOffset(agent, alpha);

  // The sprite faces up, so rotate it to face the way the agent is going.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(FACING_ANGLE[art.facing.facing(agent)]);
  ctx.drawImage(shoe, -FOOT_X * UNIT - shoeW / 2, (FOOT_Y - step) * UNIT - shoeH / 2, shoeW, shoeH);
  ctx.drawImage(shoe, FOOT_X * UNIT - shoeW / 2, (FOOT_Y + step) * UNIT - shoeH / 2, shoeW, shoeH);
  ctx.drawImage(hand, -HAND_X * UNIT - handSize / 2, (HAND_Y - swing) * UNIT - handSize / 2, handSize, handSize);
  ctx.drawImage(hand, HAND_X * UNIT - handSize / 2, (HAND_Y + swing) * UNIT - handSize / 2, handSize, handSize);
  ctx.drawImage(art.sprites.agent[agent.team], -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
  ctx.restore();

  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.outline;
  ctx.strokeText(String(agent.slot + 1), cx + numberShift(art, agent).x, cy + numberShift(art, agent).y);
  ctx.fillStyle = COLORS.number;
  ctx.fillText(String(agent.slot + 1), cx + numberShift(art, agent).x, cy + numberShift(art, agent).y);

  const carried = TEAMS.find((t) => world.flags[t].carrier === agent.id);
  if (carried) drawFlagGlyph(ctx, carried, cx + SPRITE * 0.25, cy - SPRITE * 0.2, 24);
}

// Agents are drawn once their sprites have loaded.
export function renderWorld(ctx: CanvasRenderingContext2D, world: World, alpha: number, art: Art | null): void {
  drawArena(ctx, world);
  for (const team of TEAMS) {
    const flag = world.flags[team];
    if (flag.status !== 'carried') {
      drawFlagGlyph(ctx, team, (flag.pos.x + 0.42) * TILE, (flag.pos.y + 0.62) * TILE, 28);
    }
  }
  if (!art) return;
  for (const agent of world.agents) drawAgent(ctx, world, agent, alpha, art);
}
