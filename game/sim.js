// Simulación de carrera y batalla
import { CHARACTERS, charById, LAPS, ITEM_LIST, BATTLE_TIME } from './constants.js';
import { locate, locateGlobal, pointAt, sampleAtIdx, wrapAngle, SPACING } from './geometry.js';

const KART_R = 9;
const GRAV = 720;
const GEAR_ENDS = [0.24, 0.42, 0.61, 0.8, 1.0];

function emptyInput() {
  return { steer: 0, acc: false, brake: false, drift: false, item: false, power: false };
}

export class Sim {
  constructor({ track, mode, humans, difficulty = 1, kartsTotal = 8, laps = LAPS, botChars = null, demo = false, story = null }) {
    this.demo = demo;
    this.story = story; // { type, boss, goal, hits, time, target }
    this.track = track; // objeto de trackgfx (geometría + gráficos)
    this.mode = mode; // 'race' | 'battle'
    this.arena = !!track.arena;
    this.diff = difficulty;
    this.laps = laps;
    this.time = 0; // tiempo total
    this.raceTime = 0; // desde la largada
    this.countdown = 4.2; // 1.2 s de presentación + 3,2,1
    this.started = false;
    this.done = false;
    this.events = [];
    this.parts = [];
    this.projs = [];
    this.puddles = [];
    this.effects = [];
    this.finishOrder = [];
    this.endTimer = -1;
    this.firstHumanFinish = -1;
    this.battleLeft = BATTLE_TIME;
    this.elimOrder = [];

    // karts
    const used = new Set(humans.map((h) => h.char));
    const free = CHARACTERS.map((c) => c.id).filter((id) => !used.has(id));
    let shuffled = botChars ? botChars.filter((id) => !used.has(id)) : free.sort(() => Math.random() - 0.5);
    if (!shuffled.length) shuffled.push(...free);
    if (story && story.boss) shuffled = [story.boss, ...shuffled.filter((id) => id !== story.boss)];
    const total = Math.max(kartsTotal, humans.length);
    const bots = [];
    for (let i = 0; i < total - humans.length; i++) bots.push(shuffled[i % shuffled.length]);
    this.karts = [];
    bots.forEach((c, i) => {
      const k = this.makeKart(c, false, -1);
      if (story && story.boss && i === 0) {
        k.boss = c === 'baron' ? 2 : 1;
        k.speedMul = [0.93, 0.98, 1.03][difficulty] || 0.98;
        if (story.type === 'chase') k.speedMul = [0.9, 0.94, 0.98][difficulty] || 0.94;
      }
      this.karts.push(k);
    });
    humans.forEach((h) => this.karts.push(this.makeKart(h.char, true, h.slot)));
    // en la historia los jugadores salen adelante, justo detrás del jefe
    if (story) {
      const boss = this.karts.filter((k) => k.boss);
      const hs = this.karts.filter((k) => k.human);
      const rest = this.karts.filter((k) => !k.boss && !k.human);
      this.karts = [...boss, ...hs, ...rest];
      this.karts.forEach((k, i) => { k.id = i; });
    }

    if (this.arena) this.placeArena(); else this.placeGrid();
    this.setupTrackObjects();
    this.setupStory();
    this.rank();
  }

  makeKart(charId, human, slot) {
    const ch = charById(charId);
    const s = ch.stats;
    const k = {
      id: this.karts ? this.karts.length : 0,
      ch, char: ch.id, human, slot,
      maxV: 232 + s.speed * 10, accel: 105 + s.accel * 26, turn: 1.72 + s.handling * 0.15, weight: 0.7 + s.weight * 0.25,
      x: 0, y: 0, a: 0, v: 0, vx: 0, vy: 0, z: 0, vz: 0,
      idx: 0, lat: 0, lap: 0, half: true, finished: false, finishTime: 0, place: 1, progress: 0,
      gear: 1, driftLock: false,
      drift: 0, driftT: 0, driftLevel: 0,
      boostT: 0, spinT: 0, spinVis: 0, frozenT: 0, stickyT: 0, blindT: 0, shieldT: 0, invulnT: 0, flashT: 0,
      fallT: 0, lastSafe: 0, surface: 'road',
      item: null, rouletteT: 0, power: 0, charges: 0, chargesT: 0,
      balloons: 3, eliminated: false, hits: 0,
      input: emptyInput(), prevDrift: false,
      ai: { lane: (Math.random() - 0.5) * 0.9, laneT: 0, itemT: 1 + Math.random() * 3, powerT: 2 + Math.random() * 4, noise: 0, target: null, stuckT: 0 },
      camA: 0, message: '', messageT: 0,
    };
    return k;
  }

  placeGrid() {
    const cl = this.track.cl, w = this.track.w;
    // bots adelante, jugadores atrás (como en los clásicos)
    this.karts.forEach((k, n) => {
      const row = Math.floor(n / 2), col = n % 2;
      const idx = (cl.N - 4 - row * 5) % cl.N;
      const lat = (col ? 1 : -1) * w * 0.42;
      const s = sampleAtIdx(cl, idx);
      k.x = s.x + -s.ty * lat; k.y = s.y + s.tx * lat;
      k.a = Math.atan2(s.ty, s.tx); k.camA = k.a;
      const loc = locateGlobal(cl, k.x, k.y);
      k.idx = loc.idx; k.lat = loc.d; k.lastSafe = k.idx;
      k.lap = 0; k.half = true;
    });
  }

  placeArena() {
    const n = this.karts.length;
    this.karts.forEach((k, i) => {
      const ang = (i / n) * Math.PI * 2 + Math.PI / 4;
      k.x = 1024 + Math.cos(ang) * 340; k.y = 1024 + Math.sin(ang) * 340;
      k.a = ang + Math.PI; k.camA = k.a;
    });
  }

  setupTrackObjects() {
    const t = this.track;
    this.boxes = [];
    this.zones = [];
    this.obstacles = [];
    this.hazards = [];
    if (this.arena) {
      for (const [x, y] of t.def.boxes) this.boxes.push({ x, y, t: 0 });
      return;
    }
    const cl = t.cl, w = t.w, N = cl.N;
    for (const f of t.def.boxes) {
      for (const c of [-0.6, -0.2, 0.2, 0.6]) { const p = pointAt(cl, f, c * w); this.boxes.push({ x: p.x, y: p.y, t: 0 }); }
    }
    for (const z of t.def.zones) {
      const center = z.f * N, half = z.l / 2 / SPACING;
      this.zones.push({ type: z.type, i0: center - half, i1: center + half, d0: (z.c - z.hw) * w, d1: (z.c + z.hw) * w });
    }
    for (const o of t.def.obstacles) { const p = pointAt(cl, o.f, o.c * w); this.obstacles.push({ x: p.x, y: p.y, r: o.r }); }
    for (const h of t.def.hazards) {
      const p = pointAt(cl, h.f, (h.c || 0) * w);
      this.hazards.push({ ...h, x: p.x, y: p.y, bx: p.x, by: p.y, nx: -cl.ty[p.i], ny: cl.tx[p.i], ph: Math.random() * 6, flip: 0 });
    }
  }

