// Simulación del modo «Supervivencia Estelar» (SIN DOM)
import { Sim } from '../sim.js';
import { wrapAngle, mulberry32 } from '../geometry.js';
import {
  RUNNER_KARTS,
  START_HEARTS,
  MAX_HEARTS,
  CHUNK_LEN,
  SPEED_START,
  MAXGAP_START,
  CHASER_KILL_OFFSET,
  INVULN_DURATION,
  CRASH_SPIN_DURATION,
  speedFactor,
  maxGapAt,
  chaserSpeed,
} from './config.js';
import { centerX, centerSlope, halfW, biomeAt, generateChunk } from './layout.js';

const KART_R = 9;

function makeHeadlessWorld(seed, difficulty) {
  const chunks = new Map();
  return {
    runner: true,
    ring: true,
    seed: seed >>> 0,
    difficulty,
    theme: 'granja',
    scale: 1.5,
    worldSize: 3072,
    def: { name: 'Supervivencia Estelar', outside: 'wall' },
    getChunk(ci) {
      const idx = Math.max(0, ci);
      let c = chunks.get(idx);
      if (!c) {
        c = generateChunk(this.seed, idx, this.difficulty);
        chunks.set(idx, c);
        if (chunks.size > 64) {
          const fk = chunks.keys().next().value;
          if (fk < idx - 20) chunks.delete(fk);
        }
      }
      return c;
    },
  };
}

export class RunnerSim extends Sim {
  constructor({ world = null, seed = 12345, humans = [], difficulty = 1, demo = false, botChars = null }) {
    const w = world || makeHeadlessWorld(seed, difficulty);
    w.seed = seed >>> 0;
    w.difficulty = difficulty;
    super({
      track: w,
      mode: 'runner',
      humans,
      difficulty,
      kartsTotal: RUNNER_KARTS,
      botChars,
      demo,
    });
    this.runner = true;
    this.mode = 'runner';
    this.world = w;
    this.seed = w.seed;
    this.taken = new Set();
    this.recentTaken = [];
    this.biome = biomeAt(300);
    this.biomeBanner = { name: this.biome.name, t: 2.2 };
    this.leaderY = 320;
    this.chaserY = 300 - MAXGAP_START;
    this.rng = mulberry32(this.seed ^ 0x5a5a5a5a);
  }

  makeKart(charId, human, slot) {
    const k = super.makeKart(charId, human, slot);
    k.baseMaxV = k.maxV;
    k.hearts = START_HEARTS;
    k.maxHearts = MAX_HEARTS;
    k.crashT = 0;
    k.jumpCd = 0;
    k.distance = 0;
    k.survived = 0;
    k.elimReason = null;
    k.elimChaserName = null;
    k.onPlatform = null;
    k.startY = 300;
    k.maxV = k.baseMaxV * SPEED_START;
    return k;
  }

  placeKarts() {
    const seed = this.track.seed >>> 0;
    // 6 karts en 2 filas de 3 cerca de y = 300, mirando a +Y
    this.karts.forEach((k, i) => {
      const row = Math.floor(i / 3); // 0 o 1
      const col = (i % 3) - 1; // -1, 0, 1
      const y = 320 - row * 38;
      const cx = centerX(seed, y);
      const slope = centerSlope(seed, y);
      const ang = Math.atan2(1, slope);
      k.x = cx + col * 52;
      k.y = y;
      k.z = 0;
      k.a = ang;
      k.camA = ang;
      k.startY = y;
      k.progress = y;
      k.distance = 0;
      k.survived = 0;
      k.hearts = START_HEARTS;
    });
  }

  setupTrackObjects() {
    this.boxes = [];
    this.zones = [];
    this.obstacles = [];
    this.hazards = [];
  }

  botSpeedMul(k) {
    let m = [0.97, 1.0, 1.02][this.diff] || 1.0;
    // Rebufo suave para mantener al grupo competitivo sin que el líder mate a todos por MAXGAP temprano
    const gap = this.leaderY - k.y;
    if (gap > 140) m *= Math.min(1.12, 1 + (gap - 140) / 2200);
    else if (gap < 10 && this.karts.some((o) => o !== k && !o.eliminated && this.leaderY - o.y > 220)) m *= 0.95;
    return m;
  }

