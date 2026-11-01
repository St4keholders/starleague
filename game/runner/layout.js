// Generación determinista del campo infinito de «Supervivencia Estelar» (SIN DOM)
import { mulberry32 } from '../geometry.js';
import {
  WORLD_W,
  CHUNK_LEN,
  SAFE_START_CHUNKS,
  MIN_CORRIDOR_W,
  BIOME_LENGTH,
  BIOME_TRANSITION,
  BIOMES,
  DIFF_OBS_DENSITY,
  HEART_SPACING,
  SHIELD_SPACING,
  BOOST_SPACING,
  BOX_ROW_SPACING,
  BOX_ROW_COUNT,
} from './config.js';

const seedParamsCache = new Map();

function getSeedParams(seed) {
  const key = seed >>> 0;
  let p = seedParamsCache.get(key);
  if (!p) {
    const rng = mulberry32(key ^ 0x9e3779b9);
    p = {
      phi1: rng() * Math.PI * 2,
      phi2: rng() * Math.PI * 2,
      phi3: rng() * Math.PI * 2,
      phi4: rng() * Math.PI * 2,
    };
    if (seedParamsCache.size > 64) seedParamsCache.clear();
    seedParamsCache.set(key, p);
  }
  return p;
}

export function centerX(seed, y) {
  const p = getSeedParams(seed);
  return 1536 + 380 * Math.sin(y / 2300 + p.phi1) + 120 * Math.sin(y / 970 + p.phi2);
}

export function centerSlope(seed, y) {
  const p = getSeedParams(seed);
  return (380 / 2300) * Math.cos(y / 2300 + p.phi1) + (120 / 970) * Math.cos(y / 970 + p.phi2);
}

export function halfW(seed, y) {
  const p = getSeedParams(seed);
  return 360 + 60 * Math.sin(y / 1650 + p.phi3);
}

export function biomeAt(y) {
  const yy = Math.max(0, y);
  const rawIndex = Math.floor(yy / BIOME_LENGTH);
  const localY = yy - rawIndex * BIOME_LENGTH;
  const index = rawIndex % BIOMES.length;
  const cycle = Math.floor(rawIndex / BIOMES.length);
  const b = BIOMES[index];
  const prevB = rawIndex > 0 ? BIOMES[(rawIndex - 1) % BIOMES.length] : b;
  const inTrans = rawIndex > 0 && localY < BIOME_TRANSITION;
  const t01 = inTrans ? localY / BIOME_TRANSITION : 1;
  return {
    index,
    rawIndex,
    cycle,
    id: b.id,
    name: b.name,
    theme: b.theme,
    altTheme: b.altTheme || null,
    prevTheme: prevB.theme,
    chaser: b.chaser,
    chaserName: b.chaserName,
    t01,
    inTransition: inTrans,
    localY,
  };
}

// Tipos de obstáculos estáticos de la Granja de Otoño
const FARM_OBSTACLES = [
  { kind: 'haybale', r: 16, height: 18, solid: true, jumpable: true, weight: 30 },
  { kind: 'pumpkin', r: 10, height: 14, solid: true, jumpable: true, weight: 28 },
  { kind: 'fence', w: 76, h: 14, r: 38, height: 18, solid: true, jumpable: true, weight: 22 },
  { kind: 'tractor', r: 28, height: 45, solid: true, jumpable: false, weight: 10 },
  { kind: 'barn', w: 110, h: 100, r: 55, height: 60, solid: true, jumpable: false, weight: 6 },
  { kind: 'silo', r: 30, height: 65, solid: true, jumpable: false, weight: 5 },
];

function pickWeighted(rng, list) {
  let total = 0;
  for (const it of list) total += it.weight;
  let r = rng() * total;
  for (const it of list) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return list[0];
}

// Verifica si un candidato de obstáculo bloquea la banda del pasillo seguro
function overlapsCorridor(x, halfExtent, corrMinX, corrMaxX) {
  return x + halfExtent > corrMinX && x - halfExtent < corrMaxX;
}

function overlapsExisting(x, y, rad, obstacles, pad = 16) {
  for (const o of obstacles) {
    const orad = o.w ? Math.max(o.w, o.h) * 0.5 : o.r;
    const dx = x - o.x;
    const dy = y - o.y;
    if (dx * dx + dy * dy < (rad + orad + pad) ** 2) return true;
  }
  return false;
}

