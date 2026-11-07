import { isWall, type GameMap } from '../sim/map';
import { TEAMS, type Agent, type Team, type Tile, type World } from '../sim/types';
import { FACING_ANGLE, leftFootOffset, leftHandOffset, moveProgress, type FacingMemory } from './pose';
import { isEdge, mirroredHash, propsFor, type Prop } from './scenery';
import type { Sprites } from './sprites';

export const TILE = 48;
const SPRITE = TILE * 1.2; // drawn size of the 100-unit agent sprite; shoulders span about 0.9 tile
const UNIT = SPRITE / 100;
const FOOT_X = 20; // sprite units either side of centre
const FOOT_Y = 8; // tucked under the shoulders when standing
const HAND_X = 41; // at the ends of the shoulders
const HAND_Y = 8;

const COLORS = {
  verge: '#16191e',
  asphalt: '#2b2f35',
  asphaltLight: '#2e3238',
  tintBlue: 'rgb(76 155 255 / 0.07)',
  tintRed: 'rgb(255 107 94 / 0.07)',
  water: 'rgb(45 76 99 / 0.85)',
  waterEdge: '#5b88a6',
  paint: '#e8ecf2',
  fence: '#a7afb8',
  blue: '#4c9bff',
  red: '#ff6b5e',
  outline: '#0d1117',
  selected: '#ffd166',
  number: '#f4f6fa',
};

export interface Art {
  sprites: Sprites;
  facing: FacingMemory;
}

const teamColor = (team: Team): string => COLORS[team];

// Mud is rain water here: each puddle tile rounds the corners where it meets dry ground.
function drawPuddles(ctx: CanvasRenderingContext2D, map: GameMap, sprites: Sprites): void {
  const wet = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && map.mud[y * map.width + x];
  const r = TILE * 0.35;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!wet(x, y)) continue;
      const n = wet(x, y - 1), e = wet(x + 1, y), s = wet(x, y + 1), w = wet(x - 1, y);
      ctx.beginPath();
      ctx.roundRect(x * TILE, y * TILE, TILE, TILE, [!n && !w ? r : 0, !n && !e ? r : 0, !s && !e ? r : 0, !s && !w ? r : 0]);
      ctx.fillStyle = COLORS.water;
      ctx.fill();
    }
  }
  // A light rim along the shore: straight edges stop where a corner is rounded,
  // and the rounded corners get an arc, so the rim runs unbroken round each puddle.
  ctx.strokeStyle = COLORS.waterEdge;
  ctx.lineWidth = 2;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!wet(x, y)) continue;
      const px = x * TILE;
      const py = y * TILE;
      const n = !wet(x, y - 1), e = !wet(x + 1, y), s = !wet(x, y + 1), w = !wet(x - 1, y);
      const nw = n && w ? r : 0, ne = n && e ? r : 0, se = s && e ? r : 0, sw = s && w ? r : 0;
      ctx.beginPath();
      if (n) { ctx.moveTo(px + nw, py + 1); ctx.lineTo(px + TILE - ne, py + 1); }
      if (s) { ctx.moveTo(px + sw, py + TILE - 1); ctx.lineTo(px + TILE - se, py + TILE - 1); }
      if (w) { ctx.moveTo(px + 1, py + nw); ctx.lineTo(px + 1, py + TILE - sw); }
      if (e) { ctx.moveTo(px + TILE - 1, py + ne); ctx.lineTo(px + TILE - 1, py + TILE - se); }
      ctx.stroke();
      const arc = (cx: number, cy: number, from: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, from, from + Math.PI / 2);
        ctx.stroke();
      };
      if (nw) arc(px + r, py + r, Math.PI);
      if (ne) arc(px + TILE - r, py + r, -Math.PI / 2);
      if (se) arc(px + TILE - r, py + TILE - r, 0);
      if (sw) arc(px + r, py + TILE - r, Math.PI / 2);
      if (mirroredHash(map, x, y) % 4 === 0) ctx.drawImage(sprites.ripple, px, py, TILE, TILE);
    }
  }
}

