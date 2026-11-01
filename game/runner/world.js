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
  BIOME_TRANSITION,
  FIELD_CX,
  FIELD_HW,
  WALL_W,
} from './config.js';
import { biomeAt, generateChunk, themeAt } from './layout.js';

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

const WATER_DEEP = packHex('#1e5eb8');
const WATER_MID = packHex('#2a7ad8');
const WATER_RIPPLE = packHex('#58a8ff');
const WATER_FOAM = packHex('#cfe9ff');
const ICE_BASE = packHex('#4896e8');
const ICE_LIGHT = packHex('#78bcf8');
const ICE_CRACK = packHex('#e8f6ff');
const ISLAND_RIM = packHex('#d8b068');
const BOOST_BG = packHex('#ff4d2e');
const BOOST_CHV = packHex('#ffe45c');
const BOOST_RIM = packHex('#2ef0ff');
const BOOST_DARK = packHex('#1e122a');
const RAMP_A = packHex('#ff9a1e');
const RAMP_B = packHex('#ffe45c');
const RAMP_EDGE = packHex('#c8341a');
const BRIDGE_WOOD_A = packHex('#8a562a');
const BRIDGE_WOOD_B = packHex('#6e421e');
const BRIDGE_RAIL = packHex('#4a2a10');
const GRASS_FARM_DARK = packHex('#c8961e');
const GRASS_FARM_MID = packHex('#efc23e');
const GRASS_FARM_TIP = packHex('#ffe484');
const GRASS_JUNG_DARK = packHex('#145a28');
const GRASS_JUNG_MID = packHex('#268a44');
const GRASS_JUNG_TIP = packHex('#72e042');
const LAVA_DARK = packHex('#8a1e0c');
const LAVA_MID = packHex('#ff4a14');
const LAVA_HOT = packHex('#ffd23f');
const GOO_DARK = packHex('#2a9834');
const GOO_MID = packHex('#76ea3a');
const GOO_BUB = packHex('#c8ff6a');
const HOLE_VOID = packHex('#05020a');
const HOLE_RIM = packHex('#b44dff');
const HOLE_STAR = packHex('#7ff6ff');
const DIRT_A = packHex('#8a5a2a');
const DIRT_B = packHex('#764a20');

const themeAssetsCache = {};
const FIELD_FROM_ROAD = new Set(['volcan', 'estelar', 'anillos', 'neon', 'coliseo']);
const CURB_T = 4; // grosor del borde de colores (texels)
const FURROW_EVERY = 12; // surcos/líneas a lo largo del campo (dan sensación de avance)

