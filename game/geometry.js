// Geometría de pistas: líneas centrales, búsqueda de posición en la pista
// Código puro (sin DOM) para poder usarlo en cualquier lado.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SPACING = 8;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

// Construye la línea central re-muestreada cada SPACING unidades.
export function buildCenterline(pts, startAt) {
  const n = pts.length;
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const steps = 60;
    for (let s = 0; s < steps; s++) dense.push(catmull(p0, p1, p2, p3, s / steps));
  }
  // re-muestreo por longitud de arco
  const out = [];
  let acc = 0;
  out.push(dense[0]);
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    let segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let start = 0;
    while (acc + (segLen - start) >= SPACING) {
      const need = SPACING - acc;
      start += need;
      const t = start / segLen;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      acc = 0;
    }
    acc += segLen - start;
  }
  // evitar punto duplicado al cerrar
  const last = out[out.length - 1];
  if (Math.hypot(last[0] - out[0][0], last[1] - out[0][1]) < SPACING * 0.5) out.pop();

  // rotar para que el índice 0 sea la línea de meta
  let best = 0, bd = Infinity;
  for (let i = 0; i < out.length; i++) {
    const d = Math.hypot(out[i][0] - startAt[0], out[i][1] - startAt[1]);
    if (d < bd) { bd = d; best = i; }
  }
  const rot = out.slice(best).concat(out.slice(0, best));
  const N = rot.length;
  const xs = new Float32Array(N), ys = new Float32Array(N), tx = new Float32Array(N), ty = new Float32Array(N);
  for (let i = 0; i < N; i++) { xs[i] = rot[i][0]; ys[i] = rot[i][1]; }
  for (let i = 0; i < N; i++) {
    const a = (i - 2 + N) % N, b = (i + 2) % N;
    let dx = xs[b] - xs[a], dy = ys[b] - ys[a];
    const l = Math.hypot(dx, dy) || 1;
    tx[i] = dx / l; ty[i] = dy / l;
  }
  // normal = derecha del sentido de marcha: (-ty, tx)
  return { N, xs, ys, tx, ty, length: N * SPACING };
}

// Busca el punto de la línea central más cercano alrededor de un índice previo.
// Devuelve idx (flotante) y d (distancia lateral con signo, + = derecha).
export function locate(cl, x, y, hint, range = 14) {
  const { N, xs, ys } = cl;
  let bestD2 = Infinity, bestI = 0, bestT = 0;
  const h = Math.floor(hint);
  for (let k = -range; k <= range; k++) {
    const i = ((h + k) % N + N) % N;
    const j = (i + 1) % N;
    const ax = xs[i], ay = ys[i];
    const bx = xs[j] - ax, by = ys[j] - ay;
    const px = x - ax, py = y - ay;
    let t = (px * bx + py * by) / (bx * bx + by * by);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const qx = px - bx * t, qy = py - by * t;
    const d2 = qx * qx + qy * qy;
    if (d2 < bestD2) { bestD2 = d2; bestI = i; bestT = t; }
  }
  const i = bestI, j = (i + 1) % N;
  const ax = xs[i], ay = ys[i];
  const bx = xs[j] - ax, by = ys[j] - ay;
  const len = Math.hypot(bx, by) || 1;
  // lado: producto cruz con dirección
  const cross = (bx * (y - ay) - by * (x - ax)) / len;
  return { idx: i + bestT, d: cross, dist: Math.sqrt(bestD2) };
}

// Búsqueda global (lenta) para inicializar
export function locateGlobal(cl, x, y) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < cl.N; i++) {
    const d = (cl.xs[i] - x) ** 2 + (cl.ys[i] - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return locate(cl, x, y, best, 3);
}

export function pointAt(cl, f, lat) {
  // f = fracción de vuelta, lat = desplazamiento lateral en unidades
  const i = ((Math.round(f * cl.N) % cl.N) + cl.N) % cl.N;
  return {
    i,
    x: cl.xs[i] + -cl.ty[i] * lat,
    y: cl.ys[i] + cl.tx[i] * lat,
    a: Math.atan2(cl.ty[i], cl.tx[i]),
  };
}

export function sampleAtIdx(cl, idx) {
  const N = cl.N;
  const i = ((Math.floor(idx) % N) + N) % N;
  const j = (i + 1) % N;
  const t = idx - Math.floor(idx);
  return {
    x: cl.xs[i] + (cl.xs[j] - cl.xs[i]) * t,
    y: cl.ys[i] + (cl.ys[j] - cl.ys[i]) * t,
    tx: cl.tx[i], ty: cl.ty[i],
  };
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
