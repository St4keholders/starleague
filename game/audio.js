// Sonido sintetizado: efectos y música chiptune original (sin archivos)

const SONGS = [
  { // pradera
    bpm: 140, key: 60, roots: [0, 5, 7, 0], q: ['M', 'M', 'M', 'M'],
    mel: '7 . 9 7 4 . 2 4 | 5 . 4 5 9 . 7 . | 7 9 11 12 11 9 7 4 | 5 4 2 . 0 . . .',
  },
  { // playa
    bpm: 118, key: 65, roots: [0, 5, 7, 0], q: ['M', 'M', 'M', 'M'],
    mel: '0 4 7 4 9 . 7 . | 5 9 12 9 7 . 5 . | 4 7 11 7 12 . 11 . | 9 7 4 2 0 . . .',
  },
  { // nieve
    bpm: 112, key: 62, roots: [0, -4, -2, -5], q: ['m', 'M', 'M', 'M'],
    mel: '12 . 10 8 7 . 5 7 | 8 . 7 5 3 . 2 . | 3 5 7 10 8 7 5 . | 7 . 11 . 14 . . .',
  },
  { // volcán
    bpm: 152, key: 64, roots: [0, -4, -2, -5], q: ['m', 'M', 'M', 'M'],
    mel: '0 0 3 0 5 0 7 6 | 4 4 7 4 8 . 7 . | 5 5 9 5 10 9 7 5 | 6 . 3 . 11 . . .',
  },
  { // estelar
    bpm: 128, key: 57, roots: [0, -4, 3, -2], q: ['m', 'M', 'M', 'M'],
    mel: '12 . 15 . 19 . 17 15 | 12 . 8 . 12 . 15 . | 10 . 12 . 15 . 19 . | 17 15 14 . 12 . . .',
  },
  { // arena
    bpm: 146, key: 67, roots: [0, 5, 7, 0], q: ['M', 'M', 'M', 'M'],
    mel: '4 7 12 7 4 7 12 7 | 5 9 12 9 5 9 12 9 | 7 11 14 11 7 11 14 . | 12 . 7 . 4 . 0 .',
  },
  { // menú
    bpm: 100, key: 60, roots: [0, -3, 5, 7], q: ['M', 'm', 'M', 'M'],
    mel: '12 . . 7 . 9 . . | 12 . . 4 . 7 . . | 9 . 7 . 5 . 4 . | 2 . . 4 . 7 . .',
  },
  { // 7 · Fortaleza Eclipse (final)
    bpm: 160, key: 62, roots: [0, -4, -7, -5], q: ['m', 'M', 'M', 'M'],
    mel: '0 3 7 12 11 7 3 7 | 8 . 7 . 3 . 0 . | 5 8 12 15 14 12 8 5 | 7 . 11 . 14 . 12 11',
  },
  { // 8 · cinemáticas
    bpm: 84, key: 57, roots: [0, -4, 3, -2], q: ['m', 'M', 'M', 'M'],
    mel: '12 . . . 10 . . . | 8 . . . 7 . . . | 7 . . 8 . . 10 . | 12 . . . . . . .',
  },
  { // 9 · cinemática del villano
    bpm: 96, key: 50, roots: [0, 1, 0, -1], q: ['m', 'M', 'm', 'M'],
    mel: '0 . 3 . 6 . 3 . | 1 . 4 . 7 . 4 . | 0 . 3 . 6 . 9 . | 8 . 6 . 3 . 1 .',
  },
  { // 10 · Anillos de Saturnia
    bpm: 132, key: 64, roots: [0, -3, 5, 2], q: ['M', 'm', 'M', 'm'],
    mel: '12 . 11 . 7 . 4 7 | 9 . 12 . 16 . 14 12 | 11 . 7 . 9 11 12 . | 14 . 12 . 7 . . .',
  },
  { // 11 · Jungla Gloop
    bpm: 124, key: 60, roots: [0, 3, 5, 3], q: ['m', 'M', 'm', 'M'],
    mel: '0 3 . 7 . 3 10 . | 8 . 7 . 5 3 . 0 | 3 5 7 . 10 . 12 10 | 7 . 5 . 3 . . .',
  },
  { // 12 · Ciudad Neón
    bpm: 150, key: 62, roots: [0, 0, -4, -2], q: ['m', 'm', 'M', 'M'],
    mel: '12 12 15 12 10 . 12 . | 15 . 17 15 12 . 10 . | 8 8 12 8 7 . 8 . | 10 . 12 . 14 . 15 .',
  },
  { // 13 · Coliseo de Zorg
    bpm: 158, key: 57, roots: [0, -2, -4, -5], q: ['m', 'M', 'M', 'M'],
    mel: '0 . 0 3 7 . 12 . | 10 . 8 7 8 . 10 . | 12 12 15 12 10 8 7 . | 5 . 7 . 3 . 0 .',
  },
  { // 14 · tema de Zorg
    bpm: 104, key: 52, roots: [0, 1, 0, 3], q: ['m', 'M', 'm', 'M'],
    mel: '0 . 7 . 6 . 3 . | 1 . 8 . 7 . 4 . | 0 . 7 . 12 . 11 . | 10 . 7 . 3 . 1 .',
  },
];
export const ZORG_SONG = 14;
export const STORY_SONG = 8;
export const VILLAIN_SONG = 9;

