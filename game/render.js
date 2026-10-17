// Render pseudo-3D estilo "modo 7" + sprites + HUD
import { VIEW_W, VIEW_H, SLOT_COLORS, SLOT_NAMES, LAPS } from './constants.js';
import { getSprites, getShadowFrames, KART_FRAMES, KART_SPRITE } from './sprites.js';

const FONT = '"Press Start 2P", monospace';
const FOG0 = 620, FOG1 = 1350;
const CAM_DIST = 104;

export function layoutFor(n, W = VIEW_W, H = VIEW_H) {
  if (n <= 1) return [{ x: 0, y: 0, w: W, h: H }];
  if (n === 2) return [{ x: 0, y: 0, w: W, h: H / 2 }, { x: 0, y: H / 2, w: W, h: H / 2 }];
  return [
    { x: 0, y: 0, w: W / 2, h: H / 2 }, { x: W / 2, y: 0, w: W / 2, h: H / 2 },
    { x: 0, y: H / 2, w: W / 2, h: H / 2 }, { x: W / 2, y: H / 2, w: W / 2, h: H / 2 },
  ];
}

function camParams(vp) {
  const wide = vp.h / vp.w < 0.4;
  const focal = vp.w * (wide ? 0.46 : 0.62);
  const hz = Math.round(vp.h * (wide ? 0.3 : 0.36));
  const H = ((0.87 * vp.h - hz) * CAM_DIST) / focal;
  return { focal, hz, H };
}

