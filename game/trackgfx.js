// Construye la textura del piso (2048x2048), el fondo del cielo y la decoración
import { MAP_SIZE } from './constants.js';
import { TRACK_DEFS, ARENA_DEF, getCenterline } from './tracks.js';
import { mulberry32, pointAt, SPACING } from './geometry.js';
import { mkCanvas, hexToRgb } from './sprites.js';

export const THEMES = {
  pradera: {
    skyTop: '#3d9bff', skyHor: '#c9ecff', fog: '#cdeeff',
    road: '#6d6f7c', roadNoise: ['#62646f', '#777a86', '#6a6c78'],
    curbA: '#ffffff', curbB: '#e8342c',
    off: '#58b83a', offNoise: ['#4fae35', '#63c445', '#4aa532'],
    wall: '#2d6b28', wallNoise: ['#245a20', '#3a7d33'],
    out: '#4fae35', outNoise: ['#469e30', '#57b83d', '#5fc048', '#3f9a2c'],
    music: 0,
  },
  playa: {
    skyTop: '#29a8ff', skyHor: '#fff0c4', fog: '#ffeec8',
    road: '#b8a284', roadNoise: ['#ac9677', '#c3ad8f', '#b39c7d'],
    curbA: '#ffffff', curbB: '#1fb5c9',
    off: '#f1d48a', offNoise: ['#e8c87a', '#f7dc98', '#ecd086'],
    shallow: '#3cd2e6', foam: '#e8fbff',
    out: '#1b86d0', outNoise: ['#1a7cc2', '#2090da', '#1f8ad4', '#57b5ee'],
    music: 1,
  },
  nieve: {
    skyTop: '#7aa6db', skyHor: '#eaf3ff', fog: '#eef5ff',
    road: '#868ea2', roadNoise: ['#7c8498', '#9199ad', '#8890a4', '#c8d2e6'],
    curbA: '#ffffff', curbB: '#2f6fd8',
    off: '#eef4fd', offNoise: ['#e2eaf6', '#f7fbff', '#d8e3f2'],
    wall: '#c9d9ee', wallNoise: ['#b8cae3', '#dbe7f6'],
    out: '#e9f1fb', outNoise: ['#dfe9f6', '#f3f8ff', '#d5e1f0'],
    ice: '#aee6ff',
    music: 2,
  },
  volcan: {
    skyTop: '#1e0710', skyHor: '#b8361c', fog: '#7a2414',
    road: '#4a3f46', roadNoise: ['#40363c', '#554950', '#3a3036'],
    curbA: '#ff8a1e', curbB: '#2a2024',
    off: '#2b2226', offNoise: ['#241c20', '#33292e', '#2e2428'],
    rim: '#16100f',
    out: '#ff5a14', outNoise: ['#ff4a0e', '#ff7a1e', '#ffb02e', '#e8360a'],
    music: 3,
  },
  estelar: {
    skyTop: '#04020f', skyHor: '#2e1660', fog: '#1a0c38',
    road: '#2a1f5a', roadNoise: ['#251b50', '#30246a', '#2c2160', '#3a2e80'],
    curbA: '#7ff6ff', curbB: '#ff4fd8',
    off: '#170f3a', offNoise: ['#130c30', '#1c1446', '#ffffff'],
    out: '#06041a', outNoise: ['#06041a', '#080622', '#0a0728', '#ffffff'],
    music: 4,
  },
  arena: {
    skyTop: '#3a6fd0', skyHor: '#ffcfa0', fog: '#ffd8b0',
    road: '#c4b6ff', roadNoise: ['#b9aaf8', '#cdc0ff'],
    out: '#3a2a6a', outNoise: ['#33255e', '#402f74'],
    wall: '#ffd23f',
    music: 5,
  },
};

function noiseTile(base, noise, rng, size = 32, density = 0.35, star = false) {
  const c = mkCanvas(size, size);
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * density; i++) {
    const col = noise[Math.floor(rng() * noise.length)];
    if (col === '#ffffff' && (!star || rng() > 0.06)) continue;
    x.fillStyle = col;
    const w = rng() < 0.3 ? 2 : 1;
    x.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), w, 1);
  }
  return c;
}

