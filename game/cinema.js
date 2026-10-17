// Director de cinemáticas: tomas de cámara sobre la pista + diálogos
import { Sim } from './sim.js';
import { charById, shadowName, VILLAIN } from './constants.js';
import { sampleAtIdx, wrapAngle } from './geometry.js';

const CHARS_PER_SEC = 38;

export class Cinema {
  // heroes: ids de personaje de los jugadores (en orden J1, J2…); bossChar: jefe de la escena
  constructor({ track, shots, heroes, bossChar }) {
    this.track = track;
    this.shots = shots || [];
    this.heroes = heroes.length ? heroes : ['pipo'];
    this.bossChar = bossChar || null;
    this.scene = new Sim({
      track, mode: 'race', demo: true, laps: 99,
      humans: this.heroes.map((c, i) => ({ slot: i, char: c })),
      kartsTotal: 8,
      story: bossChar ? { type: 'boss', boss: bossChar } : null,
    });
    this.scene.karts.forEach((k) => { if (k.human) k.autopilot = true; });
    this.shotIdx = -1;
    this.done = false;
    this.version = 0; // cambia cuando cambia la línea o la toma (para avisar a la interfaz)
    this.flashT = 0; this.shakeT = 0;
    this.nextShot();
  }

  get shot() { return this.shots[this.shotIdx]; }

  nextShot() {
    this.shotIdx++;
    this.t = 0; this.lineIdx = 0; this.lineT = 0;
    if (this.shotIdx >= this.shots.length) { this.done = true; this.version++; return; }
    const s = this.shot;
    if (s.fx === 'flash') this.flashT = 0.7;
    if (s.fx === 'shake') this.shakeT = 1.6;
    this.songCue = s.song || null;
    this.orbitA0 = null;
    this.version++;
  }

  next() {
    if (this.done) return;
    const s = this.shot;
    if (s.lines && this.lineIdx < s.lines.length - 1) { this.lineIdx++; this.lineT = 0; this.version++; }
    else this.nextShot();
  }

  skip() { this.done = true; this.version++; }

  lineDuration(line) {
    return Math.max(3.2, line[1].length / CHARS_PER_SEC + 2.4);
  }

  shotDuration() {
    const s = this.shot;
    if (!s) return 1;
    if (s.lines && s.lines.length) return s.lines.reduce((a, l) => a + this.lineDuration(l), 0);
    return s.dur || 3;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt; this.lineT += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
    const s = this.shot;
    if (s.cam && s.cam.kind === 'chase') {
      if (!this.scene.started) { this.scene.started = true; this.scene.countdown = 0; }
    }
    if (this.scene.started) { this.scene.step(dt); this.scene.events.length = 0; }
    else this.scene.time += dt;
    // avance automático por si nadie toca
    if (s.lines && s.lines.length) {
      if (this.lineT > this.lineDuration(s.lines[this.lineIdx])) this.next();
    } else if (this.t >= (s.dur || 3)) this.nextShot();
  }

  // ---- quién habla ----
  speaker(who) {
    if (who === 'n') return { name: 'Narrador', char: null, shadow: false };
    if (who === 'x') return { name: VILLAIN.name, char: VILLAIN.id, shadow: false };
    if (who === 'b') {
      const id = this.bossChar || VILLAIN.id;
      return { name: shadowName(id), char: id, shadow: id !== VILLAIN.id };
    }
    const i = Number(who.slice(1)) || 0;
    const id = this.heroes[i % this.heroes.length];
    return { name: charById(id).name, char: id, shadow: false };
  }

  fill(text) {
    return text
      .replace(/\{h0\}/g, charById(this.heroes[0]).name)
      .replace(/\{h1\}/g, charById(this.heroes[1 % this.heroes.length]).name)
      .replace(/\{b\}/g, this.bossChar ? shadowName(this.bossChar) : VILLAIN.name);
  }

  // ¿el Barón habla sin estar en la escena? (se muestra como holograma en el cielo)
  baronHologram() {
    if (this.done || this.bossChar === VILLAIN.id) return false;
    const s = this.shot;
    const line = s && s.lines && s.lines[this.lineIdx];
    return !!(line && line[0] === 'x');
  }

  state() {
    if (this.done) return { done: true, v: this.version };
    const s = this.shot;
    const line = s.lines && s.lines[this.lineIdx];
    const sp = line ? this.speaker(line[0]) : null;
    return {
      v: this.version,
      title: s.title || '', sub: s.sub || '',
      line: line ? { ...sp, text: this.fill(line[1]), id: `${this.shotIdx}-${this.lineIdx}` } : null,
      tint: s.tint || null,
    };
  }

  // ---- cámara: devuelve un "kart falso" que el render usa como cámara ----
  camera() {
    const s = this.shot || this.shots[this.shots.length - 1];
    const cam = (s && s.cam) || { kind: 'orbit', on: 'grid', r: 60, z: 20, spd: 0.2 };
    const cl = this.track.cl;
    let out;
    if (cam.kind === 'fly') {
      const k = Math.min(1, this.t / Math.max(1, this.shotDuration()));
      const ease = k * k * (3 - 2 * k);
      const f = cam.f0 + (cam.f1 - cam.f0) * ease;
      const p = sampleAtIdx(cl, (((f % 1) + 1) % 1) * cl.N);
      const ahead = sampleAtIdx(cl, (((f % 1) + 1) % 1) * cl.N + 25);
      const a = Math.atan2(ahead.y - p.y, ahead.x - p.x);
      out = { camX: p.x, camY: p.y, camA: a, camH: 22 + cam.z * 0.7, x: p.x, y: p.y, z: 0 };
    } else if (cam.kind === 'chase') {
      const k = this.target(cam.on);
      out = k ? { camX: k.x - Math.cos(k.camA) * 104, camY: k.y - Math.sin(k.camA) * 104, camA: k.camA, x: k.x, y: k.y, z: k.z, camH: 26 } : null;
    } else {
      const k = this.target(cam.on);
      let px, py, base;
      if (k && cam.on !== 'grid') { px = k.x; py = k.y; base = k.a + Math.PI; }
      else {
        const g = sampleAtIdx(cl, cl.N - 14);
        px = g.x; py = g.y; base = Math.atan2(g.ty, g.tx) + Math.PI * 0.75;
      }
      if (this.orbitA0 === null) this.orbitA0 = base;
      const a = this.orbitA0 + this.t * (cam.spd || 0.25);
      // la cámara mira hacia el punto desde una distancia r (más lejos si es un kart, para que quepa)
      const r = cam.on === 'grid' ? cam.r : cam.r * 2.2;
      out = { camX: px - Math.cos(a) * r, camY: py - Math.sin(a) * r, camA: a, frameDist: r, camUp: cam.z || 0, x: px, y: py, z: 0 };
    }
    if (!out) out = { camX: 1024, camY: 1024, camA: 0, camH: 60, x: 1024, y: 1024, z: 0 };
    if (this.shakeT > 0) { out.camX += (Math.random() - 0.5) * 6; out.camY += (Math.random() - 0.5) * 6; }
    return out;
  }

  target(on) {
    const sc = this.scene;
    if (on === 'b') return sc.karts.find((k) => k.boss) || sc.karts[0];
    if (on === 'h0' || on === 'h1') {
      const humans = sc.karts.filter((k) => k.human).sort((a, b) => a.slot - b.slot);
      const i = on === 'h1' ? 1 % humans.length : 0;
      return humans[i] || sc.karts[0];
    }
    return null;
  }
}

export { wrapAngle };