function mulCol(c, m) {
  const r = Math.min(255, ((c & 255) * m) | 0);
  const g = Math.min(255, (((c >> 8) & 255) * m) | 0);
  const b = Math.min(255, (((c >> 16) & 255) * m) | 0);
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

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

  // Piso del campo: tierra natural en los mundos de naturaleza, la «pista» en los mundos de ciudad/espacio
  const fieldBase = FIELD_FROM_ROAD.has(themeName) ? th.road : (th.off || th.road);
  const fieldNoise = FIELD_FROM_ROAD.has(themeName) ? (th.roadNoise || [th.road]) : (th.offNoise || th.roadNoise || [fieldBase]);
  // poco ruido: el piso debe verse limpio para que los obstáculos resalten
  const fieldTile = noiseTile(fieldBase, fieldNoise.filter((c) => c !== '#ffffff'), rng, 64, 0.12, false);
  const assets = {
    theme: themeName,
    fieldPat: toU32(fieldTile),
    furrowMul: FIELD_FROM_ROAD.has(themeName) ? 1.18 : 0.86,
    curbA: packHex(th.curbA || '#ffffff'),
    curbB: packHex(th.curbB || '#e8342c'),
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
    this.paintedTheme = new Array(MAP_SIZE / CHUNK_TEX_ROWS).fill('');

    for (const bm of BIOMES) {
      getThemeAssets(bm.theme);
      if (bm.altTheme) getThemeAssets(bm.altTheme);
    }
    const first = getThemeAssets(BIOMES[0].theme);
    this.theme = first.theme;
    this.th = first.th;
    this.sky = first.sky;
    this.skyTop = first.skyTop;
    this.skyHor = first.skyHor;
    this.fog = first.fog;
    this.outer = first.outer;
    this.decor = [];

    // Pintar los primeros 16 trozos de inmediato para arrancar sin esperas y calentar el JIT
    this.ensure(0, 3072, 16);
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
    const chunkA = getThemeAssets(chunk.theme || 'granja');
    const tex = this.tex;
    const slot = chunkIndex & 15;
    const row0 = (chunkIndex * CHUNK_TEX_ROWS) & 2047;
    const prevSlotTheme = this.paintedTheme[slot];
    let slotThemeUniform = true;
    let lastEffTheme = '';

    const cxT = Math.round(FIELD_CX / TEX_SCALE);
    const hwT = Math.round(FIELD_HW / TEX_SCALE);
    const wallT = Math.round(WALL_W / TEX_SCALE);
    const leftIn = cxT - hwT;
    const rightIn = cxT + hwT - 1;
    const leftWall = leftIn - wallT;
    const rightWall = rightIn + wallT;
    for (let r = 0; r < CHUNK_TEX_ROWS; r++) {
      const v = (row0 + r) & 2047;
      const vAbs = chunkIndex * CHUNK_TEX_ROWS + r;
      const wy = vAbs * TEX_SCALE;
      const b = biomeAt(wy);
      const effTheme = themeAt(b);
      if (r === 0) lastEffTheme = effTheme;
      else if (effTheme !== lastEffTheme || b.inTransition) slotThemeUniform = false;
      const curA = getThemeAssets(effTheme);
      const prevA = b.inTransition ? getThemeAssets(themeAt(biomeAt(wy - BIOME_TRANSITION - 1))) : curA;
      const threshold = (b.t01 * 16) | 0;
      const rowOff = v << 11;
      const patRow = (v & 63) << 6;
      const bayerRow = (v & 3) << 2;
      const curbOn = ((vAbs >> 3) & 1) === 0;
      const sameOuter = !b.inTransition && prevSlotTheme === effTheme;
      const uStart = sameOuter ? leftWall : 0;
      const uEnd = sameOuter ? rightWall + 1 : MAP_SIZE;
      for (let u = uStart; u < uEnd; u++) {
        const A = b.inTransition && BAYER4[bayerRow | (u & 3)] >= threshold ? prevA : curA;
        const pi = patRow | (u & 63);
        let col;
        if (u < leftWall || u > rightWall) col = A.outer[pi];
        else if (u < leftIn - CURB_T || u > rightIn + CURB_T) {
          // pared: más oscura hacia afuera y con una línea de sombra junto al borde
          col = (u === leftWall || u === rightWall) ? A.borderCol : A.wallPat[pi];
        } else if (u < leftIn || u > rightIn) col = curbOn ? A.curbA : A.curbB;
        else {
          col = A.fieldPat[pi];
          if ((u - leftIn) % FURROW_EVERY === 0) col = mulCol(col, A.furrowMul);
          else if (u === leftIn || u === rightIn) col = mulCol(col, 0.7);
        }
        tex[rowOff | u] = col;
      }
    }
    this.paintedTheme[slot] = slotThemeUniform ? lastEffTheme : '';

    // Pintar zonas (primero agua e islas; encima puentes, turbos y rampas)
    // 1. Lagos (congelados con grietas o de agua abierta)
    for (const z of chunk.zones) {
      if (z.type !== 'water') continue;
      const u0 = Math.max(0, (z.x0 / TEX_SCALE) | 0);
      const u1 = Math.min(MAP_SIZE - 1, (z.x1 / TEX_SCALE) | 0);
      const vr0 = (z.y0 / TEX_SCALE) | 0;
      const vr1 = (z.y1 / TEX_SCALE) | 0;
      for (let vr = vr0; vr <= vr1; vr++) {
        const vv = vr & 2047;
        const rowOff = vv << 11;
        const borderY = vr <= vr0 + 1 || vr >= vr1 - 1;
        for (let uu = u0; uu <= u1; uu++) {
          const borderX = uu <= u0 + 1 || uu >= u1 - 1;
          if (borderX || borderY) {
            tex[rowOff | uu] = WATER_FOAM;
          } else if (z.frozen) {
            // Grietas blancas sobre hielo azul (icecrack en la textura)
            const c1 = ((uu + vr * 2) % 19) === 0 && ((uu ^ vr) & 3) !== 0;
            const c2 = ((uu * 2 - vr + 1024) % 23) === 0 && ((uu + vr) & 3) !== 0;
            if (c1 || c2) tex[rowOff | uu] = ICE_CRACK;
            else tex[rowOff | uu] = ((uu + vr) & 7) === 0 ? ICE_LIGHT : ICE_BASE;
          } else {
            const wave = ((uu + (vr >> 1) * 3) % 13) === 0 && (vr & 1) === 0;
            tex[rowOff | uu] = wave ? WATER_RIPPLE : (((uu ^ vr) & 4) ? WATER_MID : WATER_DEEP);
          }
        }
      }
    }

    // 2. Islas seguras sobre el agua
    for (const z of chunk.zones) {
      if (z.type !== 'island') continue;
      const u0 = Math.max(0, ((z.x - z.rx) / TEX_SCALE) | 0);
      const u1 = Math.min(MAP_SIZE - 1, ((z.x + z.rx) / TEX_SCALE) | 0);
      const vr0 = ((z.y - z.ry) / TEX_SCALE) | 0;
      const vr1 = ((z.y + z.ry) / TEX_SCALE) | 0;
      const uc = z.x / TEX_SCALE;
      const vc = z.y / TEX_SCALE;
      const urx = Math.max(2, z.rx / TEX_SCALE);
      const vry = Math.max(2, z.ry / TEX_SCALE);
      for (let vr = vr0; vr <= vr1; vr++) {
        const vv = vr & 2047;
        const rowOff = vv << 11;
        const patRow = (vv & 63) << 6;
        const dy = (vr - vc) / vry;
        for (let uu = u0; uu <= u1; uu++) {
          const dx = (uu - uc) / urx;
          const d2 = dx * dx + dy * dy;
          if (d2 <= 1.0) {
            tex[rowOff | uu] = d2 > 0.78 ? ISLAND_RIM : chunkA.offPat[patRow | (uu & 63)];
          } else if (d2 <= 1.15) {
            tex[rowOff | uu] = WATER_FOAM;
          }
        }
      }
    }

    // 2.5 Zonas de pasto/trigo alto (con patrón de hojas de alto contraste)
    for (const z of chunk.zones) {
      if (z.type !== 'grass') continue;
      const u0 = Math.max(0, (z.x0 / TEX_SCALE) | 0);
      const u1 = Math.min(MAP_SIZE - 1, (z.x1 / TEX_SCALE) | 0);
      const vr0 = (z.y0 / TEX_SCALE) | 0;
      const vr1 = (z.y1 / TEX_SCALE) | 0;
      const cDark = z.jungle ? GRASS_JUNG_DARK : GRASS_FARM_DARK;
      const cMid = z.jungle ? GRASS_JUNG_MID : GRASS_FARM_MID;
      const cTip = z.jungle ? GRASS_JUNG_TIP : GRASS_FARM_TIP;
      for (let vr = vr0; vr <= vr1; vr++) {
        const vv = vr & 2047;
        const rowOff = vv << 11;
        for (let uu = u0; uu <= u1; uu++) {
          const h = ((uu * 7 + vr * 13) ^ (uu >> 1)) & 7;
          tex[rowOff | uu] = h < 2 ? cTip : h < 5 ? cMid : cDark;
        }
      }
    }

    // 2.6 Zonas de hielo (ice), lava (lava), baba (goo) y huecos al vacío (hole)
    for (const z of chunk.zones) {
      if (z.type !== 'ice' && z.type !== 'lava' && z.type !== 'goo' && z.type !== 'hole') continue;
      const u0 = Math.max(0, (z.x0 / TEX_SCALE) | 0);
      const u1 = Math.min(MAP_SIZE - 1, (z.x1 / TEX_SCALE) | 0);
      const vr0 = (z.y0 / TEX_SCALE) | 0;
      const vr1 = (z.y1 / TEX_SCALE) | 0;
      for (let vr = vr0; vr <= vr1; vr++) {
        const vv = vr & 2047;
        const rowOff = vv << 11;
        const borderY = vr <= vr0 + 1 || vr >= vr1 - 1;
        for (let uu = u0; uu <= u1; uu++) {
          const borderX = uu <= u0 + 1 || uu >= u1 - 1;
          if (z.type === 'ice') {
            if (borderX || borderY) tex[rowOff | uu] = WATER_FOAM;
            else tex[rowOff | uu] = ((uu + vr * 3) % 17 === 0) ? ICE_CRACK : (((uu ^ vr) & 4) ? ICE_LIGHT : ICE_BASE);
          } else if (z.type === 'lava') {
            if (borderX || borderY) tex[rowOff | uu] = LAVA_DARK;
            else {
              const h = ((uu * 5 + vr * 11) ^ (vr >> 1)) & 15;
              tex[rowOff | uu] = h < 3 ? LAVA_HOT : h < 11 ? LAVA_MID : LAVA_DARK;
            }
          } else if (z.type === 'goo') {
            if (borderX || borderY) tex[rowOff | uu] = GOO_DARK;
            else {
              const h = ((uu * 9 + vr * 7) ^ (uu >> 1)) & 15;
              tex[rowOff | uu] = h < 2 ? GOO_BUB : h < 11 ? GOO_MID : GOO_DARK;
            }
          } else if (z.type === 'hole') {
            if (borderX || borderY) tex[rowOff | uu] = HOLE_RIM;
            else tex[rowOff | uu] = ((uu * 31 + vr * 17) & 63) === 0 ? HOLE_STAR : HOLE_VOID;
          }
        }
      }
    }

    // 3. Puentes, turbos y rampas encima
    for (const z of chunk.zones) {
      if (z.type === 'boost') {
        const u0 = Math.max(0, (z.x0 / TEX_SCALE) | 0);
        const u1 = Math.min(MAP_SIZE - 1, (z.x1 / TEX_SCALE) | 0);
        const vr0 = (z.y0 / TEX_SCALE) | 0;
        const vr1 = (z.y1 / TEX_SCALE) | 0;
        const um = (u0 + u1) >> 1;
        for (let vr = vr0; vr <= vr1; vr++) {
          const vv = vr & 2047;
          const rowOff = vv << 11;
          const ly = vr - vr0;
          for (let uu = u0; uu <= u1; uu++) {
            if (uu === u0 || uu === u1 || vr === vr0 || vr === vr1) {
              tex[rowOff | uu] = BOOST_DARK;
            } else if (uu === u0 + 1 || uu === u1 - 1) {
              tex[rowOff | uu] = BOOST_RIM;
            } else {
              const dx = Math.abs(uu - um);
              const chv = (ly + dx) % 9;
              tex[rowOff | uu] = chv < 4 ? BOOST_CHV : BOOST_BG;
            }
          }
        }
      } else if (z.type === 'ramp') {
        const u0 = Math.max(0, (z.x0 / TEX_SCALE) | 0);
        const u1 = Math.min(MAP_SIZE - 1, (z.x1 / TEX_SCALE) | 0);
        const vr0 = (z.y0 / TEX_SCALE) | 0;
        const vr1 = (z.y1 / TEX_SCALE) | 0;
        const um = (u0 + u1) >> 1;
        for (let vr = vr0; vr <= vr1; vr++) {
          const vv = vr & 2047;
          const rowOff = vv << 11;
          const ly = vr - vr0;
          for (let uu = u0; uu <= u1; uu++) {
            if (uu === u0 || uu === u1 || vr === vr0) {
              tex[rowOff | uu] = BOOST_DARK;
            } else if (vr >= vr1 - 2) {
              tex[rowOff | uu] = BOOST_CHV;
            } else if (uu === u0 + 1 || uu === u1 - 1) {
              tex[rowOff | uu] = RAMP_EDGE;
            } else {
              const dx = Math.abs(uu - um);
              const chv = (ly - (dx >> 1) + 64) % 7;
              tex[rowOff | uu] = chv < 3 ? RAMP_B : RAMP_A;
            }
          }
        }
      } else if (z.type === 'bridge') {
        const u0 = Math.max(0, (z.x0 / TEX_SCALE) | 0);
        const u1 = Math.min(MAP_SIZE - 1, (z.x1 / TEX_SCALE) | 0);
        const vr0 = (z.y0 / TEX_SCALE) | 0;
        const vr1 = (z.y1 / TEX_SCALE) | 0;
        for (let vr = vr0; vr <= vr1; vr++) {
          const vv = vr & 2047;
          const rowOff = vv << 11;
          const plank = (vr % 4) === 0 ? BRIDGE_WOOD_B : BRIDGE_WOOD_A;
          for (let uu = u0; uu <= u1; uu++) {
            tex[rowOff | uu] = (uu <= u0 + 1 || uu >= u1 - 1) ? BRIDGE_RAIL : plank;
          }
        }
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
    const A = getThemeAssets(themeAt(biomeAt(y)));
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
    const maxY = c.y + 1350;
    const maxGrassY = c.y + 650;
    const maxDecorY = c.y + 1150;
    this.ensure(minY - 150, maxY + 150, 1);
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
        if (d.y < minY || d.cut) continue;
        if (d.kind === 'grasstuft' ? d.y > maxGrassY : (d.kind !== 'gate' && d.y > maxDecorY)) continue;
        out.push(d);
      }
      if (ch.pickups) {
        for (const pk of ch.pickups) {
          if (pk.y < minY || pk.y > maxY) continue;
          if (taken && taken.has(pk.id)) continue;
          out.push(pk);
        }
      }
      if (ch.platforms) {
        for (const pl of ch.platforms) {
          if (pl.y1 < minY || pl.y0 > maxY) continue;
          out.push(pl);
        }
      }
    }
    return out;
  }

  cutGrass(x, y, r = 9) {
    const tex = this.tex;
    const u0 = (x / TEX_SCALE) | 0;
    const v0 = (y / TEX_SCALE) | 0;
    const rad = Math.max(2, Math.round(r / TEX_SCALE));

    for (let dy = -rad; dy <= rad; dy++) {
      const vv = (v0 + dy) & 2047;
      const rowOff = vv << 11;
      const span = Math.round(Math.sqrt(Math.max(0, rad * rad - dy * dy)));
      for (let dx = -span; dx <= span; dx++) {
        const uu = u0 + dx;
        if (uu >= 0 && uu < MAP_SIZE) {
          tex[rowOff | uu] = ((uu + vv) & 1) ? DIRT_A : DIRT_B;
        }
      }
    }

    const ci = Math.max(0, Math.floor(y / CHUNK_LEN));
    const ch = this.getChunk(ci);
    if (ch && ch.decor) {
      for (const d of ch.decor) {
        if (d.kind === 'grasstuft' && !d.cut) {
          if (Math.hypot(d.x - x, d.y - y) < 12) {
            d.cut = true;
          }
        }
      }
    }
  }
}
