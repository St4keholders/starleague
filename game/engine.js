// Motor del anfitrión (pantalla del PC/TV)
import { VILLAIN, CHARACTERS, MAX_PLAYERS, PEER_PREFIX, RACE_KARTS, BATTLE_KARTS, CUP_POINTS, TRACK_NAMES, MODES, DIFFICULTIES } from './constants.js';
import { Sim } from './sim.js';
import { Renderer, drawCinemaFx } from './render.js';
import { buildTrack, THEMES } from './trackgfx.js';
import { Audio, MENU_SONG, STORY_SONG, VILLAIN_SONG, ZORG_SONG } from './audio.js';
import { TIME_LIMITS, STORIES, storyById } from './story.js';
import { Cinema } from './cinema.js';
import { peerOptionsFromURL, peerParamsString } from './peeropts.js';
import { raceInitMsg, snapshotMsg } from './mirror.js';

export { peerParamsString };

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STEP = 1 / 60;

const KB = {
  // el carro acelera solo: "join" solo sirve para unirse en el lobby
  kbA: { left: ['KeyA'], right: ['KeyD'], join: ['KeyW'], brake: ['KeyS'], drift: ['Space'], item: ['KeyQ'], power: ['KeyE'] },
  kbB: { left: ['ArrowLeft'], right: ['ArrowRight'], join: ['ArrowUp'], brake: ['ArrowDown'], drift: ['ShiftRight', 'Numpad0'], item: ['Slash', 'Numpad1', 'Minus'], power: ['Period', 'Numpad2'] },
};

function randCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function loadCfg() {
  const def = { mode: 'copa', track: 0, diff: 1, level: 0, story: 1 };
  try { const c = JSON.parse(localStorage.getItem('sl_cfg') || 'null'); if (c && typeof c === 'object') return { ...def, ...c }; } catch (e) { /* sin almacenamiento */ }
  return def;
}

// personajes que se desbloquean al terminar una historia (se guarda en este dispositivo)
function loadUnlocks() {
  try { return JSON.parse(localStorage.getItem('sl_unlocks') || '[]'); } catch (e) { return []; }
}

