// Copia de la carrera en el celular: recibe "fotos" del PC y las interpola
// para dibujar la vista del jugador con el mismo motor gráfico.
import { charById } from './constants.js';
import { wrapAngle } from './geometry.js';

export const PROJ_TYPES = ['gum', 'snow', 'honey'];
export const FX_TYPES = ['ring', 'bolt', 'boom'];

// bits de estado de cada kart
export const F = {
  DRIFT_R: 1, DRIFT_L: 2, BOOST: 4, OFF: 8, INVULN: 16, SPIN: 32, FROZEN: 64, SHIELD: 128,
  STICKY: 256, ELIM: 512, FALL: 1024, FINISHED: 2048, LV1: 4096, LV2: 8192,
};

const INTERP_DELAY = 0.09;

export class MirrorSim {
  constructor(init, track) {
    this.track = track;
    this.arena = !!track.arena;
    this.mode = init.mode;
    this.laps = init.laps;
    this.time = 0; this.raceTime = 0; this.started = false; this.countdown = 4.2; this.battleLeft = 0;
    this.karts = init.karts.map(([char, human, slot, boss], i) => ({
      id: i, char, ch: charById(char), human: !!human, slot, boss: boss || 0,
      x: 0, y: 0, z: 0, a: 0, camA: 0, spinVis: 0, drift: 0, driftLevel: 0,
      boostT: 0, surface: 'road', v: 0, invulnT: 0, spinT: 0, frozenT: 0, shieldT: 0, stickyT: 0,
      eliminated: false, balloons: 3, fallT: 0, place: i + 1, lap: 1, finished: false, finishTime: 0,
      flashT: 0, rouletteT: 0, item: null, power: 0, charges: 0,
      message: '', messageT: 0, init: false,
    }));
    this.boxes = init.boxes.map(([x, y]) => ({ x, y, t: 0 }));
    this.hazards = init.hazards.map(([type, period]) => ({ type, period, x: 0, y: 0, phase: 0 }));
    this.projs = []; this.puddles = []; this.effects = []; this.parts = [];
    this.story = init.story || null;
    this.stars = init.stars ? init.stars.map(([x, y]) => ({ x, y, taken: false })) : null;
    this.objectiveText = '';
    this.snaps = [];
    this.offset = null;
  }

  push(s) {
    const now = performance.now() / 1000;
    const off = s.ts - now;
    if (this.offset === null || off > this.offset) this.offset = off;
    else this.offset += (off - this.offset) * 0.03;
    this.snaps.push(s);
    if (this.snaps.length > 12) this.snaps.shift();
    // datos que no se interpolan: se toman de la última foto
    this.raceTime = s.rt; this.started = !!s.st; this.countdown = s.cd; this.battleLeft = s.bl;
    for (let i = 0; i < this.boxes.length; i++) this.boxes[i].t = s.b.charCodeAt(i) === 49 ? 1 : 0;
    this.projs = s.p.map(([t, x, y]) => ({ type: PROJ_TYPES[t], x, y, r: t === 1 ? 15 : t === 2 ? 8 : 9 }));
    this.puddles = s.d.map(([t, x, y, r]) => ({ type: t ? 'salsa' : 'oil', x, y, r }));
    s.h.forEach(([x, y, ph], i) => { const h = this.hazards[i]; if (h) { h.x = x; h.y = y; h.phase = ph; } });
    if (this.stars && s.sr) for (let i = 0; i < this.stars.length; i++) this.stars[i].taken = s.sr.charCodeAt(i) === 49;
    this.effects = s.e.map(([t, x, y, tt, max, r, kart]) => ({ type: FX_TYPES[t], x, y, t: tt, max, r, kart }));
  }

  applyHud(slot, h) {
    const k = this.karts.find((o) => o.human && o.slot === slot);
    if (!k || !h) return;
    k.lap = h.lap; k.finished = !!h.finished; k.finishTime = h.ft || 0;
    k.rouletteT = h.item === '?' ? 1 : 0;
    k.item = h.item && h.item !== '?' ? h.item : null;
    k.power = h.power || 0; k.charges = h.charges || 0;
    k.message = h.msg || ''; k.messageT = h.msg ? 1 : 0;
    k.flashT = h.fl || 0; k.v = h.v || 0;
    this.objectiveText = h.obj || '';
  }