function drawMarkings(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const midX = (map.width / 2) * TILE;
  const midY = (map.height / 2) * TILE;
  ctx.strokeStyle = COLORS.paint;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(midX, TILE);
  ctx.lineTo(midX, (map.height - 1) * TILE);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(midX, midY, TILE * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Each base is a painted square in its team's colour.
  for (const team of TEAMS) {
    const home = map.flagHome[team];
    const x = (home.x - 1) * TILE;
    const y = (home.y - 1) * TILE;
    ctx.fillStyle = teamColor(team);
    ctx.globalAlpha = 0.16;
    ctx.fillRect(x, y, TILE * 3, TILE * 3);
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    ctx.strokeStyle = teamColor(team);
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(x + 2, y + 2, TILE * 3 - 4, TILE * 3 - 4);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

function drawProp(ctx: CanvasRenderingContext2D, sprites: Sprites, prop: Prop): void {
  const x = prop.x * TILE;
  const y = prop.y * TILE;
  const w = prop.w * TILE;
  const h = prop.h * TILE;
  const turned = (img: HTMLImageElement) => {
    // Sprites are drawn running left to right; turn them for upright props.
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (prop.vertical) ctx.rotate(Math.PI / 2);
    const [len, wide] = prop.vertical ? [h, w] : [w, h];
    ctx.drawImage(img, -len / 2, -wide / 2, len, wide);
    ctx.restore();
  };
  switch (prop.kind) {
    case 'container':
      turned(sprites.containers[prop.variant % sprites.containers.length]);
      break;
    case 'barrier':
      turned(sprites.barrier);
      break;
    case 'concrete':
      ctx.drawImage(sprites.concrete, x, y, w, h);
      break;
    case 'crate':
      ctx.drawImage(sprites.crate, x, y, w, h);
      break;
    case 'tyres':
    case 'crates': {
      const img = prop.kind === 'tyres' ? sprites.tyres : sprites.crate;
      for (let ty = 0; ty < prop.h; ty++) {
        for (let tx = 0; tx < prop.w; tx++) ctx.drawImage(img, x + tx * TILE, y + ty * TILE, TILE, TILE);
      }
      break;
    }
  }
}

// A chain-link fence runs round the inside of the arena's outer edge.
function drawFence(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const x0 = TILE - 3;
  const y0 = TILE - 3;
  const x1 = (map.width - 1) * TILE + 3;
  const y1 = (map.height - 1) * TILE + 3;
  ctx.strokeStyle = 'rgb(0 0 0 / 0.45)';
  ctx.lineWidth = 7;
  ctx.strokeRect(x0 + 3, y0 + 3, x1 - x0, y1 - y0);
  ctx.strokeStyle = COLORS.fence;
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.fence;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 2;
  const post = (px: number, py: number) => {
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  for (let x = 1; x < map.width; x += 2) {
    post(x * TILE, y0);
    post(x * TILE, y1);
  }
  for (let y = 1; y < map.height; y += 2) {
    post(x0, y * TILE);
    post(x1, y * TILE);
  }
}

// Everything that never moves is drawn once per arena and reused every frame.
function drawBackground(ctx: CanvasRenderingContext2D, map: GameMap, sprites: Sprites): void {
  ctx.fillStyle = COLORS.verge;
  ctx.fillRect(0, 0, map.width * TILE, map.height * TILE);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (isEdge(map, x, y)) continue;
      const shade = mirroredHash(map, x, y);
      ctx.fillStyle = shade % 4 === 0 ? COLORS.asphaltLight : COLORS.asphalt;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.fillStyle = x < map.width / 2 ? COLORS.tintBlue : COLORS.tintRed;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (!isWall(map, x, y) && !map.mud[y * map.width + x] && shade % 13 === 0) {
        // Cracks are flipped on the red side and the bottom half, so they mirror too.
        ctx.save();
        ctx.translate((x + 0.5) * TILE, (y + 0.5) * TILE);
        ctx.scale(x < map.width / 2 ? 1 : -1, y <= map.height / 2 ? 1 : -1);
        ctx.drawImage(sprites.crack, -TILE / 2, -TILE / 2, TILE, TILE);
        ctx.restore();
      }
    }
  }
  drawPuddles(ctx, map, sprites);
  drawMarkings(ctx, map);
  for (const prop of propsFor(map)) drawProp(ctx, sprites, prop);
  drawFence(ctx, map);
}

const backgrounds = new WeakMap<GameMap, HTMLCanvasElement>();

function background(map: GameMap, sprites: Sprites): HTMLCanvasElement {
  let canvas = backgrounds.get(map);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = map.width * TILE;
    canvas.height = map.height * TILE;
    drawBackground(canvas.getContext('2d')!, map, sprites);
    backgrounds.set(map, canvas);
  }
  return canvas;
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

function drawRing(ctx: CanvasRenderingContext2D, agent: Agent, alpha: number): void {
  if (agent.respawn > 0) return;
  const at = agentPosition(agent, alpha);
  ctx.beginPath();
  ctx.arc((at.x + 0.5) * TILE, (at.y + 0.5) * TILE, TILE * 0.66, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.selected;
  ctx.stroke();
}

// The agent drawn nearest to a point, in tiles, if one is close enough to count as clicked.
export function agentAt(world: World, x: number, y: number, alpha: number): Agent | null {
  let best: Agent | null = null;
  let bestDistance = 0.6;
  for (const agent of world.agents) {
    if (agent.respawn > 0) continue;
    const at = agentPosition(agent, alpha);
    const distance = Math.hypot(at.x + 0.5 - x, at.y + 0.5 - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = agent;
    }
  }
  return best;
}

// Where an agent is drawn, as fractions of the arena's width and height.
export function agentOnCanvas(world: World, agent: Agent, alpha: number): { x: number; y: number } {
  const at = agentPosition(agent, alpha);
  return { x: (at.x + 0.5) / world.map.width, y: (at.y + 0.5) / world.map.height };
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

// The arena is drawn once the sprites have loaded.
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  alpha: number,
  art: Art | null,
  selected: number[] = [],
): void {
  if (!art) {
    ctx.fillStyle = COLORS.verge;
    ctx.fillRect(0, 0, world.map.width * TILE, world.map.height * TILE);
    return;
  }
  ctx.drawImage(background(world.map, art.sprites), 0, 0);
  for (const team of TEAMS) {
    const flag = world.flags[team];
    if (flag.status !== 'carried') {
      drawFlagGlyph(ctx, team, (flag.pos.x + 0.42) * TILE, (flag.pos.y + 0.62) * TILE, 28);
    }
  }
  for (const id of selected) drawRing(ctx, world.agents[id], alpha);
  for (const agent of world.agents) drawAgent(ctx, world, agent, alpha, art);
}
