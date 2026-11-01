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
  DIFF_BOT_THINK_DT,
  DIFF_BOT_ERROR,
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
    // Rebufo de grupo para mantener la carrera compacta y evitar muertes prematuras por MAXGAP
    const gap = this.leaderY - k.y;
    if (gap > 120) {
      m *= Math.min(1.22, 1 + (gap - 120) / 1400);
    } else if (gap < 15 && this.karts.some((o) => o !== k && !o.eliminated && this.leaderY - o.y > 190)) {
      m *= 0.88;
    }
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
    const wasFrozen = k.frozenT > 0;
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
      if ((wasSpin && k.spinT <= 0) || (wasFrozen && k.frozenT <= 0)) {
        if (k.v < 85) k.v = 85;
      } else if (k.spinT <= 0 && k.v < k.maxV * 0.7 && (k.human ? !(k.input && k.input.brake) : true)) {
        k.v = Math.min(k.maxV, k.v + k.accel * 0.7 * dt);
      }
      if (k.surface === 'grass' && k.boostT <= 0 && k.v > k.maxV * 0.92) {
        k.v = k.maxV * 0.92;
      }
    }
  }

  hit(k, kind, src) {
    void src;
    if (k.eliminated || k.fallT > 0 || k.invulnT > 0) return false;
    if (k.shieldT > 0) {
      k.shieldT = 0;
      k.invulnT = 0.8;
      this.sfx('pop');
      this.say(k, '¡ESCUDO!', 0.8);
      return false;
    }
    k.drift = 0;
    k.driftT = 0;
    k.driftLevel = 0;
    if (kind === 'spin') {
      k.spinT = 0.48;
      k.v = Math.max(80, k.v * 0.55);
    } else if (kind === 'frozen') {
      k.frozenT = 0.45;
      k.v = 0;
    } else if (kind === 'sticky') {
      k.stickyT = 1.6;
      k.spinT = 0.35;
      k.v = Math.max(85, k.v * 0.65);
    } else if (kind === 'shock') {
      k.spinT = 0.55;
      k.v = Math.max(75, k.v * 0.5);
      k.stickyT = 0.9;
    }
    k.invulnT = (k.spinT || 0) + (k.frozenT || 0) + 0.8;
    k.hits++;
    this.sfx('hit');
    this.buzz(k, 200);
    return true;
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
      k.a += da * 0.35;
    }

    // Mantener el ángulo del kart apuntando hacia adelante (+Y) dentro de un cono razonable
    const roadAng = Math.atan2(1, slope);
    const angOff = wrapAngle(k.a - roadAng);
    if (Math.abs(angOff) > 1.05) {
      k.a = roadAng + Math.sign(angOff) * 1.05;
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
      k.power = Math.min(1, k.power + 0.08);
      this.sfx('box');
      this.buzz(k, 30);
    }
  }

  kartAhead(k) {
    let best = null;
    let bestY = Infinity;
    for (const o of this.karts) {
      if (o === k || o.eliminated) continue;
      if (o.y > k.y && o.y < bestY) {
        bestY = o.y;
        best = o;
      }
    }
    return best;
  }

  useItem(k) {
    if (!k.item || k.rouletteT > 0) return;
    if (k.item === 'iman') {
      k.item = null;
      const t =
        this.karts.find((o) => o !== k && !o.eliminated && o.y > k.y && o.item) ||
        this.karts.find((o) => o !== k && !o.eliminated && o.item);
      if (t) {
        k.item = t.item;
        t.item = null;
        this.say(k, '¡ROBADO!', 1);
        this.say(t, '¡TE ROBARON!', 1.2);
        this.buzz(t, 120);
      } else {
        k.item = 'chile';
      }
      this.sfx('magnet');
      return;
    }
    super.useItem(k);
  }

  usePower(k) {
    if (k.charges > 0) {
      super.usePower(k);
      return;
    }
    if (k.power < 1 || k.eliminated) return;
    const p = k.ch.power;
    if (p === 'destello') {
      k.power = 0;
      this.emit({ type: 'power', kart: k.id, power: p });
      this.sfx('flash');
      const targets = this.karts.filter((o) => o !== k && !o.eliminated && o.y > k.y);
      for (const o of targets) {
        if (o.shieldT > 0) continue;
        o.blindT = 2.3;
        o.flashT = 2.3;
        this.buzz(o, 100);
      }
      this.say(k, '¡DESTELLO!', 0.8);
      return;
    }
    if (p === 'rayo') {
      k.power = 0;
      this.emit({ type: 'power', kart: k.id, power: p });
      const aliveByY = this.karts.filter((o) => !o.eliminated).sort((a, b) => b.y - a.y);
      const t = aliveByY[0] === k ? aliveByY[1] : aliveByY[0];
      if (t && t !== k) {
        this.effects.push({ type: 'bolt', x: t.x, y: t.y, t: 0.5, max: 0.5, kart: t.id });
        this.hit(t, 'shock', k);
      }
      this.sfx('thunder');
      return;
    }
    super.usePower(k);
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
      ai.thinkT = DIFF_BOT_THINK_DT[this.diff] || 0.15;
      const lookY = k.y + 210;
      const hwLook = halfW(this.seed, lookY) - 28;
      const candidates = [];

      const ci0 = Math.max(0, Math.floor(k.y / CHUNK_LEN));
      const ci1 = Math.floor((k.y + 260) / CHUNK_LEN);
      const curOff = k.x - centerX(this.seed, k.y);

      for (let c = -3; c <= 3; c++) {
        const candOff = (c / 3) * (hwLook * 0.84);
        let minClear = 999;
        let hazardPen = 0;
        let bonus = 0;
        let gotBoost = false;
        let gotHeart = false;
        let gotBox = false;

        for (let s = 20; s <= 240; s += 20) {
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
              if (!gotBoost && ch.zones) {
                for (const z of ch.zones) {
                  if (z.type === 'boost' && sx >= z.x0 && sx <= z.x1 && sy >= z.y0 && sy <= z.y1) {
                    bonus += 120;
                    gotBoost = true;
                    break;
                  }
                }
              }
              if (ch.pickups) {
                for (const pk of ch.pickups) {
                  if (this.taken.has(pk.id)) continue;
                  if (Math.hypot(sx - pk.x, sy - pk.y) < 28) {
                    if (pk.type === 'heart' && k.hearts < MAX_HEARTS && !gotHeart) {
                      bonus += 150;
                      gotHeart = true;
                    } else if (pk.type === 'box' && !k.item && !gotBox) {
                      bonus += 60;
                      gotBox = true;
                    }
                  }
                }
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

        const clearScore = minClear < 24 ? (minClear - 24) * 45 : Math.min(90, minClear) * 4;
        const effBonus = minClear >= 24 && hazardPen > -100 ? bonus : 0;
        const score = clearScore + hazardPen + effBonus - Math.abs(candOff - curOff) * 0.14 - Math.abs(candOff) * 0.04;
        candidates.push({ candOff, score, safe: hazardPen > -500 && minClear > 20 });
      }

      candidates.sort((a, b) => b.score - a.score);
      const errProb = DIFF_BOT_ERROR[this.diff] ?? 0.06;
      const safeAlt = candidates.length > 1 && candidates[1].safe ? candidates[1] : candidates[0];
      const chosen = this.rng() < errProb ? safeAlt : candidates[0];
      ai.targetOffset = chosen.candOff;
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
    if (k.blindT > 0) ai.noise = Math.max(-0.2, Math.min(0.2, (ai.noise || 0) + (this.rng() - 0.5) * dt * 2));
    else ai.noise = (ai.noise || 0) * 0.85;
    inp.steer = Math.max(-1, Math.min(1, diff * 2.8 + (ai.noise || 0))) * (k.v < 0 ? -1 : 1);
    inp.acc = true;
    inp.brake = false;

    // Uso de objetos y poderes (sección 3.8)
    if (k.item) {
      ai.itemT = (ai.itemT || 1.2) - dt;
      if (ai.itemT <= 0) {
        let use = false;
        const ahead = this.kartAhead(k);
        if (k.item === 'chile') use = Math.abs(diff) < 0.25;
        else if (k.item === 'burbuja' || k.item === 'iman') use = true;
        else if (k.item === 'aceite') use = this.karts.some((o) => !o.eliminated && o !== k && o.y < k.y && k.y - o.y < 140);
        else if (k.item === 'chicle') use = Boolean(ahead && ahead.y - k.y < 220);
        if (use || ai.itemT < -5) {
          inp.item = true;
          ai.itemT = 1.5 + this.rng() * 2.5;
        }
      }
    }
    if (k.power >= 1 || k.charges > 0) {
      ai.powerT = (ai.powerT || 1.8) - dt;
      if (ai.powerT <= 0) {
        let use = true;
        if (k.ch.power === 'temblor') use = this.karts.some((o) => !o.eliminated && o !== k && Math.hypot(o.x - k.x, o.y - k.y) < 140);
        if (k.ch.power === 'triple' || k.charges > 0) use = Math.abs(diff) < 0.25;
        if (use || ai.powerT < -7) {
          inp.power = true;
          ai.powerT = 2.0 + this.rng() * 3.5;
        }
      }
    }
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