  step(dt) {
    if (this.started) {
      const sf = speedFactor(this.raceTime);
      for (const k of this.karts) {
        k.maxV = k.baseMaxV * sf;
        if (k.jumpCd > 0) k.jumpCd = Math.max(0, k.jumpCd - dt);
        if (k.crashT > 0) k.crashT = Math.max(0, k.crashT - dt);
      }
    }
    if (this.biomeBanner && this.biomeBanner.t > 0) {
      this.biomeBanner.t = Math.max(0, this.biomeBanner.t - dt);
    }

    super.step(dt);

    if (!this.started) return;

    // Actualizar líder y bioma actual
    let maxY = this.leaderY;
    for (const k of this.karts) {
      if (!k.eliminated && k.y > maxY) maxY = k.y;
    }
    this.leaderY = maxY;

    const newBiome = biomeAt(this.leaderY);
    if (newBiome.rawIndex !== this.biome.rawIndex) {
      this.biome = newBiome;
      this.biomeBanner = { name: newBiome.name, t: 2.2 };
      this.emit({ type: 'biome', theme: newBiome.theme, name: newBiome.name, chaser: newBiome.chaser });
      this.sfx('biome');
    } else {
      this.biome = newBiome;
    }

    // Actualizar perseguidor
    if (this.demo) {
      this.chaserY = this.leaderY - 650;
    } else {
      const vChaser = chaserSpeed(this.raceTime, this.diff, this.biome.cycle);
      const minChaserY = this.leaderY - maxGapAt(this.raceTime);
      this.chaserY = Math.max(this.chaserY + vChaser * dt, minChaserY);

      for (const k of this.karts) {
        if (k.eliminated) continue;
        if (k.y < this.chaserY + CHASER_KILL_OFFSET) {
          this.eliminateKart(k, 'perseguidor');
        }
      }
    }

    this.rank();
    this.checkEnd(dt);
  }

  eliminateKart(k, reason) {
    if (k.eliminated || this.demo) return;
    k.eliminated = true;
    k.elimAt = this.raceTime;
    k.survived = this.raceTime;
    k.elimReason = reason;
    k.elimChaserName = this.biome.chaserName;
    k.drift = 0;
    k.boostT = 0;
    this.elimOrder.push(k);
    if (reason === 'perseguidor') {
      this.say(k, `¡TE ATRAPÓ ${this.biome.chaserName.toUpperCase()}!`, 99);
    } else {
      this.say(k, '¡SIN VIDAS!', 99);
    }
    this.buzz(k, 350);
    this.sfx('eliminated');
    this.emit({ type: 'eliminated', kart: k.id, reason });
  }

  damageKart(k, reason = 'vidas', bounceBack = true) {
    if (k.eliminated || this.demo) return;
    if (k.shieldT > 0) {
      k.shieldT = 0;
      k.invulnT = 1.0;
      this.sfx('pop');
      this.say(k, '¡ESCUDO!', 0.9);
      return;
    }
    if (k.invulnT > 0) return;

    k.hearts = Math.max(0, k.hearts - 1);
    k.drift = 0;
    k.driftT = 0;
    k.driftLevel = 0;
    k.boostT = 0;
    if (bounceBack) {
      k.v = -Math.abs(k.v) * 0.3;
      k.vx = Math.cos(k.a) * k.v;
      k.vy = Math.sin(k.a) * k.v;
      k.spinT = CRASH_SPIN_DURATION;
      k.crashT = CRASH_SPIN_DURATION;
    }
    k.invulnT = INVULN_DURATION;
    this.sfx('crash');
    this.buzz(k, 240);

    if (k.hearts <= 0) {
      this.eliminateKart(k, reason);
    } else {
      this.say(k, `♥ ${k.hearts}`, 1.0);
    }
  }

  bounds(k, dt) {
    void dt;
    const seed = this.seed;
    const cx = centerX(seed, k.y);
    const slope = centerSlope(seed, k.y);
    const hw = halfW(seed, k.y);
    const lat = k.x - cx;
    const lim = hw - KART_R;

    // Paredes laterales
    if (Math.abs(lat) > lim) {
      const sgn = Math.sign(lat);
      k.x = cx + sgn * lim;
      const nLen = Math.hypot(1, slope) || 1;
      const nx = 1 / nLen;
      const ny = -slope / nLen;
      const vn = k.vx * nx + k.vy * ny;
      if (vn * sgn > 0) {
        k.vx -= nx * vn * 1.35;
        k.vy -= ny * vn * 1.35;
        if (Math.abs(vn) > 55) {
          k.v *= 0.85;
          this.sfx('bump');
          this.buzz(k, 35);
        }
      }
      // Reorientar suavemente hacia el camino si apunta contra la pared
      const roadAng = Math.atan2(1, slope);
      const da = wrapAngle(roadAng - k.a);
      k.a += da * 0.25;
    }

    k.surface = 'road';

    // Colisión con obstáculos de los trozos cercanos (solo si no está invulnerable)
    if (k.invulnT <= 0) {
      const ci = Math.floor(k.y / CHUNK_LEN);
      for (let cIdx = Math.max(0, ci - 1); cIdx <= ci + 1; cIdx++) {
        const ch = this.world.getChunk(cIdx);
        for (const o of ch.obstacles) {
          if (!o.solid) continue;
          if (k.z >= (o.height || 24)) continue;
          if (o.w && o.h) {
            const hx = o.w * 0.5 + KART_R;
            const hy = o.h * 0.5 + KART_R;
            const dx = k.x - o.x;
            const dy = k.y - o.y;
            if (Math.abs(dx) < hx && Math.abs(dy) < hy) {
              this.damageKart(k, 'vidas', true);
              break;
            }
          } else {
            const dx = k.x - o.x;
            const dy = k.y - o.y;
            const d = Math.hypot(dx, dy);
            const m = (o.r || 16) + KART_R;
            if (d < m) {
              this.damageKart(k, 'vidas', true);
              break;
            }
          }
        }
        if (k.invulnT > 0) break;
      }
    }

    if (!k.eliminated) {
      k.distance = Math.max(k.distance, Math.max(0, (k.y - k.startY) / 10));
      k.survived = this.raceTime;
    }
    k.progress = k.y;
  }

