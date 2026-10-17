// Generación procedural de sprites pixel art (sin descargar imágenes)
import { CHARACTERS } from './constants.js';

export function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------- utilidades pixel ----------
function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function ell(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry + 0.0001);
    if (t < 0) continue;
    const half = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}
function disc(ctx, cx, cy, r, col) { ell(ctx, cx, cy, r, r, col); }
function outline(canvas, col = '#120a18') {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  const c = hexToRgb(col);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
export function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${cl(r * f)},${cl(g * f)},${cl(b * f)})`;
}

// ---------- voxels ----------
class Vox {
  constructor() { this.m = new Map(); }
  set(x, y, z, c) { this.m.set(`${x},${y},${z}`, { x, y, z, c }); }
  box(x0, x1, y0, y1, z0, z1, c) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, c);
  }
  sphere(cx, cy, cz, r, c, filter) {
    const R = Math.ceil(r);
    for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) {
      if (x * x + y * y + z * z <= r * r + 0.5) {
        const col = filter ? filter(x, y, z) : c;
        if (col) this.set(cx + x, cy + y, cz + z, col);
      }
    }
  }
  has(x, y, z) { return this.m.has(`${x},${y},${z}`); }
}

function kartModel(ch) {
  const v = new Vox();
  const K = ch.kart, T = ch.trim;
  const tire = '#23222a', hub = '#9aa0ad';
  // ruedas
  v.box(4, 7, -8, -6, 0, 3, tire); v.box(4, 7, 6, 8, 0, 3, tire);
  v.box(-8, -4, -9, -6, 0, 4, tire); v.box(-8, -4, 6, 9, 0, 4, tire);
  v.set(5, -8, 2, hub); v.set(5, 8, 2, hub); v.set(-6, -9, 2, hub); v.set(-6, 9, 2, hub);
  // chasis
  v.box(-7, 7, -5, 5, 1, 2, shade(K, 0.7));
  v.box(-6, 6, -5, 5, 3, 4, K);
  v.box(7, 9, -4, 4, 1, 3, T);
  v.box(10, 10, -3, 3, 1, 2, '#3a3a46');
  v.box(-4, 3, -6, -6, 2, 3, T); v.box(-4, 3, 6, 6, 2, 3, T);
  // asiento, volante, motor
  v.box(-6, -5, -3, 3, 4, 8, '#2a2a38');
  v.box(3, 4, 0, 0, 4, 5, '#2a2a38');
  v.box(2, 2, -2, 2, 6, 6, '#1d1d26');
  v.box(-8, -7, -3, 3, 2, 4, '#6b6f7c');
  v.set(-9, -2, 4, '#c4c8d2'); v.set(-9, 2, 4, '#c4c8d2');
  // personaje
  switch (ch.id) {
    case 'pipo': {
      v.box(-3, 1, -3, 3, 4, 8, '#ffd23a');
      v.box(-2, 0, -5, -4, 6, 8, '#e9b520'); v.box(-2, 0, 4, 5, 6, 8, '#e9b520');
      v.sphere(-1, 0, 12, 4.6, '#ffd23a');
      v.box(3, 6, -1, 1, 10, 11, '#ff8a1e');
      v.set(3, -2, 13, '#111'); v.set(3, 2, 13, '#111');
      v.box(-2, 0, 0, 0, 16, 18, '#e8342c');
      break;
    }
    case 'rocco': {
      v.box(-3, 1, -4, 4, 4, 8, '#8a909c');
      v.box(-2, 1, -6, -5, 5, 9, '#7a808c'); v.box(-2, 1, 5, 6, 5, 9, '#7a808c');
      v.box(-4, 2, -4, 4, 9, 16, '#8a909c');
      v.box(-4, 2, -4, 4, 17, 17, '#5fae4a');
      v.box(-1, 1, -1, 2, 17, 18, '#5fae4a');
      v.box(3, 3, -3, 3, 14, 14, '#646a75');
      v.set(3, -2, 13, '#6ff7ff'); v.set(3, 2, 13, '#6ff7ff');
      v.set(3, -1, 11, '#646a75'); v.set(3, 0, 11, '#646a75'); v.set(3, 1, 11, '#646a75');
      v.set(-4, 3, 12, '#5d636e'); v.set(-4, -2, 10, '#5d636e');
      break;
    }
    case 'lumi': {
      v.box(-3, 0, -2, 2, 4, 8, '#4a2a7a');
      v.sphere(-6, 0, 9, 3.2, '#fff070');
      v.box(-4, -1, -9, -4, 10, 11, '#bfe6ff'); v.box(-4, -1, 4, 9, 10, 11, '#bfe6ff');
      v.sphere(0, 0, 12, 4, '#5b3896');
      v.box(3, 4, -3, -1, 12, 14, '#ffffff'); v.box(3, 4, 1, 3, 12, 14, '#ffffff');
      v.set(4, -2, 13, '#111'); v.set(4, 2, 13, '#111');
      v.box(0, 0, -2, -2, 16, 18, '#2a1840'); v.box(0, 0, 2, 2, 16, 18, '#2a1840');
      v.set(0, -2, 19, '#fff070'); v.set(0, 2, 19, '#fff070');
      break;
    }
    case 'bruno': {
      v.box(-3, 1, -3, 3, 4, 8, '#8a5530');
      v.sphere(-1, 0, 12, 4.8, '#9a6136');
      v.sphere(-1, -4, 16, 1.8, '#9a6136'); v.sphere(-1, 4, 16, 1.8, '#9a6136');
      v.set(-1, -4, 16, '#e0b080'); v.set(-1, 4, 16, '#e0b080');
      v.box(3, 5, -2, 2, 9, 11, '#e0b080');
      v.box(5, 6, -1, 1, 11, 11, '#111');
      v.set(3, -2, 13, '#111'); v.set(3, 2, 13, '#111');
      break;
    }
    case 'nimbo': {
      v.box(-3, 0, -3, 3, 4, 8, '#f4f8ff');
      v.sphere(0, 0, 12, 4, '#ffffff');
      v.sphere(-1, -4, 11, 3, '#eef3fb'); v.sphere(-1, 4, 11, 3, '#eef3fb');
      v.sphere(-3, 0, 15, 3, '#ffffff'); v.sphere(0, -2, 16, 2.5, '#ffffff'); v.sphere(0, 2, 16, 2.5, '#ffffff');
      v.set(4, -2, 12, '#1a2a4a'); v.set(4, 2, 12, '#1a2a4a');
      v.set(4, -3, 10, '#ff9ab8'); v.set(4, 3, 10, '#ff9ab8');
      break;
    }
    case 'chispa': {
      v.box(-3, 1, -3, 3, 4, 8, '#d9612a');
      v.sphere(-8, 0, 9, 3, '#e8752e'); v.sphere(-9, 0, 13, 3.6, '#e8752e'); v.sphere(-8, 0, 17, 3, '#e8752e');
      v.sphere(-7, 0, 19, 2, '#ffd9a0');
      v.sphere(0, 0, 12, 4, '#e8752e');
      v.box(-1, 0, -3, -3, 15, 18, '#c95420'); v.box(-1, 0, 3, 3, 15, 18, '#c95420');
      v.box(3, 4, -2, 2, 10, 11, '#ffd9a0');
      v.set(4, -2, 13, '#111'); v.set(4, 2, 13, '#111');
      v.set(5, 0, 11, '#3a1a10');
      break;
    }
    case 'tito': {
      v.box(-3, 0, -2, 2, 4, 7, '#3fae49');
      v.sphere(-1, 0, 12, 5.6, '#e83a2e');
      v.box(-4, 2, 0, 0, 18, 18, '#2f9a3a'); v.box(-1, -1, -3, 3, 18, 18, '#2f9a3a');
      v.box(-1, -1, 0, 0, 19, 20, '#226b2a');
      v.box(4, 5, -3, -1, 12, 14, '#ffffff'); v.box(4, 5, 1, 3, 12, 14, '#ffffff');
      v.set(5, -2, 13, '#111'); v.set(5, 2, 13, '#111');
      v.box(5, 5, -1, 1, 9, 9, '#7a1010');
      v.set(2, -4, 15, '#ff7a6a'); v.set(1, 4, 9, '#c82a20');
      break;
    }
    case 'gelida': {
      v.box(-3, 1, -3, 3, 4, 8, '#1d1f2e');
      v.box(2, 2, -2, 2, 5, 8, '#ffffff');
      v.sphere(-1, 0, 12, 4.8, null, (x, y, z) => (x >= 2 && z <= 1 && Math.abs(y) <= 3 ? '#ffffff' : '#1d1f2e'));
      v.box(4, 6, -1, 1, 11, 11, '#ffa21e');
      v.set(3, -2, 13, '#111'); v.set(3, 2, 13, '#111');
      v.set(4, -2, 13, '#ffffff'); v.set(4, 2, 13, '#ffffff');
      for (let a = 0; a < 24; a++) {
        const yy = Math.round(Math.sin((a / 24) * Math.PI * 2) * 4), xx = Math.round(Math.cos((a / 24) * Math.PI * 2) * 4) - 1;
        v.set(xx, yy, 8, '#e8342c');
      }
      v.box(-6, -5, 2, 3, 6, 8, '#e8342c');
      break;
    }
    default: break;
  }
  return v;
}

const NEIGH = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function prepareVoxels(v) {
  const list = [];
  for (const vox of v.m.values()) {
    let nx = 0, ny = 0, nz = 0, exposed = 0;
    for (const [dx, dy, dz] of NEIGH) {
      if (!v.has(vox.x + dx, vox.y + dy, vox.z + dz)) { nx += dx; ny += dy; nz += dz; exposed++; }
    }
    if (!exposed) continue;
    const l = Math.hypot(nx, ny, nz) || 1;
    list.push({ ...vox, nx: nx / l, ny: ny / l, nz: nz / l, rgb: parseCol(vox.c) });
  }
  return list;
}
function parseCol(c) {
  if (c.startsWith('rgb')) return c.match(/\d+/g).map(Number);
  return hexToRgb(c);
}

// Renderiza un modelo voxel visto con ángulo relativo theta.
function renderVox(list, theta, size, scale, ax, ay, elev = 0.42) {
  const can = mkCanvas(size, size);
  const ctx = can.getContext('2d');
  const ct = Math.cos(theta), st = Math.sin(theta);
  const ce = Math.cos(elev), se = Math.sin(elev);
  // luz (en espacio de cámara): desde arriba-izquierda-frente
  const L = [-0.45, -0.35, 0.82];
  const pts = list.map((p) => {
    const depth = p.x * ct - p.y * st;
    const right = p.x * st + p.y * ct;
    const ndepth = p.nx * ct - p.ny * st;
    const nright = p.nx * st + p.ny * ct;
    const sy = -(p.z * ce) - depth * se;
    const dz = depth * ce - p.z * se;
    // normal: componente hacia cámara = -ndepth
    const lum = 0.62 + 0.45 * Math.max(0, nright * L[0] + p.nz * L[2] * 0.9 + -ndepth * 0.35);
    return { right, sy, dz, rgb: p.rgb, lum };
  });
  pts.sort((a, b) => b.dz - a.dz);
  const s = Math.ceil(scale) + 1;
  for (const p of pts) {
    const r = Math.min(255, p.rgb[0] * p.lum) | 0, g = Math.min(255, p.rgb[1] * p.lum) | 0, b = Math.min(255, p.rgb[2] * p.lum) | 0;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.round(ax + p.right * scale - s / 2), Math.round(ay + p.sy * scale - s / 2), s, s);
  }
  return outline(can);
}

export const KART_FRAMES = 24;
export const KART_SPRITE = { size: 48, ax: 24, ay: 34, worldPerPx: 0.8 };

let cache = null;

export function getSprites() {
  if (cache) return cache;
  const karts = {}, portraits = {};
  for (const ch of CHARACTERS) {
    const list = prepareVoxels(kartModel(ch));
    const frames = [];
    for (let f = 0; f < KART_FRAMES; f++) {
      frames.push(renderVox(list, (f / KART_FRAMES) * Math.PI * 2, KART_SPRITE.size, 1.55, KART_SPRITE.ax, KART_SPRITE.ay));
    }
    karts[ch.id] = frames;
    portraits[ch.id] = renderVox(list, Math.PI + 0.55, 72, 2.6, 36, 56, 0.3);
  }
  cache = { karts, portraits, decor: makeDecor(), items: makeItemIcons(), fx: makeFx() };
  return cache;
}

// Solo retratos (para el celular)
export function getPortraitURLs() {
  const out = {};
  for (const ch of CHARACTERS) {
    const list = prepareVoxels(kartModel(ch));
    out[ch.id] = renderVox(list, Math.PI + 0.55, 72, 2.6, 36, 56, 0.3).toDataURL();
  }
  return out;
}
export function getItemIconURLs() {
  const icons = makeItemIcons();
  const out = {};
  for (const k in icons) out[k] = icons[k].toDataURL();
  return out;
}

// ---------- decoración ----------
// Cada sprite: { c: canvas, w: anchura en mundo, float: altura extra }
function makeDecor() {
  const D = {};
  const add = (name, can, worldW, float = 0) => { D[name] = { c: outline(can), w: worldW, float }; };

  { // árbol
    const c = mkCanvas(32, 42), x = c.getContext('2d');
    rect(x, 14, 28, 5, 13, '#7a4a26'); rect(x, 14, 28, 2, 13, '#9a6234');
    disc(x, 16, 16, 13, '#2f8a2a'); disc(x, 11, 13, 8, '#3fa83a'); disc(x, 20, 10, 7, '#4dbb44'); disc(x, 13, 8, 4, '#6fd25e');
    add('tree', c, 64);
  }
  { // arbusto
    const c = mkCanvas(26, 16), x = c.getContext('2d');
    ell(x, 13, 10, 12, 6, '#2f8a2a'); disc(x, 8, 8, 5, '#3fa83a'); disc(x, 17, 7, 5, '#4dbb44'); disc(x, 9, 6, 2, '#ff6ab0'); disc(x, 18, 9, 2, '#fff06a');
    add('bush', c, 30);
  }
  { // flores
    const c = mkCanvas(14, 10), x = c.getContext('2d');
    rect(x, 3, 5, 1, 5, '#2f8a2a'); rect(x, 9, 4, 1, 6, '#2f8a2a');
    disc(x, 3, 3, 2, '#ff5a7a'); disc(x, 9, 2, 2, '#ffe45c'); rect(x, 3, 3, 1, 1, '#fff'); rect(x, 9, 2, 1, 1, '#ff8a1e');
    add('flower', c, 14);
  }
  { // molino
    const c = mkCanvas(44, 66), x = c.getContext('2d');
    for (let y = 22; y < 66; y++) { const hw = 6 + Math.round((y - 22) * 0.18); rect(x, 22 - hw, y, hw * 2, 1, y % 6 === 0 ? '#d8cdb8' : '#f2ead8'); }
    rect(x, 19, 52, 6, 14, '#7a4a26');
    x.fillStyle = '#c0392b'; x.beginPath(); x.moveTo(14, 23); x.lineTo(22, 12); x.lineTo(30, 23); x.fill();
    x.strokeStyle = '#5a3a20'; x.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      x.beginPath(); x.moveTo(22, 18); x.lineTo(22 + Math.cos(a) * 20, 18 + Math.sin(a) * 20); x.stroke();
      x.fillStyle = '#efe6d2';
      const bx = 22 + Math.cos(a) * 13, by = 18 + Math.sin(a) * 13;
      x.save(); x.translate(bx, by); x.rotate(a); x.fillRect(-7, -3, 14, 6); x.restore();
    }
    disc(x, 22, 18, 2, '#3a2a1a');
    add('windmill', c, 110);
  }
  { // palmera
    const c = mkCanvas(40, 56), x = c.getContext('2d');
    for (let i = 0; i < 9; i++) { rect(x, 18 + Math.round(Math.sin(i * 0.35) * 3), 20 + i * 4, 5, 4, i % 2 ? '#8a5a2a' : '#a8723a'); }
    const leaf = (a, l, col) => { x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); x.moveTo(20, 20); x.quadraticCurveTo(20 + Math.cos(a) * l * 0.6, 14 + Math.sin(a) * l * 0.3 - 6, 20 + Math.cos(a) * l, 20 + Math.sin(a) * l * 0.5 + 4); x.stroke(); };
    [[-2.8, 18, '#2f8a2a'], [-0.3, 18, '#2f8a2a'], [-2.2, 16, '#3fa83a'], [-0.9, 16, '#3fa83a'], [-1.57, 12, '#4dbb44'], [3.4, 14, '#3fa83a']].forEach(([a, l, col]) => leaf(a, l, col));
    disc(x, 18, 22, 2, '#6a3a1a'); disc(x, 22, 23, 2, '#6a3a1a');
    add('palm', c, 80);
  }
  { // sombrilla
    const c = mkCanvas(30, 32), x = c.getContext('2d');
    rect(x, 14, 10, 2, 22, '#e8e2d0');
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff4d5e'; x.beginPath(); x.moveTo(15, 2); x.lineTo(i * 5, 12); x.lineTo(i * 5 + 5, 12); x.fill(); }
    add('umbrella', c, 40);
  }
  { // roca
    const c = mkCanvas(24, 16), x = c.getContext('2d');
    ell(x, 12, 10, 11, 6, '#8d8f99'); ell(x, 10, 8, 7, 4, '#a7a9b3'); disc(x, 8, 7, 2, '#c4c6cf');
    add('rock', c, 28);
  }
  { // pino nevado
    const c = mkCanvas(30, 50), x = c.getContext('2d');
    rect(x, 13, 40, 4, 10, '#5a3a20');
    const tier = (y, hw, h) => { x.fillStyle = '#1f5f3a'; x.beginPath(); x.moveTo(15, y); x.lineTo(15 - hw, y + h); x.lineTo(15 + hw, y + h); x.fill(); x.fillStyle = '#f4f8ff'; x.beginPath(); x.moveTo(15, y); x.lineTo(15 - hw * 0.45, y + h * 0.45); x.lineTo(15 + hw * 0.45, y + h * 0.45); x.fill(); };
    tier(18, 14, 22); tier(9, 11, 18); tier(1, 8, 14);
    add('pine', c, 70);
  }
  { // muñeco de nieve
    const c = mkCanvas(22, 30), x = c.getContext('2d');
    disc(x, 11, 21, 8, '#f4f8ff'); disc(x, 11, 10, 6, '#ffffff');
    rect(x, 6, 2, 10, 3, '#222'); rect(x, 8, 0, 6, 2, '#222');
    rect(x, 9, 9, 1, 1, '#111'); rect(x, 13, 9, 1, 1, '#111'); rect(x, 11, 11, 3, 1, '#ff8a1e');
    rect(x, 5, 15, 12, 2, '#e8342c'); rect(x, 11, 19, 1, 1, '#222'); rect(x, 11, 23, 1, 1, '#222');
    add('snowman', c, 30);
  }
  { // cristal de hielo
    const c = mkCanvas(18, 30), x = c.getContext('2d');
    x.fillStyle = '#9fe6ff'; x.beginPath(); x.moveTo(9, 0); x.lineTo(16, 12); x.lineTo(9, 30); x.lineTo(2, 12); x.fill();
    x.fillStyle = '#e6fbff'; x.beginPath(); x.moveTo(9, 2); x.lineTo(12, 12); x.lineTo(9, 26); x.fill();
    add('crystal', c, 32);
  }
  { // roca de lava
    const c = mkCanvas(26, 20), x = c.getContext('2d');
    ell(x, 13, 12, 12, 7, '#2a2024'); ell(x, 11, 10, 8, 5, '#3a2e33');
    rect(x, 6, 12, 6, 1, '#ff7a1a'); rect(x, 12, 13, 1, 3, '#ff7a1a'); rect(x, 15, 9, 5, 1, '#ffb02e');
    add('lavarock', c, 34);
  }
  { // torre
    const c = mkCanvas(30, 58), x = c.getContext('2d');
    rect(x, 4, 10, 22, 48, '#3a3036');
    for (let y = 12; y < 58; y += 6) for (let i = 0; i < 4; i++) rect(x, 4 + i * 6 + ((y / 6) % 2) * 3, y, 5, 1, '#2a2226');
    for (let i = 0; i < 4; i++) rect(x, 2 + i * 7, 4, 5, 6, '#3a3036');
    rect(x, 12, 22, 6, 9, '#ffb02e'); rect(x, 13, 23, 4, 7, '#ff6a1a');
    add('tower', c, 90);
  }
  { // árbol seco
    const c = mkCanvas(26, 38), x = c.getContext('2d');
    x.strokeStyle = '#1a1416'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(13, 38); x.lineTo(13, 14); x.lineTo(5, 4); x.moveTo(13, 20); x.lineTo(22, 8); x.moveTo(13, 26); x.lineTo(6, 18); x.stroke();
    add('deadtree', c, 48);
  }
  { // cristal estelar
    const c = mkCanvas(20, 32), x = c.getContext('2d');
    x.fillStyle = '#ff4fd8'; x.beginPath(); x.moveTo(10, 0); x.lineTo(18, 14); x.lineTo(10, 32); x.lineTo(2, 14); x.fill();
    x.fillStyle = '#7ff6ff'; x.beginPath(); x.moveTo(10, 3); x.lineTo(14, 14); x.lineTo(10, 28); x.fill();
    add('starcrystal', c, 40, 20);
  }
  { // asteroide
    const c = mkCanvas(26, 22), x = c.getContext('2d');
    ell(x, 13, 11, 12, 10, '#5a5070'); ell(x, 11, 9, 8, 6, '#706690'); disc(x, 16, 13, 3, '#463e5a'); disc(x, 8, 8, 2, '#463e5a');
    add('asteroid', c, 46, 40);
  }
  { // poste neón
    const c = mkCanvas(10, 42), x = c.getContext('2d');
    rect(x, 3, 6, 4, 36, '#2a2050'); rect(x, 4, 6, 2, 36, '#7ff6ff'); disc(x, 5, 4, 4, '#ff4fd8'); disc(x, 5, 4, 2, '#ffffff');
    add('pylon', c, 16);
  }
  { // pilar de la arena
    const c = mkCanvas(48, 70), x = c.getContext('2d');
    rect(x, 6, 10, 36, 56, '#8e7cf0'); rect(x, 6, 10, 8, 56, '#b3a3ff'); rect(x, 34, 10, 8, 56, '#6a58c8');
    rect(x, 2, 2, 44, 10, '#ffd23f'); rect(x, 2, 62, 44, 8, '#ffd23f');
    for (let i = 0; i < 5; i++) { disc(x, 24, 22 + i * 9, 2, '#ffffff'); }
    add('pillar', c, 110);
  }
  { // palco con banderas (arena)
    const c = mkCanvas(30, 40), x = c.getContext('2d');
    rect(x, 14, 4, 2, 36, '#ccc');
    x.fillStyle = '#ff4d5e'; x.beginPath(); x.moveTo(16, 4); x.lineTo(30, 9); x.lineTo(16, 14); x.fill();
    add('flag', c, 34);
  }
  return D;
}

// ---------- iconos de objetos ----------
function makeItemIcons() {
  const I = {};
  { const c = mkCanvas(16, 16), x = c.getContext('2d');
    x.fillStyle = '#e8261e'; x.beginPath(); x.moveTo(4, 5); x.quadraticCurveTo(14, 4, 13, 15); x.quadraticCurveTo(6, 12, 4, 5); x.fill();
    rect(x, 3, 2, 4, 3, '#2f9a3a'); rect(x, 4, 1, 2, 1, '#226b2a'); rect(x, 7, 6, 2, 2, '#ff8a7a');
    I.chile = outline(c); }
  { const c = mkCanvas(16, 16), x = c.getContext('2d');
    ell(x, 8, 11, 7, 4, '#1a1a22'); disc(x, 8, 6, 4, '#1a1a22'); rect(x, 7, 1, 2, 3, '#1a1a22'); rect(x, 5, 9, 3, 1, '#6a6aa0'); rect(x, 6, 5, 1, 2, '#8a8ac0');
    I.aceite = outline(c); }
  { const c = mkCanvas(16, 16), x = c.getContext('2d');
    disc(x, 8, 8, 6, '#ff6ab0'); disc(x, 6, 6, 2, '#ffd0e8'); rect(x, 10, 10, 2, 1, '#d84a90');
    I.chicle = outline(c); }
  { const c = mkCanvas(16, 16), x = c.getContext('2d');
    disc(x, 8, 8, 7, '#7fd8ff'); disc(x, 8, 8, 5, '#c8f0ff'); disc(x, 8, 8, 4, '#9fe6ff'); rect(x, 4, 4, 2, 2, '#ffffff');
    I.burbuja = outline(c); }
  { const c = mkCanvas(16, 16), x = c.getContext('2d');
    x.strokeStyle = '#e8342c'; x.lineWidth = 4; x.beginPath(); x.arc(8, 7, 4.5, Math.PI, 0); x.stroke();
    rect(x, 1, 7, 5, 5, '#e8342c'); rect(x, 10, 7, 5, 5, '#e8342c'); rect(x, 1, 11, 5, 3, '#d8dce6'); rect(x, 10, 11, 5, 3, '#d8dce6');
    I.iman = outline(c); }
  return I;
}

// ---------- efectos / objetos en mundo ----------
function makeFx() {
  const F = {};
  const add = (name, can, w) => { F[name] = { c: can, w }; };
  // caja de objetos (4 cuadros)
  F.box = [];
  const pal = ['#ff4d5e', '#ffd23f', '#3ddc84', '#3fa0ff'];
  for (let f = 0; f < 4; f++) {
    const c = mkCanvas(18, 18), x = c.getContext('2d');
    rect(x, 1, 1, 16, 16, pal[f]); rect(x, 3, 3, 12, 12, pal[(f + 1) % 4]);
    rect(x, 1, 1, 16, 2, 'rgba(255,255,255,0.6)');
    // estrella
    x.fillStyle = '#fff';
    x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.4 : 5.5, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(9 + Math.cos(a) * r, 9 + Math.sin(a) * r); }
    x.fill();
    F.box.push({ c: outline(c), w: 20 });
  }
  { const c = mkCanvas(36, 14), x = c.getContext('2d'); ell(x, 18, 7, 17, 6, '#121218'); ell(x, 14, 5, 7, 2, '#3a3a60'); add('oil', c, 36); }
  { const c = mkCanvas(64, 22), x = c.getContext('2d'); ell(x, 32, 11, 31, 10, '#b8160e'); ell(x, 30, 10, 24, 7, '#e8261e'); ell(x, 22, 7, 6, 2, '#ff8a7a'); disc(x, 44, 12, 3, '#ffe0a0'); add('salsa', c, 72); }
  { const c = mkCanvas(14, 14), x = c.getContext('2d'); disc(x, 7, 7, 6, '#ff6ab0'); disc(x, 5, 5, 2, '#ffd0e8'); add('gum', outline(c), 18); }
  { const c = mkCanvas(22, 22), x = c.getContext('2d'); disc(x, 11, 11, 10, '#f4f8ff'); disc(x, 8, 8, 4, '#ffffff'); disc(x, 14, 15, 3, '#d8e6f5'); add('snow', outline(c), 32); }
  { const c = mkCanvas(16, 14), x = c.getContext('2d');
    x.fillStyle = '#ffb81e'; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.lineTo(8 + Math.cos(a) * 7, 7 + Math.sin(a) * 6.5); } x.fill();
    rect(x, 5, 5, 2, 2, '#ffe080'); rect(x, 9, 7, 2, 2, '#c88a10'); add('honey', outline(c), 20); }
  F.crab = [];
  for (let f = 0; f < 2; f++) {
    const c = mkCanvas(22, 14), x = c.getContext('2d');
    ell(x, 11, 9, 7, 4, '#ff5a2a'); disc(x, 3, f ? 5 : 7, 3, '#ff5a2a'); disc(x, 19, f ? 7 : 5, 3, '#ff5a2a');
    rect(x, 8, 3, 1, 3, '#ff5a2a'); rect(x, 13, 3, 1, 3, '#ff5a2a'); rect(x, 8, 2, 1, 1, '#111'); rect(x, 13, 2, 1, 1, '#111');
    for (let i = 0; i < 3; i++) { rect(x, 5 + i * 2, 12 + (f + i) % 2, 1, 2, '#c83a1a'); rect(x, 15 + i * 2, 12 + (f + i + 1) % 2, 1, 2, '#c83a1a'); }
    F.crab.push({ c: outline(c), w: 26 });
  }
  F.fire = [];
  for (let f = 0; f < 2; f++) {
    const c = mkCanvas(18, 22), x = c.getContext('2d');
    disc(x, 9, 14, 7, '#ff5a14'); disc(x, 9, 15, 5, '#ffb02e'); disc(x, 9, 16, 3, '#fff3a0');
    x.fillStyle = '#ff5a14'; x.beginPath(); x.moveTo(3, 12); x.lineTo(9, f ? 0 : 2); x.lineTo(15, 12); x.fill();
    F.fire.push({ c: outline(c, '#4a0a00'), w: 30 });
  }
  { const c = mkCanvas(20, 64), x = c.getContext('2d');
    x.fillStyle = '#fff6a0'; x.beginPath(); x.moveTo(12, 0); x.lineTo(4, 30); x.lineTo(11, 30); x.lineTo(6, 64); x.lineTo(17, 24); x.lineTo(10, 24); x.lineTo(15, 0); x.fill();
    add('bolt', outline(c, '#ffd23f'), 40); }
  { const c = mkCanvas(32, 32), x = c.getContext('2d');
    x.strokeStyle = 'rgba(160,230,255,0.9)'; x.lineWidth = 2; x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.stroke();
    x.fillStyle = 'rgba(160,230,255,0.25)'; x.fill(); rect(x, 8, 7, 4, 2, '#ffffff'); add('shield', c, 44); }
  { const c = mkCanvas(30, 30), x = c.getContext('2d');
    x.fillStyle = 'rgba(170,230,255,0.55)'; x.fillRect(2, 2, 26, 26); x.strokeStyle = '#e6fbff'; x.lineWidth = 2; x.strokeRect(2, 2, 26, 26);
    rect(x, 5, 5, 6, 2, '#ffffff'); add('ice', c, 40); }
  return F;
}

export function getDecorSpec(kind) {
  return getSprites().decor[kind];
}
