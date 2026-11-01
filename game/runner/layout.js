// Generación determinista del campo infinito de «Supervivencia Estelar» (SIN DOM)
//
// El campo es RECTO: va siempre hacia adelante (+Y), con paredes fijas a los lados.
// Para que se pueda leer, los obstáculos vienen en FILAS: cada fila tapa algunas
// franjas (invisibles) del campo y siempre deja al menos un hueco libre.
import { mulberry32 } from '../geometry.js';
import {
  CHUNK_LEN,
  SAFE_START_CHUNKS,
  MIN_CORRIDOR_W,
  BIOME_LENGTH,
  BIOME_TRANSITION,
  BIOMES,
  DIFF_OBS_DENSITY,
  HEART_SPACING,
  SHIELD_SPACING,
  FIELD_CX,
  FIELD_HW,
  SLOTS,
  SLOT_W,
  WALL_W,
} from './config.js';

// ---------- forma del campo (recta) ----------
export function centerX() { return FIELD_CX; }
export function centerSlope() { return 0; }
export function halfW() { return FIELD_HW; }
export function slotX(i) { return FIELD_CX + (i - (SLOTS - 1) / 2) * SLOT_W; }

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

// ---------- catálogo de obstáculos por bioma ----------
// dw = ancho con el que se dibuja (unidades de mundo); r = radio del choque (más chico que el dibujo: perdona roces)
// low = bajito (se salta con SALTO); tall = alto (hay que esquivarlo o pasarlo con rampa)
const CATALOG = {
  granja: {
    low: [
      { kind: 'haybale', dw: 50, r: 22, height: 18 },
      { kind: 'pumpkin', dw: 40, r: 18, height: 14 },
    ],
    tall: [
      { kind: 'tractor', dw: 64, r: 25, height: 45 },
    ],
    fence: { kind: 'fence', height: 16 },
  },
  playa: {
    low: [{ kind: 'rock', dw: 48, r: 21, height: 16 }],
    tall: [
      { kind: 'palm', dw: 66, r: 23, height: 55 },
      { kind: 'umbrella', dw: 58, r: 24, height: 30 },
    ],
  },
  nieve: {
    low: [{ kind: 'snowman', dw: 44, r: 20, height: 20 }],
    tall: [
      { kind: 'pine', dw: 64, r: 24, height: 52 },
      { kind: 'crystal', dw: 54, r: 23, height: 30 },
    ],
    fence: { kind: 'fence', height: 16 },
  },
  volcan: {
    low: [{ kind: 'lavarock', dw: 50, r: 22, height: 18 }],
    tall: [
      { kind: 'deadtree', dw: 60, r: 23, height: 36 },
      { kind: 'tower', dw: 62, r: 25, height: 60 },
    ],
  },
  jungla: {
    low: [{ kind: 'rock', dw: 48, r: 21, height: 16 }],
    tall: [
      { kind: 'mushroom', dw: 62, r: 25, height: 36 },
      { kind: 'alienplant', dw: 60, r: 24, height: 42 },
    ],
  },
  neon: {
    low: [],
    tall: [
      { kind: 'neonsign', dw: 60, r: 24, height: 34 },
      { kind: 'tower2', dw: 62, r: 25, height: 70 },
    ],
  },
  anillos: {
    low: [{ kind: 'ringrock', dw: 50, r: 22, height: 18, fz: 0 }],
    tall: [
      { kind: 'obelisk', dw: 56, r: 23, height: 50 },
    ],
  },
  coliseo: {
    low: [{ kind: 'spike', dw: 52, r: 22, height: 20 }],
    tall: [
      { kind: 'obelisk', dw: 56, r: 23, height: 50 },
      { kind: 'pillar', dw: 62, r: 25, height: 68 },
    ],
  },
};

// Postes a lo largo de las paredes (marcan bien el borde del campo) y adornos de afuera
const WALL_POSTS = {
  granja: 'post', playa: 'post', nieve: 'pine', volcan: 'lavarock',
  jungla: 'mushroom', neon: 'pylon', anillos: 'pylon', coliseo: 'brazier',
};
const POST_DW = { post: 12, pine: 40, lavarock: 18, mushroom: 26, pylon: 16, brazier: 20 };
const OUTSIDE_DECOR = {
  granja: ['windmill2', 'tree', 'silo', 'barn', 'bush'],
  playa: ['palm', 'umbrella'],
  nieve: ['pine', 'snowman'],
  volcan: ['tower', 'deadtree'],
  jungla: ['alienplant', 'mushroom'],
  neon: ['tower2', 'neonsign'],
  anillos: ['satellite', 'asteroid', 'starcrystal'],
  coliseo: ['stand', 'zorgstatue', 'pillar', 'flag'],
};