// Devuelve el tipo de superficie/peligro en (x, y) dentro de un trozo:
// null (seguro/tierra/puente/isla), 'ice' (seguro pero resbaloso), 'grass' (frena), 'goo' (frena),
// o 'water' / 'lava' / 'hole' (letal si está en el piso).
export function isHazardAt(chunk, x, y) {
  if (!chunk || !chunk.zones) return null;
  // Primero verificar si está sobre un puente o una isla segura
  for (const z of chunk.zones) {
    if (z.type === 'bridge') {
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return null;
    } else if (z.type === 'island') {
      const dx = (x - z.x) / (z.rx || 36);
      const dy = (y - z.y) / (z.ry || 28);
      if (dx * dx + dy * dy <= 1) return null;
    }
  }
  // Luego verificar agua, lava, huecos, hielo, baba o pasto
  let surf = null;
  for (const z of chunk.zones) {
    if (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1) continue;
    if (z.type === 'water') {
      if (z.frozen) surf = 'ice';
      else return 'water';
    } else if (z.type === 'lava') {
      return 'lava';
    } else if (z.type === 'hole') {
      return 'hole';
    } else if (z.type === 'ice') {
      surf = 'ice';
    } else if (z.type === 'goo') {
      surf = 'goo';
    } else if (z.type === 'grass' && !surf) {
      surf = 'grass';
    }
  }
  return surf;
}

// Calcula el estado determinista de un obstáculo en el instante raceTime (SIN DOM)
export function obstacleStateAt(obs, raceTime = 0) {
  if (!obs || !obs.moving) {
    return {
      x: obs ? obs.x : 0,
      y: obs ? obs.y : 0,
      active: true,
      warning: false,
      k: 0,
      dir: 1,
      frame: 0,
    };
  }
  if (obs.moveType === 'cross') {
    const minX = obs.minX ?? obs.x - 120;
    const maxX = obs.maxX ?? obs.x + 120;
    const range = Math.max(20, maxX - minX);
    const speed = obs.speed || 55;
    const halfPeriod = range / speed;
    const period = halfPeriod * 2;
    const u = (((raceTime + (obs.phase || 0)) % period) + period) % period;
    let cx;
    let dir;
    if (u < halfPeriod) {
      cx = minX + u * speed;
      dir = 1;
    } else {
      cx = maxX - (u - halfPeriod) * speed;
      dir = -1;
    }
    const x = cx + (obs.flockDx || 0);
    const y = obs.y + (obs.flockDy || 0);
    const frame = Math.floor((raceTime + (obs.phase || 0)) * 6) % 2;
    return { x, y, active: true, warning: false, k: 0, dir, frame };
  }
  if (obs.moveType === 'fire') {
    const period = obs.period || 3.4;
    const ph = (((raceTime + (obs.phase || 0)) % period) + period) % period;
    const warn = 1.2;
    const warning = ph > period - warn;
    const active = ph > period - 0.35;
    const k = warning ? (period - ph) / warn : 1;
    const frame = Math.floor(raceTime * 10) % 2;
    return {
      x: obs.x,
      y: obs.y,
      active,
      warning,
      k,
      phase: ph,
      period,
      dir: 1,
      frame,
    };
  }
  return { x: obs.x, y: obs.y, active: true, warning: false, k: 0, dir: 1, frame: 0 };
}

