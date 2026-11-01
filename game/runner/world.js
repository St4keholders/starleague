// Mundo circular (anillo 2048²) para «Supervivencia Estelar» (con DOM / Uint32Array)
import { MAP_SIZE } from '../constants.js';
import { mulberry32 } from '../geometry.js';
import { THEMES, makeSkyStrip, noiseTile, toU32 } from '../trackgfx.js';
import { hexToRgb } from '../sprites.js';
import {
  TEX_SCALE,
  WORLD_W,
  CHUNK_TEX_ROWS,
  CHUNK_LEN,
  BIOMES,
} from './config.js';
import { centerX, halfW, biomeAt, generateChunk } from './layout.js';

// Matriz Bayer 4x4 para el tramado (dithering) en la transición entre biomas
const BAYER4 = new Uint8Array([
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
]);

function packHex(hex) {
  const [r, g, b] = hexToRgb(hex);
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

const themeAssetsCache = {};

function getThemeAssets(themeName) {
  if (themeAssetsCache[themeName]) return themeAssetsCache[themeName];
  const th = THEMES[themeName] || THEMES.granja;
  const rng = mulberry32(themeName.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 1337));
  const star = themeName === 'estelar' || themeName === 'anillos';

  const outTile = noiseTile(th.out, th.outNoise || [th.out], rng, 64, star ? 0.25 : 0.45, star);
  const offTile = noiseTile(th.off || th.road, th.offNoise || th.roadNoise || [th.road], rng, 64, 0.42, star);
  const roadTile = noiseTile(th.road, th.roadNoise || [th.road], rng, 64, 0.45, false);
  const wallBase = th.wall || th.rim || '#7a7a84';
  const wallNoise = th.wallNoise || [wallBase, '#5a5a64'];
  const wallTile = noiseTile(wallBase, wallNoise, rng, 64, 0.5, false);

  const sky = makeSkyStrip(themeName, rng);
  const skyTop = hexToRgb(th.skyTop);
  const skyHor = hexToRgb(th.skyHor);
  const fog = hexToRgb(th.fog);
  const fogCol = ((255 << 24) | (fog[2] << 16) | (fog[1] << 8) | fog[0]) >>> 0;

  const assets = {
    theme: themeName,
    th,
    sky,
    skyTop,
    skyHor,
    fog,
    fogCol,
    outer: toU32(outTile),
    offPat: toU32(offTile),
    roadPat: toU32(roadTile),
    wallPat: toU32(wallTile),
    borderCol: packHex(th.curbB || '#3a2414'),
    waterCol: packHex(th.water || th.shallow || '#2a7ad8'),
    iceCol: packHex(th.ice || '#cfe9ff'),
    lavaCol: packHex('#ff5a14'),
    gooCol: packHex(th.goo || '#9dff3a'),
    dirtCol: packHex('#8a5a2a'),
  };
  themeAssetsCache[themeName] = assets;
  return assets;
}

export class RunnerWorld {
  constructor(seed = 12345, difficulty = 1) {
    this.runner = true;
    this.ring = true;
    this.seed = seed >>> 0;
    this.difficulty = difficulty;
    this.scale = TEX_SCALE;
    this.worldSize = WORLD_W;
    this.def = { name: 'Supervivencia Estelar', outside: 'wall' };

    this.tex = new Uint32Array(MAP_SIZE * MAP_SIZE);
    this.chunks = new Map(); // chunkIndex -> chunk data
    this.paintedSlot = new Int32Array(MAP_SIZE / CHUNK_TEX_ROWS).fill(-1); // 16 slots in 2048 rows

    const first = getThemeAssets(BIOMES[0].theme);
    this.theme = first.theme;
    this.th = first.th;
    this.sky = first.sky;
    this.skyTop = first.skyTop;
    this.skyHor = first.skyHor;
    this.fog = first.fog;
    this.outer = first.outer;
    this.decor = [];

    // Pintar los primeros trozos de inmediato para arrancar sin esperas
    this.ensure(0, 1900, 16);
  }

  getChunk(chunkIndex) {
    if (chunkIndex < 0) chunkIndex = 0;
    let c = this.chunks.get(chunkIndex);
    if (!c) {
      c = generateChunk(this.seed, chunkIndex, this.difficulty);
      this.chunks.set(chunkIndex, c);
      // Limitar memoria de trozos muy antiguos
      if (this.chunks.size > 64) {
        const firstKey = this.chunks.keys().next().value;
        if (firstKey < chunkIndex - 24) this.chunks.delete(firstKey);
      }
    }
    return c;
  }

  ensure(minY, maxY, maxPerFrame = 2) {
    const c0 = Math.max(0, Math.floor(minY / CHUNK_LEN));
    const c1 = Math.max(c0, Math.floor(maxY / CHUNK_LEN));
    let painted = 0;
    for (let ci = c0; ci <= c1; ci++) {
      const slot = ci & 15;
      if (this.paintedSlot[slot] !== ci) {
        this.paintChunk(ci);
        this.paintedSlot[slot] = ci;
        painted++;
        if (painted >= maxPerFrame) break;
      }
    }
  }