function catalogFor(biome) {
  const id = biome.id === 'anillos' ? 'anillos' : biome.id;
  return CATALOG[id] || CATALOG.granja;
}

// Tema que se ve en cierta Y (Anillos usa primero «estelar» y luego «anillos»)
export function themeAt(b) {
  return b.altTheme && b.localY < BIOME_LENGTH / 2 ? b.altTheme : b.theme;
}

// Devuelve el tipo de superficie/peligro en (x, y) dentro de un trozo:
// null (seguro), 'ice' (resbala), 'grass' (frena un poco), 'goo' (frena),
// o 'water' / 'lava' / 'hole' (quita una vida si estás en el piso).
export function isHazardAt(chunk, x, y) {
  if (!chunk || !chunk.zones) return null;
  for (const z of chunk.zones) {
    if (z.type === 'bridge') {
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return null;
    } else if (z.type === 'island') {
      const dx = (x - z.x) / (z.rx || 36);
      const dy = (y - z.y) / (z.ry || 28);
      if (dx * dx + dy * dy <= 1) return null;
    }
  }
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

// Estado determinista de un obstáculo en el instante raceTime (SIN DOM)
export function obstacleStateAt(obs, raceTime = 0) {
  if (!obs || !obs.moving) {
    return { x: obs ? obs.x : 0, y: obs ? obs.y : 0, active: true, warning: false, k: 0, dir: 1, frame: 0 };
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
    if (u < halfPeriod) { cx = minX + u * speed; dir = 1; } else { cx = maxX - (u - halfPeriod) * speed; dir = -1; }
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
    return { x: obs.x, y: obs.y, active, warning, k, phase: ph, period, dir: 1, frame };
  }
  return { x: obs.x, y: obs.y, active: true, warning: false, k: 0, dir: 1, frame: 0 };
}

// Verifica que en el trozo exista al menos un pasillo vertical libre de ancho >= minWidth
export function verifyFreeCorridor(seed, chunk, minWidth = MIN_CORRIDOR_W) {
  void seed;
  const left = FIELD_CX - FIELD_HW + 10;
  const right = FIELD_CX + FIELD_HW - 10;
  let runWidth = 0;
  let maxRun = 0;
  for (let x = left; x <= right; x += 10) {
    let blocked = false;
    for (const o of chunk.obstacles) {
      if (!o.solid || o.moving) continue;
      const hx = o.w ? o.w * 0.5 : o.r;
      if (Math.abs(x - o.x) < hx + 9) { blocked = true; break; }
    }
    if (!blocked && chunk.zones && chunk.zones.length > 0) {
      for (let sy = chunk.y0 + 8; sy < chunk.y1; sy += 12) {
        const hz = isHazardAt(chunk, x, sy);
        if (hz === 'water' || hz === 'lava' || hz === 'hole') { blocked = true; break; }
      }
    }
    if (!blocked) { runWidth += 10; if (runWidth > maxRun) maxRun = runWidth; } else runWidth = 0;
  }
  return maxRun >= minWidth;
}

const r1 = (v) => Math.round(v * 10) / 10;

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateChunk(seed, chunkIndex, difficulty = 1) {
  const y0 = chunkIndex * CHUNK_LEN;
  const y1 = y0 + CHUNK_LEN;
  const ym = (y0 + y1) * 0.5;
  const biome = biomeAt(ym);
  const rng = mulberry32(((seed * 7919) + chunkIndex) >>> 0);
  const cat = catalogFor(biome);

  const obstacles = [];
  const pickups = [];
  const zones = [];
  const platforms = [];
  const decor = [];

  let nextId = 0;
  const mkId = (prefix = '') => `${chunkIndex}:${prefix}${nextId++}`;

  const addObs = (tpl, x, y, extra = {}) => {
    const o = {
      id: mkId('o'), kind: tpl.kind, x: r1(x), y: r1(y), r: tpl.r, dw: tpl.dw,
      height: tpl.height, solid: true, jumpable: tpl.height <= 22, ...extra,
    };
    if (tpl.fz !== undefined) o.fz = tpl.fz;
    if (tpl.kind === 'pumpkin') o.lit = rng() < 0.25;
    obstacles.push(o);
    return o;
  };

  // ¿Empieza un bioma nuevo en este trozo? → arco de bienvenida y trozo despejado
  const bEnd = biomeAt(y1 - 1);
  const biomeStartY = bEnd.rawIndex * BIOME_LENGTH;
  const gateHere = bEnd.rawIndex > 0 && biomeStartY >= y0 && biomeStartY < y1;
  if (gateHere) {
    decor.push({ id: mkId('gate'), kind: 'gate', x: FIELD_CX, y: r1(biomeStartY + 24), solid: false, biomeName: bEnd.name });
  }

  // Avance de la partida (0 al inicio, 1 muy adelante) → filas más seguidas y más tapadas
  const prog = Math.min(1, chunkIndex / 170);
  const dens = DIFF_OBS_DENSITY[difficulty] ?? 1.0;
  const rowY = r1(y0 + 96 + (rng() - 0.5) * 24);
  const freeSlots = [];

  if (chunkIndex >= SAFE_START_CHUNKS && !gateHere) {
    const pRow = Math.min(0.82, (0.42 + 0.4 * prog) * dens);
    const boxChunk = chunkIndex % 7 === 3;
    const hasRow = !boxChunk && rng() < pRow;

    if (hasRow) {
      const r = rng();
      const id = biome.id;
      let pattern = 'blocks';
      if (r < 0.14) pattern = 'zone';
      else if (r < 0.26 && chunkIndex > 5) pattern = 'moving';
      else if (r < 0.42 && cat.fence) pattern = 'fence';
      else if (r < 0.52 && id === 'granja' && chunkIndex > 6) pattern = 'barn';

      if (pattern === 'zone') {
        // Franja de terreno especial que cruza el campo
        const zy0 = r1(rowY - 36);
        const zy1 = r1(rowY + 36);
        if (id === 'nieve') {
          // lago congelado de pared a pared: resbala, pero es seguro
          zones.push({ id: mkId('z'), type: 'water', frozen: true, x0: FIELD_CX - FIELD_HW, x1: FIELD_CX + FIELD_HW, y0: r1(zy0 - 20), y1: r1(zy1 + 20) });
          const s = Math.floor(rng() * SLOTS);
          addObs(cat.tall[0], slotX(s), rowY);
          for (let i = 0; i < SLOTS; i++) if (i !== s) freeSlots.push(i);
        } else if (id === 'jungla') {
          const a = Math.floor(rng() * (SLOTS - 2));
          zones.push({ id: mkId('z'), type: 'goo', x0: r1(slotX(a) - SLOT_W / 2), x1: r1(slotX(a + 2) + SLOT_W / 2), y0: zy0, y1: zy1 });
          for (let i = 0; i < SLOTS; i++) freeSlots.push(i);
        } else if (id === 'neon' || id === 'coliseo') {
          pattern = 'blocks';
        } else {
          // agua / lava / hueco que tapa 3 o 4 franjas; deja 1 seca y a veces un puente
          const type = id === 'volcan' ? 'lava' : id === 'anillos' ? 'hole' : 'water';
          const n = rng() < 0.5 + 0.3 * prog ? 4 : 3;
          const a = Math.floor(rng() * (SLOTS - n + 1));
          const frozen = id === 'granja' && rng() < 0.35;
          zones.push({ id: mkId('z'), type, frozen, x0: r1(slotX(a) - SLOT_W / 2), x1: r1(slotX(a + n - 1) + SLOT_W / 2), y0: zy0, y1: zy1 });
          for (let i = 0; i < SLOTS; i++) if (i < a || i >= a + n) freeSlots.push(i);
          if (!frozen && n >= 3 && rng() < 0.6) {
            const b = a + 1 + Math.floor(rng() * (n - 2));
            zones.push({ id: mkId('z'), type: 'bridge', x0: r1(slotX(b) - 24), x1: r1(slotX(b) + 24), y0: r1(zy0 - 6), y1: r1(zy1 + 6) });
            freeSlots.push(b);
          }
          if (id === 'granja' && !frozen) {
            // islita en medio del lago (segura)
            const ix = slotX(a + (n - 1) / 2);
            zones.push({ id: mkId('z'), type: 'island', x: r1(ix), y: rowY, rx: 26, ry: 20, x0: r1(ix - 26), x1: r1(ix + 26), y0: r1(rowY - 20), y1: r1(rowY + 20) });
          }
        }
      }

      if (pattern === 'moving') {
        const minX = FIELD_CX - FIELD_HW + 30;
        const maxX = FIELD_CX + FIELD_HW - 30;
        const phase = r1(rng() * 12);
        if (id === 'granja' && rng() < 0.5) {
          obstacles.push({ id: mkId('m'), kind: 'tractor_side', dw: 62, x: FIELD_CX, y: rowY, r: 20, height: 42, solid: true, jumpable: false, moving: true, moveType: 'cross', minX, maxX, speed: 55, phase });
        } else if (id === 'granja' || id === 'nieve') {
          const n = 3;
          for (let s = 0; s < n; s++) {
            obstacles.push({ id: mkId('m'), kind: 'sheep', dw: 26, x: FIELD_CX, y: rowY, r: 10, height: 16, solid: true, jumpable: true, moving: true, moveType: 'cross', minX: minX + 30, maxX: maxX - 30, speed: 34, phase, flockDx: (s - 1) * 24, flockDy: 0 });
          }
        } else if (id === 'playa' || id === 'jungla') {
          obstacles.push({ id: mkId('m'), kind: 'crab', dw: 30, x: FIELD_CX, y: rowY, r: 12, height: 16, solid: true, jumpable: true, moving: true, moveType: 'cross', minX, maxX, speed: 50, phase });
        } else if (id === 'neon') {
          obstacles.push({ id: mkId('m'), kind: 'hovercar', dw: 50, x: FIELD_CX, y: rowY, r: 18, height: 25, solid: true, jumpable: true, moving: true, moveType: 'cross', minX, maxX, speed: 80, phase });
        } else {
          // géiseres o meteoritos con aviso (sombra que crece) en 2 franjas
          const sl = shuffle(rng, [0, 1, 2, 3, 4]).slice(0, 2);
          for (const s of sl) {
            obstacles.push({ id: mkId('m'), kind: id === 'coliseo' || id === 'anillos' ? 'meteor' : 'fire', skin: id === 'coliseo' || id === 'anillos' ? 'meteor' : 'fire', x: r1(slotX(s)), y: rowY, r: 18, height: 55, solid: true, jumpable: false, moving: true, moveType: 'fire', period: 3.2, phase: r1(rng() * 3.2) });
          }
        }
        for (let i = 0; i < SLOTS; i++) freeSlots.push(i);
      }

      if (pattern === 'fence') {
        // cerca bajita de 4 franjas: se salta o se busca el hueco
        const gap = rng() < 0.5 ? 0 : SLOTS - 1;
        for (let i = 0; i < SLOTS; i++) {
          if (i === gap) { freeSlots.push(i); continue; }
          addObs({ kind: cat.fence.kind, dw: SLOT_W + 2, r: SLOT_W / 2, height: cat.fence.height }, slotX(i), rowY, { w: SLOT_W, h: 12 });
        }
      }

      if (pattern === 'barn') {
        // granero de 2 franjas con rampa delante para subir al techo
        const a = Math.floor(rng() * (SLOTS - 1));
        const bx = (slotX(a) + slotX(a + 1)) / 2;
        const bw = SLOT_W * 2 - 10;
        const bh = 96;
        const by = rowY + bh / 2 - 10;
        const barn = addObs({ kind: 'barn', dw: bw + 6, r: bw / 2, height: 60 }, bx, by, { w: bw, h: bh });
        barn.jumpable = false;
        platforms.push({ id: mkId('pl'), obsId: barn.id, kind: 'barn_roof', x0: r1(bx - bw / 2), x1: r1(bx + bw / 2), y0: r1(by - bh / 2), y1: r1(by + bh / 2), h: 60 });
        zones.push({ id: mkId('z'), type: 'ramp', x0: r1(bx - 30), x1: r1(bx + 30), y0: r1(by - bh / 2 - 74), y1: r1(by - bh / 2 - 26) });
        for (let i = 0; i < SLOTS; i++) if (i !== a && i !== a + 1) freeSlots.push(i);
        if (rng() < 0.5 && freeSlots.length > 1) {
          const s = freeSlots.splice(Math.floor(rng() * freeSlots.length), 1)[0];
          addObs(cat.low[0] || cat.tall[0], slotX(s), rowY);
        }
      }

      if (pattern === 'blocks') {
        // 2 a 4 franjas tapadas, siempre queda al menos 1 libre
        let nBlock = 2;
        if (rng() < 0.3 + 0.5 * prog) nBlock++;
        if (prog > 0.4 && rng() < 0.3 * prog) nBlock++;
        nBlock = Math.min(SLOTS - 1, nBlock);
        const order = shuffle(rng, [0, 1, 2, 3, 4]);
        const blocked = order.slice(0, nBlock);
        for (let i = 0; i < SLOTS; i++) if (!blocked.includes(i)) freeSlots.push(i);
        let rampDone = false;
        for (const s of blocked) {
          const useLow = cat.low.length && rng() < 0.4;
          const tpl = useLow ? cat.low[Math.floor(rng() * cat.low.length)] : cat.tall[Math.floor(rng() * cat.tall.length)];
          addObs(tpl, slotX(s) + (rng() - 0.5) * 6, rowY + (rng() - 0.5) * 12);
          // de vez en cuando, una rampa delante de un obstáculo alto para saltarlo
          if (!useLow && !rampDone && rng() < 0.16) {
            rampDone = true;
            zones.push({ id: mkId('z'), type: 'ramp', x0: r1(slotX(s) - 26), x1: r1(slotX(s) + 26), y0: r1(rowY - 92), y1: r1(rowY - 46) });
          }
        }
      }

      // turbo en el piso dentro de un hueco libre (premia ir por el hueco)
      if (freeSlots.length && rng() < 0.28) {
        const s = freeSlots[Math.floor(rng() * freeSlots.length)];
        zones.push({ id: mkId('z'), type: 'boost', x0: r1(slotX(s) - 22), x1: r1(slotX(s) + 22), y0: r1(rowY - 110), y1: r1(rowY - 60) });
      }
    } else if (boxChunk) {
      // fila de cajas de objetos
      const skip = Math.floor(rng() * SLOTS);
      for (let i = 0; i < SLOTS; i++) {
        if (i === skip) continue;
        pickups.push({ id: mkId('pk'), type: 'box', kind: 'box', x: r1(slotX(i)), y: rowY, r: 18 });
      }
    } else if ((biome.id === 'granja' || biome.id === 'jungla') && rng() < 0.6) {
      // trigo / pasto alto (frena un poquito y deja surco)
      const a = Math.floor(rng() * 3);
      const n = 2 + Math.floor(rng() * 2);
      zones.push({ id: mkId('z'), type: 'grass', jungle: biome.id === 'jungla', x0: r1(slotX(a) - SLOT_W / 2), x1: r1(slotX(Math.min(SLOTS - 1, a + n - 1)) + SLOT_W / 2), y0: r1(y0 + 20), y1: r1(y1 - 20) });
    }

    // Corazón (raro) y escudo, en un hueco libre de la fila
    const placePickup = (type, kind) => {
      const s = freeSlots.length ? freeSlots[Math.floor(rng() * freeSlots.length)] : Math.floor(rng() * SLOTS);
      pickups.push({ id: mkId('pk'), type, kind, x: r1(slotX(s)), y: rowY, r: 18 });
    };
    if (rng() < CHUNK_LEN / HEART_SPACING) placePickup('heart', 'heart');
    else if (rng() < CHUNK_LEN / SHIELD_SPACING) placePickup('shield', 'shieldpick');
  }

  // Postes en las paredes (marcan el borde) y adornos afuera (nunca dentro del campo)
  const postKind = WALL_POSTS[biome.id] || 'post';
  for (let py = y0; py < y1; py += 48) {
    for (const side of [-1, 1]) {
      decor.push({ id: mkId('p'), kind: postKind, dw: POST_DW[postKind], x: r1(FIELD_CX + side * (FIELD_HW + WALL_W * 0.55)), y: r1(py), solid: false, post: true });
    }
  }
  const outKinds = OUTSIDE_DECOR[biome.id] || OUTSIDE_DECOR.granja;
  for (const side of [-1, 1]) {
    if (rng() < 0.75) {
      const kind = outKinds[Math.floor(rng() * outKinds.length)];
      const dist = FIELD_HW + 80 + rng() * 220;
      decor.push({ id: mkId('d'), kind, x: r1(FIELD_CX + side * dist), y: r1(y0 + rng() * CHUNK_LEN), solid: false });
    }
  }

  const chunk = { index: chunkIndex, y0, y1, biome, theme: themeAt(biome), obstacles, pickups, zones, platforms, decor };

  // Salvaguarda: si algo dejara el campo sin paso, quitar obstáculos estáticos de la franja más libre
  if (!verifyFreeCorridor(seed, chunk, MIN_CORRIDOR_W)) {
    const s = freeSlots.length ? freeSlots[0] : 2;
    const sx = slotX(s);
    chunk.obstacles = chunk.obstacles.filter((o) => o.moving || Math.abs(o.x - sx) > (o.w ? o.w / 2 : o.r) + SLOT_W / 2);
    chunk.zones = chunk.zones.filter((z) => !((z.type === 'water' && !z.frozen) || z.type === 'lava' || z.type === 'hole') || sx < z.x0 - 40 || sx > z.x1 + 40);
  }

  return chunk;
}