// Verifica que en el trozo exista al menos un pasillo vertical libre de ancho >= minWidth
// haciendo un barrido en X cada 10 unidades dentro de los límites jugables del trozo.
export function verifyFreeCorridor(seed, chunk, minWidth = MIN_CORRIDOR_W) {
  const ym = (chunk.y0 + chunk.y1) * 0.5;
  const cx0 = centerX(seed, chunk.y0);
  const cx1 = centerX(seed, chunk.y1);
  const cxm = centerX(seed, ym);
  const hwm = halfW(seed, ym);
  const left = Math.max(cx0 - halfW(seed, chunk.y0), cx1 - halfW(seed, chunk.y1), cxm - hwm) + 12;
  const right = Math.min(cx0 + halfW(seed, chunk.y0), cx1 + halfW(seed, chunk.y1), cxm + hwm) - 12;

  let runWidth = 0;
  let maxRun = 0;
  for (let x = left; x <= right; x += 10) {
    let blocked = false;
    for (const o of chunk.obstacles) {
      if (!o.solid || o.moving) continue;
      const hx = o.w ? o.w * 0.5 : o.r;
      if (Math.abs(x - o.x) < hx + 9) {
        blocked = true;
        break;
      }
    }
    if (!blocked && chunk.zones && chunk.zones.length > 0) {
      for (let sy = chunk.y0 + 16; sy < chunk.y1; sy += 24) {
        const hz = isHazardAt(chunk, x, sy);
        if (hz === 'water' || hz === 'lava' || hz === 'hole') {
          blocked = true;
          break;
        }
      }
    }
    if (!blocked) {
      runWidth += 10;
      if (runWidth > maxRun) maxRun = runWidth;
    } else {
      runWidth = 0;
    }
  }
  return maxRun >= minWidth;
}