  projBounds(p) {
    const cx = centerX(this.seed, p.y);
    const hw = halfW(this.seed, p.y);
    const lim = hw - p.r;
    const lat = p.x - cx;
    if (Math.abs(lat) > lim) {
      p.x = cx + Math.sign(lat) * lim;
      p.vx = -p.vx * 0.85;
    }
    return false;
  }

  botThink(k, dt) {
    const inp = (k.input = { steer: 0, acc: false, brake: false, drift: false, item: false, power: false, jump: false });
    if (k.eliminated) return;
    const ai = k.ai;

    ai.thinkT = (ai.thinkT || 0) - dt;
    if (ai.thinkT <= 0 || ai.targetOffset === undefined) {
      ai.thinkT = [0.25, 0.15, 0.1][this.diff] || 0.15;
      const lookY = k.y + 185;
      const cxLook = centerX(this.seed, lookY);
      const hwLook = halfW(this.seed, lookY) - 28;
      let bestOff = 0;
      let bestScore = -1e9;

      const ci0 = Math.max(0, Math.floor(k.y / CHUNK_LEN));
      const ci1 = Math.floor((k.y + 270) / CHUNK_LEN);

      for (let c = -3; c <= 3; c++) {
        const candOff = (c / 3) * (hwLook * 0.82);
        let minClear = 999;

        for (let s = 20; s <= 240; s += 20) {
          const sy = k.y + s;
          const f = s / 240;
          const scx = centerX(this.seed, sy);
          const sx = k.x + (scx + candOff - k.x) * f;

          for (let ci = ci0; ci <= ci1; ci++) {
            const ch = this.world.getChunk(ci);
            for (const o of ch.obstacles) {
              if (!o.solid) continue;
              const rad = o.w ? Math.max(o.w, o.h) * 0.55 : o.r;
              const d = Math.hypot(sx - o.x, sy - o.y) - rad;
              if (d < minClear) minClear = d;
            }
          }
        }

        const curOff = k.x - centerX(this.seed, k.y);
        let score = minClear * 4 - Math.abs(candOff - curOff) * 0.15 - Math.abs(candOff) * 0.05;
        if (score > bestScore) {
          bestScore = score;
          bestOff = candOff;
        }
      }
      ai.targetOffset = bestOff;
    }

    const lookAhead = 120;
    const ty = k.y + lookAhead;
    const tx = centerX(this.seed, ty) + (ai.targetOffset || 0);
    const want = Math.atan2(ty - k.y, tx - k.x);
    const diff = wrapAngle(want - k.a);
    inp.steer = Math.max(-1, Math.min(1, diff * 2.5));
    inp.acc = true;
    inp.brake = Math.abs(diff) > 1.15 && k.v > 140;
  }

  rank() {
    if (!this.karts) return;
    const sorted = [...this.karts].sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.eliminated && b.eliminated) {
        const dt = (b.elimAt || 0) - (a.elimAt || 0);
        if (Math.abs(dt) > 0.01) return dt;
        return (b.distance || 0) - (a.distance || 0);
      }
      return b.y - a.y;
    });
    sorted.forEach((k, i) => {
      k.place = i + 1;
    });
  }

  checkEnd(dt) {
    if (this.done || this.demo) return;
    const alive = this.karts.filter((k) => !k.eliminated);
    const humans = this.karts.filter((k) => k.human);
    const humansAlive = humans.filter((k) => !k.eliminated);

    if (this.endTimer < 0) {
      if (alive.length <= 1 || (humans.length > 0 && humansAlive.length === 0)) {
        this.endTimer = 2.0;
        const win = alive[0] || this.karts.find((k) => k.place === 1);
        if (win && !win.eliminated) {
          this.say(win, '¡GANASTE!', 99);
          this.sfx('finish');
        }
      }
    } else {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.done = true;
        this.emit({ type: 'done' });
      }
    }
  }

  results() {
    this.rank();
    return [...this.karts]
      .sort((a, b) => a.place - b.place)
      .map((k) => ({
        place: k.place,
        char: k.char,
        human: k.human,
        slot: k.slot,
        distance: Math.round(k.distance || 0),
        time: k.eliminated ? k.survived : this.raceTime,
        hearts: k.hearts,
        reason: k.eliminated ? (k.elimReason || 'perseguidor') : 'ganador',
        chaserName: k.elimChaserName || this.biome.chaserName,
      }));
  }
}