  emit(e) { this.events.push(e); }
  sfx(name) { this.emit({ type: 'sfx', name }); }
  say(k, text, t = 1.4) { k.message = text; k.messageT = t; }
  buzz(k, ms) { if (k.human) this.emit({ type: 'buzz', slot: k.slot, ms }); }

  // ------------------------------------------------------------
  step(dt) {
    this.time += dt;
    if (!this.started) {
      const before = this.countdown;
      this.countdown -= dt;
      for (const n of [3, 2, 1]) if (before > n && this.countdown <= n) this.sfx('count');
      if (this.countdown <= 0) { this.started = true; this.sfx('go'); }
      // acelerar en la largada: solo revoluciones
      for (const k of this.karts) k.input = k.human ? k.input : emptyInput();
      this.updateParts(dt);
      return;
    }
    this.raceTime += dt;
    if (this.mode === 'battle') {
      this.battleLeft -= dt;
    }

    for (const k of this.karts) {
      if (!k.human || k.finished || k.autopilot) this.botThink(k, dt);
      this.updateKart(k, dt);
    }
    this.kartCollisions();
    this.updateBoxes(dt);
    if (this.stars) this.updateStars();
    this.updateHazards(dt);
    this.updateProjectiles(dt);
    this.updatePuddles(dt);
    this.updateParts(dt);
    for (let i = this.effects.length - 1; i >= 0; i--) { this.effects[i].t -= dt; if (this.effects[i].t <= 0) this.effects.splice(i, 1); }
    this.rank();
    this.checkEnd(dt);
  }

  // ------------------------------------------------------------
  updateKart(k, dt) {
    const inp = k.input;
    // timers
    k.boostT = Math.max(0, k.boostT - dt);
    k.invulnT = Math.max(0, k.invulnT - dt);
    k.shieldT = Math.max(0, k.shieldT - dt);
    k.stickyT = Math.max(0, k.stickyT - dt);
    k.blindT = Math.max(0, k.blindT - dt);
    k.flashT = Math.max(0, k.flashT - dt);
    k.messageT = Math.max(0, k.messageT - dt);
    if (k.chargesT > 0) { k.chargesT -= dt; if (k.chargesT <= 0) k.charges = 0; }
    if (k.rouletteT > 0) {
      k.rouletteT -= dt;
      if (k.rouletteT <= 0) { k.rouletteT = 0; k.item = this.pickItem(k); this.sfx('itemget'); }
    }
    if (k.eliminated) { k.v *= Math.exp(-3 * dt); k.vx *= Math.exp(-3 * dt); k.vy *= Math.exp(-3 * dt); k.x += k.vx * dt; k.y += k.vy * dt; return; }

    // caída al vacío / agua
    if (k.fallT > 0) {
      k.fallT -= dt;
      k.z -= 160 * dt;
      k.x += k.vx * dt * 0.3; k.y += k.vy * dt * 0.3;
      if (k.fallT <= 0) this.respawn(k);
      return;
    }

    // poder: carga
    if (!k.finished) {
      let rate = this.mode === 'battle' ? 1 / 14 : (1 / 20) * (1 + 0.12 * (k.place - 1));
      if (k.boss) rate *= 1.6;
      if (k.power < 1) { k.power = Math.min(1, k.power + rate * dt); if (k.power >= 1) { this.buzz(k, 60); if (k.human) this.sfx('ready'); } }
    }

    const ctrl = k.spinT <= 0 && k.frozenT <= 0;
    if (ctrl) {
      if (inp.item) this.useItem(k);
      if (inp.power) this.usePower(k);
    }

    // caja siempre automática
    const topV = k.maxV;
    let gearN = 1;
    while (gearN < 5 && k.v > GEAR_ENDS[gearN - 1] * topV * 0.97) gearN++;
    k.gear = gearN;

    // superficie
    let maxV = topV;
    let accel = k.accel;
    const surf = k.surface;
    let grip = 11;
    if (surf === 'off') { maxV *= this.track.theme === 'nieve' ? 0.5 : 0.56; }
    else if (surf === 'shallow') { maxV *= 0.42; }
    else if (surf === 'ice') { grip = 1.7; }
    if (k.stickyT > 0) maxV *= 0.55;
    if (k.blindT > 0 && !k.human) maxV *= 0.85;
    if (!k.human && !k.finished) maxV *= k.boss ? this.bossMul(k) : this.botSpeedMul(k);
    if (k.finished && k.human) maxV *= 0.8;
    if (k.boostT > 0) { maxV = Math.max(maxV, topV * 1.34); accel *= 3; }

    // aceleración
    if (k.frozenT > 0) {
      k.frozenT -= dt; k.v = 0; k.vx *= 0.8; k.vy *= 0.8;
    } else if (k.spinT > 0) {
      k.spinT -= dt; k.spinVis += dt * 16; k.v *= Math.exp(-2.6 * dt);
      if (k.spinT <= 0) k.spinVis = 0;
    } else {
      const air = k.z > 0.5;
      // los jugadores aceleran solos; solo frenan
      const accOn = k.human ? !inp.brake : inp.acc;
      if (accOn && !inp.brake) {
        if (k.v < maxV) k.v = Math.min(maxV, k.v + accel * Math.max(0.22, 1 - k.v / (maxV * 1.12)) * dt * (air ? 0.4 : 1));
        else k.v -= (k.v - maxV) * 2.2 * dt;
      } else if (inp.brake) {
        if (k.v > 0) k.v = Math.max(0, k.v - 330 * dt);
        else k.v = Math.max(-70, k.v - 110 * dt);
      } else {
        k.v -= Math.sign(k.v) * Math.min(Math.abs(k.v), 70 * dt);
        if (k.v > maxV) k.v -= (k.v - maxV) * 2.2 * dt;
      }
      if (k.boostT > 0 && k.v < maxV) k.v = Math.min(maxV, k.v + 600 * dt);

      // derrape
      const steer = Math.max(-1, Math.min(1, inp.steer));
      // derrape simplificado: mantén DERRAPE y gira; las chispas cargan solas
      if (!inp.drift) k.driftLock = false;
      if (inp.drift && !k.driftLock && k.drift === 0 && !air && Math.abs(steer) > 0.2 && k.v > 100) {
        k.drift = Math.sign(steer); k.driftT = 0; k.driftLevel = 0; k.vz = 75; this.sfx('hop');
      }
      if (k.drift !== 0) {
        if (!inp.drift || k.v < 75) {
          if (inp.drift) k.driftLock = true;
          if (k.driftLevel >= 2) { k.boostT = Math.max(k.boostT, 1.05); this.sfx('boost'); this.say(k, '¡MINI TURBO!', 0.7); }
          else if (k.driftLevel === 1) { k.boostT = Math.max(k.boostT, 0.5); this.sfx('boost'); }
          k.drift = 0; k.driftT = 0; k.driftLevel = 0;
        } else {
          const into = steer * k.drift;
          const amt = k.drift * (0.5 + 0.5 * (into + 1) / 2);
          k.a += amt * k.turn * 1.18 * dt;
          k.driftT += dt;
          const lvl = k.driftT > 1.5 ? 2 : k.driftT > 0.7 ? 1 : 0;
          if (lvl > k.driftLevel) { k.driftLevel = lvl; this.sfx(lvl === 2 ? 'spark2' : 'spark1'); this.buzz(k, 25); }
          grip = Math.min(grip, 3.2);
          if (Math.random() < 0.6 && k.driftLevel > 0) this.spark(k, k.driftLevel === 2 ? '#ffa21e' : '#59c8ff');
        }
      } else {
        const sf = Math.min(1, Math.abs(k.v) / 85) * (k.v < 0 ? -1 : 1);
        k.a += steer * k.turn * sf * dt * (air ? 0.5 : 1);
      }
      k.prevDrift = inp.drift;
      if (air) grip = Math.min(grip, 0.7);
    }

    // velocidad real (agarre)
    const dvx = Math.cos(k.a) * k.v, dvy = Math.sin(k.a) * k.v;
    const g = Math.min(1, grip * dt);
    k.vx += (dvx - k.vx) * g; k.vy += (dvy - k.vy) * g;
    k.x += k.vx * dt; k.y += k.vy * dt;

    // altura
    if (k.z > 0 || k.vz > 0) {
      k.vz -= GRAV * dt; k.z += k.vz * dt;
      if (k.z <= 0) { k.z = 0; k.vz = 0; }
    }

    // efectos
    if (k.boostT > 0 && Math.random() < 0.8) this.flame(k);
    if (surf === 'off' && Math.abs(k.v) > 60 && Math.random() < 0.35) this.dust(k);

    // límites del mundo
    if (this.arena) this.arenaBounds(k); else this.trackBounds(k, dt);
    k.camA += wrapAngle(k.a - k.camA) * Math.min(1, dt * (k.drift ? 4.2 : 7));
  }