export function generateChunk(seed, chunkIndex, difficulty = 1) {
  const y0 = chunkIndex * CHUNK_LEN;
  const y1 = y0 + CHUNK_LEN;
  const ym = (y0 + y1) * 0.5;
  const biome = biomeAt(ym);
  const rng = mulberry32(((seed * 7919) + chunkIndex) >>> 0);
  const p = getSeedParams(seed);

  const obstacles = [];
  const pickups = [];
  const zones = [];
  const platforms = [];
  const decor = [];

  let nextId = 0;
  const mkId = (prefix = '') => `${chunkIndex}:${prefix}${nextId++}`;

  // Centro del pasillo libre garantizado (>= 110 u de despeje en X constante dentro del trozo)
  const cx0 = centerX(seed, y0);
  const cx1 = centerX(seed, y1);
  const cxm = centerX(seed, ym);
  const hwm = halfW(seed, ym);
  const safeLeft = Math.max(cx0 - halfW(seed, y0), cx1 - halfW(seed, y1), cxm - hwm) + 20;
  const safeRight = Math.min(cx0 + halfW(seed, y0), cx1 + halfW(seed, y1), cxm + hwm) - 20;
  const corrRatio = 0.5 + 0.32 * Math.sin(chunkIndex * 0.45 + p.phi4);
  const corrCenter = safeLeft + 60 + Math.max(0, safeRight - safeLeft - 120) * corrRatio;
  const corrHalf = 58; // 116 u libres (> 90 u requeridos)
  const corrMinX = corrCenter - corrHalf;
  const corrMaxX = corrCenter + corrHalf;

  // Los primeros 3 trozos (zona de salida) no tienen obstáculos
  if (chunkIndex >= SAFE_START_CHUNKS) {
    // Lagos (con grietas de hielo seguros o lagos de agua abierta con isla y puente)
    if (chunkIndex % 5 === 1) {
      const frozen = chunkIndex % 10 === 1 || rng() < 0.55;
      const wy0 = Math.round((y0 + 36 + rng() * 24) * 10) / 10;
      const wy1 = Math.round((wy0 + 76 + rng() * 28) * 10) / 10;
      const wyMid = (wy0 + wy1) * 0.5;
      const cxy = centerX(seed, wyMid);
      const hwy = halfW(seed, wyMid);

      if (frozen) {
        // Lago congelado con grietas de hielo (seguro para cruzar)
        const wx = cxy + (rng() * 2 - 1) * (hwy * 0.35);
        const ww = 120 + rng() * 80;
        zones.push({
          id: mkId('z'),
          type: 'water',
          frozen: true,
          x0: Math.round((wx - ww) * 10) / 10,
          x1: Math.round((wx + ww) * 10) / 10,
          y0: wy0,
          y1: wy1,
        });
      } else {
        // Lago lateral de agua abierta (quita 1 corazón) fuera del pasillo libre, con isla y puente
        const side = corrCenter >= cxy ? -1 : 1;
        const lakeHalfW = 90 + rng() * 30;
        const lakeCx = side < 0
          ? Math.max(cxy - hwy + lakeHalfW + 24, corrMinX - lakeHalfW - 16)
          : Math.min(cxy + hwy - lakeHalfW - 24, corrMaxX + lakeHalfW + 16);
        const wx0 = Math.round((lakeCx - lakeHalfW) * 10) / 10;
        const wx1 = Math.round((lakeCx + lakeHalfW) * 10) / 10;
        zones.push({
          id: mkId('z'),
          type: 'water',
          frozen: false,
          x0: wx0,
          x1: wx1,
          y0: wy0,
          y1: wy1,
        });
        // Isla en medio del lago
        const islX = Math.round((lakeCx + side * 18) * 10) / 10;
        const islY = Math.round(wyMid * 10) / 10;
        zones.push({
          id: mkId('z'),
          type: 'island',
          x: islX,
          y: islY,
          rx: 38,
          ry: 26,
          x0: islX - 38,
          x1: islX + 38,
          y0: islY - 26,
          y1: islY + 26,
        });
        // Puente seguro en el borde del lago más cercano al centro
        const brX = side < 0 ? wx1 - 28 : wx0 + 28;
        zones.push({
          id: mkId('z'),
          type: 'bridge',
          x0: Math.round((brX - 24) * 10) / 10,
          x1: Math.round((brX + 24) * 10) / 10,
          y0: Math.round((wy0 - 6) * 10) / 10,
          y1: Math.round((wy1 + 6) * 10) / 10,
        });
      }
    }

    // Zonas de pasto/trigo alto que deja surco (granja y jungla)
    if ((biome.id === 'granja' || biome.id === 'jungla') && (chunkIndex % 2 === 0 || rng() < 0.65)) {
      const gy0 = Math.round((y0 + 18 + rng() * 28) * 10) / 10;
      const gy1 = Math.round((gy0 + 88 + rng() * 52) * 10) / 10;
      const gyMid = (gy0 + gy1) * 0.5;
      const cxy = centerX(seed, gyMid);
      const hwy = halfW(seed, gyMid);
      const gHalfW = 75 + rng() * 55;
      const gSide = rng() < 0.5 ? -1 : 1;
      const gx = cxy + gSide * (40 + rng() * Math.max(20, hwy - gHalfW - 65));
      const gx0 = Math.round((gx - gHalfW) * 10) / 10;
      const gx1 = Math.round((gx + gHalfW) * 10) / 10;
      if (isHazardAt({ zones }, gx, gyMid) !== 'water') {
        zones.push({
          id: mkId('z'),
          type: 'grass',
          jungle: biome.id === 'jungla',
          x0: gx0,
          x1: gx1,
          y0: gy0,
          y1: gy1,
        });
        // Repartir mechones grasstuft (~1 cada 40×40 u)
        for (let ty = gy0 + 16; ty <= gy1 - 12; ty += 38) {
          for (let tx = gx0 + 16; tx <= gx1 - 12; tx += 38) {
            const jx = Math.round((tx + (rng() - 0.5) * 16) * 10) / 10;
            const jy = Math.round((ty + (rng() - 0.5) * 16) * 10) / 10;
            if (isHazardAt({ zones }, jx, jy) === 'water') continue;
            decor.push({
              id: mkId('gt'),
              kind: 'grasstuft',
              jungle: biome.id === 'jungla',
              x: jx,
              y: jy,
              solid: false,
              cut: false,
            });
          }
        }
      }
    }

    const dens = DIFF_OBS_DENSITY[difficulty] ?? 1.0;
    const baseCount = Math.max(1, Math.round((2 + Math.floor(rng() * 3)) * dens));

    for (let i = 0; i < baseCount; i++) {
      const tpl = pickWeighted(rng, FARM_OBSTACLES);
      const y = tpl.kind === 'barn'
        ? y0 + 128 + rng() * 10
        : y0 + 24 + rng() * (CHUNK_LEN - 48);
      const cxy = centerX(seed, y);
      const hwy = halfW(seed, y);
      const halfExt = tpl.w ? tpl.w * 0.5 : tpl.r;
      const margin = halfExt + 18;

      let placed = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const lat = (rng() * 2 - 1) * (hwy - margin);
        const x = Math.round((cxy + lat) * 10) / 10;
        const ry = Math.round(y * 10) / 10;
        if (overlapsCorridor(x, halfExt + 10, corrMinX, corrMaxX)) continue;
        if (overlapsExisting(x, ry, halfExt, obstacles, 18)) continue;
        if (isHazardAt({ zones }, x, ry) === 'water') continue;

        const obs = {
          id: mkId('o'),
          kind: tpl.kind,
          x,
          y: ry,
          r: tpl.r,
          height: tpl.height,
          solid: tpl.solid,
          jumpable: tpl.jumpable,
        };
        if (tpl.w) {
          obs.w = tpl.w;
          obs.h = tpl.h;
        }
        if (tpl.kind === 'pumpkin') {
          obs.lit = rng() < 0.25;
        }
        if (tpl.kind === 'barn') {
          const rx0 = Math.round((obs.x - obs.w * 0.5) * 10) / 10;
          const rx1 = Math.round((obs.x + obs.w * 0.5) * 10) / 10;
          const ry0 = Math.round((obs.y - obs.h * 0.5) * 10) / 10;
          const ry1 = Math.round((obs.y + obs.h * 0.5) * 10) / 10;
          platforms.push({
            id: mkId('pl'),
            obsId: obs.id,
            kind: 'barn_roof',
            x0: rx0,
            x1: rx1,
            y0: ry0,
            y1: ry1,
            h: obs.height || 60,
          });
          // Rampa de acceso frente al granero para subir al techo
          const rampY0 = Math.max(y0 + 4, Math.round((ry0 - 72) * 10) / 10);
          const rampY1 = Math.max(rampY0 + 36, Math.round((ry0 - 24) * 10) / 10);
          zones.push({
            id: mkId('z'),
            type: 'ramp',
            x0: Math.round((obs.x - 36) * 10) / 10,
            x1: Math.round((obs.x + 36) * 10) / 10,
            y0: rampY0,
            y1: rampY1,
          });
        }
        obstacles.push(obs);
        placed = true;
        break;
      }
      void placed;
    }

    // Obstáculos en movimiento deterministas en función de raceTime
    if (biome.id === 'granja') {
      if (chunkIndex % 4 === 0) {
        const my = Math.round((y0 + 50 + rng() * (CHUNK_LEN - 100)) * 10) / 10;
        const cxy = centerX(seed, my);
        const hwy = halfW(seed, my);
        if (isHazardAt({ zones }, cxy, my) !== 'water') {
          obstacles.push({
            id: mkId('m'),
            kind: 'tractor_side',
            x: Math.round(cxy * 10) / 10,
            y: my,
            r: 26,
            height: 42,
            solid: true,
            jumpable: false,
            moving: true,
            moveType: 'cross',
            minX: Math.round((cxy - hwy + 54) * 10) / 10,
            maxX: Math.round((cxy + hwy - 54) * 10) / 10,
            speed: 70,
            phase: Math.round(rng() * 12 * 100) / 100,
          });
        }
      } else if (chunkIndex % 4 === 2) {
        const my = Math.round((y0 + 56 + rng() * (CHUNK_LEN - 112)) * 10) / 10;
        const cxy = centerX(seed, my);
        const hwy = halfW(seed, my);
        if (isHazardAt({ zones }, cxy, my) !== 'water') {
          const flockCount = 3 + Math.floor(rng() * 3); // 3 a 5 ovejas
          const phase = Math.round(rng() * 12 * 100) / 100;
          const minX = Math.round((cxy - hwy + 70) * 10) / 10;
          const maxX = Math.round((cxy + hwy - 70) * 10) / 10;
          for (let sIdx = 0; sIdx < flockCount; sIdx++) {
            const fdx = (sIdx - (flockCount - 1) * 0.5) * 26;
            const fdy = (sIdx % 2 === 0 ? -1 : 1) * 8;
            obstacles.push({
              id: mkId('m'),
              kind: 'sheep',
              x: Math.round(cxy * 10) / 10,
              y: my,
              r: 12,
              height: 16,
              solid: true,
              jumpable: true,
              moving: true,
              moveType: 'cross',
              minX,
              maxX,
              speed: 38,
              phase,
              flockDx: Math.round(fdx * 10) / 10,
              flockDy: Math.round(fdy * 10) / 10,
            });
          }
        }
      }
    } else if (biome.id === 'playa' && chunkIndex % 2 === 0) {
      const my = Math.round((y0 + 48 + rng() * (CHUNK_LEN - 96)) * 10) / 10;
      const cxy = centerX(seed, my);
      const hwy = halfW(seed, my);
      obstacles.push({
        id: mkId('m'),
        kind: 'crab',
        x: Math.round(cxy * 10) / 10,
        y: my,
        r: 14,
        height: 16,
        solid: true,
        jumpable: true,
        moving: true,
        moveType: 'cross',
        minX: Math.round((cxy - hwy + 52) * 10) / 10,
        maxX: Math.round((cxy + hwy - 52) * 10) / 10,
        speed: 55,
        phase: Math.round(rng() * 10 * 100) / 100,
      });
    } else if (biome.id === 'volcan' && chunkIndex % 2 === 1) {
      const my = Math.round((y0 + 48 + rng() * (CHUNK_LEN - 96)) * 10) / 10;
      const cxy = centerX(seed, my);
      const hwy = halfW(seed, my);
      const gx = Math.round((cxy + (rng() * 2 - 1) * (hwy - 68)) * 10) / 10;
      obstacles.push({
        id: mkId('m'),
        kind: 'fire',
        skin: 'fire',
        x: gx,
        y: my,
        r: 20,
        height: 55,
        solid: true,
        jumpable: false,
        moving: true,
        moveType: 'fire',
        period: 3.2,
        phase: Math.round(rng() * 3.2 * 100) / 100,
      });
    } else if (biome.id === 'neon' && chunkIndex % 2 === 0) {
      const my = Math.round((y0 + 48 + rng() * (CHUNK_LEN - 96)) * 10) / 10;
      const cxy = centerX(seed, my);
      const hwy = halfW(seed, my);
      obstacles.push({
        id: mkId('m'),
        kind: 'hovercar',
        x: Math.round(cxy * 10) / 10,
        y: my,
        r: 22,
        height: 25,
        solid: true,
        jumpable: true,
        moving: true,
        moveType: 'cross',
        minX: Math.round((cxy - hwy + 56) * 10) / 10,
        maxX: Math.round((cxy + hwy - 56) * 10) / 10,
        speed: 120,
        phase: Math.round(rng() * 8 * 100) / 100,
      });
    } else if (biome.id === 'coliseo' && chunkIndex % 2 === 1) {
      const my = Math.round((y0 + 48 + rng() * (CHUNK_LEN - 96)) * 10) / 10;
      const cxy = centerX(seed, my);
      const hwy = halfW(seed, my);
      const mx = Math.round((cxy + (rng() * 2 - 1) * (hwy - 68)) * 10) / 10;
      obstacles.push({
        id: mkId('m'),
        kind: 'meteor',
        skin: 'meteor',
        x: mx,
        y: my,
        r: 22,
        height: 60,
        solid: true,
        jumpable: false,
        moving: true,
        moveType: 'fire',
        period: 3.4,
        phase: Math.round(rng() * 3.4 * 100) / 100,
      });
    }

    // Rampas de salto adicionales (~1 cada 5 trozos)
    if (rng() < 0.22) {
      const ry = Math.round((y0 + 30 + rng() * (CHUNK_LEN - 90)) * 10) / 10;
      const cxy = centerX(seed, ry);
      const hwy = halfW(seed, ry);
      const rx = Math.round((cxy + (rng() * 2 - 1) * (hwy - 70)) * 10) / 10;
      if (!overlapsExisting(rx, ry + 26, 32, obstacles, 8)) {
        zones.push({
          id: mkId('z'),
          type: 'ramp',
          x0: Math.round((rx - 28) * 10) / 10,
          x1: Math.round((rx + 28) * 10) / 10,
          y0: ry,
          y1: Math.round((ry + 52) * 10) / 10,
        });
      }
    }

    // Franja de turbo en el piso (~1 cada BOOST_SPACING = 900 u)
    if (rng() < CHUNK_LEN / BOOST_SPACING) {
      const by = Math.round((y0 + 36 + rng() * (CHUNK_LEN - 96)) * 10) / 10;
      const cxy = centerX(seed, by);
      const hwy = halfW(seed, by);
      const bx = Math.round((cxy + (rng() * 2 - 1) * (hwy - 70)) * 10) / 10;
      if (!overlapsExisting(bx, by + 32, 34, obstacles, 10)) {
        zones.push({
          id: mkId('z'),
          type: 'boost',
          x0: Math.round((bx - 30) * 10) / 10,
          x1: Math.round((bx + 30) * 10) / 10,
          y0: by,
          y1: Math.round((by + 64) * 10) / 10,
        });
      }
    }

    // Corazón (~1 cada HEART_SPACING = 2.500 u)
    if (rng() < CHUNK_LEN / HEART_SPACING) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const py = Math.round((y0 + 30 + rng() * (CHUNK_LEN - 60)) * 10) / 10;
        const cxy = centerX(seed, py);
        const hwy = halfW(seed, py);
        const px = Math.round((cxy + (rng() * 2 - 1) * (hwy - 48)) * 10) / 10;
        if (overlapsExisting(px, py, 16, obstacles, 12)) continue;
        pickups.push({
          id: mkId('pk'),
          type: 'heart',
          kind: 'heart',
          x: px,
          y: py,
          r: 18,
        });
        break;
      }
    }

    // Escudo (~1 cada SHIELD_SPACING = 1.800 u)
    if (rng() < CHUNK_LEN / SHIELD_SPACING) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const py = Math.round((y0 + 30 + rng() * (CHUNK_LEN - 60)) * 10) / 10;
        const cxy = centerX(seed, py);
        const hwy = halfW(seed, py);
        const px = Math.round((cxy + (rng() * 2 - 1) * (hwy - 48)) * 10) / 10;
        if (overlapsExisting(px, py, 16, obstacles, 12)) continue;
        pickups.push({
          id: mkId('pk'),
          type: 'shield',
          kind: 'shieldpick',
          x: px,
          y: py,
          r: 18,
        });
        break;
      }
    }

    // Fila de 4 cajas de objetos (~1 fila cada BOX_ROW_SPACING = 1.200 u)
    const boxPeriod = Math.max(3, Math.round(BOX_ROW_SPACING / CHUNK_LEN));
    if (chunkIndex % boxPeriod === 2) {
      const by = Math.round((y0 + CHUNK_LEN * 0.5) * 10) / 10;
      const cxy = centerX(seed, by);
      const hwy = halfW(seed, by);
      const span = Math.min(240, hwy * 0.65);
      for (let bi = 0; bi < BOX_ROW_COUNT; bi++) {
        const t = BOX_ROW_COUNT > 1 ? bi / (BOX_ROW_COUNT - 1) - 0.5 : 0;
        const bx = Math.round((cxy + t * span * 2) * 10) / 10;
        if (overlapsExisting(bx, by, 14, obstacles, 6)) continue;
        pickups.push({
          id: mkId('pk'),
          type: 'box',
          kind: 'box',
          x: bx,
          y: by,
          r: 18,
        });
      }
    }
  }

  // Adornos fuera de las paredes laterales (no sólidos)
  const decorKinds = ['windmill2', 'tree', 'bush', 'silo'];
  for (const side of [-1, 1]) {
    const count = 1 + (rng() < 0.65 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const y = Math.round((y0 + 16 + rng() * (CHUNK_LEN - 32)) * 10) / 10;
      const cxy = centerX(seed, y);
      const hwy = halfW(seed, y);
      const distOut = hwy + 36 + rng() * 140;
      const x = Math.round((cxy + side * distOut) * 10) / 10;
      if (x < 24 || x > WORLD_W - 24) continue;
      const kind = decorKinds[Math.floor(rng() * decorKinds.length)];
      decor.push({ id: mkId('d'), kind, x, y, solid: false });
    }
  }

  const chunk = {
    index: chunkIndex,
    y0,
    y1,
    biome,
    obstacles,
    pickups,
    zones,
    platforms,
    decor,
  };

  // Salvaguarda final: si por cualquier motivo no se cumple el pasillo de 90 u, despejar el centro
  if (!verifyFreeCorridor(seed, chunk, MIN_CORRIDOR_W)) {
    chunk.obstacles = chunk.obstacles.filter((o) => {
      const hx = o.w ? o.w * 0.5 : o.r;
      return !overlapsCorridor(o.x, hx + 12, corrMinX, corrMaxX);
    });
  }

  return chunk;
}