function parseMel(s) {
  return s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((t) => (t === '.' ? null : Number(t)));
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.song = -1;
    this.timer = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(f, dur, type = 'square', vol = 0.2, slide = null, at = 0, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 3000, slide = null, at = 0, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'count': this.tone(440, 0.25, 'square', 0.25); break;
      case 'go': this.tone(880, 0.6, 'square', 0.25); this.tone(1320, 0.6, 'square', 0.12); break;
      case 'itemget': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.08, 'square', 0.12, null, i * 0.05)); break;
      case 'box': this.noise(0.12, 0.25, 5000); this.tone(1200, 0.1, 'triangle', 0.12, 2400); break;
      case 'boost': this.noise(0.45, 0.25, 600, 3000); break;
      case 'hit': this.tone(600, 0.45, 'sawtooth', 0.2, 80); this.noise(0.2, 0.2, 1200); break;
      case 'bump': this.tone(120, 0.12, 'square', 0.18, 60); break;
      case 'hop': this.tone(300, 0.08, 'square', 0.1, 600); break;
      case 'spark1': this.tone(1600, 0.06, 'square', 0.07); break;
      case 'spark2': this.tone(2000, 0.06, 'square', 0.08); this.tone(2600, 0.06, 'square', 0.06, null, 0.05); break;
      case 'jump': this.tone(300, 0.3, 'square', 0.14, 900); break;
      case 'shift': this.noise(0.05, 0.2, 2500); break;
      case 'perfect': this.tone(988, 0.08, 'square', 0.14); this.tone(1318, 0.12, 'square', 0.14, null, 0.07); break;
      case 'lap': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.12, 'square', 0.15, null, i * 0.09)); break;
      case 'final': [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => this.tone(f, 0.1, 'square', 0.15, null, i * 0.08)); break;
      case 'finish': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, 'square', 0.16, null, i * 0.12)); break;
      case 'splash': this.noise(0.6, 0.3, 2000, 300); break;
      case 'fall': this.tone(800, 0.8, 'triangle', 0.2, 80); break;
      case 'drop': this.tone(200, 0.15, 'triangle', 0.2, 90); break;
      case 'throw': this.tone(700, 0.12, 'square', 0.12, 1400); break;
      case 'shield': this.tone(500, 0.3, 'sine', 0.2, 1200); break;
      case 'pop': this.noise(0.15, 0.3, 4000); break;
      case 'magnet': this.tone(300, 0.3, 'sawtooth', 0.12, 900); break;
      case 'quake': this.noise(0.8, 0.4, 120, 60); this.tone(60, 0.6, 'square', 0.2, 40); break;
      case 'flash': this.tone(2000, 0.4, 'sine', 0.2, 4000); break;
      case 'thunder': this.noise(0.9, 0.45, 800, 100); break;
      case 'balloon': this.noise(0.1, 0.35, 3000); break;
      case 'elim': [400, 300, 200, 100].forEach((f, i) => this.tone(f, 0.15, 'square', 0.15, null, i * 0.12)); break;
      case 'boom': this.noise(0.5, 0.35, 400, 80); break;
      case 'ready': this.tone(1046, 0.1, 'triangle', 0.15); this.tone(1568, 0.15, 'triangle', 0.15, null, 0.08); break;
      case 'select': this.tone(880, 0.06, 'square', 0.1); break;
      case 'join': this.tone(660, 0.08, 'square', 0.12); this.tone(990, 0.12, 'square', 0.12, null, 0.08); break;
      default: break;
    }
  }

  playSong(i) {
    if (!this.ctx) return;
    if (this.song === i) return;
    this.stopSong();
    this.song = i;
    const s = SONGS[i];
    const mel = parseMel(s.mel);
    const stepDur = 60 / s.bpm / 2;
    let step = 0;
    let next = this.ctx.currentTime + 0.1;
    const dest = this.musicGain;
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.15) {
        const at = next - this.ctx.currentTime;
        const bar = Math.floor(step / 8) % 4;
        const root = s.key + s.roots[bar];
        const third = s.q[bar] === 'm' ? 3 : 4;
        const st = step % 8;
        const m = mel[step % mel.length];
        if (m !== null && m !== undefined) this.tone(mtof(s.key + 12 + m), stepDur * 1.6, 'square', 0.09, null, at, dest);
        const arp = [0, third, 7, 12][st % 4];
        this.tone(mtof(root + arp), stepDur * 0.9, 'triangle', 0.07, null, at, dest);
        if (st % 2 === 0) this.tone(mtof(root - 24 + (st === 4 ? 7 : 0)), stepDur * 1.8, 'triangle', 0.16, null, at, dest);
        if (st % 4 === 0) this.tone(150, 0.12, 'sine', 0.3, 45, at, dest);
        if (st % 2 === 1) this.noise(0.04, 0.06, 7000, null, at, dest);
        if (st === 4) this.noise(0.1, 0.12, 1800, null, at, dest);
        step++;
        next += stepDur;
      }
    };
    tick();
    this.timer = setInterval(tick, 40);
  }

  stopSong() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = -1;
  }
}

export const MENU_SONG = 6;
