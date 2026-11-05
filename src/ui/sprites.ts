import type { Team } from '../sim/types';
import agentSvg from './sprites/agent.svg?raw';
import handSvg from './sprites/hand.svg?raw';
import shoeSvg from './sprites/shoe.svg?raw';

// The agent sprite is drawn in blue. Red gets the same art with its colours swapped.
const BLUE_SHIRT = '#4c9bff';
const BLUE_CAP = '#2f6fd0';
const TEAM_COLOURS: Record<Team, { shirt: string; cap: string }> = {
  blue: { shirt: BLUE_SHIRT, cap: BLUE_CAP },
  red: { shirt: '#ff6b5e', cap: '#d4483c' },
};

export interface Sprites {
  agent: Record<Team, HTMLImageElement>;
  hand: HTMLImageElement;
  shoe: HTMLImageElement;
}

function image(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A sprite failed to load.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function recolour(svg: string, team: Team): string {
  const { shirt, cap } = TEAM_COLOURS[team];
  return svg.split(BLUE_SHIRT).join(shirt).split(BLUE_CAP).join(cap);
}

export async function loadSprites(): Promise<Sprites> {
  const [blue, red, hand, shoe] = await Promise.all([
    image(recolour(agentSvg, 'blue')),
    image(recolour(agentSvg, 'red')),
    image(handSvg),
    image(shoeSvg),
  ]);
  return { agent: { blue, red }, hand, shoe };
}