export class Renderer {
  constructor(canvas, w = VIEW_W, h = VIEW_H) {
    this.canvas = canvas;
    this.W = w; this.H = h;
    canvas.width = w; canvas.height = h;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.img = this.ctx.createImageData(this.W, this.H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.sp = getSprites();
    this.atanCache = {};
    this.gradCache = {};
  }

  setTrack(t) {
    this.t = t;
    this.gradCache = {};
    const f = t.fog;
    this.fogCol = (255 << 24) | (f[2] << 16) | (f[1] << 8) | f[0];
  }

  // ------------------------------------------------------------
  render(sim, viewKarts, ui = {}) {
    const ctx = this.ctx;
    this.noLabels = !!ui.cinema;
    const vps = layoutFor(viewKarts.length, this.W, this.H);
    const cams = viewKarts.map((k, i) => this.makeCam(k, vps[i]));
    cams.forEach((c) => { this.drawSky(c); this.drawFloor(c); });
    // cuadrante vacío con 3 jugadores
    if (viewKarts.length === 3) this.fillRect(vps[3], 0xff201430);
    ctx.putImageData(this.img, 0, 0);
    cams.forEach((c, i) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(c.vp.x, c.vp.y, c.vp.w, c.vp.h); ctx.clip();
      ctx.translate(c.vp.x, c.vp.y);
      this.drawSprites(sim, c, viewKarts[i]);
      if (!ui.demo) this.drawHUD(sim, c, viewKarts[i], viewKarts.length, ui.hudInset || 0);
      ctx.restore();
    });
    if (viewKarts.length === 3) this.drawSidePanel(sim, vps[3]);
    // separadores
    ctx.fillStyle = '#0b0614';
    if (viewKarts.length >= 2) ctx.fillRect(0, this.H / 2 - 1, this.W, 2);
    if (viewKarts.length >= 3) ctx.fillRect(this.W / 2 - 1, 0, 2, this.H);
    if (!ui.demo) this.drawCountdown(sim);
    if (ui.paused) {
      ctx.fillStyle = 'rgba(10,6,20,0.6)'; ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  fillRect(vp, col) {
    for (let y = vp.y; y < vp.y + vp.h; y++) this.buf.fill(col, y * this.W + vp.x, y * this.W + vp.x + vp.w);
  }

  makeCam(k, vp) {
    const p = camParams(vp);
    const a = k.camA;
    const ca = Math.cos(a), sa = Math.sin(a);
    // cámara libre (cinemáticas)
    if (k.camX !== undefined) {
      let H = k.camH !== undefined ? k.camH : p.H;
      if (k.frameDist) H = (0.3 * (vp.h - p.hz) * k.frameDist) / p.focal + (k.camUp || 0);
      return { vp, ...p, a, ca, sa, x: k.camX, y: k.camY, H, target: k };
    }
    const lift = Math.max(0, k.z) * 0.6;
    return {
      vp, ...p, a, ca, sa,
      x: k.x - ca * CAM_DIST, y: k.y - sa * CAM_DIST,
      H: p.H + lift, target: k,
    };
  }

  // ------------------------------------------------------------
  drawSky(c) {
    const { vp, hz, focal, a } = c;
    const t = this.t, buf = this.buf;
    const key = `${vp.w}|${hz}`;
    let grad = this.gradCache[key];
    if (!grad) {
      grad = new Uint32Array(hz + 1);
      for (let y = 0; y <= hz; y++) {
        const f = hz ? y / hz : 1;
        const r = t.skyTop[0] + (t.skyHor[0] - t.skyTop[0]) * f;
        const g = t.skyTop[1] + (t.skyHor[1] - t.skyTop[1]) * f;
        const b = t.skyTop[2] + (t.skyHor[2] - t.skyTop[2]) * f;
        grad[y] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      }
      this.gradCache[key] = grad;
    }
    const akey = `${vp.w}|${focal}`;
    let at = this.atanCache[akey];
    if (!at) {
      at = new Float32Array(vp.w);
      for (let x = 0; x < vp.w; x++) at[x] = Math.atan((x - vp.w / 2) / focal);
      this.atanCache[akey] = at;
    }
    const strip = t.sky, SW = 2048, SH = 80;
    const TWO_PI = Math.PI * 2;
    for (let x = 0; x < vp.w; x++) {
      let ang = (a + at[x]) / TWO_PI;
      ang -= Math.floor(ang);
      const sc = (ang * SW) | 0;
      let o = vp.y * this.W + vp.x + x;
      for (let y = 0; y <= hz; y++, o += this.W) {
        const sr = SH - 1 - (hz - y);
        let col = grad[y];
        if (sr >= 0) {
          const s = strip[sr * SW + sc];
          if ((s >>> 24) > 100) col = s;
        }
        buf[o] = col;
      }
    }
  }

  drawFloor(c) {
    const { vp, hz, focal, H, ca, sa } = c;
    const tex = this.t.tex, outer = this.t.outer, buf = this.buf;
    const ks = 1 / (this.t.scale || 1); // mundo -> píxel de textura
    const hw = vp.w / 2;
    const fogCol = this.fogCol;
    const fr = fogCol & 255, fg = (fogCol >> 8) & 255, fb = (fogCol >> 16) & 255;
    for (let y = hz + 1; y < vp.h; y++) {
      const dy = y - hz;
      const f = (H * focal) / dy;
      let o = (vp.y + y) * this.W + vp.x;
      if (f > FOG1) { buf.fill(fogCol, o, o + vp.w); continue; }
      const scale = f / focal;
      let wx = (c.x + ca * f + sa * hw * scale) * ks;
      let wy = (c.y + sa * f - ca * hw * scale) * ks;
      const sx = -sa * scale * ks, sy = ca * scale * ks;
      const fog = f > FOG0 ? (f - FOG0) / (FOG1 - FOG0) : 0;
      if (fog <= 0) {
        for (let x = 0; x < vp.w; x++) {
          const u = wx | 0, v = wy | 0;
          buf[o++] = ((u | v) & ~2047) === 0 ? tex[(v << 11) | u] : outer[((v & 63) << 6) | (u & 63)];
          wx += sx; wy += sy;
        }
      } else {
        const inv = 1 - fog;
        const fR = fr * fog, fG = fg * fog, fB = fb * fog;
        for (let x = 0; x < vp.w; x++) {
          const u = wx | 0, v = wy | 0;
          const col = ((u | v) & ~2047) === 0 ? tex[(v << 11) | u] : outer[((v & 63) << 6) | (u & 63)];
          const r = ((col & 255) * inv + fR) | 0, g = (((col >> 8) & 255) * inv + fG) | 0, b = (((col >> 16) & 255) * inv + fB) | 0;
          buf[o++] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
          wx += sx; wy += sy;
        }
      }
    }
  }

  // ------------------------------------------------------------
  proj(c, x, y, z) {
    const dx = x - c.x, dy = y - c.y;
    const f = dx * c.ca + dy * c.sa;
    if (f < 8 || f > FOG1) return null;
    const r = -dx * c.sa + dy * c.ca;
    const s = c.focal / f;
    return { sx: c.vp.w / 2 + r * s, sy: c.hz + (c.H - z) * s, s, f };
  }

  drawSprites(sim, c, me) {
    const ctx = this.ctx, sp = this.sp, t = this.t;
    const list = [];
    const time = sim.time;
    const push = (p, draw) => { if (p && p.sx > -80 && p.sx < c.vp.w + 80) list.push({ f: p.f, p, draw }); };

    // decoración
    for (const d of t.decor) {
      const spec = sp.decor[d.kind];
      if (!spec) continue;
      const p = this.proj(c, d.x, d.y, spec.float || 0);
      if (p && p.f < CAM_DIST * 0.75) continue;
      push(p, () => this.billboard(spec.c, p, spec.w, d.kind === 'starcrystal' || d.kind === 'asteroid' ? Math.sin(time * 2 + d.x) * 4 * p.s : 0));
    }
    // cajas
    const bf = sp.fx.box[Math.floor(time * 6) % 4];
    for (const b of sim.boxes) {
      if (b.t > 0) continue;
      const z = 7 + Math.sin(time * 3 + b.x * 0.1) * 2.5;
      const p = this.proj(c, b.x, b.y, z);
      if (p) { push(p, () => { this.shadow(p, c, b.x, b.y, 8); this.billboard(bf.c, p, bf.w); }); }
    }
    // estrellas del modo historia
    if (sim.stars) {
      const sf = sp.fx.star[Math.floor(time * 8) % 4];
      for (const st of sim.stars) {
        if (st.taken) continue;
        const p = this.proj(c, st.x, st.y, 10 + Math.sin(time * 4 + st.x) * 3);
        if (p) push(p, () => { this.shadow(p, c, st.x, st.y, 7); this.billboard(sf.c, p, sf.w); });
      }
    }
    // charcos
    for (const pd of sim.puddles) {
      const spec = sp.fx[pd.type];
      const p = this.proj(c, pd.x, pd.y, 0);
      push(p, () => this.flat(spec.c, p, spec.w * (pd.r / (pd.type === 'oil' ? 16 : 34)), c));
    }
    // peligros
    for (const h of sim.hazards) {
      if (h.type === 'crab') {
        const fr = sp.fx.crab[Math.floor(time * 6) % 2];
        const p = this.proj(c, h.x, h.y, 0);
        push(p, () => this.billboard(fr.c, p, fr.w));
      } else if (h.type === 'fire') {
        const ph = h.phase || 0, warn = 1.2;
        if (ph > h.period - warn) {
          const k = (h.period - ph) / warn;
          const pg = this.proj(c, h.x, h.y, 0);
          push(pg, () => {
            ctx.fillStyle = `rgba(0,0,0,${0.5 - k * 0.35})`;
            const rr = (10 + (1 - k) * 18) * pg.s;
            ctx.beginPath(); ctx.ellipse(pg.sx, pg.sy, rr, rr * 0.35, 0, 0, Math.PI * 2); ctx.fill();
          });
          const p = this.proj(c, h.x, h.y, k * 280);
          const fr = sp.fx.fire[Math.floor(time * 10) % 2];
          push(p ? { ...p, f: p.f - 1 } : null, () => this.billboard(fr.c, p, fr.w));
        }
      }
    }
    // proyectiles
    for (const pr of sim.projs) {
      const spec = sp.fx[pr.type];
      const z = pr.type === 'honey' ? 12 + Math.sin(time * 12) * 2 : pr.type === 'gum' ? 3 + Math.abs(Math.sin(time * 10)) * 6 : 2;
      const p = this.proj(c, pr.x, pr.y, z);
      push(p, () => { this.shadow(p, c, pr.x, pr.y, pr.r); this.billboard(spec.c, p, spec.w); });
    }
    // efectos
    for (const e of sim.effects) {
      if (e.type === 'ring') {
        const p = this.proj(c, e.x, e.y, 0);
        push(p, () => {
          const k = 1 - e.t / e.max;
          ctx.strokeStyle = `rgba(255,220,120,${1 - k})`; ctx.lineWidth = Math.max(1, 3 * p.s);
          const rr = e.r * k * p.s;
          ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rr, rr * Math.min(1, c.H / p.f * 2.2), 0, 0, Math.PI * 2); ctx.stroke();
        });
      } else if (e.type === 'bolt') {
        const kk = sim.karts[e.kart];
        const p = this.proj(c, kk.x, kk.y, 0);
        push(p ? { ...p, f: p.f - 2 } : null, () => this.billboard(sp.fx.bolt.c, p, sp.fx.bolt.w));
      } else if (e.type === 'boom') {
        const p = this.proj(c, e.x, e.y, 6);
        push(p, () => {
          const k = 1 - e.t / e.max;
          ctx.fillStyle = `rgba(255,${180 - k * 120},40,${1 - k})`;
          ctx.beginPath(); ctx.arc(p.sx, p.sy - 10 * p.s, (12 + k * 26) * p.s, 0, Math.PI * 2); ctx.fill();
        });
      }
    }
    // partículas
    for (const pa of sim.parts) {
      const p = this.proj(c, pa.x, pa.y, pa.z);
      if (!p) continue;
      list.push({ f: p.f, p, draw: () => { ctx.globalAlpha = Math.min(1, pa.life / pa.max * 1.5); ctx.fillStyle = pa.col; const s = Math.max(1, Math.min(5, Math.round(pa.size * p.s * 2))); ctx.fillRect(Math.round(p.sx - s / 2), Math.round(p.sy - s), s, s); ctx.globalAlpha = 1; } });
    }
    // karts
    for (const k of sim.karts) {
      const p = this.proj(c, k.x, k.y, k.z);
      if (!p) continue;
      list.push({ f: p.f, p, draw: () => this.drawKart(sim, c, k, p, me) });
    }

    list.sort((a, b) => b.f - a.f);
    for (const it of list) it.draw();
  }

  billboard(img, p, worldW, lift = 0) {
    const sc = (worldW / img.width) * p.s;
    const w = img.width * sc, h = img.height * sc;
    if (w < 0.5) return;
    this.ctx.drawImage(img, Math.round(p.sx - w / 2), Math.round(p.sy - h - lift), Math.round(w) || 1, Math.round(h) || 1);
  }

  flat(img, p, worldW, c) {
    const sc = (worldW / img.width) * p.s;
    const w = img.width * sc;
    const h = Math.max(1, img.height * sc * Math.min(1, (c.H / p.f) * 2.4));
    this.ctx.drawImage(img, Math.round(p.sx - w / 2), Math.round(p.sy - h / 2), Math.round(w) || 1, Math.round(h));
  }

  shadow(p, c, x, y, r) {
    const g = this.proj(c, x, y, 0);
    if (!g) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    const rx = r * g.s;
    ctx.beginPath(); ctx.ellipse(g.sx, g.sy, rx, Math.max(1, rx * Math.min(0.6, (c.H / g.f) * 1.8)), 0, 0, Math.PI * 2); ctx.fill();
  }

  drawKart(sim, c, k, p, me) {
    const ctx = this.ctx;
    if (k.fallT > 0 && k.z < -20) return;
    // sombra
    if (k.fallT <= 0) {
      const g = this.proj(c, k.x, k.y, 0);
      if (g) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        const rx = (12 - Math.min(6, k.z * 0.08)) * g.s;
        ctx.beginPath(); ctx.ellipse(g.sx, g.sy, rx, Math.max(1, rx * Math.min(0.5, (c.H / g.f) * 1.6)), 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (k.invulnT > 0 && k.spinT <= 0 && k.frozenT <= 0 && Math.floor(sim.time * 16) % 2 === 0) return;
    const frames = k.boss ? getShadowFrames(k.char) : this.sp.karts[k.char];
    let rel = (k.a + k.spinVis + (k.drift ? k.drift * 0.35 : 0)) - c.a;
    let fi = Math.round((rel / (Math.PI * 2)) * KART_FRAMES) % KART_FRAMES;
    if (fi < 0) fi += KART_FRAMES;
    const img = frames[fi];
    const sc = KART_SPRITE.worldPerPx * p.s;
    const w = img.width * sc, h = img.height * sc;
    const bounce = k.boostT > 0 || (k.surface === 'off' && Math.abs(k.v) > 60) ? (Math.floor(sim.time * 20) % 2) * Math.max(1, sc * 0.6) : 0;
    const dx = Math.round(p.sx - KART_SPRITE.ax * sc), dy = Math.round(p.sy - KART_SPRITE.ay * sc - bounce);
    if (k.eliminated) ctx.globalAlpha = 0.45;
    else if (k !== me && p.f < CAM_DIST - 12 && !this.noLabels) ctx.globalAlpha = 0.5;
    ctx.drawImage(img, dx, dy, Math.round(w), Math.round(h));
    ctx.globalAlpha = 1;
    const cx = p.sx, top = dy + 4 * sc;
    if (k.frozenT > 0) { const ic = this.sp.fx.ice; const iw = ic.w * p.s; ctx.drawImage(ic.c, Math.round(cx - iw / 2), Math.round(p.sy - iw * 0.95), Math.round(iw), Math.round(iw)); }
    if (k.shieldT > 0) { const sh = this.sp.fx.shield; const sw = sh.w * p.s; ctx.globalAlpha = 0.8 + Math.sin(sim.time * 10) * 0.2; ctx.drawImage(sh.c, Math.round(cx - sw / 2), Math.round(p.sy - sw * 0.9), Math.round(sw), Math.round(sw)); ctx.globalAlpha = 1; }
    if (k.stickyT > 0) { ctx.fillStyle = '#ffb81e'; for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(cx - 12 * sc + i * 8 * sc), Math.round(p.sy - 14 * sc), Math.max(1, 3 * sc), Math.max(1, (4 + ((i + Math.floor(sim.time * 4)) % 3) * 3) * sc)); }
    // globos
    if (sim.mode === 'battle' && !k.eliminated) {
      for (let i = 0; i < k.balloons; i++) {
        const bx = cx + (i - (k.balloons - 1) / 2) * 10 * sc, by = top - 10 * sc + Math.sin(sim.time * 3 + i) * 1.5 * sc;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by + 4 * sc); ctx.lineTo(cx, top + 4 * sc); ctx.stroke();
        ctx.fillStyle = k.human ? SLOT_COLORS[k.slot] : k.ch.kart; ctx.beginPath(); ctx.ellipse(bx, by, 4 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(Math.round(bx - 2 * sc), Math.round(by - 3 * sc), Math.max(1, sc * 1.5), Math.max(1, sc * 1.5));
      }
    }
    // etiqueta de jefe
    if (k.boss && k !== me && p.f < 900 && !this.noLabels) {
      const label = sim.story && sim.story.type === 'chase' ? 'LADRÓN' : 'JEFE';
      ctx.font = `8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const ly = Math.round(top - 6);
      ctx.fillStyle = '#000'; ctx.fillText(label, Math.round(cx) + 1, ly + 1);
      ctx.fillStyle = Math.floor(sim.time * 4) % 2 ? '#d98aff' : '#b44dff'; ctx.fillText(label, Math.round(cx), ly);
    }
    // etiqueta de jugador
    if (k.human && k !== me && p.f < 700 && !this.noLabels) {
      const label = SLOT_NAMES[k.slot];
      ctx.font = `8px ${FONT}`; ctx.textAlign = 'center';
      const ly = Math.round(top - (sim.mode === 'battle' ? 18 * sc : 4 * sc) - 6);
      ctx.fillStyle = '#000'; ctx.fillText(label, Math.round(cx) + 1, ly + 1);
      ctx.fillStyle = SLOT_COLORS[k.slot]; ctx.fillText(label, Math.round(cx), ly);
    }
  }

  // ------------------------------------------------------------
  text(str, x, y, size, col, align = 'left', shadow = true) {
    const ctx = this.ctx;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'top';
    if (shadow) { ctx.fillStyle = '#120a18'; ctx.fillText(str, x + Math.max(1, size / 8), y + Math.max(1, size / 8)); }
    ctx.fillStyle = col; ctx.fillText(str, x, y);
  }

  drawHUD(sim, c, k, nViews, inset = 0) {
    const ctx = this.ctx;
    const { w: vw, h: vh } = c.vp;
    const big = vh >= 200;
    const u = big ? 1 : 0.5;
    const pad = big ? 8 : 4;
    const [iL, iR] = Array.isArray(inset) ? inset : [inset, inset];
    const L = pad + iL, R = vw - pad - iR;
    // destello
    if (k.flashT > 0) { ctx.fillStyle = `rgba(255,250,220,${Math.min(0.92, k.flashT / 1.2)})`; ctx.fillRect(0, 0, vw, vh); }

    // posición o globos
    if (sim.mode === 'race') {
      const pc = k.place === 1 ? '#ffd23f' : k.place === 2 ? '#d8dce6' : k.place === 3 ? '#e8954a' : '#ffffff';
      this.text(`${k.place}º`, L, pad, big ? 24 : 14, pc);
      const lap = Math.max(1, Math.min(sim.laps, k.lap));
      this.text(`VUELTA ${lap}/${sim.laps}`, R, pad, big ? 8 : 6, '#ffffff', 'right');
      this.text(fmtTime(k.finished ? k.finishTime : sim.raceTime), R, pad + (big ? 12 : 9), big ? 8 : 6, '#c8f0ff', 'right');
    } else {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < k.balloons ? SLOT_COLORS[k.slot] : 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(L + 6 * (big ? 1.4 : 1) + i * (big ? 16 : 11), pad + (big ? 9 : 6), big ? 6 : 4, big ? 8 : 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      const left = Math.max(0, sim.battleLeft);
      this.text(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, R, pad, big ? 10 : 7, left < 20 ? '#ff6a6a' : '#ffffff', 'right');
      this.text(`VIVOS ${sim.karts.filter((o) => !o.eliminated).length}`, R, pad + (big ? 14 : 10), big ? 7 : 5, '#c8f0ff', 'right');
    }

    // objeto
    const bs = big ? 28 : 18;
    const bx = Math.round(vw / 2 - bs / 2), by = pad;
    ctx.fillStyle = 'rgba(18,10,24,0.75)'; ctx.fillRect(bx, by, bs, bs);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bs - 1, bs - 1);
    let icon = null;
    if (k.rouletteT > 0) icon = ['chile', 'aceite', 'chicle', 'burbuja', 'iman'][Math.floor(sim.time * 14) % 5];
    else if (k.item) icon = k.item;
    if (icon) { const isz = big ? 20 : 14; ctx.drawImage(this.sp.items[icon], bx + (bs - isz) / 2, by + (bs - isz) / 2, isz, isz); }
    if (sim.objectiveText) this.text(sim.objectiveText, vw / 2, by + bs + 4, big ? 8 : 5, '#7ff6ff', 'center');

    // poder
    const py = vh - pad - (big ? 26 : 16);
    const pw = big ? 26 : 16;
    ctx.drawImage(this.sp.portraits[k.char], L, py, pw, pw);
    const barW = big ? 64 : 34, barH = big ? 6 : 4;
    const barX = L + pw + 3, barY = py + pw - barH - 2;
    ctx.fillStyle = 'rgba(18,10,24,0.8)'; ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    const ready = k.power >= 1;
    ctx.fillStyle = ready ? (Math.floor(sim.time * 6) % 2 ? '#ffd23f' : '#ff8a1e') : '#59c8ff';
    ctx.fillRect(barX, barY, Math.round(barW * k.power), barH);
    if (k.charges > 0) this.text(`TURBO x${k.charges}`, barX, barY - (big ? 11 : 8), big ? 7 : 5, '#ffd23f');
    else if (ready) this.text('¡PODER!', barX, barY - (big ? 11 : 8), big ? 7 : 5, '#ffd23f');
    else this.text(k.ch.powerName.toUpperCase(), barX, barY - (big ? 11 : 8), big ? 6 : 4, '#c8f0ff');

    // velocímetro
    const gx = R, gy = vh - pad - (big ? 22 : 14);
    this.text(`${Math.max(0, Math.round(Math.abs(k.v) * 0.5))}`, gx - (big ? 34 : 22), gy, big ? 14 : 9, k.boostT > 0 ? '#ffd23f' : '#ffffff', 'right');
    this.text('km/h', gx, gy + (big ? 6 : 4), big ? 6 : 4, '#c8f0ff', 'right');

    // minimapa (1 jugador)
    if (nViews === 1) this.drawMinimap(sim, R - 72, 34, 72);

    // mensaje
    if (k.messageT > 0 && k.message) {
      const sz = big ? 12 : 7;
      this.text(k.message, vw / 2, vh * 0.3, sz, k.message.startsWith('¡META') || k.message.startsWith('¡GAN') ? '#ffd23f' : '#ffffff', 'center');
    }
    if (k.fallT > 0) this.text('¡RESCATE!', vw / 2, vh * 0.45, big ? 10 : 6, '#7ff6ff', 'center');
    if (k.finished && sim.mode === 'race') this.drawMiniStandings(sim, vw / 2 - (big ? 60 : 38), vh * 0.42, big);
  }

  drawMinimap(sim, x, y, size) {
    const ctx = this.ctx, mm = this.t.minimap;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(mm, x, y, size, size);
    ctx.globalAlpha = 1;
    const k = size / (this.t.worldSize || 2048);
    for (const kt of sim.karts) {
      if (kt.eliminated) continue;
      ctx.fillStyle = kt.human ? SLOT_COLORS[kt.slot] : kt.ch.kart;
      const s = kt.human ? 4 : 3;
      ctx.fillRect(Math.round(x + kt.x * k - s / 2), Math.round(y + kt.y * k - s / 2), s, s);
      if (kt.human) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x + kt.x * k - s / 2) - 0.5, Math.round(y + kt.y * k - s / 2) - 0.5, s + 1, s + 1); }
    }
  }

  drawMiniStandings(sim, x, y, big) {
    const ctx = this.ctx;
    const sorted = [...sim.karts].sort((a, b) => a.place - b.place);
    const lh = big ? 11 : 7;
    ctx.fillStyle = 'rgba(18,10,24,0.7)'; ctx.fillRect(x - 4, y - 4, big ? 128 : 84, lh * sorted.length + 6);
    sorted.forEach((k, i) => {
      const col = k.human ? SLOT_COLORS[k.slot] : '#ffffff';
      this.text(`${k.place} ${k.ch.name}${k.human ? ' ' + SLOT_NAMES[k.slot] : ''}`, x, y + i * lh, big ? 7 : 5, col, 'left', false);
    });
  }

  drawSidePanel(sim, vp) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(vp.x, vp.y);
    this.drawMinimap(sim, 8, 10, 112);
    const sorted = [...sim.karts].sort((a, b) => a.place - b.place);
    sorted.forEach((k, i) => {
      const col = k.human ? SLOT_COLORS[k.slot] : '#c8c0e0';
      ctx.drawImage(this.sp.portraits[k.char], 128, 8 + i * 15, 12, 12);
      this.text(`${k.place} ${k.ch.name}`, 144, 11 + i * 15, 6, col, 'left', false);
    });
    ctx.restore();
  }

  drawCountdown(sim) {
    if (sim.started && sim.raceTime > 1) return;
    const ctx = this.ctx;
    if (!sim.started && sim.countdown > 3.05) {
      const name = this.t.def.name.toUpperCase();
      ctx.fillStyle = 'rgba(18,10,24,0.7)'; ctx.fillRect(0, this.H / 2 - 22, this.W, 44);
      this.text(name, this.W / 2, this.H / 2 - 12, 14, '#ffd23f', 'center');
      const sub = sim.story && sim.story.obj ? sim.story.obj.toUpperCase() : sim.mode === 'battle' ? 'BATALLA DE GLOBOS' : `${sim.laps || LAPS} VUELTAS`;
      this.text(sub, this.W / 2, this.H / 2 + 6, 7, sim.story ? '#7ff6ff' : '#ffffff', 'center');
      return;
    }
    const n = Math.ceil(sim.countdown);
    const label = sim.started ? '¡YA!' : String(n);
    const lit = sim.started ? 3 : 3 - n + 1;
    const lx = this.W / 2 - 30, ly = this.H / 2 - 34;
    ctx.fillStyle = '#1a1424'; ctx.fillRect(lx, ly, 60, 20);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = sim.started ? '#3ddc84' : i < lit ? '#ff4d5e' : '#3a2a3a';
      ctx.beginPath(); ctx.arc(lx + 10 + i * 20, ly + 10, 7, 0, Math.PI * 2); ctx.fill();
    }
    this.text(label, this.W / 2, this.H / 2 - 6, 24, sim.started ? '#3ddc84' : '#ffffff', 'center');
  }
}

export function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