export class GameHost {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.renderer = new Renderer(canvas);
    this.audio = new Audio();
    this.players = [null, null, null, null];
    this.cfg = loadCfg();
    this.unlocks = loadUnlocks();
    this.phase = 'lobby';
    this.code = null;
    this.peerStatus = 'connecting';
    this.peerError = '';
    this.conns = new Map(); // conn -> slot
    this.keys = new Set();
    this.pend = {}; // eventos de un solo toque por slot
    this.phoneIn = {};
    this.cup = null;
    this.results = null;
    this.paused = false;
    this.sim = null;
    this.demo = null;
    this.trackCache = {};
    this.running = true;
    this.acc = 0;
    this.last = performance.now();
    this.hudTimer = 0;
    this.snapTimer = 0;
    this.sfxOut = [];
    this.raceInit = null;
    // "sin pantalla principal": quien crea la sala también juega en este mismo dispositivo
    this.localSlot = null;
    this.localIn = { steer: 0, brake: false, drift: false };
    this.viewSize = null;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.startDemo();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.initPeer();
  }

  destroy() {
    this.running = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.audio.stopSong();
    try { this.peer && this.peer.destroy(); } catch (e) { /* nada */ }
  }

  // ---------------- estado para React ----------------
  snapshot() {
    return {
      phase: this.phase, code: this.code, peerStatus: this.peerStatus, peerError: this.peerError,
      players: this.players.map((p) => p && { slot: p.slot, kind: p.kind, char: p.char, connected: p.connected }),
      extra: this.playableIds().filter((id) => !CHARACTERS.some((c) => c.id === id)),
      cfg: { ...this.cfg }, cup: this.cup && { current: this.cup.current, total: this.cup.races.length, points: { ...this.cup.points } },
      results: this.results, paused: this.paused, muted: this.audio.muted,
      raceName: this.sim ? this.sim.track.def.name : '',
      cine: this.cinema ? this.cinema.state() : null,
      local: this.localSlot,
      story: this.storyInfo(),
      mode: this.sim ? this.sim.mode : null,
    };
  }
  changed() { this.onChange && this.onChange(this.snapshot()); }

  // ---------------- red ----------------
  async initPeer() {
    let code = null;
    try { code = sessionStorage.getItem('sl_code'); } catch (e) { /* nada */ }
    if (!code) code = randCode();
    this.code = code;
    try { sessionStorage.setItem('sl_code', code); } catch (e) { /* nada */ }
    this.changed();
    let PeerCls;
    try { PeerCls = (await import('peerjs')).Peer; } catch (e) { this.peerStatus = 'error'; this.peerError = 'No se pudo cargar la conexión'; this.changed(); return; }
    const open = () => {
      const peer = new PeerCls(PEER_PREFIX + this.code, peerOptionsFromURL());
      this.peer = peer;
      peer.on('open', () => { this.peerStatus = 'ready'; this.peerError = ''; this.changed(); });
      peer.on('connection', (conn) => this.handleConn(conn));
      peer.on('disconnected', () => { this.peerStatus = 'connecting'; this.changed(); setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* nada */ } }, 1500); });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          try { peer.destroy(); } catch (e) { /* nada */ }
          this.code = randCode();
          try { sessionStorage.setItem('sl_code', this.code); } catch (e) { /* nada */ }
          this.changed();
          setTimeout(open, 300);
        } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          this.peerStatus = 'error'; this.peerError = 'Sin conexión con el servidor de mandos. Reintentando...'; this.changed();
          setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* nada */ } }, 3000);
        } else if (err.type !== 'peer-unavailable') {
          this.peerError = String(err.type || err.message || err); this.changed();
        }
      });
    };
    open();
  }

  handleConn(conn) {
    conn.on('data', (msg) => this.onMsg(conn, msg));
    conn.on('close', () => this.dropConn(conn));
    conn.on('error', () => this.dropConn(conn));
  }

  dropConn(conn) {
    const slot = this.conns.get(conn);
    this.conns.delete(conn);
    if (slot === undefined) return;
    const p = this.players[slot];
    if (p && p.conn === conn) {
      p.connected = false; p.conn = null;
      if (this.phase === 'lobby') { this.players[slot] = null; this.broadcastLobby(); }
      this.changed();
    }
  }

  send(slot, msg) {
    const p = this.players[slot];
    if (p && p.conn && p.conn.open) { try { p.conn.send(msg); } catch (e) { /* nada */ } }
  }
  broadcast(msgFn) {
    this.players.forEach((p, i) => { if (p && p.kind === 'phone') this.send(i, typeof msgFn === 'function' ? msgFn(i) : msgFn); });
  }

  hostSlot() {
    if (this.localSlot !== null) return this.localSlot; // manda quien creó la sala
    const i = this.players.findIndex((p) => p && p.kind === 'phone' && p.connected);
    return i;
  }

  playableIds() {
    const ids = CHARACTERS.map((c) => c.id);
    if (this.unlocks.includes(VILLAIN.id)) ids.push(VILLAIN.id);
    return ids;
  }

  unlock(id) {
    if (!id || this.unlocks.includes(id)) return;
    this.unlocks.push(id);
    try { localStorage.setItem('sl_unlocks', JSON.stringify(this.unlocks)); } catch (e) { /* nada */ }
  }

  storyLevels(id) { return storyById(id || (this.storyRun ? this.storyRun.story : this.cfg.story)).levels; }

  // ---------------- jugar en el mismo dispositivo que crea la sala ----------------
  addLocal() {
    if (this.localSlot !== null || this.phase !== 'lobby') return;
    let slot = this.players[0] ? this.players.findIndex((p) => !p) : 0;
    if (slot < 0) return;
    this.players[slot] = { slot, kind: 'local', char: this.freeChar(), connected: true };
    this.localSlot = slot;
    this.audio.init();
    this.audio.sfx('join');
    this.broadcastLobby();
    this.changed();
  }

  setLocalChar(char) {
    const p = this.localSlot !== null && this.players[this.localSlot];
    if (!p || this.phase !== 'lobby' || !this.playableIds().includes(char)) return;
    p.char = char;
    this.audio.sfx('select');
    this.broadcastLobby();
    this.changed();
  }

  localPress(what) {
    if (this.localSlot === null) return;
    const pd = this.pend[this.localSlot] || (this.pend[this.localSlot] = {});
    pd[what] = true;
  }

  // tamaño del dibujo: 16:9 en el TV; en modo celular se adapta a la pantalla
  setViewSize(w, h) {
    const key = `${w}x${h}`;
    if (this.viewSize === key) return;
    this.viewSize = key;
    this.renderer = new Renderer(this.canvas, w, h);
    const t = this.sim ? this.sim.track : this.cinema ? this.cinema.track : this.demo ? this.demo.track : null;
    if (t) this.renderer.setTrack(t);
  }

  localKart() {
    if (this.localSlot === null || !this.sim) return null;
    return this.sim.karts.find((k) => k.human && k.slot === this.localSlot) || null;
  }

  localHud() {
    const k = this.localKart();
    if (!k) return null;
    return { drift: k.driftLevel, power: k.power, charges: k.charges, item: k.rouletteT > 0 ? '?' : k.item, started: this.sim.started };
  }

  lobbyMsg(slot) {
    return {
      t: 'lobby', you: slot, host: this.hostSlot() === slot, phase: this.phase, noScreen: this.localSlot !== null,
      players: this.players.map((p) => p && { kind: p.kind, char: p.char, connected: p.connected }),
      cfg: this.cfg,
      tracks: TRACK_NAMES,
      levels: this.storyLevels(this.cfg.story).map((l) => `${l.n}. ${l.title}`),
      stories: STORIES.map((st) => ({ id: st.id, title: st.title, n: st.levels.length })),
      extra: this.playableIds().filter((id) => !CHARACTERS.some((c) => c.id === id)),
    };
  }
  broadcastLobby() { this.broadcast((i) => this.lobbyMsg(i)); }

  freeChar() {
    const used = new Set(this.players.filter(Boolean).map((p) => p.char));
    return (CHARACTERS.find((c) => !used.has(c.id)) || CHARACTERS[0]).id;
  }

  onMsg(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      let slot = this.players.findIndex((p) => p && p.kind === 'phone' && p.pid === msg.pid);
      if (slot < 0) {
        slot = this.players.findIndex((p) => !p);
        if (slot < 0) { try { conn.send({ t: 'full' }); } catch (e) { /* nada */ } return; }
        this.players[slot] = { slot, kind: 'phone', pid: msg.pid, char: this.freeChar(), connected: true, conn, late: this.phase !== 'lobby' };
        this.audio.sfx('join');
      } else {
        const p = this.players[slot];
        if (p.conn && p.conn !== conn) { try { p.conn.close(); } catch (e) { /* nada */ } this.conns.delete(p.conn); }
        p.conn = conn; p.connected = true;
      }
      this.conns.set(conn, slot);
      try { conn.send({ t: 'welcome', slot }); } catch (e) { /* nada */ }
      this.broadcastLobby();
      if (this.phase !== 'lobby') this.send(slot, this.phaseMsg(slot));
      if ((this.phase === 'race' || this.phase === 'cinematic') && this.raceInit) this.send(slot, this.raceInit);
      this.changed();
      return;
    }
    const slot = this.conns.get(conn);
    if (slot === undefined) return;
    const p = this.players[slot];
    if (!p) return;
    switch (msg.t) {
      case 'in': {
        const prev = this.phoneIn[slot] || { ic: msg.ic, pc: msg.pc };
        const pd = this.pend[slot] || (this.pend[slot] = {});
        if (msg.ic > prev.ic) pd.item = true;
        if (msg.pc > prev.pc) pd.power = true;
        this.phoneIn[slot] = msg;
        p.lastSeen = performance.now();
        break;
      }
      case 'pick':
        if (this.phase !== 'lobby') break;
        if (this.playableIds().includes(msg.char)) p.char = msg.char;
        this.audio.sfx('select');
        this.broadcastLobby(); this.changed();
        break;
      case 'cfg':
        if (this.hostSlot() !== slot || this.phase !== 'lobby') break;
        this.setCfg(msg.cfg || {});
        break;
      case 'start':
        if (this.hostSlot() === slot) this.startGame();
        break;
      case 'next':
        if (this.hostSlot() === slot) this.next();
        break;
      case 'pause':
        if (this.phase === 'race') this.togglePause();
        break;
      case 'view':
        p.view = !!msg.on;
        if (p.view && (this.phase === 'race' || this.phase === 'cinematic') && this.raceInit) this.send(slot, this.raceInit);
        break;
      case 'cnext':
        if (this.phase === 'cinematic') this.cineNext();
        break;
      case 'cskip':
        if (this.hostSlot() === slot && this.phase === 'cinematic') this.cineSkip();
        break;
      case 'skiplevel':
        if (this.hostSlot() === slot && this.phase === 'storyresult') this.skipLevel();
        break;
      case 'quit':
        if (this.hostSlot() === slot) this.toLobby();
        break;
      default: break;
    }
  }

  setCfg(c) {
    if (c.mode && MODES.some((m) => m.id === c.mode)) this.cfg.mode = c.mode;
    if (Number.isInteger(c.track) && c.track >= 0 && c.track < TRACK_NAMES.length) this.cfg.track = c.track;
    if (Number.isInteger(c.diff) && DIFFICULTIES.some((d) => d.id === c.diff)) this.cfg.diff = c.diff;
    if (Number.isInteger(c.story) && STORIES.some((st) => st.id === c.story) && c.story !== this.cfg.story) { this.cfg.story = c.story; this.cfg.level = 0; }
    if (Number.isInteger(c.level) && c.level >= 0 && c.level < this.storyLevels(this.cfg.story).length) this.cfg.level = c.level;
    try { localStorage.setItem('sl_cfg', JSON.stringify(this.cfg)); } catch (e) { /* nada */ }
    this.audio.sfx('select');
    if (this.phase === 'lobby') this.startDemo();
    this.broadcastLobby(); this.changed();
  }

  // ---------------- teclado ----------------
  onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Slash'].includes(code)) e.preventDefault();
    this.audio.init();
    if (this.phase === 'lobby' && this.audio.song === -1) this.audio.playSong(MENU_SONG);
    if (e.repeat) { this.keys.add(code); return; }
    this.keys.add(code);
    if (code === 'KeyM') { this.toggleMute(); return; }
    if (this.phase === 'lobby') {
      for (const kind of ['kbA', 'kbB']) {
        const map = KB[kind];
        const slot = this.players.findIndex((p) => p && p.kind === kind);
        if (slot < 0) {
          if (map.join.includes(code)) {
            const free = this.players.findIndex((p) => !p);
            if (free >= 0) { this.players[free] = { slot: free, kind, char: this.freeChar(), connected: true }; this.audio.sfx('join'); this.broadcastLobby(); this.changed(); }
          }
        } else {
          const p = this.players[slot];
          const ci = CHARACTERS.findIndex((c) => c.id === p.char);
          if (map.left.includes(code)) { p.char = CHARACTERS[(ci + CHARACTERS.length - 1) % CHARACTERS.length].id; this.audio.sfx('select'); }
          else if (map.right.includes(code)) { p.char = CHARACTERS[(ci + 1) % CHARACTERS.length].id; this.audio.sfx('select'); }
          else if ((kind === 'kbA' && code === 'KeyQ') || (kind === 'kbB' && code === 'Backspace')) { this.players[slot] = null; }
          else continue;
          this.broadcastLobby(); this.changed();
        }
      }
      if (code === 'Enter' || code === 'NumpadEnter') this.startGame();
      return;
    }
    if (this.phase === 'race') {
      if (code === 'Escape' || code === 'KeyP') { this.togglePause(); return; }
      for (const kind of ['kbA', 'kbB']) {
        const slot = this.players.findIndex((p) => p && p.kind === kind);
        if (slot < 0) continue;
        const map = KB[kind];
        const pd = this.pend[slot] || (this.pend[slot] = {});
        if (map.item.includes(code)) pd.item = true;
        if (map.power.includes(code)) pd.power = true;
      }
      return;
    }
    if (this.phase === 'cinematic') {
      if (code === 'Escape') this.cineSkip();
      else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { if (!(this.cineHook && this.cineHook())) this.cineNext(); }
      return;
    }
    if (['results', 'podium', 'storyresult', 'storyend'].includes(this.phase) && (code === 'Enter' || code === 'NumpadEnter' || code === 'Space')) this.next();
  }
  onKeyUp(e) { this.keys.delete(e.code); }

  kbInput(kind) {
    const m = KB[kind], k = this.keys;
    const any = (arr) => arr.some((c) => k.has(c));
    return { steer: (any(m.right) ? 1 : 0) - (any(m.left) ? 1 : 0), acc: true, brake: any(m.brake), drift: any(m.drift) };
  }

  removePlayer(slot) {
    if (this.phase !== 'lobby') return;
    const p = this.players[slot];
    if (!p) return;
    if (p.conn) {
      const c = p.conn;
      try { c.send({ t: 'kicked' }); } catch (e) { /* nada */ }
      this.conns.delete(c);
      setTimeout(() => { try { c.close(); } catch (e) { /* nada */ } }, 300);
    }
    this.players[slot] = null;
    if (slot === this.localSlot) { this.localSlot = null; this.viewSize = null; this.renderer = new Renderer(this.canvas); if (this.demo) this.renderer.setTrack(this.demo.track); }
    this.broadcastLobby();
    this.changed();
  }

  toggleMute() { this.audio.setMuted(!this.audio.muted); this.changed(); }

  // ---------------- flujo del juego ----------------
  getTrack(index) {
    if (!this.trackCache[index]) this.trackCache[index] = buildTrack(index);
    return this.trackCache[index];
  }

  startDemo() {
    const idx = this.cfg.mode === 'batalla' ? 'arena' : this.cfg.mode === 'rapida' ? this.cfg.track : this.cfg.mode === 'historia' ? (this.storyLevels(this.cfg.story)[this.cfg.level || 0] || this.storyLevels(this.cfg.story)[0]).track : 0;
    const t = this.getTrack(idx);
    this.demo = new Sim({ track: t, mode: idx === 'arena' ? 'battle' : 'race', humans: [], difficulty: 2, kartsTotal: idx === 'arena' ? 6 : 8, demo: true });
    this.demo.countdown = 0; this.demo.started = true; this.demo.demo = true;
    this.renderer.setTrack(t);
  }

  activePlayers() { return this.players.filter(Boolean); }

  startGame() {
    if (this.phase !== 'lobby') return;
    if (!this.activePlayers().length) return;
    this.audio.init();
    this.players.forEach((p) => { if (p) p.late = false; });
    if (this.cfg.mode === 'copa') {
      const humans = new Set(this.activePlayers().map((p) => p.char));
      const free = CHARACTERS.map((c) => c.id).filter((id) => !humans.has(id)).sort(() => Math.random() - 0.5);
      this.cup = { races: [0, 1, 2, 3, 4], current: 0, points: {}, bots: free };
    } else this.cup = null;
    if (this.cfg.mode === 'historia') {
      this.storyRun = { story: this.cfg.story || 1, level: Math.min(this.cfg.level || 0, this.storyLevels(this.cfg.story).length - 1) };
      this.startStoryLevel(true);
      return;
    }
    this.storyRun = null;
    this.startRace();
  }

  // ---------------- modo historia ----------------
  storyLevel() { return this.storyRun ? this.storyLevels()[this.storyRun.level] : null; }

  // 'h0' = clon del personaje de J1
  resolveChar(id) {
    if (id === 'h0') return this.heroChars()[0] || 'pipo';
    return id || null;
  }

  storyInfo() {
    const l = this.storyLevel();
    if (!l) return null;
    const st = storyById(this.storyRun.story);
    return { story: st.id, storyTitle: st.title, end: st.end, n: l.n, total: st.levels.length, title: l.title, chapter: l.chapter, obj: l.obj, result: this.storyResult || null };
  }

  heroChars() {
    return this.activePlayers().sort((a, b) => a.slot - b.slot).map((p) => p.char);
  }

  startStoryLevel(withIntro) {
    const l = this.storyLevel();
    this.storyResult = null;
    if (withIntro && l.intro && l.intro.length) this.playCinema(l.intro, l, () => this.startRace());
    else this.startRace();
  }

  playCinema(shots, level, onDone) {
    const levels = this.storyLevels();
    const i = levels.indexOf(level);
    const next = levels[i + 1];
    const src = level.boss ? level : next && next.boss ? next : level;
    const track = this.getTrack(level.track);
    this.cinema = new Cinema({
      track, shots, heroes: this.heroChars(),
      bossChar: this.resolveChar(src.boss), bossSkin: src.bossSkin,
      allyChar: level.ally || null, rivalSkin: level.rivalSkin || null,
    });
    this.cinemaDone = onDone;
    this.cineVersion = -1;
    this.sim = null;
    this.renderer.setTrack(track);
    // los celulares con vista de juego también ven la cinemática
    this.raceInit = { ...raceInitMsg(this.cinema.scene, level.track), cinema: true, song: STORY_SONG };
    this.broadcast(this.raceInit);
    this.snapTimer = 0;
    this.phase = 'cinematic';
    this.paused = false;
    this.audio.playSong(STORY_SONG);
    this.broadcast((p) => this.phaseMsg(p));
    this.changed();
  }

  cineNext() { if (this.cinema) this.cinema.next(); }
  cineSkip() { if (this.cinema) this.cinema.skip(); }

  advanceStory() {
    this.storyRun.level++;
    if (this.storyRun.level >= this.storyLevels().length) {
      const st = storyById(this.storyRun.story);
      if (st.end && st.end.unlock) { this.unlock(st.end.unlock); this.broadcastLobby(); }
      this.storyRun.level = this.storyLevels().length - 1;
      this.storyResult = 'win';
      this.phase = 'storyend';
      this.sim = null;
      this.audio.playSong(STORY_SONG);
      this.broadcast((p) => this.phaseMsg(p));
      this.changed();
      return;
    }
    this.startStoryLevel(true);
  }

  skipLevel() {
    if (!this.storyRun) return;
    this.advanceStory();
  }

  startRace() {
    const mode = this.cfg.mode;
    const battle = mode === 'batalla';
    const lvl = this.storyLevel();
    const idx = lvl ? lvl.track : battle ? 'arena' : mode === 'copa' ? this.cup.races[this.cup.current] : this.cfg.track;
    const track = this.getTrack(idx);
    this.players.forEach((p) => { if (p) p.late = false; });
    const humans = this.activePlayers().map((p) => ({ slot: p.slot, char: p.char }));
    const story = lvl ? {
      type: lvl.type, boss: this.resolveChar(lvl.boss), bossSkin: lvl.bossSkin, ally: lvl.ally || null, rivalSkin: lvl.rivalSkin || null,
      maxAhead: lvl.maxAhead, goal: lvl.goal || 0, hits: lvl.hits || 0, target: lvl.target || 3, obj: lvl.obj,
      time: lvl.type === 'time' ? (TIME_LIMITS[this.cfg.diff] || TIME_LIMITS[1]) : 0,
    } : null;
    this.cinema = null;
    this.storyResult = null;
    this.sim = new Sim({
      track, mode: battle && !lvl ? 'battle' : 'race', humans, difficulty: this.cfg.diff,
      kartsTotal: battle && !lvl ? BATTLE_KARTS : RACE_KARTS, botChars: this.cup ? this.cup.bots : null,
      laps: lvl ? lvl.laps : undefined, story,
    });
    this.renderer.setTrack(track);
    this.phase = 'race';
    this.paused = false;
    this.results = null;
    this.pend = {};
    this.audio.playSong(battle && !lvl ? 5 : THEMES[track.theme].music);
    this.broadcast((i) => this.phaseMsg(i));
    // datos fijos de la carrera para los celulares que muestran el juego
    this.raceInit = raceInitMsg(this.sim, idx);
    this.raceInit.song = battle && !lvl ? 5 : THEMES[track.theme].music;
    this.sfxOut = [];
    this.broadcast(this.raceInit);
    this.changed();
  }

  phaseMsg(slot) {
    const m = { t: 'phase', phase: this.phase, host: this.hostSlot() === slot, mode: this.sim ? this.sim.mode : null, track: this.sim ? this.sim.track.def.name : '' };
    if (this.results) {
      const mine = this.results.find((r) => r.human && r.slot === slot);
      m.place = mine ? mine.place : null;
      m.cupLeft = this.cup ? this.cup.races.length - 1 - this.cup.current : 0;
      m.cup = !!this.cup;
    }
    m.story = this.storyInfo();
    if (this.phase === 'cinematic' && this.cinema) m.cine = this.cinema.state();
    if (this.phase === 'podium' && this.cup) m.standings = this.cupStandings().map((s) => ({ place: s.place, name: s.name, points: s.points, slot: s.slot }));
    return m;
  }

  endRace() {
    if (this.storyRun) {
      this.sim.results();
      this.storyResult = this.sim.storyState.result === 'win' ? 'win' : 'lose';
      this.phase = 'storyresult';
      this.paused = false;
      this.broadcast((i) => this.phaseMsg(i));
      this.changed();
      return;
    }
    const res = this.sim.results();
    const named = res.map((r) => ({ ...r, key: r.human ? `h${r.slot}` : `b${r.char}` }));
    if (this.cup) {
      named.forEach((r) => {
        const pts = this.sim.mode === 'race' ? (CUP_POINTS[r.place - 1] || 0) : 0;
        r.points = pts;
        this.cup.points[r.key] = (this.cup.points[r.key] || 0) + pts;
        r.total = this.cup.points[r.key];
      });
    }
    this.results = named;
    this.phase = 'results';
    this.paused = false;
    this.broadcast((i) => this.phaseMsg(i));
    this.changed();
  }

  cupStandings() {
    if (!this.cup) return [];
    const list = Object.entries(this.cup.points).map(([key, points]) => {
      const human = key.startsWith('h');
      const slot = human ? Number(key.slice(1)) : -1;
      const char = human ? (this.players[slot] ? this.players[slot].char : 'pipo') : key.slice(1);
      const ch = CHARACTERS.find((c) => c.id === char);
      return { key, points, human, slot, char, name: ch ? ch.name : char };
    });
    list.sort((a, b) => b.points - a.points);
    list.forEach((s, i) => { s.place = i + 1; });
    return list;
  }

  next() {
    if (this.phase === 'storyresult') {
      const l = this.storyLevel();
      if (this.storyResult === 'win') {
        if (l.outro && l.outro.length) this.playCinema(l.outro, l, () => this.advanceStory());
        else this.advanceStory();
      } else this.startRace(); // reintentar
      return;
    }
    if (this.phase === 'storyend') { this.toLobby(); return; }
    if (this.phase === 'results') {
      if (this.cup && this.cup.current < this.cup.races.length - 1) { this.cup.current++; this.startRace(); return; }
      if (this.cup) { this.phase = 'podium'; this.audio.sfx('finish'); this.broadcast((i) => this.phaseMsg(i)); this.changed(); return; }
      this.toLobby();
    } else if (this.phase === 'podium') this.toLobby();
  }

  toLobby() {
    this.phase = 'lobby';
    this.sim = null; this.results = null; this.cup = null; this.paused = false;
    this.storyRun = null; this.storyResult = null; this.cinema = null;
    // quitar celulares desconectados
    this.players = this.players.map((p) => (p && p.kind === 'phone' && !p.connected ? null : p));
    this.startDemo();
    this.audio.playSong(MENU_SONG);
    this.broadcast((i) => this.phaseMsg(i));
    this.broadcastLobby();
    this.changed();
  }

  togglePause() {
    if (this.phase !== 'race') return;
    this.paused = !this.paused;
    this.broadcast({ t: 'paused', v: this.paused });
    this.changed();
  }

  // ---------------- bucle ----------------
  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (this.phase === 'race' && this.sim) {
      if (!this.paused) {
        this.acc += dt;
        while (this.acc >= STEP) {
          this.applyInputs();
          this.sim.step(STEP);
          this.acc -= STEP;
          this.handleEvents();
          if (this.phase !== 'race') break;
        }
        const viewers = this.viewers();
        this.hudTimer -= dt;
        if (this.hudTimer <= 0 && this.sim) { this.hudTimer = viewers.length ? 1 / 15 : 0.1; this.sendHud(); }
        this.snapTimer -= dt;
        if (this.snapTimer <= 0 && this.sim) {
          this.snapTimer = 1 / 30;
          if (viewers.length) {
            const snap = snapshotMsg(this.sim, this.sfxOut);
            viewers.forEach((p) => this.send(p.slot, snap));
          }
          this.sfxOut = [];
        }
      }
      if (this.sim) {
        const lk = this.localKart();
        // sin pantalla principal: este dispositivo muestra solo a su jugador (los demás se ven en sus celulares)
        const views = lk ? [lk] : this.sim.karts.filter((k) => k.human).sort((a, b) => a.slot - b.slot);
        this.renderer.render(this.sim, views, { paused: this.paused, hudInset: lk ? [Math.round(this.renderer.W * 0.24), Math.round(this.renderer.W * 0.3)] : 0 });
      }
    } else if (this.phase === 'cinematic' && this.cinema) {
      const cin = this.cinema;
      cin.update(dt);
      if (cin.songCue) { this.audio.playSong(cin.songCue === 'villain' ? VILLAIN_SONG : cin.songCue === 'zorg' ? ZORG_SONG : STORY_SONG); cin.songCue = null; }
      const cam = cin.camera();
      this.renderer.render(cin.scene, [cam], { demo: true, cinema: true });
      const st = cin.shot;
      const fx = { tint: st && st.tint ? st.tint : null, flash: cin.flashT, holo: cin.hologram() };
      drawCinemaFx(this.renderer, fx);
      this.snapTimer -= dt;
      if (this.snapTimer <= 0) {
        this.snapTimer = 1 / 30;
        const viewers = this.viewers();
        if (viewers.length) {
          const snap = snapshotMsg(cin.scene, []);
          snap.cam = [cam.camX, cam.camY, cam.camA, cam.camH === undefined ? -1 : cam.camH, cam.frameDist || 0, cam.camUp || 0].map((v) => Math.round(v * 1000) / 1000);
          snap.fx = { tint: fx.tint, flash: Math.round(fx.flash * 100) / 100, holo: fx.holo || 0 };
          viewers.forEach((p) => this.send(p.slot, snap));
        }
      }
      if (cin.version !== this.cineVersion) {
        this.cineVersion = cin.version;
        const stt = cin.state();
        this.broadcast((i) => ({ t: 'cine', ...stt, host: this.hostSlot() === i }));
        this.changed();
      }
      if (cin.done) { const cb = this.cinemaDone; this.cinema = null; this.cinemaDone = null; if (cb) cb(); }
    } else if (this.phase === 'lobby' && this.demo) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 6) { this.demo.step(STEP); this.demo.events.length = 0; this.acc -= STEP; n++; }
      if (n >= 6) this.acc = 0;
      // cámara: seguir al líder del demo
      const lead = this.demo.karts.reduce((a, b) => (a.place < b.place ? a : b));
      this.renderer.render(this.demo, [lead], { demo: true });
    }
  }

  applyInputs() {
    for (const k of this.sim.karts) {
      if (!k.human) continue;
      const p = this.players[k.slot];
      const pd = this.pend[k.slot] || {};
      let base;
      if (!p) base = { steer: 0, acc: false, brake: false, drift: false };
      else if (p.kind === 'local') { const li = this.localIn; base = { steer: Math.max(-1, Math.min(1, li.steer || 0)), brake: !!li.brake, drift: !!li.drift }; }
      else if (p.kind === 'cpu') { k.autopilot = true; base = { steer: 0, acc: false, brake: false, drift: false }; }
      else if (p.kind === 'phone') {
        const m = this.phoneIn[k.slot];
        // si el celular deja de mandar señal 1,5 s, el carro sigue solo hasta que vuelva
        const stale = this.sim.started && (!p.lastSeen || performance.now() - p.lastSeen > 1500);
        k.autopilot = !p.connected || stale;
        base = m ? { steer: Math.max(-1, Math.min(1, Number(m.s) || 0)), acc: !!m.a, brake: !!m.b, drift: !!m.d } : { steer: 0, acc: false, brake: false, drift: false };
      } else base = this.kbInput(p.kind);
      k.input = { ...base, acc: !base.brake, item: !!pd.item, power: !!pd.power };
      this.pend[k.slot] = {};
    }
  }

  handleEvents() {
    const ev = this.sim.events;
    for (const e of ev) {
      if (e.type === 'sfx') { this.audio.sfx(e.name); if (this.sfxOut.length < 12 && !this.sfxOut.includes(e.name)) this.sfxOut.push(e.name); }
      else if (e.type === 'buzz') this.send(e.slot, { t: 'buzz', ms: e.ms });
      else if (e.type === 'done') { this.sim.events.length = 0; this.endRace(); return; }
    }
    ev.length = 0;
  }

  viewers() {
    return this.players.filter((p) => p && p.kind === 'phone' && p.view && p.connected);
  }

  sendHud() {
    const sim = this.sim;
    for (const k of sim.karts) {
      if (!k.human) continue;
      const p = this.players[k.slot];
      if (!p || p.kind !== 'phone') continue;
      this.send(k.slot, {
        t: 'hud', mode: sim.mode, place: k.place, total: sim.karts.length, lap: Math.max(1, Math.min(sim.laps, k.lap)), laps: sim.laps,
        item: k.rouletteT > 0 ? '?' : k.item, power: Math.round(k.power * 100) / 100, charges: k.charges,
        balloons: k.balloons, elim: k.eliminated, finished: k.finished, started: sim.started,
        count: sim.started ? 0 : Math.ceil(sim.countdown), drift: k.driftLevel, boost: k.boostT > 0, msg: k.messageT > 0 ? k.message : '', char: k.char,
        obj: sim.objectiveText || '',
        ft: k.finished ? Math.round(k.finishTime * 100) / 100 : 0, fl: Math.round(k.flashT * 100) / 100, v: Math.round(k.v),
      });
    }
  }
}
