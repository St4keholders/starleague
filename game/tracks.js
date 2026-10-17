// Definición de las 5 pistas y la arena de batalla (datos puros)
import { buildCenterline } from './geometry.js';

export const TRACK_DEFS = [
  {
    id: 'pradera', name: 'Pradera Molinos', theme: 'pradera', seed: 11,
    pts: [[300, 1700], [300, 900], [380, 450], [650, 300], [1000, 320], [1150, 520], [1050, 780], [1080, 980], [1350, 1000], [1650, 850], [1780, 1050], [1760, 1500], [1600, 1720], [1200, 1760], [900, 1650], [600, 1760]],
    startAt: [300, 1350],
    w: 64, ow: 46, outside: 'wall',
    zones: [
      { type: 'boost', f: 0.22, l: 32, c: -0.35, hw: 0.35 },
      { type: 'boost', f: 0.60, l: 32, c: 0.0, hw: 0.4 },
      { type: 'boost', f: 0.83, l: 32, c: 0.35, hw: 0.35 },
    ],
    boxes: [0.12, 0.35, 0.58, 0.80],
    obstacles: [],
    hazards: [],
    decor: { tree: 5, bush: 3, windmill: 1, flower: 3 },
  },
  {
    id: 'playa', name: 'Playa Coral', theme: 'playa', seed: 22,
    pts: [[400, 1650], [350, 1100], [550, 800], [500, 450], [800, 280], [1150, 420], [1300, 700], [1550, 550], [1800, 700], [1750, 1100], [1450, 1250], [1600, 1550], [1300, 1780], [900, 1700], [780, 1420]],
    startAt: [380, 1400],
    w: 60, ow: 44, outside: 'water',
    zones: [
      { type: 'boost', f: 0.27, l: 32, c: 0.3, hw: 0.35 },
      { type: 'ramp', f: 0.545, l: 22, c: 0, hw: 1 },
      { type: 'ramp', f: 0.75, l: 22, c: 0, hw: 1 },
      { type: 'boost', f: 0.93, l: 32, c: -0.3, hw: 0.35 },
    ],
    boxes: [0.10, 0.33, 0.50, 0.81],
    obstacles: [],
    hazards: [
      { type: 'crab', f: 0.36, amp: 0.8, speed: 1.3 },
      { type: 'crab', f: 0.40, amp: 0.8, speed: 1.0 },
      { type: 'crab', f: 0.64, amp: 0.7, speed: 1.6 },
      { type: 'crab', f: 0.86, amp: 0.8, speed: 1.2 },
    ],
    decor: { palm: 5, umbrella: 2, rock: 2 },
  },
  {
    id: 'nieve', name: 'Cumbre Nevada', theme: 'nieve', seed: 33,
    pts: [[300, 1750], [300, 1200], [500, 1000], [300, 750], [350, 350], [700, 250], [900, 500], [800, 800], [1100, 950], [1300, 650], [1200, 350], [1550, 250], [1800, 450], [1750, 850], [1500, 1050], [1750, 1300], [1700, 1700], [1300, 1780], [1000, 1500], [700, 1750]],
    startAt: [300, 1500],
    w: 58, ow: 42, outside: 'wall',
    zones: [
      { type: 'ice', f: 0.25, l: 150, c: 0, hw: 0.85 },
      { type: 'ice', f: 0.585, l: 140, c: 0, hw: 0.85 },
      { type: 'ice', f: 0.885, l: 120, c: 0, hw: 0.85 },
      { type: 'boost', f: 0.70, l: 32, c: 0, hw: 0.4 },
      { type: 'boost', f: 0.05, l: 32, c: 0.35, hw: 0.35 },
    ],
    boxes: [0.12, 0.33, 0.55, 0.73],
    obstacles: [
      { f: 0.17, c: 0.5, r: 13, kind: 'snowman' },
      { f: 0.40, c: -0.55, r: 13, kind: 'snowman' },
      { f: 0.52, c: 0.45, r: 13, kind: 'snowman' },
      { f: 0.78, c: -0.5, r: 13, kind: 'snowman' },
      { f: 0.80, c: 0.45, r: 13, kind: 'snowman' },
      { f: 0.95, c: -0.45, r: 13, kind: 'snowman' },
    ],
    hazards: [],
    decor: { pine: 6, snowman: 1, crystal: 1 },
  },
  {
    id: 'volcan', name: 'Volcán Fortaleza', theme: 'volcan', seed: 44,
    pts: [[300, 1750], [260, 1250], [450, 1050], [300, 800], [350, 400], [650, 280], [820, 560], [1000, 780], [1150, 430], [1350, 260], [1700, 330], [1800, 700], [1520, 860], [1700, 1100], [1800, 1500], [1560, 1790], [1150, 1660], [760, 1800]],
    startAt: [280, 1500],
    w: 56, ow: 30, outside: 'void',
    zones: [
      { type: 'boost', f: 0.55, l: 32, c: 0, hw: 0.4 },
      { type: 'boost', f: 0.92, l: 32, c: 0.3, hw: 0.35 },
    ],
    boxes: [0.08, 0.42, 0.68, 0.90],
    obstacles: [],
    hazards: [
      { type: 'fire', f: 0.16, c: 0.3, period: 3.4, off: 0 },
      { type: 'fire', f: 0.24, c: -0.3, period: 3.4, off: 1.7 },
      { type: 'fire', f: 0.48, c: 0, period: 3.0, off: 0.8 },
      { type: 'fire', f: 0.63, c: 0.35, period: 3.6, off: 0.3 },
      { type: 'fire', f: 0.66, c: -0.35, period: 3.6, off: 2.1 },
      { type: 'fire', f: 0.85, c: 0, period: 3.2, off: 1.2 },
    ],
    decor: { lavarock: 3, tower: 2, deadtree: 2 },
  },
  {
    id: 'estelar', name: 'Senda Estelar', theme: 'estelar', seed: 55,
    pts: [[350, 1700], [250, 1200], [450, 900], [250, 600], [400, 300], [800, 250], [1000, 500], [900, 800], [1150, 1000], [1450, 800], [1350, 450], [1650, 250], [1850, 550], [1800, 1000], [1550, 1200], [1800, 1500], [1600, 1800], [1200, 1700], [1000, 1400], [750, 1650]],
    startAt: [300, 1450],
    w: 50, ow: 14, outside: 'void',
    zones: [
      { type: 'boost', f: 0.12, l: 32, c: 0, hw: 0.45 },
      { type: 'boost', f: 0.22, l: 32, c: 0.4, hw: 0.4 },
      { type: 'boost', f: 0.46, l: 32, c: -0.35, hw: 0.4 },
      { type: 'ramp', f: 0.575, l: 22, c: 0, hw: 1 },
      { type: 'boost', f: 0.68, l: 32, c: 0, hw: 0.45 },
      { type: 'boost', f: 0.79, l: 32, c: 0.35, hw: 0.4 },
      { type: 'boost', f: 0.955, l: 32, c: 0, hw: 0.45 },
    ],
    boxes: [0.07, 0.36, 0.62, 0.90],
    obstacles: [],
    hazards: [],
    decor: { starcrystal: 3, asteroid: 2, pylon: 2 },
  },
  {
    id: 'eclipse', name: 'Fortaleza Eclipse', theme: 'eclipse', seed: 77,
    pts: [[300, 1750], [260, 1150], [500, 900], [350, 600], [500, 300], [850, 280], [1000, 550], [800, 800], [1000, 1050], [1300, 900], [1250, 550], [1500, 300], [1800, 450], [1750, 850], [1500, 1000], [1800, 1250], [1750, 1700], [1400, 1800], [1200, 1550], [950, 1750], [650, 1600]],
    startAt: [280, 1450],
    w: 56, ow: 22, outside: 'void',
    zones: [
      { type: 'boost', f: 0.10, l: 32, c: 0, hw: 0.4 },
      { type: 'boost', f: 0.33, l: 32, c: -0.35, hw: 0.35 },
      { type: 'ramp', f: 0.52, l: 22, c: 0, hw: 1 },
      { type: 'boost', f: 0.70, l: 32, c: 0.35, hw: 0.35 },
      { type: 'boost', f: 0.90, l: 32, c: 0, hw: 0.4 },
    ],
    boxes: [0.06, 0.28, 0.47, 0.65, 0.84],
    obstacles: [],
    hazards: [
      { type: 'fire', f: 0.20, c: 0.3, period: 3.2, off: 0 },
      { type: 'fire', f: 0.42, c: -0.3, period: 3.0, off: 1.1 },
      { type: 'fire', f: 0.60, c: 0, period: 3.4, off: 2.0 },
      { type: 'fire', f: 0.78, c: -0.3, period: 3.1, off: 0.5 },
      { type: 'fire', f: 0.95, c: 0.3, period: 3.3, off: 1.6 },
    ],
    decor: { obelisk: 3, brazier: 2, spike: 3 },
  },
];

export const ARENA_DEF = {
  id: 'arena', name: 'Arena Cometa', theme: 'arena', seed: 66, arena: true,
  min: 574, max: 1474,
  pillars: [
    { x: 834, y: 834, r: 52 }, { x: 1214, y: 834, r: 52 },
    { x: 834, y: 1214, r: 52 }, { x: 1214, y: 1214, r: 52 },
    { x: 1024, y: 1024, r: 70 },
  ],
  boxes: [[1024, 700], [1024, 1348], [700, 1024], [1348, 1024], [700, 700], [1348, 1348], [1348, 700], [700, 1348]],
};

// Las pistas se diseñan en una cuadrícula de 2048 y se agrandan 1,5 veces en el mundo.
// La textura del piso sigue siendo de 2048 (no gasta más memoria): cada píxel cubre 1,5 unidades.
export const TRACK_SCALE = 1.5;

const cache = {};
export function getCenterline(i) {
  if (!cache[i]) {
    const d = TRACK_DEFS[i];
    const S = TRACK_SCALE;
    cache[i] = buildCenterline(d.pts.map(([x, y]) => [x * S, y * S]), [d.startAt[0] * S, d.startAt[1] * S]);
  }
  return cache[i];
}