  trackBounds(k, dt) {
    const t = this.track, cl = t.cl;
    const prevIdx = k.idx;
    const loc = locate(cl, k.x, k.y, k.idx);
    k.idx = loc.idx; k.lat = loc.d;
    const ad = Math.abs(loc.d);
    const w = t.w, ow = t.ow;
    const i = Math.floor(k.idx) % cl.N;
    const nx = -cl.ty[i], ny = cl.tx[i];
    let surf = 'road';
    if (ad > w) surf = 'off';
    if (t.def.outside === 'wall') {
      const lim = w + ow - KART_R;
      if (ad > lim) {
        const sgn = Math.sign(loc.d), ex = ad - lim;
        k.x -= nx * sgn * ex; k.y -= ny * sgn * ex;
        const vn = k.vx * nx + k.vy * ny;
        if (vn * sgn > 0) {
          k.vx -= nx * vn * 1.4; k.vy -= ny * vn * 1.4;
          if (Math.abs(vn) > 50) { k.v *= 0.8; this.sfx('bump'); this.buzz(k, 40); }
        }
      }
    } else if (t.def.outside === 'water') {
      if (ad > w + ow) surf = 'shallow';
      if (ad > w + ow + 30 && k.z <= 0.5) this.startFall(k, 'splash');
    } else {
      if (ad > w + ow + 2 && k.z <= 0.5) this.startFall(k, 'fall');
    }
    // zonas
    if (k.z <= 0.5) {
      for (const z of this.zones) {
        if (!inRange(k.idx, z.i0, z.i1, cl.N) || loc.d < z.d0 || loc.d > z.d1) continue;
        if (z.type === 'boost') { if (k.boostT < 0.8) this.sfx('boost'); k.boostT = Math.max(k.boostT, 0.85); }
        else if (z.type === 'ramp' && k.v > 90) { k.vz = 210 + k.v * 0.25; k.z = 1; this.sfx('jump'); if (k.boostT <= 0) k.boostT = 0.3; }
        else if (z.type === 'ice') surf = 'ice';
      }
    }
    if (surf === 'road' && k.z <= 0.5) k.lastSafe = k.idx;
    k.surface = surf;
    // obstáculos
    for (const o of this.obstacles) {
      const dx = k.x - o.x, dy = k.y - o.y, d = Math.hypot(dx, dy), m = o.r + KART_R;
      if (d < m && k.z < 20) {
        const ux = dx / (d || 1), uy = dy / (d || 1);
        k.x = o.x + ux * m; k.y = o.y + uy * m;
        const vn = k.vx * ux + k.vy * uy;
        if (vn < 0) { k.vx -= ux * vn * 1.6; k.vy -= uy * vn * 1.6; k.v *= 0.55; this.sfx('bump'); this.buzz(k, 50); }
      }
    }
    // vueltas
    if (this.mode === 'race' && !k.finished) {
      const N = cl.N;
      if (prevIdx > N * 0.75 && k.idx < N * 0.25) {
        if (k.half) {
          k.lap++; k.half = false;
          if (k.lap > this.laps) this.finish(k);
          else if (k.lap > 1) {
            if (k.lap === this.laps) { this.say(k, '¡VUELTA FINAL!', 2); if (k.human) this.sfx('final'); }
            else { this.say(k, `VUELTA ${k.lap}`, 1.4); if (k.human) this.sfx('lap'); }
          }
        }
      } else if (prevIdx < N * 0.25 && k.idx > N * 0.75) {
        k.lap--; k.half = true;
      }
      if (k.idx > N * 0.4 && k.idx < N * 0.6) k.half = true;
    }
    k.progress = k.finished ? 1e9 - k.finishTime : k.lap * cl.N + k.idx;
  }