  paintChunk(chunkIndex) {
    const chunk = this.getChunk(chunkIndex);
    const tex = this.tex;
    const row0 = (chunkIndex * CHUNK_TEX_ROWS) & 2047;

    for (let r = 0; r < CHUNK_TEX_ROWS; r++) {
      const v = (row0 + r) & 2047;
      const wy = (chunkIndex * CHUNK_TEX_ROWS + r) * TEX_SCALE;
      const b = biomeAt(wy);
      const curA = getThemeAssets(b.theme);
      const prevA = b.inTransition ? getThemeAssets(b.prevTheme) : curA;
      const threshold = (b.t01 * 16) | 0;

      const cx = (centerX(this.seed, wy) / TEX_SCALE) | 0;
      const hw = (halfW(this.seed, wy) / TEX_SCALE) | 0;
      const leftIn = Math.max(24, cx - hw);
      const rightIn = Math.min(2024, cx + hw);
      const leftWall = Math.max(0, leftIn - 18);
      const rightWall = Math.min(2047, rightIn + 18);
      // Sendero central suave
      const pathShift = Math.round(Math.sin(wy / 360 + this.seed * 0.1) * (hw * 0.35));
      const pathL = cx + pathShift - 26;
      const pathR = cx + pathShift + 26;

      const rowOff = v << 11;
      const patRow = (v & 63) << 6;
      const bayerRow = (v & 3) << 2;

      for (let u = 0; u < MAP_SIZE; u++) {
        const useCur = !b.inTransition || BAYER4[bayerRow | (u & 3)] < threshold;
        const A = useCur ? curA : prevA;
        const patIdx = patRow | (u & 63);
        let col;
        if (u < leftWall || u > rightWall) {
          col = A.outer[patIdx];
        } else if (u < leftIn || u > rightIn) {
          col = (u >= leftIn - 2 && u <= rightIn + 2) ? A.borderCol : A.wallPat[patIdx];
        } else if (u >= pathL && u <= pathR) {
          col = A.roadPat[patIdx];
        } else {
          col = A.offPat[patIdx];
        }
        tex[rowOff | u] = col;
      }
    }

    // Sombras suaves de obstáculos estáticos en el piso
    const shadowCol = 0xff5a3e20;
    for (const o of chunk.obstacles) {
      if (o.moving) continue;
      const u0 = (o.x / TEX_SCALE) | 0;
      const v0 = ((o.y / TEX_SCALE) | 0) & 2047;
      const rx = Math.max(4, ((o.w ? o.w * 0.45 : o.r) / TEX_SCALE) | 0);
      const ry = Math.max(3, (rx * 0.55) | 0);
      for (let dy = -ry; dy <= ry; dy++) {
        const vv = (v0 + dy) & 2047;
        const rowOff = vv << 11;
        const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.1))));
        for (let dx = -span; dx <= span; dx++) {
          const uu = u0 + dx;
          if (uu >= 0 && uu < MAP_SIZE) {
            const c = tex[rowOff | uu];
            const r = ((c & 255) * 0.72) | 0;
            const g = (((c >> 8) & 255) * 0.72) | 0;
            const b = (((c >> 16) & 255) * 0.72) | 0;
            tex[rowOff | uu] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
          }
        }
      }
      void shadowCol;
    }
  }

  applyBiomeFor(renderer, y) {
    const b = biomeAt(y);
    const A = getThemeAssets(b.theme);
    this.theme = A.theme;
    this.th = A.th;
    this.sky = A.sky;
    this.skyTop = A.skyTop;
    this.skyHor = A.skyHor;
    this.fog = A.fog;
    this.outer = A.outer;
    if (renderer.fogCol !== A.fogCol || renderer._runnerTheme !== A.theme) {
      renderer._runnerTheme = A.theme;
      renderer.fogCol = A.fogCol;
      renderer.gradCache = {};
    }
  }

  visibleDecor(c, sim) {
    const minY = c.y - 50;
    const maxY = c.y + 1400;
    this.ensure(minY - 250, maxY + 250, 2);
    const c0 = Math.max(0, Math.floor(minY / CHUNK_LEN));
    const c1 = Math.max(c0, Math.floor(maxY / CHUNK_LEN));
    const out = [];
    const taken = sim && sim.taken ? sim.taken : null;

    for (let ci = c0; ci <= c1; ci++) {
      const ch = this.getChunk(ci);
      for (const o of ch.obstacles) {
        if (o.y < minY || o.y > maxY) continue;
        out.push(o);
      }
      for (const d of ch.decor) {
        if (d.y < minY || d.y > maxY || d.cut) continue;
        out.push(d);
      }
      if (ch.pickups) {
        for (const pk of ch.pickups) {
          if (pk.y < minY || pk.y > maxY) continue;
          if (taken && taken.has(pk.id)) continue;
          out.push(pk);
        }
      }
    }
    return out;
  }
}
