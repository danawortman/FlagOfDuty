import type { Team } from '../sim/types';
import agentSvg from './sprites/agent.svg?raw';
import barrierSvg from './sprites/barrier.svg?raw';
import concreteSvg from './sprites/concrete.svg?raw';
import containerSvg from './sprites/container.svg?raw';
import crackSvg from './sprites/crack.svg?raw';
import crateSvg from './sprites/crate.svg?raw';
import handSvg from './sprites/hand.svg?raw';
import rippleSvg from './sprites/ripple.svg?raw';
import shoeSvg from './sprites/shoe.svg?raw';
import tyresSvg from './sprites/tyres.svg?raw';

// The agent sprite is drawn in blue. Red gets the same art with its colours swapped.
const BLUE_SHIRT = '#4c9bff';
const BLUE_CAP = '#2f6fd0';
const TEAM_COLOURS: Record<Team, { shirt: string; cap: string }> = {
  blue: { shirt: BLUE_SHIRT, cap: BLUE_CAP },
  red: { shirt: '#ff6b5e', cap: '#d4483c' },
};

// Shipping containers come in a few paint jobs; the art is drawn in the first.
const CONTAINER_PAINT = ['#3f7d6e', '#b5602c', '#3d5a80'];

export interface Sprites {
  agent: Record<Team, HTMLImageElement>;
  hand: HTMLImageElement;
  shoe: HTMLImageElement;
  containers: HTMLImageElement[];
  crate: HTMLImageElement;
  tyres: HTMLImageElement;
  barrier: HTMLImageElement;
  concrete: HTMLImageElement;
  ripple: HTMLImageElement;
  crack: HTMLImageElement;
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
  const [blue, red, hand, shoe, crate, tyres, barrier, concrete, ripple, crack, ...containers] = await Promise.all([
    image(recolour(agentSvg, 'blue')),
    image(recolour(agentSvg, 'red')),
    image(handSvg),
    image(shoeSvg),
    image(crateSvg),
    image(tyresSvg),
    image(barrierSvg),
    image(concreteSvg),
    image(rippleSvg),
    image(crackSvg),
    ...CONTAINER_PAINT.map((paint) => image(containerSvg.split(CONTAINER_PAINT[0]).join(paint))),
  ]);
  return { agent: { blue, red }, hand, shoe, containers, crate, tyres, barrier, concrete, ripple, crack };
}