  arenaBounds(k) {
    const d = this.track.def;
    const lo = d.min + KART_R, hi = d.max - KART_R;
    let hit = false;
    if (k.x < lo) { k.x = lo; if (k.vx < 0) { k.vx = -k.vx * 0.5; hit = true; } }
    if (k.x > hi) { k.x = hi; if (k.vx > 0) { k.vx = -k.vx * 0.5; hit = true; } }
    if (k.y < lo) { k.y = lo; if (k.vy < 0) { k.vy = -k.vy * 0.5; hit = true; } }
    if (k.y > hi) { k.y = hi; if (k.vy > 0) { k.vy = -k.vy * 0.5; hit = true; } }
    for (const p of d.pillars) {
      const dx = k.x - p.x, dy = k.y - p.y, dd = Math.hypot(dx, dy), m = p.r + KART_R;
      if (dd < m) {
        const ux = dx / (dd || 1), uy = dy / (dd || 1);
        k.x = p.x + ux * m; k.y = p.y + uy * m;
        const vn = k.vx * ux + k.vy * uy;
        if (vn < 0) { k.vx -= ux * vn * 1.5; k.vy -= uy * vn * 1.5; hit = true; }
      }
    }
    if (hit && Math.abs(k.v) > 60) { k.v *= 0.75; this.sfx('bump'); this.buzz(k, 40); }
    k.surface = 'road';
  }

  startFall(k, kind) {
    if (k.fallT > 0) return;
    k.fallT = 1.3; k.drift = 0; k.boostT = 0;
    this.sfx(kind === 'splash' ? 'splash' : 'fall');
    this.buzz(k, 150);
    if (kind === 'splash') for (let i = 0; i < 14; i++) this.part(k.x, k.y, 2, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 90 + Math.random() * 80, 0.8, '#e8fbff', 2);
  }

  respawn(k) {
    const cl = this.track.cl;
    const idx = Math.floor(k.lastSafe);
    const s = sampleAtIdx(cl, idx);
    k.x = s.x; k.y = s.y; k.a = Math.atan2(s.ty, s.tx); k.camA = k.a;
    k.v = 0; k.vx = 0; k.vy = 0; k.z = 30; k.vz = 0;
    const loc = locate(cl, k.x, k.y, idx);
    k.idx = loc.idx; k.lat = loc.d;
    k.invulnT = 2; k.surface = 'road';
  }

  finish(k) {
    k.finished = true;
    k.finishTime = this.raceTime;
    this.finishOrder.push(k);
    k.place = this.finishOrder.length;
    this.storyOnFinish(k);
    k.drift = 0;
    if (k.human) {
      this.sfx('finish');
      this.say(k, `¡META! ${k.place}º`, 99);
      if (this.firstHumanFinish < 0) this.firstHumanFinish = this.raceTime;
    }
  }

  // ------------------------------------------------------------
  pickItem(k) {
    const n = this.karts.length;
    const p = this.mode === 'battle' ? 0.5 : (k.place - 1) / Math.max(1, n - 1);
    const w = {
      chile: 0.15 + 0.35 * p,
      aceite: 0.33 - 0.22 * p,
      chicle: 0.25,
      burbuja: 0.2 - 0.08 * p,
      iman: 0.04 + 0.2 * p,
    };
    if (this.mode === 'battle') { w.chicle = 0.35; w.aceite = 0.25; }
    let tot = 0; for (const key of ITEM_LIST) tot += w[key];
    let r = Math.random() * tot;
    for (const key of ITEM_LIST) { r -= w[key]; if (r <= 0) return key; }
    return 'chile';
  }