  advance(dt) {
    if (!this.snaps.length) return;
    const now = performance.now() / 1000;
    const rt = now + this.offset - INTERP_DELAY;
    let s0 = this.snaps[0], s1 = this.snaps[this.snaps.length - 1];
    for (let i = 0; i < this.snaps.length - 1; i++) {
      if (this.snaps[i].ts <= rt && this.snaps[i + 1].ts >= rt) { s0 = this.snaps[i]; s1 = this.snaps[i + 1]; break; }
    }
    if (rt >= s1.ts) s0 = s1;
    const span = s1.ts - s0.ts;
    const t = span > 0 ? Math.max(0, Math.min(1, (rt - s0.ts) / span)) : 1;
    this.time = Math.max(this.time, rt);
    this.karts.forEach((k, i) => {
      const a = s0.k[i], b = s1.k[i];
      if (!a || !b) return;
      k.x = a[0] + (b[0] - a[0]) * t;
      k.y = a[1] + (b[1] - a[1]) * t;
      k.z = a[2] + (b[2] - a[2]) * t;
      k.a = a[3] + wrapAngle(b[3] - a[3]) * t;
      k.spinVis = a[4] + (b[4] - a[4]) * t;
      const f = b[5];
      k.drift = f & F.DRIFT_R ? 1 : f & F.DRIFT_L ? -1 : 0;
      k.driftLevel = f & F.LV2 ? 2 : f & F.LV1 ? 1 : 0;
      k.boostT = f & F.BOOST ? 1 : 0;
      k.surface = f & F.OFF ? 'off' : 'road';
      k.invulnT = f & F.INVULN ? 1 : 0;
      k.spinT = f & F.SPIN ? 1 : 0;
      k.frozenT = f & F.FROZEN ? 1 : 0;
      k.shieldT = f & F.SHIELD ? 1 : 0;
      k.stickyT = f & F.STICKY ? 1 : 0;
      k.eliminated = !!(f & F.ELIM);
      k.fallT = f & F.FALL ? 1 : 0;
      k.balloons = b[6];
      k.place = b[7];
      if (!k.init) { k.camA = k.a; k.init = true; }
      k.camA += wrapAngle(k.a - k.camA) * Math.min(1, dt * (k.drift ? 4.2 : 7));
      if (k.v === 0 && !k.human) k.v = 100;
      // efectos locales
      if (k.boostT && Math.random() < 0.7) this.flame(k);
      if (k.driftLevel && Math.random() < 0.6) this.spark(k, k.driftLevel === 2 ? '#ffa21e' : '#59c8ff');
    });
    this.updateParts(dt);
  }

  part(x, y, z, vx, vy, vz, life, col, size = 2) {
    if (this.parts.length > 300) return;
    this.parts.push({ x, y, z, vx, vy, vz, life, max: life, col, size });
  }
  spark(k, col) {
    const ca = Math.cos(k.a), sa = Math.sin(k.a), side = -k.drift;
    for (const s of [-1, 1]) {
      const bx = k.x - ca * 10 + -sa * 8 * s, by = k.y - sa * 10 + ca * 8 * s;
      this.part(bx, by, 1, (Math.random() - 0.5) * 60 + -sa * side * 40, (Math.random() - 0.5) * 60 + ca * side * 40, 40 + Math.random() * 60, 0.25, col, 2);
    }
  }
  flame(k) {
    const ca = Math.cos(k.a), sa = Math.sin(k.a);
    this.part(k.x - ca * 13, k.y - sa * 13, 4 + k.z, -ca * 60 + (Math.random() - 0.5) * 30, -sa * 60 + (Math.random() - 0.5) * 30, 10, 0.22, Math.random() < 0.5 ? '#ffd23f' : '#ff6a1a', 3);
  }
  updateParts(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 300 * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.7; p.vy *= 0.7; }
    }
  }
}

// ---------- lado del PC: armar los mensajes ----------
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

export function raceInitMsg(sim, trackIndex) {
  return {
    t: 'raceinit', track: trackIndex, mode: sim.mode, laps: sim.laps,
    karts: sim.karts.map((k) => [k.char, k.human ? 1 : 0, k.slot, k.boss || 0]),
    boxes: sim.boxes.map((b) => [r1(b.x), r1(b.y)]),
    hazards: sim.hazards.map((h) => [h.type, h.period || 0]),
    stars: sim.stars ? sim.stars.map((s) => [r1(s.x), r1(s.y)]) : null,
    story: sim.story ? { type: sim.story.type, obj: sim.story.obj } : null,
  };
}

export function snapshotMsg(sim, sfx) {
  return {
    t: 'snap', ts: r3(sim.time), rt: r3(sim.raceTime), st: sim.started ? 1 : 0, cd: r3(sim.countdown), bl: r1(sim.battleLeft),
    k: sim.karts.map((k) => {
      let f = 0;
      if (k.drift > 0) f |= F.DRIFT_R; else if (k.drift < 0) f |= F.DRIFT_L;
      if (k.driftLevel === 1) f |= F.LV1; else if (k.driftLevel === 2) f |= F.LV2;
      if (k.boostT > 0) f |= F.BOOST;
      if (k.surface === 'off' && Math.abs(k.v) > 60) f |= F.OFF;
      if (k.invulnT > 0) f |= F.INVULN;
      if (k.spinT > 0) f |= F.SPIN;
      if (k.frozenT > 0) f |= F.FROZEN;
      if (k.shieldT > 0) f |= F.SHIELD;
      if (k.stickyT > 0) f |= F.STICKY;
      if (k.eliminated) f |= F.ELIM;
      if (k.fallT > 0) f |= F.FALL;
      if (k.finished) f |= F.FINISHED;
      return [r1(k.x), r1(k.y), r1(k.z), r3(k.a), r1(k.spinVis), f, k.balloons, k.place];
    }),
    b: sim.boxes.map((b) => (b.t > 0 ? '1' : '0')).join(''),
    p: sim.projs.map((p) => [PROJ_TYPES.indexOf(p.type), r1(p.x), r1(p.y)]),
    d: sim.puddles.map((p) => [p.type === 'oil' ? 0 : 1, r1(p.x), r1(p.y), p.r]),
    h: sim.hazards.map((h) => [r1(h.x), r1(h.y), r3(h.phase || 0)]),
    e: sim.effects.map((e) => [FX_TYPES.indexOf(e.type), r1(e.x), r1(e.y), r3(e.t), e.max, e.r || 0, e.kart === undefined ? -1 : e.kart]),
    sr: sim.stars ? sim.stars.map((x) => (x.taken ? '1' : '0')).join('') : '',
    s: sfx,
  };
}
