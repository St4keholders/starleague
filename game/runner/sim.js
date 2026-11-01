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
  SHIELD_DURATION,
  BOOST_PAD_DURATION,
  HEART_FULL_BOOST,
  JUMP_VZ,
  JUMP_COOLDOWN,
  RAMP_VZ,
  RAMP_V_FACTOR,
  RAMP_BOOST,
  speedFactor,
  maxGapAt,
  chaserSpeed,
} from './config.js';
import { centerX, centerSlope, halfW, biomeAt, generateChunk, isHazardAt, obstacleStateAt } from './layout.js';

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
    cutGrass(x, y, r = 9) {
      void r;
      this.grassCuts = (this.grassCuts || 0) + 1;
      const ci = Math.max(0, Math.floor(y / CHUNK_LEN));
      const ch = this.getChunk(ci);
      if (ch && ch.decor) {
        for (const d of ch.decor) {
          if (d.kind === 'grasstuft' && !d.cut && Math.hypot(d.x - x, d.y - y) < 12) {
            d.cut = true;
          }
        }
      }
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

    // Partículas de la banda del perseguidor según el bioma (sección 4.3)
    const chColors = {
      granja: '#d89a5a',
      playa: '#cfe9ff',
      nieve: '#ffffff',
      volcan: '#ff7a1a',
      jungla: '#9dff3a',
      neon: '#ff2ea6',
      estelar: '#b44dff',
      coliseo: '#9dff3a',
    };
    const pCol = chColors[this.biome.id] || '#d89a5a';
    const chCx = centerX(this.seed, this.chaserY);
    const chHw = halfW(this.seed, this.chaserY);
    const px = chCx + (this.rng() * 2 - 1) * (chHw - 30);
    this.part(px, this.chaserY + 6, 4 + this.rng() * 14, (this.rng() - 0.5) * 40, 20 + this.rng() * 40, 25 + this.rng() * 30, 0.35, pCol, 2.5);

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
      k.v = -Math.min(60, Math.abs(k.v) * 0.3);
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

  findSafeX(x, y) {
    const cx = centerX(this.seed, y);
    const hw = halfW(this.seed, y);
    const left = cx - hw + 24;
    const right = cx + hw - 24;
    const ci = Math.max(0, Math.floor(y / CHUNK_LEN));
    const ch = this.world.getChunk(ci);

    let bestX = cx;
    let bestDist = Infinity;
    for (let sx = left; sx <= right; sx += 10) {
      const hz = isHazardAt(ch, sx, y);
      if (hz === 'water' || hz === 'lava' || hz === 'hole') continue;
      let blocked = false;
      for (const o of ch.obstacles) {
        if (!o.solid) continue;
        const st = obstacleStateAt(o, this.raceTime || 0);
        if (!st.active) continue;
        const hx = (o.w ? o.w * 0.5 : o.r || 16) + KART_R + 6;
        const hy = (o.h ? o.h * 0.5 : o.r || 16) + KART_R + 6;
        if (Math.abs(sx - st.x) < hx && Math.abs(y - st.y) < hy) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const d = Math.abs(sx - x);
      if (d < bestDist) {
        bestDist = d;
        bestX = sx;
      }
    }
    return bestX;
  }

  respawn(k) {
    const safeY = k.respawnY !== undefined ? k.respawnY : k.y;
    const safeX = k.respawnX !== undefined ? k.respawnX : this.findSafeX(k.x, safeY);
    k.x = safeX;
    k.y = safeY;
    k.z = 30;
    k.vz = 0;
    k.a = Math.atan2(1, centerSlope(this.seed, safeY));
    k.v = 95;
    k.vx = Math.cos(k.a) * k.v;
    k.vy = Math.sin(k.a) * k.v;
    k.invulnT = INVULN_DURATION;
    k.surface = 'road';
    k.fallT = 0;
  }

  fallInHazard(k, hz) {
    if (k.eliminated || this.demo) return;
    if (k.shieldT > 0) {
      k.shieldT = 0;
      k.invulnT = 1.0;
      this.sfx('pop');
      this.say(k, '¡ESCUDO!', 0.9);
      return;
    }
    if (k.invulnT > 0) return;

    k.respawnY = k.y;
    k.respawnX = this.findSafeX(k.x, k.y);
    this.damageKart(k, 'vidas', false);
    this.sfx(hz === 'water' ? 'splash' : 'fall');
    if (!k.eliminated) {
      this.respawn(k);
    }
  }

  groundAt(x, y, prevZ = 0) {
    const ci = Math.floor(y / CHUNK_LEN);
    let maxH = 0;
    for (let cIdx = Math.max(0, ci - 1); cIdx <= ci + 1; cIdx++) {
      const ch = this.world.getChunk(cIdx);
      if (!ch.platforms) continue;
      for (const pl of ch.platforms) {
        if (x >= pl.x0 && x <= pl.x1 && y >= pl.y0 && y <= pl.y1) {
          if (prevZ >= pl.h - 6 && pl.h > maxH) {
            maxH = pl.h;
          }
        }
      }
    }
    return maxH;
  }

  updateKart(k, dt) {
    k._prevZ = k.z;
    const wasSpin = k.spinT > 0;
    const gH = this.groundAt(k.x, k.y, k.z);
    if (
      !k.eliminated &&
      k.fallT <= 0 &&
      k.spinT <= 0 &&
      k.frozenT <= 0 &&
      k.input &&
      k.input.jump &&
      k.z <= gH + 0.5 &&
      (k.jumpCd || 0) <= 0
    ) {
      k.vz = JUMP_VZ;
      k.jumpCd = JUMP_COOLDOWN;
      this.sfx('jump');
      this.buzz(k, 20);
    }
    super.updateKart(k, dt);
    if (!k.eliminated && k.fallT <= 0 && k.frozenT <= 0) {
      if (wasSpin && k.spinT <= 0 && k.v < 70) {
        k.v = 70;
      } else if (k.spinT <= 0 && k.v < k.maxV * 0.7 && (k.human ? !(k.input && k.input.brake) : true)) {
        k.v = Math.min(k.maxV, k.v + k.accel * 0.7 * dt);
      }
      if (k.surface === 'grass' && k.boostT <= 0 && k.v > k.maxV * 0.92) {
        k.v = k.maxV * 0.92;
      }
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

    // Suelo elevado (techos de granero y plataformas)
    const prevZ = k._prevZ ?? k.z;
    const gH = this.groundAt(k.x, k.y, Math.max(prevZ, k.z));
    if (gH > 0 && k.z <= gH && k.vz <= 0) {
      k.z = gH;
      k.vz = 0;
    }

    const ci = Math.floor(k.y / CHUNK_LEN);

    // Zonas y recogibles en los trozos cercanos
    for (let cIdx = Math.max(0, ci - 1); cIdx <= ci + 1; cIdx++) {
      const ch = this.world.getChunk(cIdx);
      if (k.y >= ch.y0 - 8 && k.y <= ch.y1 + 8 && gH === 0 && k.z <= 2) {
        const hz = isHazardAt(ch, k.x, k.y);
        if (hz === 'ice') {
          k.surface = 'ice';
        } else if (hz === 'goo') {
          k.surface = 'goo';
        } else if (hz === 'grass') {
          k.surface = 'grass';
          if (this.world.cutGrass) this.world.cutGrass(k.x, k.y, 9);
        } else if (hz === 'water' || hz === 'lava' || hz === 'hole') {
          this.fallInHazard(k, hz);
          break;
        }
      }
      if (ch.zones) {
        for (const z of ch.zones) {
          if (z.type === 'boost' && k.z <= gH + 4) {
            if (k.x >= z.x0 && k.x <= z.x1 && k.y >= z.y0 && k.y <= z.y1) {
              const prev = k.boostT;
              k.boostT = Math.max(k.boostT, BOOST_PAD_DURATION);
              if (prev < 0.7) {
                this.sfx('boost');
                this.buzz(k, 40);
              }
            }
          } else if (z.type === 'ramp' && k.z <= gH + 4) {
            if (k.x >= z.x0 && k.x <= z.x1 && k.y >= z.y0 && k.y <= z.y1) {
              if (k.vz < 120) {
                k.vz = RAMP_VZ + Math.max(0, k.v) * RAMP_V_FACTOR;
                k.boostT = Math.max(k.boostT, RAMP_BOOST);
                this.sfx('jump');
                this.buzz(k, 35);
              }
            }
          }
        }
      }
      if (ch.pickups) {
        for (const pk of ch.pickups) {
          if (this.taken.has(pk.id)) continue;
          if (k.z >= 36) continue;
          const d = Math.hypot(k.x - pk.x, k.y - pk.y);
          if (d < (pk.r || 18) + KART_R) {
            this.collectPickup(k, pk);
          }
        }
      }
    }

    // Colisión con obstáculos de los trozos cercanos (solo si no está invulnerable)
    if (k.invulnT <= 0) {
      for (let cIdx = Math.max(0, ci - 1); cIdx <= ci + 1; cIdx++) {
        const ch = this.world.getChunk(cIdx);
        for (const o of ch.obstacles) {
          if (!o.solid) continue;
          const st = obstacleStateAt(o, this.raceTime || 0);
          if (!st.active) continue;
          const oh = o.height || 24;
          // Si está en una plataforma por encima del obstáculo o saltando sobre él, no choca
          if (k.z >= oh - 6) continue;
          if (o.w && o.h) {
            const hx = o.w * 0.5 + KART_R;
            const hy = o.h * 0.5 + KART_R;
            const dx = k.x - st.x;
            const dy = k.y - st.y;
            if (Math.abs(dx) < hx && Math.abs(dy) < hy) {
              this.damageKart(k, 'vidas', true);
              break;
            }
          } else {
            const dx = k.x - st.x;
            const dy = k.y - st.y;
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

  collectPickup(k, pk) {
    if (this.taken.has(pk.id)) return;
    this.taken.add(pk.id);
    this.emit({ type: 'pickup', id: pk.id, pickupType: pk.type, kart: k.id });
    if (pk.type === 'heart') {
      if (k.hearts < MAX_HEARTS) {
        k.hearts = Math.min(MAX_HEARTS, k.hearts + 1);
        this.sfx('heart');
        this.say(k, '+1 ♥', 1.0);
        this.buzz(k, 45);
      } else {
        k.boostT = Math.max(k.boostT, HEART_FULL_BOOST);
        this.sfx('boost');
        this.say(k, '¡TURBO!', 0.8);
        this.buzz(k, 35);
      }
    } else if (pk.type === 'shield') {
      k.shieldT = SHIELD_DURATION;
      this.sfx('shield');
      this.say(k, '¡ESCUDO!', 1.0);
      this.buzz(k, 45);
    } else if (pk.type === 'box') {
      if (!k.item && k.rouletteT <= 0) {
        k.rouletteT = 0.85;
      }
      this.sfx('box');
      this.buzz(k, 30);
    }
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
        const candOff = (c / 3) * (hwLook * 0.84);
        let minClear = 999;
        let hazardPen = 0;

        for (let s = 18; s <= 240; s += 18) {
          const sy = k.y + s;
          const f = s / 240;
          const scx = centerX(this.seed, sy);
          const sx = k.x + (scx + candOff - k.x) * f;

          for (let ci = ci0; ci <= ci1; ci++) {
            const ch = this.world.getChunk(ci);
            if (sy >= ch.y0 && sy <= ch.y1) {
              const hz = isHazardAt(ch, sx, sy);
              if (hz === 'water' || hz === 'lava' || hz === 'hole') {
                hazardPen -= 1000;
              } else if (hz === 'goo') {
                hazardPen -= 200;
              }
            }
            for (const o of ch.obstacles) {
              if (!o.solid) continue;
              const futTime = (this.raceTime || 0) + s / Math.max(120, k.v);
              const st = obstacleStateAt(o, futTime);
              if (o.moveType === 'fire' && !st.warning && !st.active) continue;
              let d;
              if (o.w && o.h) {
                const dx = Math.max(0, Math.abs(sx - st.x) - o.w * 0.5);
                const dy = Math.max(0, Math.abs(sy - st.y) - o.h * 0.5);
                d = Math.hypot(dx, dy);
              } else {
                d = Math.hypot(sx - st.x, sy - st.y) - (o.r || 16);
              }
              if (d < minClear) minClear = d;
            }
          }
        }

        const curOff = k.x - centerX(this.seed, k.y);
        const clearScore = minClear < 24 ? (minClear - 24) * 45 : Math.min(90, minClear) * 4;
        let score = clearScore + hazardPen - Math.abs(candOff - curOff) * 0.12 - Math.abs(candOff) * 0.04;
        if (score > bestScore) {
          bestScore = score;
          bestOff = candOff;
        }
      }
      ai.targetOffset = bestOff;
    }

    // Saltar si hay un obstáculo saltable o canal de agua/lava/hueco justo adelante a menos de 55 u
    const ciNow = Math.max(0, Math.floor(k.y / CHUNK_LEN));
    for (let ci = ciNow; ci <= ciNow + 1; ci++) {
      const ch = this.world.getChunk(ci);
      const hzAhead = isHazardAt(ch, k.x, k.y + 32);
      if (hzAhead === 'water' || hzAhead === 'lava' || hzAhead === 'hole') {
        inp.jump = true;
        break;
      }
      for (const o of ch.obstacles) {
        if (!o.solid || !o.jumpable) continue;
        const st = obstacleStateAt(o, this.raceTime || 0);
        const dy = st.y - k.y;
        if (dy > 6 && dy < 55) {
          const hx = (o.w ? o.w * 0.5 : o.r || 16) + KART_R + 4;
          if (Math.abs(k.x - st.x) < hx) {
            inp.jump = true;
            break;
          }
        }
      }
      if (inp.jump) break;
    }

    const lookAhead = 110;
    const ty = k.y + lookAhead;
    const tx = centerX(this.seed, ty) + (ai.targetOffset || 0);
    const want = Math.atan2(ty - k.y, tx - k.x);
    const diff = wrapAngle(want - k.a);
    inp.steer = Math.max(-1, Math.min(1, diff * 2.8)) * (k.v < 0 ? -1 : 1);
    inp.acc = true;
    inp.brake = false;
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