  kartAhead(k) {
    if (this.mode === 'battle') return this.nearestOther(k, true);
    return this.karts.find((o) => o.place === k.place - 1 && !o.eliminated) || null;
  }
  nearestOther(k, alive = true) {
    let best = null, bd = Infinity;
    for (const o of this.karts) {
      if (o === k || (alive && o.eliminated)) continue;
      const d = (o.x - k.x) ** 2 + (o.y - k.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  useItem(k) {
    if (!k.item || k.rouletteT > 0) return;
    const it = k.item;
    k.item = null;
    const ca = Math.cos(k.a), sa = Math.sin(k.a);
    switch (it) {
      case 'chile': k.boostT = Math.max(k.boostT, 1.25); this.sfx('boost'); break;
      case 'aceite': this.puddles.push({ type: 'oil', x: k.x - ca * 24, y: k.y - sa * 24, r: 16, life: 25, owner: k, grace: 0.6 }); this.sfx('drop'); break;
      case 'chicle': this.shoot(k, 'gum', 330, 9, 6); break;
      case 'burbuja': k.shieldT = 9; this.sfx('shield'); break;
      case 'iman': {
        const t = this.mode === 'battle' ? this.karts.filter((o) => o !== k && o.item && !o.eliminated).sort((a, b) => ((a.x - k.x) ** 2 + (a.y - k.y) ** 2) - ((b.x - k.x) ** 2 + (b.y - k.y) ** 2))[0] : this.karts.find((o) => o.place < k.place && o.item);
        if (t) { k.item = t.item; t.item = null; this.say(k, '¡ROBADO!', 1); this.say(t, '¡TE ROBARON!', 1.2); this.buzz(t, 120); }
        else { k.item = 'chile'; }
        this.sfx('magnet');
        break;
      }
      default: break;
    }
  }

  shoot(k, type, speed, r, life) {
    const ca = Math.cos(k.a), sa = Math.sin(k.a);
    const sp = Math.max(k.v, 0) + speed;
    this.projs.push({ type, x: k.x + ca * 20, y: k.y + sa * 20, vx: ca * sp, vy: sa * sp, r, life, owner: k, grace: 0.35, idx: k.idx, z: 4 });
    this.sfx('throw');
  }

  usePower(k) {
    if (k.charges > 0) {
      k.charges--; k.boostT = Math.max(k.boostT, 0.9); this.sfx('boost');
      if (!k.charges) k.chargesT = 0;
      return;
    }
    if (k.power < 1 || k.finished) return;
    k.power = 0;
    const p = k.ch.power;
    this.emit({ type: 'power', kart: k.id, power: p });
    switch (p) {
      case 'aletazo': k.vz = 250; k.z = 1; k.boostT = Math.max(k.boostT, 0.7); k.invulnT = Math.max(k.invulnT, 0.9); this.sfx('jump'); this.say(k, '¡ALETAZO!', 0.8); break;
      case 'temblor': {
        this.effects.push({ type: 'ring', x: k.x, y: k.y, t: 0.8, max: 0.8, r: 160 });
        this.sfx('quake');
        for (const o of this.karts) if (o !== k && Math.hypot(o.x - k.x, o.y - k.y) < 160 && o.z < 12) this.hit(o, 'spin', k);
        break;
      }
      case 'destello': {
        this.sfx('flash');
        const targets = this.mode === 'battle' ? this.karts.filter((o) => o !== k) : this.karts.filter((o) => o.place < k.place);
        for (const o of targets) { if (o.shieldT > 0) continue; o.blindT = 2.3; o.flashT = 2.3; this.buzz(o, 100); }
        this.say(k, '¡DESTELLO!', 0.8);
        break;
      }
      case 'panal': {
        const t = this.kartAhead(k) || this.nearestOther(k);
        const ca = Math.cos(k.a), sa = Math.sin(k.a);
        this.projs.push({ type: 'honey', x: k.x + ca * 18, y: k.y + sa * 18, vx: ca * 420, vy: sa * 420, r: 8, life: 6, owner: k, grace: 0.3, target: t, z: 14 });
        this.sfx('throw');
        break;
      }
      case 'rayo': {
        let t;
        if (this.mode === 'battle') t = this.karts.filter((o) => o !== k && !o.eliminated).sort((a, b) => b.balloons - a.balloons)[0];
        else t = this.karts.find((o) => o.place === (k.place === 1 ? 2 : 1));
        if (t) { this.effects.push({ type: 'bolt', x: t.x, y: t.y, t: 0.5, max: 0.5, kart: t.id }); this.hit(t, 'shock', k); }
        this.sfx('thunder');
        break;
      }
      case 'triple': k.charges = 3; k.chargesT = 10; k.charges--; k.boostT = Math.max(k.boostT, 0.9); this.sfx('boost'); this.say(k, '¡TRIPLE TURBO!', 0.8); break;
      case 'salsa': {
        const ca = Math.cos(k.a), sa = Math.sin(k.a);
        this.puddles.push({ type: 'salsa', x: k.x - ca * 40, y: k.y - sa * 40, r: 34, life: 14, owner: k, grace: 0.8 });
        this.sfx('drop');
        break;
      }
      case 'bola': this.shoot(k, 'snow', 260, 15, 7); break;
      default: break;
    }
  }

  hit(k, kind, src) {
    if (k.eliminated || k.fallT > 0) return false;
    if (k.finished && this.mode === 'race') return false;
    if (k.invulnT > 0) return false;
    if (k.shieldT > 0) { k.shieldT = 0; k.invulnT = 0.7; this.sfx('pop'); this.say(k, '¡ESCUDO!', 0.8); return false; }
    k.drift = 0; k.driftT = 0; k.driftLevel = 0;
    if (kind === 'spin') { k.spinT = 1.0; k.v *= 0.4; }
    else if (kind === 'frozen') { k.frozenT = 1.3; k.v = 0; }
    else if (kind === 'sticky') { k.stickyT = 2.6; k.spinT = 0.45; }
    else if (kind === 'shock') { k.spinT = 1.2; k.v *= 0.2; k.stickyT = 1.3; }
    k.invulnT = (k.spinT || 0) + (k.frozenT || 0) + 0.7;
    k.hits++;
    if (this.story && this.story.type === 'chase' && k.boss && src && src.human && !this.storyState.result) {
      this.storyState.hits++;
      this.say(src, `¡ALCANCE ${this.storyState.hits}/${this.storyState.goal}!`, 1.2);
      if (this.storyState.hits >= this.storyState.goal) this.storyWin();
    }
    this.sfx('hit');
    this.buzz(k, 220);
    if (this.mode === 'battle') {
      k.balloons--;
      this.sfx('balloon');
      if (src && src !== k) this.say(src, '¡PUM! -1 GLOBO', 1);
      if (k.balloons <= 0) {
        k.eliminated = true; k.balloons = 0;
        this.elimOrder.push(k);
        this.say(k, 'ELIMINADO', 99);
        this.sfx('elim');
      }
    }
    return true;
  }

  // ------------------------------------------------------------
  updateBoxes(dt) {
    for (const b of this.boxes) {
      if (b.t > 0) { b.t -= dt; continue; }
      for (const k of this.karts) {
        if (k.eliminated || k.fallT > 0) continue;
        if (Math.abs(k.x - b.x) < 17 && Math.abs(k.y - b.y) < 17 && k.z < 24) {
          b.t = 2.5;
          this.sfx('box');
          for (let i = 0; i < 8; i++) this.part(b.x, b.y, 10, (Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140, 60 + Math.random() * 90, 0.6, ['#ff4d5e', '#ffd23f', '#3ddc84', '#3fa0ff'][i % 4], 2);
          if (!k.item && k.rouletteT <= 0) k.rouletteT = 1.0;
          k.power = Math.min(1, k.power + 0.06);
          break;
        }
      }
    }
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      if (h.type === 'crab') {
        h.ph += dt * h.speed;
        const off = Math.sin(h.ph) * h.amp * this.track.w;
        h.x = h.bx + h.nx * off; h.y = h.by + h.ny * off;
        for (const k of this.karts) if (k.z < 6 && Math.hypot(k.x - h.x, k.y - h.y) < 20) this.hit(k, 'spin', null);
      } else if (h.type === 'fire') {
        const prev = (this.raceTime - dt + h.off) % h.period;
        const now = (this.raceTime + h.off) % h.period;
        h.phase = now;
        if (now < prev) {
          this.effects.push({ type: 'boom', x: h.x, y: h.y, t: 0.5, max: 0.5 });
          this.sfx('boom');
          for (let i = 0; i < 12; i++) this.part(h.x, h.y, 4, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 80 + Math.random() * 120, 0.7, i % 2 ? '#ffb02e' : '#ff5a14', 3);
          for (const k of this.karts) if (k.z < 14 && Math.hypot(k.x - h.x, k.y - h.y) < 34) this.hit(k, 'spin', null);
        }
      }
    }
  }

  updateProjectiles(dt) {
    const t = this.track;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.life -= dt; p.grace -= dt;
      let dead = p.life <= 0;
      if (p.type === 'honey') {
        if (p.target && !p.target.eliminated) {
          const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          const na = cur + Math.max(-4.5 * dt, Math.min(4.5 * dt, wrapAngle(want - cur)));
          const sp = 440;
          p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (this.arena) {
          const d = t.def;
          if (p.x < d.min || p.x > d.max) { p.vx = -p.vx; p.x = Math.max(d.min, Math.min(d.max, p.x)); }
          if (p.y < d.min || p.y > d.max) { p.vy = -p.vy; p.y = Math.max(d.min, Math.min(d.max, p.y)); }
          for (const pl of d.pillars) {
            const dx = p.x - pl.x, dy = p.y - pl.y, dd = Math.hypot(dx, dy);
            if (dd < pl.r + p.r) { const ux = dx / dd, uy = dy / dd; const vn = p.vx * ux + p.vy * uy; p.vx -= 2 * vn * ux; p.vy -= 2 * vn * uy; p.x = pl.x + ux * (pl.r + p.r); p.y = pl.y + uy * (pl.r + p.r); }
          }
        } else {
          const loc = locate(t.cl, p.x, p.y, p.idx);
          p.idx = loc.idx;
          const lim = t.w + t.ow - p.r;
          if (Math.abs(loc.d) > lim) {
            if (t.def.outside === 'wall') {
              const j = Math.floor(p.idx) % t.cl.N, nx = -t.cl.ty[j], ny = t.cl.tx[j];
              const vn = p.vx * nx + p.vy * ny;
              if (vn * Math.sign(loc.d) > 0) { p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny; }
              p.x -= nx * Math.sign(loc.d) * (Math.abs(loc.d) - lim); p.y -= ny * Math.sign(loc.d) * (Math.abs(loc.d) - lim);
            } else if (Math.abs(loc.d) > t.w + t.ow + 10) dead = true;
          }
        }
      }
      if (!dead) {
        for (const k of this.karts) {
          if (k.eliminated || (k === p.owner && p.grace > 0)) continue;
          if (Math.hypot(k.x - p.x, k.y - p.y) < p.r + KART_R && k.z < 22) {
            const kind = p.type === 'snow' ? 'frozen' : p.type === 'honey' ? 'sticky' : 'spin';
            this.hit(k, kind, p.owner);
            dead = true;
            for (let j = 0; j < 8; j++) this.part(p.x, p.y, 8, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 60 + Math.random() * 80, 0.5, p.type === 'snow' ? '#ffffff' : p.type === 'honey' ? '#ffb81e' : '#ff6ab0', 2);
            break;
          }
        }
      }
      if (dead) this.projs.splice(i, 1);
    }
  }

  updatePuddles(dt) {
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.life -= dt; p.grace -= dt;
      if (p.life <= 0) { this.puddles.splice(i, 1); continue; }
      for (const k of this.karts) {
        if (k.z > 4 || k.eliminated || (k === p.owner && p.grace > 0)) continue;
        if (Math.hypot(k.x - p.x, k.y - p.y) < p.r + 6) {
          const done = this.hit(k, 'spin', p.owner);
          if (p.type === 'oil' && done) { this.puddles.splice(i, 1); break; }
        }
      }
    }
  }

  kartCollisions() {
    const K = this.karts;
    for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
      const a = K[i], b = K[j];
      if (a.eliminated || b.eliminated || a.fallT > 0 || b.fallT > 0) continue;
      if (Math.abs(a.z - b.z) > 12) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = KART_R * 2;
      if (d < m && d > 0.01) {
        const ux = dx / d, uy = dy / d, ov = m - d;
        const tw = a.weight + b.weight;
        a.x -= ux * ov * (b.weight / tw); a.y -= uy * ov * (b.weight / tw);
        b.x += ux * ov * (a.weight / tw); b.y += uy * ov * (a.weight / tw);
        const rv = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
        if (rv < 0) {
          const imp = -rv * 1.3;
          a.vx -= ux * imp * (b.weight / tw); a.vy -= uy * imp * (b.weight / tw);
          b.vx += ux * imp * (a.weight / tw); b.vy += uy * imp * (a.weight / tw);
          if (imp > 70) { this.sfx('bump'); this.buzz(a, 30); this.buzz(b, 30); }
          // persecución: chocar al ladrón cuenta como alcance
          if (this.story && this.story.type === 'chase' && imp > 25) {
            if (a.boss && b.human) this.hit(a, 'spin', b);
            else if (b.boss && a.human) this.hit(b, 'spin', a);
          }
          // un kart con turbo y más pesado derriba en batalla
          if (this.mode === 'battle') {
            if (a.boostT > 0 && b.boostT <= 0 && imp > 120) this.hit(b, 'spin', a);
            else if (b.boostT > 0 && a.boostT <= 0 && imp > 120) this.hit(a, 'spin', b);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------
  part(x, y, z, vx, vy, vz, life, col, size = 2) {
    if (this.parts.length > 500) return;
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
  dust(k) {
    const col = { pradera: '#8ad05a', playa: '#f7dc98', nieve: '#ffffff', volcan: '#5a4a4e', estelar: '#ff4fd8' }[this.track.theme] || '#ccc';
    this.part(k.x - Math.cos(k.a) * 10, k.y - Math.sin(k.a) * 10, 2, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, 40 + Math.random() * 40, 0.4, col, 2);
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

  // ------------------------------------------------------------
  botSpeedMul(k) {
    let m = [0.83, 0.92, 0.99][this.diff] || 0.92;
    if (this.mode !== 'race') return m;
    const humans = this.karts.filter((o) => o.human);
    if (!humans.length) return m;
    const N = this.track.cl.N;
    const best = Math.max(...humans.map((h) => h.progress));
    const worst = Math.min(...humans.map((h) => h.progress));
    if (k.progress > best + N * 0.18) m *= 0.92;
    else if (k.progress < worst - N * 0.22) m *= 1.07;
    return m;
  }

  botThink(k, dt) {
    const inp = k.input = emptyInput();
    if (k.eliminated) return;
    const ai = k.ai;
    if (this.arena) return this.botThinkArena(k, dt, inp);
    const cl = this.track.cl, w = this.track.w;
    ai.laneT -= dt;
    if (ai.laneT <= 0) { ai.laneT = 2 + Math.random() * 3; ai.lane = Math.max(-0.75, Math.min(0.75, ai.lane + (Math.random() - 0.5) * 0.6)); }
    const look = 9 + Math.max(0, k.v) / 22;
    const s = sampleAtIdx(cl, k.idx + look);
    let lane = ai.lane;
    // esquivar charcos
    for (const p of this.puddles) {
      const dx = p.x - s.x, dy = p.y - s.y;
      if (dx * dx + dy * dy < (p.r + 40) ** 2) lane = p.x * -s.ty + p.y * s.tx > s.x * -s.ty + s.y * s.tx ? -0.6 : 0.6;
    }
    const tx = s.x + -s.ty * lane * w, ty = s.y + s.tx * lane * w;
    const want = Math.atan2(ty - k.y, tx - k.x);
    const diff = wrapAngle(want - k.a);
    if (k.blindT > 0) ai.noise += (Math.random() - 0.5) * dt * 8; else ai.noise *= 0.9;
    inp.steer = Math.max(-1, Math.min(1, diff * 2.4 + ai.noise));
    inp.acc = true;
    inp.brake = Math.abs(diff) > 1.0 && k.v > 140;
    // atascado
    if (Math.abs(k.v) < 15 && this.started) { ai.stuckT += dt; } else ai.stuckT = 0;
    if (ai.stuckT > 1.5) { inp.acc = false; inp.brake = true; inp.steer = -inp.steer; if (ai.stuckT > 2.6) ai.stuckT = 0; }
    if (k.finished) return;
    // objetos
    if (k.item) {
      ai.itemT -= dt;
      if (ai.itemT <= 0) {
        let use = false;
        if (k.item === 'chile') use = Math.abs(diff) < 0.2;
        else if (k.item === 'burbuja' || k.item === 'iman') use = true;
        else if (k.item === 'aceite') use = this.karts.some((o) => o.place === k.place + 1 && o.progress > k.progress - 30);
        else if (k.item === 'chicle') use = this.karts.some((o) => o.place === k.place - 1 && o.progress - k.progress < 45);
        if (use || ai.itemT < -6) { inp.item = true; ai.itemT = 1 + Math.random() * 3; }
      }
    }
    if (k.power >= 1 || k.charges > 0) {
      ai.powerT -= dt;
      if (ai.powerT <= 0) {
        let use = true;
        if (k.ch.power === 'temblor') use = this.karts.some((o) => o !== k && Math.hypot(o.x - k.x, o.y - k.y) < 130);
        if (k.ch.power === 'triple' || k.charges > 0) use = Math.abs(diff) < 0.25;
        if (use || ai.powerT < -8) { inp.power = true; ai.powerT = 1.5 + Math.random() * 4; }
      }
    }
  }

  botThinkArena(k, dt, inp) {
    const ai = k.ai;
    const d = this.track.def;
    ai.retarget = (ai.retarget || 0) - dt;
    if (ai.retarget <= 0 || !ai.target || (ai.target.k && ai.target.k.eliminated)) {
      ai.retarget = 2 + Math.random() * 2;
      if (!k.item && Math.random() < 0.6) {
        const b = this.boxes.filter((bx) => bx.t <= 0).sort((a, c) => ((a.x - k.x) ** 2 + (a.y - k.y) ** 2) - ((c.x - k.x) ** 2 + (c.y - k.y) ** 2))[0];
        ai.target = b ? { x: b.x, y: b.y } : null;
      } else {
        const o = this.nearestOther(k);
        ai.target = o ? { k: o } : null;
      }
    }
    let tx = 1024, ty = 1024;
    if (ai.target) { tx = ai.target.k ? ai.target.k.x : ai.target.x; ty = ai.target.k ? ai.target.k.y : ai.target.y; }
    let want = Math.atan2(ty - k.y, tx - k.x);
    // evitar pilares y bordes
    const ax = k.x + Math.cos(k.a) * 70, ay = k.y + Math.sin(k.a) * 70;
    let avoid = false;
    if (ax < d.min + 20 || ax > d.max - 20 || ay < d.min + 20 || ay > d.max - 20) avoid = true;
    for (const p of d.pillars) if (Math.hypot(ax - p.x, ay - p.y) < p.r + 22) avoid = true;
    if (avoid) want = Math.atan2(1024 - k.y, 1024 - k.x) + (k.id % 2 ? 0.9 : -0.9);
    const diff = wrapAngle(want - k.a);
    if (k.blindT > 0) ai.noise += (Math.random() - 0.5) * dt * 8; else ai.noise = (ai.noise || 0) * 0.9;
    inp.steer = Math.max(-1, Math.min(1, diff * 2.2 + ai.noise));
    inp.acc = true;
    inp.brake = Math.abs(diff) > 1.6 && k.v > 80;
    if (Math.abs(k.v) < 15) { ai.stuckT += dt; } else ai.stuckT = 0;
    if (ai.stuckT > 1.2) { inp.acc = false; inp.brake = true; inp.steer = 1; if (ai.stuckT > 2.2) ai.stuckT = 0; }
    const tgt = ai.target && ai.target.k;
    if (k.item) {
      ai.itemT -= dt;
      if (ai.itemT <= 0) {
        let use = k.item === 'burbuja' || k.item === 'iman' || k.item === 'chile';
        if (tgt && (k.item === 'chicle') && Math.abs(diff) < 0.3 && Math.hypot(tgt.x - k.x, tgt.y - k.y) < 320) use = true;
        if (k.item === 'aceite') use = Math.random() < 0.5;
        if (use || ai.itemT < -5) { inp.item = true; ai.itemT = 1 + Math.random() * 2; }
      }
    }
    if (k.power >= 1 || k.charges > 0) {
      ai.powerT -= dt;
      if (ai.powerT <= 0) { inp.power = true; ai.powerT = 1 + Math.random() * 3; }
    }
  }

  // ------------------------------------------------------------
  rank() {
    if (this.mode === 'battle') {
      const alive = this.karts.filter((k) => !k.eliminated).sort((a, b) => b.balloons - a.balloons);
      const dead = [...this.elimOrder].reverse();
      [...alive, ...dead].forEach((k, i) => { k.place = i + 1; });
      return;
    }
    const sorted = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((k, i) => { k.place = i + 1; });
  }

  checkEnd(dt) {
    if (this.done || this.demo) return;
    if (this.story) {
      this.storyTick();
      if (this.storyState.result && this.endTimer < 0) this.endTimer = 3;
    }
    if (this.mode === 'battle') {
      const alive = this.karts.filter((k) => !k.eliminated);
      const humansAlive = alive.filter((k) => k.human);
      if (this.endTimer < 0 && (alive.length <= 1 || this.battleLeft <= 0 || humansAlive.length === 0)) {
        this.endTimer = 2.5;
        const win = this.karts.find((k) => k.place === 1);
        if (win) this.say(win, '¡GANASTE!', 99);
        this.sfx('finish');
      }
    } else {
      const humans = this.karts.filter((k) => k.human);
      if (this.endTimer < 0) {
        if (humans.every((h) => h.finished)) { this.endTimer = 3; if (this.story && !this.storyState.result) this.storyLose(); }
        else if (this.firstHumanFinish >= 0 && this.raceTime - this.firstHumanFinish > 45) this.endTimer = 0.5;
      }
    }
    if (this.endTimer >= 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) { this.done = true; this.emit({ type: 'done' }); }
    }
  }

  results() {
    this.rank();
    if (this.story && !this.storyState.result) this.storyLose();
    const N = this.arena ? 1 : this.track.cl.N;
    let lastT = 0;
    return [...this.karts].sort((a, b) => a.place - b.place).map((k) => {
      let time = null;
      if (this.mode === 'race') {
        if (k.finished) time = k.finishTime;
        else {
          // tiempo estimado para los que no alcanzaron a llegar
          const left = Math.max(0, (this.laps + 1) * N - k.progress) * SPACING;
          time = Math.max(lastT + 0.3, this.raceTime + left / 230);
        }
        lastT = time;
      }
      return { place: k.place, char: k.char, human: k.human, slot: k.slot, time, est: this.mode === 'race' && !k.finished, balloons: k.balloons };
    });
  }
}

// ---------------- modo historia ----------------
Object.assign(Sim.prototype, {
  setupStory() {
    const st = this.story;
    this.storyState = null;
    this.objectiveText = '';
    if (!st) return;
    this.storyState = { result: null, collected: 0, goal: st.goal || st.hits || 0, hits: 0, timeLeft: st.time || 0 };
    const boss = this.karts.find((k) => k.boss);
    this.boss = boss || null;
    if (st.type === 'chase' && boss) {
      // el ladrón sale con ventaja
      const cl = this.track.cl;
      const s = sampleAtIdx(cl, (boss.idx + 22) % cl.N);
      boss.x = s.x; boss.y = s.y; boss.a = Math.atan2(s.ty, s.tx); boss.camA = boss.a;
      const loc = locate(cl, boss.x, boss.y, boss.idx + 22);
      boss.idx = loc.idx; boss.lat = loc.d; boss.lastSafe = boss.idx;
      if (boss.idx < cl.N * 0.5) { boss.lap = 1; boss.half = false; }
    }
    if (st.type === 'collect') {
      const cl = this.track.cl, w = this.track.w;
      this.stars = [];
      const n = 18;
      for (let i = 0; i < n; i++) {
        const p = pointAt(cl, 0.04 + (i / n) * 0.95, [-0.5, 0, 0.5, 0.25, -0.25][i % 5] * w);
        this.stars.push({ x: p.x, y: p.y, taken: false });
      }
    }
    this.storyTick();
  },

  updateStars() {
    for (const s of this.stars) {
      if (s.taken) continue;
      for (const k of this.karts) {
        if (!k.human || k.fallT > 0) continue;
        if (Math.abs(k.x - s.x) < 18 && Math.abs(k.y - s.y) < 18 && k.z < 30) {
          s.taken = true;
          this.storyState.collected++;
          this.sfx('itemget');
          this.buzz(k, 40);
          for (let i = 0; i < 8; i++) this.part(s.x, s.y, 12, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 60 + Math.random() * 80, 0.5, '#ffd23f', 2);
          if (this.storyState.collected >= this.storyState.goal && !this.storyState.result) this.storyWin();
          break;
        }
      }
    }
  },

  storyOnFinish(k) {
    const st = this.story;
    if (!st || this.storyState.result) return;
    if (st.type === 'top') {
      if (k.human && k.place <= st.target) this.storyWin();
      else if (this.finishOrder.length >= st.target && !this.finishOrder.slice(0, st.target).some((o) => o.human)) this.storyLose();
    } else if (st.type === 'boss') {
      if (k.human) this.storyWin();
      else if (k.boss) this.storyLose();
    } else if (st.type === 'chase') {
      if (k.boss) this.storyLose();
    } else if (st.type === 'time') {
      if (k.human) this.storyWin();
    }
  },

  storyTick() {
    const st = this.story, ss = this.storyState;
    if (st.type === 'time') {
      ss.timeLeft = Math.max(0, st.time - this.raceTime);
      if (ss.timeLeft <= 0 && !ss.result && this.started) this.storyLose();
    }
    let txt = '';
    if (st.type === 'top') txt = `OBJETIVO: TOP ${st.target}`;
    else if (st.type === 'boss') txt = this.boss ? `JEFE: ${this.boss.place}º` : '';
    else if (st.type === 'collect') txt = `★ ${ss.collected}/${ss.goal}`;
    else if (st.type === 'chase') txt = `ALCANCES ${ss.hits}/${ss.goal}`;
    else if (st.type === 'time') txt = `TIEMPO ${Math.floor(ss.timeLeft / 60)}:${String(Math.floor(ss.timeLeft % 60)).padStart(2, '0')}`;
    this.objectiveText = txt;
  },

  storyWin() {
    if (this.storyState.result) return;
    this.storyState.result = 'win';
    for (const k of this.karts) if (k.human) this.say(k, '¡OBJETIVO CUMPLIDO!', 99);
    this.sfx('finish');
  },

  storyLose() {
    if (this.storyState.result) return;
    this.storyState.result = 'lose';
    for (const k of this.karts) if (k.human) this.say(k, 'OBJETIVO FALLIDO', 99);
    this.sfx('elim');
  },

  bossMul(k) {
    const m = k.speedMul || 1;
    const humans = this.karts.filter((o) => o.human);
    if (!humans.length || this.mode !== 'race') return m;
    const N = this.track.cl.N;
    const best = Math.max(...humans.map((h) => h.progress));
    const diff = k.progress - best;
    if (this.story && this.story.type === 'chase') {
      // el ladrón se mantiene justo adelante: ni se escapa ni se deja
      if (diff > N * 0.1) return m * 0.9;
      if (diff < N * 0.01) return m * 1.08;
      return m;
    }
    if (diff > N * 0.12) return m * 0.92;
    if (diff < -N * 0.1) return m * 1.06;
    return m;
  },
});

function inRange(idx, i0, i1, N) {
  let a = ((i0 % N) + N) % N, b = ((i1 % N) + N) % N;
  if (a <= b) return idx >= a && idx <= b;
  return idx >= a || idx <= b;
}
