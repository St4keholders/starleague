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
      const effTheme = b.altTheme && b.localY < 4500 ? b.altTheme : b.theme;
      const curA = getThemeAssets(effTheme);
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

    // Pintar zonas (primero agua e islas; encima puentes, turbos y rampas)
    const waterDeep = toU32('#1e5eb8');
    const waterMid = toU32('#2a7ad8');
    const waterRipple = toU32('#58a8ff');
    const waterFoam = toU32('#cfe9ff');
    const iceBase = toU32('#4896e8');
    const iceLight = toU32('#78bcf8');
    const iceCrack = toU32('#e8f6ff');
    const islandRim = toU32('#d8b068');
    const boostBg = toU32('#ff4d2e');
    const boostChv = toU32('#ffe45c');
    const boostRim = toU32('#2ef0ff');
    const boostDark = toU32('#1e122a');
    const rampA = toU32('#ff9a1e');
    const rampB = toU32('#ffe45c');
    const rampEdge = toU32('#c8341a');
    const bridgeWoodA = toU32('#8a562a');
    const bridgeWoodB = toU32('#6e421e');
    const bridgeRail = toU32('#4a2a10');

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
            tex[rowOff | uu] = waterFoam;
          } else if (z.frozen) {
            // Grietas blancas sobre hielo azul (icecrack en la textura)
            const c1 = ((uu + vr * 2) % 19) === 0 && ((uu ^ vr) & 3) !== 0;
            const c2 = ((uu * 2 - vr + 1024) % 23) === 0 && ((uu + vr) & 3) !== 0;
            if (c1 || c2) tex[rowOff | uu] = iceCrack;
            else tex[rowOff | uu] = ((uu + vr) & 7) === 0 ? iceLight : iceBase;
          } else {
            const wave = ((uu + (vr >> 1) * 3) % 13) === 0 && (vr & 1) === 0;
            tex[rowOff | uu] = wave ? waterRipple : (((uu ^ vr) & 4) ? waterMid : waterDeep);
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
            tex[rowOff | uu] = d2 > 0.78 ? islandRim : curA.offPat[patRow | (uu & 63)];
          } else if (d2 <= 1.15) {
            tex[rowOff | uu] = waterFoam;
          }
        }
      }
    }

    // 2.5 Zonas de pasto/trigo alto (con patrón de hojas de alto contraste)
    const grassFarmDark = toU32('#b85814');
    const grassFarmMid = toU32('#df7a20');
    const grassFarmTip = toU32('#ffa83a');
    const grassJungDark = toU32('#145a28');
    const grassJungMid = toU32('#268a44');
    const grassJungTip = toU32('#72e042');
    for (const z of chunk.zones) {
      if (z.type !== 'grass') continue;
      const u0 = Math.max(0, (z.x0 / TEX_SCALE) | 0);
      const u1 = Math.min(MAP_SIZE - 1, (z.x1 / TEX_SCALE) | 0);
      const vr0 = (z.y0 / TEX_SCALE) | 0;
      const vr1 = (z.y1 / TEX_SCALE) | 0;
      const cDark = z.jungle ? grassJungDark : grassFarmDark;
      const cMid = z.jungle ? grassJungMid : grassFarmMid;
      const cTip = z.jungle ? grassJungTip : grassFarmTip;
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
    const lavaDark = toU32('#8a1e0c');
    const lavaMid = toU32('#ff4a14');
    const lavaHot = toU32('#ffd23f');
    const gooDark = toU32('#2a9834');
    const gooMid = toU32('#76ea3a');
    const gooBub = toU32('#c8ff6a');
    const holeVoid = toU32('#05020a');
    const holeRim = toU32('#b44dff');
    const holeStar = toU32('#7ff6ff');
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
            if (borderX || borderY) tex[rowOff | uu] = waterFoam;
            else tex[rowOff | uu] = ((uu + vr * 3) % 17 === 0) ? iceCrack : (((uu ^ vr) & 4) ? iceLight : iceBase);
          } else if (z.type === 'lava') {
            if (borderX || borderY) tex[rowOff | uu] = lavaDark;
            else {
              const h = ((uu * 5 + vr * 11) ^ (vr >> 1)) & 15;
              tex[rowOff | uu] = h < 3 ? lavaHot : h < 11 ? lavaMid : lavaDark;
            }
          } else if (z.type === 'goo') {
            if (borderX || borderY) tex[rowOff | uu] = gooDark;
            else {
              const h = ((uu * 9 + vr * 7) ^ (uu >> 1)) & 15;
              tex[rowOff | uu] = h < 2 ? gooBub : h < 11 ? gooMid : gooDark;
            }
          } else if (z.type === 'hole') {
            if (borderX || borderY) tex[rowOff | uu] = holeRim;
            else tex[rowOff | uu] = ((uu * 31 + vr * 17) & 63) === 0 ? holeStar : holeVoid;
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
              tex[rowOff | uu] = boostDark;
            } else if (uu === u0 + 1 || uu === u1 - 1) {
              tex[rowOff | uu] = boostRim;
            } else {
              const dx = Math.abs(uu - um);
              const chv = (ly + dx) % 9;
              tex[rowOff | uu] = chv < 4 ? boostChv : boostBg;
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
              tex[rowOff | uu] = boostDark;
            } else if (vr >= vr1 - 2) {
              tex[rowOff | uu] = boostChv;
            } else if (uu === u0 + 1 || uu === u1 - 1) {
              tex[rowOff | uu] = rampEdge;
            } else {
              const dx = Math.abs(uu - um);
              const chv = (ly - (dx >> 1) + 64) % 7;
              tex[rowOff | uu] = chv < 3 ? rampB : rampA;
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
          const plank = (vr % 4) === 0 ? bridgeWoodB : bridgeWoodA;
          for (let uu = u0; uu <= u1; uu++) {
            tex[rowOff | uu] = (uu <= u0 + 1 || uu >= u1 - 1) ? bridgeRail : plank;
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
    const b = biomeAt(y);
    const effTheme = b.altTheme && b.localY < 4500 ? b.altTheme : b.theme;
    const A = getThemeAssets(effTheme);
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
    const dirtA = toU32('#8a5a2a');
    const dirtB = toU32('#764a20');

    for (let dy = -rad; dy <= rad; dy++) {
      const vv = (v0 + dy) & 2047;
      const rowOff = vv << 11;
      const span = Math.round(Math.sqrt(Math.max(0, rad * rad - dy * dy)));
      for (let dx = -span; dx <= span; dx++) {
        const uu = u0 + dx;
        if (uu >= 0 && uu < MAP_SIZE) {
          tex[rowOff | uu] = ((uu + vv) & 1) ? dirtA : dirtB;
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