function strokePath(ctx, cl, width, style, dash) {
  ctx.beginPath();
  for (let i = 0; i <= cl.N; i++) {
    const k = i % cl.N;
    if (i === 0) ctx.moveTo(cl.xs[k], cl.ys[k]); else ctx.lineTo(cl.xs[k], cl.ys[k]);
  }
  ctx.closePath();
  ctx.lineWidth = width;
  ctx.lineJoin = 'round'; ctx.lineCap = dash ? 'butt' : 'round';
  ctx.strokeStyle = style;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function zoneQuad(ctx, cl, w, z, draw) {
  const p = pointAt(cl, z.f, z.c * w);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);
  draw(ctx, z.l, z.hw * w * 2);
  ctx.restore();
}

function toU32(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return new Uint32Array(img.data.buffer);
}

// ---------- fondo del cielo (tira panorámica 2048x80) ----------
function makeSkyStrip(theme, rng) {
  const W = 2048, H = 80;
  const c = mkCanvas(W, H), x = c.getContext('2d');
  const mountains = (base, amp, col, step, rough) => {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
    let y = base;
    for (let i = 0; i <= W; i += step) {
      y = base - Math.abs(Math.sin(i * 0.004 + rng() * 0.3) * amp) - rng() * rough;
      x.lineTo(i, y);
    }
    x.lineTo(W, H); x.closePath(); x.fill();
  };
  const cloud = (cx, cy, s, col) => {
    x.fillStyle = col;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(cx + (i - 2) * 6 * s, cy - (i % 2) * 3 * s, (6 + (i % 2) * 3) * s, 0, Math.PI * 2); x.fill(); }
  };
  if (theme === 'pradera') {
    for (let i = 0; i < 14; i++) cloud(rng() * W, 12 + rng() * 22, 0.8 + rng() * 0.8, 'rgba(255,255,255,0.95)');
    mountains(62, 20, '#7cc96a', 16, 4);
    mountains(72, 10, '#4fae35', 12, 3);
    for (let i = 0; i < 8; i++) { const px = rng() * W; x.fillStyle = '#f2ead8'; x.fillRect(px, 52, 3, 14); x.fillStyle = '#c0392b'; x.fillRect(px - 1, 50, 5, 3); x.fillStyle = '#5a3a20'; x.fillRect(px - 5, 52, 13, 1); x.fillRect(px + 1, 46, 1, 13); }
  } else if (theme === 'playa') {
    x.fillStyle = '#fff4b0'; x.beginPath(); x.arc(700, 30, 14, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 8; i++) cloud(rng() * W, 14 + rng() * 18, 0.7 + rng() * 0.6, 'rgba(255,255,255,0.9)');
    x.fillStyle = '#1b86d0'; x.fillRect(0, 66, W, 14);
    for (let i = 0; i < 6; i++) { const px = rng() * W, s = 20 + rng() * 40; x.fillStyle = '#3c9a5a'; x.beginPath(); x.ellipse(px, 67, s, 8 + rng() * 6, 0, Math.PI, 0); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 60; i++) x.fillRect(rng() * W, 68 + rng() * 10, 6, 1);
  } else if (theme === 'nieve') {
    mountains(70, 46, '#9fb6d6', 24, 8);
    // nieve en picos
    const img = x.getImageData(0, 0, W, H);
    for (let px = 0; px < W; px++) { for (let py = 0; py < H; py++) { const k = (py * W + px) * 4; if (img.data[k + 3] > 0) { for (let q = 0; q < 6 && py + q < 46; q++) { const kk = ((py + q) * W + px) * 4; img.data[kk] = 248; img.data[kk + 1] = 251; img.data[kk + 2] = 255; } break; } } }
    x.putImageData(img, 0, 0);
    mountains(76, 16, '#e6eefa', 14, 4);
  } else if (theme === 'volcan') {
    x.fillStyle = '#3a1a1a'; x.beginPath(); x.moveTo(500, 80); x.lineTo(640, 18); x.lineTo(680, 18); x.lineTo(840, 80); x.fill();
    x.fillStyle = '#ff6a1a'; x.fillRect(640, 16, 40, 4); x.fillRect(655, 20, 6, 30);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(60,40,40,${0.5 - i * 0.07})`; x.beginPath(); x.arc(660 + i * 12, 10 - i * 4, 8 + i * 3, 0, Math.PI * 2); x.fill(); }
    mountains(74, 14, '#2a1416', 10, 6);
    // castillo
    const cx = 1500;
    x.fillStyle = '#1a0f12';
    x.fillRect(cx, 40, 120, 40); x.fillRect(cx - 10, 26, 24, 54); x.fillRect(cx + 106, 26, 24, 54); x.fillRect(cx + 48, 18, 26, 62);
    for (let i = 0; i < 12; i++) x.fillRect(cx + i * 10, 36, 6, 4);
    x.fillStyle = '#ffb02e'; x.fillRect(cx + 56, 30, 8, 10); x.fillRect(cx - 2, 36, 6, 6); x.fillRect(cx + 114, 36, 6, 6);
  } else if (theme === 'estelar') {
    for (let i = 0; i < 260; i++) { x.fillStyle = rng() > 0.85 ? '#ffe45c' : '#ffffff'; x.fillRect(rng() * W, rng() * H, 1, 1); }
    const planet = (px, py, r, a, b) => { x.fillStyle = a; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); x.fillStyle = b; x.beginPath(); x.arc(px - r * 0.3, py - r * 0.3, r * 0.5, 0, Math.PI * 2); x.fill(); };
    planet(400, 34, 18, '#ff4fd8', '#ff9af0'); planet(1300, 22, 10, '#7ff6ff', '#d0fcff'); planet(1800, 50, 24, '#5a3cc8', '#8a6cf0');
    x.strokeStyle = '#ffe45c'; x.lineWidth = 2; x.beginPath(); x.ellipse(1800, 50, 36, 6, -0.2, 0, Math.PI * 2); x.stroke();
    x.fillStyle = 'rgba(255,79,216,0.18)'; x.beginPath(); x.ellipse(900, 40, 160, 18, 0.1, 0, Math.PI * 2); x.fill();
  } else if (theme === 'arena') {
    for (let i = 0; i < 10; i++) cloud(rng() * W, 14 + rng() * 22, 0.8 + rng() * 0.6, 'rgba(255,240,230,0.9)');
    // gradas con público
    x.fillStyle = '#3a2a6a'; x.fillRect(0, 50, W, 30);
    for (let i = 0; i < 700; i++) { x.fillStyle = ['#ff4d5e', '#3fa0ff', '#3ddc84', '#ffd23f', '#ffffff', '#ff8a1e'][Math.floor(rng() * 6)]; x.fillRect(rng() * W, 52 + rng() * 24, 2, 2); }
    x.fillStyle = '#ffd23f'; x.fillRect(0, 76, W, 4);
  }
  return toU32(c);
}

// ---------- textura del piso ----------
export function buildTrack(index) {
  if (index === 'arena') return buildArena();
  const def = TRACK_DEFS[index];
  const th = THEMES[def.theme];
  const cl = getCenterline(index);
  const rng = mulberry32(def.seed);
  const can = mkCanvas(MAP_SIZE, MAP_SIZE);
  const ctx = can.getContext('2d', { willReadFrequently: true });
  const pat = (base, noise, dens, star) => ctx.createPattern(noiseTile(base, noise, rng, 64, dens, star), 'repeat');
  const w = def.w, ow = def.ow;

  const outTile = noiseTile(th.out, th.outNoise, rng, 64, def.theme === 'estelar' ? 0.25 : 0.45, def.theme === 'estelar');
  if (def.theme === 'volcan') {
    const x = outTile.getContext('2d');
    for (let i = 0; i < 14; i++) { x.fillStyle = i % 2 ? '#ffd23f' : '#c82a08'; x.fillRect(Math.floor(rng() * 64), Math.floor(rng() * 64), 3 + Math.floor(rng() * 6), 1); }
  }
  if (def.theme === 'playa') {
    const x = outTile.getContext('2d');
    for (let i = 0; i < 10; i++) { x.fillStyle = '#7ccbf5'; x.fillRect(Math.floor(rng() * 64), Math.floor(rng() * 64), 5, 1); }
  }
  ctx.fillStyle = ctx.createPattern(outTile, 'repeat');
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  // bandas exteriores
  if (def.outside === 'wall') {
    strokePath(ctx, cl, 2 * (w + ow + 14), pat(th.wall, th.wallNoise, 0.5));
    strokePath(ctx, cl, 2 * (w + ow + 3), '#00000044');
  } else if (def.outside === 'water') {
    strokePath(ctx, cl, 2 * (w + ow + 34), th.foam);
    strokePath(ctx, cl, 2 * (w + ow + 30), pat(th.shallow, ['#5ae0f0', '#2fc4da'], 0.3));
  } else if (def.theme === 'volcan') {
    strokePath(ctx, cl, 2 * (w + ow + 5), th.rim);
  } else if (def.theme === 'estelar') {
    strokePath(ctx, cl, 2 * (w + ow + 3), '#7ff6ff');
  }
  strokePath(ctx, cl, 2 * (w + ow), pat(th.off, th.offNoise, 0.4, def.theme === 'estelar'));
  // bordillo
  strokePath(ctx, cl, 2 * (w + 6), th.curbA);
  strokePath(ctx, cl, 2 * (w + 6), th.curbB, [16, 16]);
  // asfalto
  strokePath(ctx, cl, 2 * w, pat(th.road, th.roadNoise, 0.5));
  if (def.theme === 'estelar') {
    strokePath(ctx, cl, 2 * w - 18, '#3a2e8055');
    strokePath(ctx, cl, 2, '#ff4fd866', [10, 22]);
  }

  // línea de meta
  {
    const p = pointAt(cl, 0, 0);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    const sq = 8;
    for (let r = 0; r < 2; r++) for (let k = -Math.ceil(w / sq); k < Math.ceil(w / sq); k++) {
      ctx.fillStyle = (r + k) % 2 === 0 ? '#ffffff' : '#111111';
      ctx.fillRect(-sq + r * sq, k * sq, sq, sq);
    }
    ctx.restore();
  }
  // zonas
  for (const z of def.zones) {
    if (z.type === 'boost') {
      zoneQuad(ctx, cl, w, z, (c, L, W) => {
        c.fillStyle = '#ff8a1e'; c.fillRect(-L / 2, -W / 2, L, W);
        c.fillStyle = '#ffe45c';
        for (let i = 0; i < 3; i++) {
          const x0 = -L / 2 + 3 + i * (L / 3);
          c.beginPath(); c.moveTo(x0, -W / 2 + 3); c.lineTo(x0 + L / 4, 0); c.lineTo(x0, W / 2 - 3); c.lineTo(x0 + 4, W / 2 - 3); c.lineTo(x0 + L / 4 + 4, 0); c.lineTo(x0 + 4, -W / 2 + 3); c.fill();
        }
      });
    } else if (z.type === 'ramp') {
      zoneQuad(ctx, cl, w, z, (c, L, W) => {
        c.fillStyle = '#ffd23f'; c.fillRect(-L / 2, -W / 2, L, W);
        c.fillStyle = '#1a1a22';
        for (let k = -W / 2; k < W / 2; k += 12) { c.beginPath(); c.moveTo(-L / 2, k); c.lineTo(-L / 2 + 6, k); c.lineTo(L / 2, k + 10); c.lineTo(L / 2 - 6, k + 10); c.fill(); }
        c.fillStyle = '#ffffff'; c.fillRect(L / 2 - 3, -W / 2, 3, W);
      });
    } else if (z.type === 'ice') {
      zoneQuad(ctx, cl, w, z, (c, L, W) => {
        c.fillStyle = th.ice; c.beginPath(); c.ellipse(0, 0, L / 2, W / 2, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e6fbff'; for (let i = 0; i < 8; i++) c.fillRect(-L / 2.5 + rng() * L * 0.8, -W / 3 + rng() * W * 0.6, 10, 2);
      });
    }
  }
  // decoración
  const decor = [];
  const bag = [];
  for (const k in def.decor) for (let i = 0; i < def.decor[k]; i++) bag.push(k);
  const minDist = w + ow + (def.outside === 'wall' ? 22 : 12);
  for (let i = 0; i < cl.N; i += 8) {
    for (const side of [-1, 1]) {
      if (rng() < 0.25) continue;
      const lat = side * (minDist + 6 + rng() * 150);
      const nx = -cl.ty[i], ny = cl.tx[i];
      const x = cl.xs[i] + nx * lat + (rng() - 0.5) * 30, y = cl.ys[i] + ny * lat + (rng() - 0.5) * 30;
      if (x < 20 || y < 20 || x > MAP_SIZE - 20 || y > MAP_SIZE - 20) continue;
      let ok = true;
      for (let j = 0; j < cl.N; j += 2) { if ((cl.xs[j] - x) ** 2 + (cl.ys[j] - y) ** 2 < minDist * minDist) { ok = false; break; } }
      if (!ok) continue;
      decor.push({ x, y, kind: bag[Math.floor(rng() * bag.length)] });
    }
  }
  // obstáculos visibles (muñecos de nieve)
  for (const o of def.obstacles) {
    const p = pointAt(cl, o.f, o.c * w);
    decor.push({ x: p.x, y: p.y, kind: o.kind, solid: o.r });
  }

  const sky = makeSkyStrip(def.theme, rng);
  return {
    index, def, theme: def.theme, th, cl, w, ow,
    tex: toU32(can), outer: toU32(outTile),
    sky, skyTop: hexToRgb(th.skyTop), skyHor: hexToRgb(th.skyHor), fog: hexToRgb(th.fog),
    decor,
    minimap: makeMinimap(cl, w, th),
  };
}

function makeMinimap(cl, w, th) {
  const S = 96, k = S / MAP_SIZE;
  const c = mkCanvas(S, S), x = c.getContext('2d');
  x.beginPath();
  for (let i = 0; i <= cl.N; i++) { const j = i % cl.N; const px = cl.xs[j] * k, py = cl.ys[j] * k; if (!i) x.moveTo(px, py); else x.lineTo(px, py); }
  x.lineJoin = 'round';
  x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.stroke();
  x.lineWidth = 4; x.strokeStyle = '#ffffff'; x.stroke();
  x.lineWidth = 2; x.strokeStyle = th.road; x.stroke();
  return c;
}

function buildArena() {
  const def = ARENA_DEF;
  const th = THEMES.arena;
  const rng = mulberry32(def.seed);
  const can = mkCanvas(MAP_SIZE, MAP_SIZE);
  const ctx = can.getContext('2d', { willReadFrequently: true });
  const outTile = noiseTile(th.out, th.outNoise, rng, 64, 0.4);
  ctx.fillStyle = ctx.createPattern(outTile, 'repeat');
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  const { min, max } = def;
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(min - 16, min - 16, max - min + 32, max - min + 32);
  ctx.fillStyle = '#ff4d5e';
  for (let i = min - 16; i < max + 16; i += 32) { ctx.fillRect(i, min - 16, 16, 16); ctx.fillRect(i + 16, max, 16, 16); ctx.fillRect(min - 16, i + 16, 16, 16); ctx.fillRect(max, i, 16, 16); }
  const T = 40;
  for (let y = min; y < max; y += T) for (let x = min; x < max; x += T) {
    ctx.fillStyle = ((x - min) / T + (y - min) / T) % 2 === 0 ? '#c4b6ff' : '#ae9ef2';
    ctx.fillRect(x, y, T, T);
  }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(1024, 1024, 260, 0, Math.PI * 2); ctx.stroke();
  for (const p of def.pillars) {
    ctx.fillStyle = '#5a48b0'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2); ctx.fill();
  }
  const decor = def.pillars.map((p) => ({ x: p.x, y: p.y, kind: 'pillar' }));
  for (let i = 0; i < 28; i++) {
    const t = i / 28, side = i % 4;
    const along = min + (max - min) * ((i * 7) % 28) / 28;
    const off = 60 + rng() * 40;
    let x, y;
    if (side === 0) { x = along; y = min - off; } else if (side === 1) { x = along; y = max + off; } else if (side === 2) { x = min - off; y = along; } else { x = max + off; y = along; }
    decor.push({ x, y, kind: t > 0.5 ? 'flag' : 'tree' });
  }
  const mm = mkCanvas(96, 96), mx = mm.getContext('2d');
  const k = 96 / MAP_SIZE;
  mx.fillStyle = '#ffffff'; mx.fillRect(min * k - 2, min * k - 2, (max - min) * k + 4, (max - min) * k + 4);
  mx.fillStyle = th.road; mx.fillRect(min * k, min * k, (max - min) * k, (max - min) * k);
  mx.fillStyle = '#5a48b0'; for (const p of def.pillars) { mx.beginPath(); mx.arc(p.x * k, p.y * k, p.r * k, 0, Math.PI * 2); mx.fill(); }
  return {
    index: 'arena', def, theme: 'arena', th, arena: true,
    tex: toU32(can), outer: toU32(outTile),
    sky: makeSkyStrip('arena', rng), skyTop: hexToRgb(th.skyTop), skyHor: hexToRgb(th.skyHor), fog: hexToRgb(th.fog),
    decor, minimap: mm,
  };
}

export { SPACING };
