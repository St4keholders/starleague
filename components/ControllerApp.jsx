'use client';
import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, MODES, DIFFICULTIES, TRACK_NAMES, SLOT_COLORS, SLOT_NAMES, PEER_PREFIX, charById } from '../game/constants';
import { getPortraitURLs, getItemIconURLs } from '../game/sprites';
import { peerOptionsFromURL } from '../game/peeropts';
import { Audio } from '../game/audio';

const SENS = [{ id: 0, name: 'Suave', deg: 40 }, { id: 1, name: 'Normal', deg: 30 }, { id: 2, name: 'Fuerte', deg: 21 }];

function getPid() {
  try {
    let id = localStorage.getItem('sl_pid');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sl_pid', id); }
    return id;
  } catch (e) { return Math.random().toString(36).slice(2); }
}
function loadCtrl() {
  try { const c = JSON.parse(localStorage.getItem('sl_ctrl') || 'null'); if (c) return { mode: 'tilt', invert: false, sens: 1, autoAcc: false, view: false, sound: true, ...c }; } catch (e) { /* nada */ }
  return { mode: 'tilt', invert: false, sens: 1, autoAcc: false, view: false, sound: true };
}
function saveCtrl(c) { try { localStorage.setItem('sl_ctrl', JSON.stringify(c)); } catch (e) { /* nada */ } }

export default function ControllerApp() {
  const [code, setCode] = useState(null);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('connecting');
  const [slot, setSlot] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [phase, setPhase] = useState('lobby');
  const [pinfo, setPinfo] = useState({});
  const [hud, setHud] = useState(null);
  const [paused, setPaused] = useState(false);
  const [ctrl, setCtrl] = useState(loadCtrl);
  const [sensor, setSensor] = useState('off'); // off | on | none
  const [portrait, setPortrait] = useState(true);
  const [art, setArt] = useState({ p: {}, i: {} });
  const [raceKey, setRaceKey] = useState(0);

  const connRef = useRef(null);
  const phaseRef = useRef('lobby');
  const ctrlRef = useRef(ctrl);
  const inp = useRef({ steer: 0, acc: false, brake: false, drift: false, left: false, right: false, ic: 0, pc: 0, gu: 0, gd: 0 });
  const tilt = useRef({ theta: 0, theta0: 0, got: false, smooth: 0, lastAng: null });
  const wheelRef = useRef(null);
  const barRef = useRef(null);
  const wakeRef = useRef(null);
  const slotRef = useRef(null);
  const mirrorRef = useRef(null);
  const raceInitRef = useRef(null);
  const audioRef = useRef(null);
  const getAudio = () => { if (!audioRef.current) audioRef.current = new Audio(); return audioRef.current; };

  useEffect(() => { ctrlRef.current = ctrl; saveCtrl(ctrl); }, [ctrl]);
  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== 'race' && audioRef.current) audioRef.current.stopSong();
  }, [phase]);
  useEffect(() => { slotRef.current = slot; }, [slot]);
  // avisar al PC si este celular quiere ver el juego
  useEffect(() => {
    if (status === 'online' && slot !== null) send({ t: 'view', on: !!ctrl.view });
    if (!ctrl.view && audioRef.current) audioRef.current.stopSong();
  }, [status, slot, ctrl.view]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = (q.get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(c || '');
    setArt({ p: getPortraitURLs(), i: getItemIconURLs() });
    const mq = window.matchMedia('(orientation: portrait)');
    const upd = () => setPortrait(mq.matches);
    upd();
    mq.addEventListener ? mq.addEventListener('change', upd) : mq.addListener(upd);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', upd) : mq.removeListener(upd); };
  }, []);

  // ---------- conexión ----------
  useEffect(() => {
    if (!code) return undefined;
    let peer = null, dead = false, retryT = null;
    const pid = getPid();
    const onMsg = (m) => {
      if (!m || typeof m !== 'object') return;
      switch (m.t) {
        case 'welcome': setSlot(m.slot); break;
        case 'lobby': setLobby(m); setSlot(m.you); if (m.phase) { setPhase(m.phase); } break;
        case 'phase': setPhase(m.phase); setPinfo(m); setPaused(false); if (m.phase !== 'race') setHud(null); break;
        case 'hud':
          setHud(m);
          if (mirrorRef.current) mirrorRef.current.applyHud(slotRef.current, m);
          break;
        case 'raceinit': {
          raceInitRef.current = m;
          mirrorRef.current = null;
          setRaceKey((k) => k + 1);
          const c = ctrlRef.current;
          if (c.view && c.sound && audioRef.current && audioRef.current.ctx) audioRef.current.playSong(m.track === 'arena' ? 5 : m.track);
          break;
        }
        case 'snap':
          if (mirrorRef.current) mirrorRef.current.push(m);
          if (m.s && m.s.length && ctrlRef.current.view && ctrlRef.current.sound && audioRef.current) m.s.forEach((n) => audioRef.current.sfx(n));
          break;
        case 'buzz': if (navigator.vibrate) { try { navigator.vibrate(m.ms); } catch (e) { /* nada */ } } break;
        case 'paused': setPaused(!!m.v); break;
        case 'full': setStatus('full'); dead = true; break;
        case 'kicked': setStatus('kicked'); dead = true; break;
        default: break;
      }
    };
    const retry = () => {
      if (dead) return;
      clearTimeout(retryT);
      retryT = setTimeout(() => {
        if (dead) return;
        if (peer && !peer.destroyed && peer.open) openConn();
        else { try { peer && peer.destroy(); } catch (e) { /* nada */ } start(); }
      }, 2000);
    };
    const openConn = () => {
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
      const to = setTimeout(() => { if (!conn.open) { try { conn.close(); } catch (e) { /* nada */ } setStatus((s) => (s === 'online' ? 'lost' : 'nohost')); retry(); } }, 9000);
      conn.on('open', () => { clearTimeout(to); connRef.current = conn; setStatus('online'); conn.send({ t: 'hello', pid }); });
      conn.on('data', onMsg);
      conn.on('close', () => { clearTimeout(to); if (connRef.current === conn) connRef.current = null; if (!dead) { setStatus('lost'); retry(); } });
      conn.on('error', () => { clearTimeout(to); });
    };
    const start = async () => {
      const { Peer } = await import('peerjs');
      if (dead) return;
      peer = new Peer(undefined, peerOptionsFromURL());
      peer.on('open', () => openConn());
      peer.on('error', (e) => {
        if (e.type === 'peer-unavailable') setStatus((s) => (s === 'online' ? 'lost' : 'nohost'));
        else setStatus((s) => (s === 'online' ? 'lost' : 'connecting'));
        retry();
      });
      peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (er) { /* nada */ } });
    };
    start();
    return () => { dead = true; clearTimeout(retryT); try { peer && peer.destroy(); } catch (e) { /* nada */ } };
  }, [code]);

  const send = (m) => { const c = connRef.current; if (c && c.open) { try { c.send(m); } catch (e) { /* nada */ } } };

  // ---------- envío de controles ----------
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== 'race') return;
      const i = inp.current, c = ctrlRef.current;
      let steer = c.mode === 'tilt' && tilt.current.got ? tilt.current.smooth : (i.right ? 1 : 0) - (i.left ? 1 : 0);
      const acc = c.autoAcc ? !i.brake : i.acc;
      send({ t: 'in', s: Math.round(steer * 100) / 100, a: acc, b: i.brake, d: i.drift, ic: i.ic, pc: i.pc, gu: i.gu, gd: i.gd });
    }, 33);
    return () => clearInterval(id);
  }, []);

  // ---------- sensor ----------
  const onMotion = useRef((e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null) return;
    const gx = g.x || 0, gy = g.y || 0, gz = g.z || 0;
    const t = tilt.current;
    // pasar del eje del aparato al eje de la pantalla según la orientación
    let ang = 0;
    if (screen.orientation && typeof screen.orientation.angle === 'number') ang = screen.orientation.angle;
    else if (typeof window.orientation === 'number') ang = window.orientation;
    ang = ((Math.round(ang / 90) * 90) % 360 + 360) % 360;
    if (ang !== t.lastAng) { t.lastAng = ang; t.theta0 = 0; t.smooth = 0; t.convAcc = undefined; }
    let sx, sy;
    if (ang === 0) { sx = gx; sy = gy; } else if (ang === 90) { sx = -gy; sy = gx; } else if (ang === 180) { sx = -gx; sy = -gy; } else { sx = gy; sy = -gx; }
    // iPhone y Android reportan la gravedad con signo contrario: lo detectamos solos
    t.convAcc = t.convAcc === undefined ? (sy + gz) : t.convAcc * 0.97 + (sy + gz) * 0.03;
    const conv = t.convAcc >= 0 ? 1 : -1;
    const mag = Math.hypot(gx, gy, gz) || 9.81;
    const roll = Math.asin(Math.max(-1, Math.min(1, (-sx * conv) / mag)));
    t.theta = roll;
    t.got = true;
    const c = ctrlRef.current;
    const max = (SENS[c.sens] || SENS[1]).deg * Math.PI / 180;
    let s = (roll - t.theta0) / max;
    if (c.invert) s = -s;
    const dz = 0.06;
    s = Math.abs(s) < dz ? 0 : (s - Math.sign(s) * dz) / (1 - dz);
    s = Math.max(-1, Math.min(1, s));
    t.smooth = t.smooth * 0.45 + s * 0.55;
    if (wheelRef.current) wheelRef.current.style.transform = `rotate(${t.smooth * 90}deg)`;
    if (barRef.current) barRef.current.style.transform = `translateX(${t.smooth * 50}%)`;
  }).current;

  const activateSensor = async () => {
    if (ctrlRef.current.view && ctrlRef.current.sound) getAudio().init();
    // 1) permiso del sensor primero: el iPhone lo exige justo al tocar
    let denied = false;
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') denied = true;
      }
    } catch (e) { /* algunos navegadores lanzan si no hay gesto */ }
    if (denied) { setSensor('none'); setCtrl((c) => ({ ...c, mode: 'buttons' })); return; }
    window.removeEventListener('devicemotion', onMotion);
    window.addEventListener('devicemotion', onMotion);
    tilt.current.theta0 = 0;
    tilt.current.got = false;
    tilt.current.convAcc = undefined;
    setSensor('on');
    setCtrl((c) => ({ ...c, mode: 'tilt' }));
    setTimeout(() => { if (!tilt.current.got) { setSensor('none'); setCtrl((c) => ({ ...c, mode: 'buttons' })); } }, 1500);
    // 2) pantalla completa, horizontal y que no se apague (si el navegador deja)
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
    } catch (e) { /* nada */ }
    try { if ('wakeLock' in navigator && !wakeRef.current) wakeRef.current = await navigator.wakeLock.request('screen'); } catch (e) { /* nada */ }
  };
  const center = () => { tilt.current.theta0 = tilt.current.theta; tilt.current.smooth = 0; if (navigator.vibrate) navigator.vibrate(20); };

  useEffect(() => () => window.removeEventListener('devicemotion', onMotion), []);
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'visible' && wakeRef.current) { try { wakeRef.current = await navigator.wakeLock.request('screen'); } catch (e) { /* nada */ } }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ---------- pantallas ----------
  if (code === null) return <div className="m-screen" />;
  if (!code) {
    return (
      <div className="m-screen m-center">
        <div className="m-logo">★ STAR LEAGUE</div>
        <p>Escanea el QR que sale en la pantalla, o escribe el código de 5 letras.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (typed.trim().length >= 4) { const u = new URL(window.location.href); u.searchParams.set('c', typed.trim().toUpperCase()); window.location.href = u.toString(); } }}>
          <input className="m-input" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} maxLength={5} placeholder="CÓDIGO" autoCapitalize="characters" />
          <button className="m-btn gold" type="submit">Conectar</button>
        </form>
      </div>
    );
  }
  if (status === 'full') return <Msg title="Partida llena" text="Ya hay 4 jugadores conectados." />;
  if (status === 'kicked') return <Msg title="Te quitaron de la partida" text="Toca para volver a entrar." onClick={() => window.location.reload()} />;
  if (status !== 'online' && !lobby) {
    return <Msg title={status === 'nohost' ? 'No encuentro la partida' : 'Conectando…'} text={status === 'nohost' ? `Revisa que el juego esté abierto en la pantalla con el código ${code}. Sigo intentando…` : `Código ${code}`} spin />;
  }

  const me = lobby && slot !== null ? lobby.players[slot] : null;
  const color = slot !== null ? SLOT_COLORS[slot] : '#fff';
  const isHost = lobby ? lobby.host : false;
  const lost = status !== 'online';

  const sensorCard = (
    <div className="m-card">
      <div className="m-h">Volante</div>
      {sensor !== 'on' && ctrl.mode === 'tilt' && <button className="m-btn gold wide" onClick={activateSensor}>Activar volante</button>}
      {sensor === 'none' && <p className="m-small warn">Tu celular no envió datos del sensor. Se usarán botones para girar.</p>}
      {sensor === 'on' && ctrl.mode === 'tilt' && (
        <>
          <p className="m-small">Sostén el celular horizontal como un volante y gíralo: la barra debe moverse. Si al soltarlo la barra no queda en el centro, toca «Centrar».</p>
          <div className="m-meter"><div ref={barRef} className="m-meter-dot" /></div>
          <div className="m-row">
            <button className="m-btn" onClick={center}>Centrar</button>
            <button className={'m-btn' + (ctrl.invert ? ' on' : '')} onClick={() => setCtrl((c) => ({ ...c, invert: !c.invert }))}>Invertir</button>
          </div>
          <div className="m-seg">{SENS.map((s) => <button key={s.id} className={ctrl.sens === s.id ? 'on' : ''} onClick={() => setCtrl((c) => ({ ...c, sens: s.id }))}>{s.name}</button>)}</div>
        </>
      )}
      <div className="m-row">
        <button className={'m-btn' + (ctrl.mode === 'buttons' ? ' on' : '')} onClick={() => setCtrl((c) => ({ ...c, mode: c.mode === 'buttons' ? 'tilt' : 'buttons' }))}>{ctrl.mode === 'buttons' ? 'Usando botones ◀ ▶' : 'Girar con botones'}</button>
        <button className={'m-btn' + (ctrl.autoAcc ? ' on' : '')} onClick={() => setCtrl((c) => ({ ...c, autoAcc: !c.autoAcc }))}>{ctrl.autoAcc ? 'Acelera solo ✓' : 'Acelerar solo'}</button>
      </div>
    </div>
  );

  // ---------- carrera ----------
  if (phase === 'race') {
    return (
      <RacePad
        hud={hud} ctrl={ctrl} inp={inp} wheelRef={wheelRef} center={center} portrait={portrait}
        color={color} slot={slot} art={art} paused={paused} lost={lost} isHost={isHost}
        onPause={() => send({ t: 'pause' })} onQuit={() => send({ t: 'quit' })}
        sensorOn={sensor === 'on'} activateSensor={activateSensor}
        raceKey={raceKey} raceInitRef={raceInitRef} mirrorRef={mirrorRef}
        onToggleView={() => setCtrl((c) => ({ ...c, view: !c.view }))}
      />
    );
  }

  if (phase === 'results' || phase === 'podium') {
    return (
      <div className="m-screen m-center" style={{ '--c': color }}>
        <div className="m-tag">{SLOT_NAMES[slot]}</div>
        {phase === 'results' ? (
          <>
            <div className="m-big">{pinfo.place ? `${pinfo.place}º` : '¡Listo!'}</div>
            <p>{pinfo.mode === 'battle' ? (pinfo.place === 1 ? '¡Ganaste la batalla!' : 'Batalla terminada') : pinfo.place === 1 ? '¡Ganaste la carrera!' : 'Carrera terminada'}</p>
          </>
        ) : (
          <>
            <div className="m-big">🏆</div>
            <ol className="m-stand">{(pinfo.standings || []).map((s) => <li key={s.place} style={s.slot >= 0 ? { color: SLOT_COLORS[s.slot] } : undefined}>{s.place}º {s.name}{s.slot >= 0 ? ` ${SLOT_NAMES[s.slot]}` : ''} · {s.points}</li>)}</ol>
          </>
        )}
        {isHost ? (
          <>
            <button className="m-btn gold wide" onClick={() => send({ t: 'next' })}>{phase === 'podium' ? 'Volver al lobby' : pinfo.cup ? (pinfo.cupLeft > 0 ? 'Siguiente carrera' : 'Ver podio') : 'Volver al lobby'}</button>
            {phase === 'results' && pinfo.cupLeft > 0 && <button className="m-btn wide" onClick={() => send({ t: 'quit' })}>Abandonar copa</button>}
          </>
        ) : <p className="m-small">Esperando a que J1 continúe…</p>}
      </div>
    );
  }

  // ---------- lobby ----------
  const mine = me ? charById(me.char) : null;
  return (
    <div className="m-screen m-lobby" style={{ '--c': color }}>
      <header className="m-head">
        <div className="m-logo">★ STAR LEAGUE</div>
        {slot !== null && <div className="m-tag">{SLOT_NAMES[slot]}</div>}
        {lost && <div className="m-lost">Reconectando…</div>}
      </header>
      {me && (
        <div className="m-card">
          <div className="m-h">Tu personaje</div>
          <div className="m-chars">
            {CHARACTERS.map((c) => {
              const takenBy = lobby.players.findIndex((p, i) => p && i !== slot && p.char === c.id);
              return (
                <button key={c.id} className={'m-char' + (me.char === c.id ? ' on' : '')} onClick={() => send({ t: 'pick', char: c.id })}>
                  <img src={art.p[c.id]} alt="" />
                  <span>{c.name}</span>
                  {takenBy >= 0 && <i style={{ background: SLOT_COLORS[takenBy] }}>{SLOT_NAMES[takenBy]}</i>}
                </button>
              );
            })}
          </div>
          {mine && (
            <div className="m-detail">
              <b>{mine.full}</b>
              <div className="m-power">Poder: <b>{mine.powerName}</b> — {mine.powerDesc}</div>
              <div className="m-stats">
                {[['Velocidad', 'speed'], ['Aceleración', 'accel'], ['Manejo', 'handling'], ['Peso', 'weight']].map(([n, k]) => (
                  <div key={k} className="m-stat"><span>{n}</span><div className="m-bars">{[1, 2, 3, 4, 5].map((v) => <i key={v} className={v <= mine.stats[k] ? 'on' : ''} />)}</div></div>
                ))}
              </div>
            </div>
          )}
          <div className="m-h">Caja de cambios</div>
          <div className="m-seg">
            <button className={!me.manual ? 'on' : ''} onClick={() => send({ t: 'pick', manual: false })}>Automática</button>
            <button className={me.manual ? 'on' : ''} onClick={() => send({ t: 'pick', manual: true })}>Manual</button>
          </div>
          <p className="m-small">{me.manual ? 'Tú cambias con ▲ ▼. Si cambias en la zona verde ganas un mini turbo y la velocidad máxima es un poco mayor.' : 'El carro cambia solo.'}</p>
        </div>
      )}
      {sensorCard}
      <div className="m-card">
        <div className="m-h">Pantalla en el celular</div>
        <p className="m-small">Para quien no está frente al televisor: tu carrera se ve aquí mismo, con los botones encima. Gasta más batería.</p>
        <div className="m-seg">
          <button className={!ctrl.view ? 'on' : ''} onClick={() => setCtrl((c) => ({ ...c, view: false }))}>Solo mando</button>
          <button className={ctrl.view ? 'on' : ''} onClick={() => { getAudio().init(); setCtrl((c) => ({ ...c, view: true })); }}>Ver el juego aquí</button>
        </div>
        {ctrl.view && (
          <button className={'m-btn' + (ctrl.sound ? ' on' : '')} onClick={() => { getAudio().init(); setCtrl((c) => ({ ...c, sound: !c.sound })); }}>{ctrl.sound ? '🔊 Sonido en el celular' : '🔇 Sin sonido en el celular'}</button>
        )}
      </div>
      {isHost ? (
        <div className="m-card">
          <div className="m-h">Partida (eres el anfitrión)</div>
          <div className="m-seg col">{MODES.map((m) => <button key={m.id} className={lobby.cfg.mode === m.id ? 'on' : ''} onClick={() => send({ t: 'cfg', cfg: { mode: m.id } })}>{m.name}</button>)}</div>
          {lobby.cfg.mode === 'rapida' && <div className="m-seg col">{TRACK_NAMES.map((t, i) => <button key={t} className={lobby.cfg.track === i ? 'on' : ''} onClick={() => send({ t: 'cfg', cfg: { track: i } })}>{t}</button>)}</div>}
          <div className="m-seg">{DIFFICULTIES.map((d) => <button key={d.id} className={lobby.cfg.diff === d.id ? 'on' : ''} onClick={() => send({ t: 'cfg', cfg: { diff: d.id } })}>{d.name}</button>)}</div>
          <button className="m-btn gold wide big" onClick={() => send({ t: 'start' })}>¡Empezar!</button>
        </div>
      ) : (
        <div className="m-card"><p className="m-small">J1 elige el modo y empieza la partida. Mientras tanto, activa el volante y elige tu personaje.</p></div>
      )}
    </div>
  );
}

function Msg({ title, text, spin, onClick }) {
  return (
    <div className="m-screen m-center" onClick={onClick}>
      <div className="m-logo">★ STAR LEAGUE</div>
      {spin && <div className="m-spin" />}
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function PadBtn({ label, cls, onDown, onUp, children }) {
  const active = useRef(new Set());
  const down = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { /* nada */ }
    active.current.add(e.pointerId);
    e.currentTarget.classList.add('pressed');
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (er) { /* nada */ } }
    onDown && onDown();
  };
  const up = (e) => {
    if (!active.current.has(e.pointerId)) return;
    active.current.delete(e.pointerId);
    if (active.current.size === 0) { e.currentTarget.classList.remove('pressed'); onUp && onUp(); }
  };
  return (
    <button className={'pad-btn ' + (cls || '')} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
      {children || label}
    </button>
  );
}

function GameView({ raceKey, raceInitRef, mirrorRef, slot, paused, inset }) {
  const canvasRef = useRef(null);
  const pausedRef = useRef(paused);
  const [state, setState] = useState('loading');
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    let alive = true, raf = 0, renderer = null, onResize = null;
    const init = raceInitRef.current;
    if (!init) { setState('wait'); return undefined; }
    setState('loading');
    (async () => {
      try {
        const [{ buildTrack }, { Renderer }, { MirrorSim }] = await Promise.all([import('../game/trackgfx'), import('../game/render'), import('../game/mirror')]);
        await new Promise((r) => setTimeout(r, 40));
        if (!alive) return;
        const track = buildTrack(init.track);
        if (!alive) return;
        const m = new MirrorSim(init, track);
        mirrorRef.current = m;
        const make = () => {
          const cv = canvasRef.current;
          if (!cv) return;
          const r = cv.getBoundingClientRect();
          const aspect = Math.max(1.3, Math.min(2.4, r.width / Math.max(1, r.height)));
          const H = 270, W = Math.round((H * aspect) / 2) * 2;
          renderer = new Renderer(cv, W, H);
          renderer.setTrack(track);
          renderer.inset = Math.round(W * inset);
        };
        make();
        onResize = () => setTimeout(make, 120);
        window.addEventListener('resize', onResize);
        setState('ok');
        let last = performance.now();
        const frame = (now) => {
          if (!alive) return;
          raf = requestAnimationFrame(frame);
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (!renderer || !m.snaps.length) return;
          m.advance(dt);
          const me = m.karts.find((k) => k.human && k.slot === slot) || m.karts.reduce((x, y) => (x.place < y.place ? x : y));
          renderer.render(m, [me], { paused: pausedRef.current, hudInset: renderer.inset });
        };
        raf = requestAnimationFrame(frame);
      } catch (e) {
        if (alive) setState('error');
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); if (onResize) window.removeEventListener('resize', onResize); };
  }, [raceKey]);
  return (
    <>
      <canvas ref={canvasRef} className="pad-canvas" />
      {state !== 'ok' && <div className="view-loading">{state === 'error' ? 'No se pudo cargar la pista' : 'Cargando pista…'}</div>}
    </>
  );
}

function RacePad({ hud, ctrl, inp, wheelRef, center, portrait, color, slot, art, paused, lost, isHost, onPause, onQuit, sensorOn, activateSensor, raceKey, raceInitRef, mirrorRef, onToggleView }) {
  const set = (k, v) => () => { inp.current[k] = v; };
  const inc = (k) => () => { inp.current[k]++; };
  useEffect(() => () => { const i = inp.current; i.acc = i.brake = i.drift = i.left = i.right = false; }, [inp]);
  const h = hud || {};
  const battle = h.mode === 'battle';
  const tilt = ctrl.mode === 'tilt';
  const view = !!ctrl.view;
  const leftCol = (
    <div className="pad-col left">
      {h.manual && (
        <div className="gears">
          <PadBtn cls="gear up" onDown={inc('gu')}>▲</PadBtn>
          <PadBtn cls="gear down" onDown={inc('gd')}>▼</PadBtn>
        </div>
      )}
      <PadBtn cls={'drift' + (h.drift === 2 ? ' lv2' : h.drift === 1 ? ' lv1' : '')} onDown={set('drift', true)} onUp={set('drift', false)}>DERRAPE</PadBtn>
      <PadBtn cls="brake" onDown={set('brake', true)} onUp={set('brake', false)}>FRENO</PadBtn>
    </div>
  );
  const rightCol = (
    <div className="pad-col right">
      <PadBtn cls="item" onDown={inc('ic')}>OBJETO</PadBtn>
      <PadBtn cls={'power' + (h.power >= 1 || h.charges > 0 ? ' ready' : '')} onDown={inc('pc')}>PODER</PadBtn>
      {ctrl.autoAcc ? <div className="pad-btn acc auto">AUTO</div> : <PadBtn cls="acc" onDown={set('acc', true)} onUp={set('acc', false)}>ACELERAR</PadBtn>}
    </div>
  );
  const steerBtns = (
    <div className="steer-btns">
      <PadBtn cls="steer" onDown={set('left', true)} onUp={set('left', false)}>◀</PadBtn>
      <PadBtn cls="steer" onDown={set('right', true)} onUp={set('right', false)}>▶</PadBtn>
    </div>
  );
  const overlays = (
    <>
      {portrait && <div className="rotate"><div className="rotate-ico">📱↻</div><p>Gira el celular en horizontal</p><small>Si la pantalla no gira, desactiva el bloqueo de rotación del celular.</small></div>}
      {(paused || lost) && (
        <div className="pad-over">
          <h2>{lost ? 'Reconectando…' : 'Pausa'}</h2>
          {!lost && <button className="m-btn gold" onClick={onPause}>Continuar</button>}
          {!lost && isHost && <button className="m-btn" onClick={onQuit}>Salir al lobby</button>}
        </div>
      )}
    </>
  );

  if (view) {
    return (
      <div className="pad view" style={{ '--c': color }}>
        <GameView raceKey={raceKey} raceInitRef={raceInitRef} mirrorRef={mirrorRef} slot={slot} paused={paused} inset={0.22} />
        {leftCol}
        <div className="pad-mid">
          {tilt && !sensorOn && <button className="m-btn gold view-act" onClick={activateSensor}>Activar volante</button>}
          {!tilt && <div className="view-steer">{steerBtns}</div>}
          <div className="view-top">
            {tilt && sensorOn && <button className="view-btn" onClick={center} title="Centrar volante">◎</button>}
            <button className="view-btn" onClick={onToggleView} title="Ocultar el juego">🎮</button>
            <button className="view-btn" onClick={onPause} title="Pausa">II</button>
          </div>
        </div>
        {rightCol}
        {overlays}
      </div>
    );
  }

  return (
    <div className="pad" style={{ '--c': color }}>
      {leftCol}
      <div className="pad-mid">
        <div className="pad-top">
          <div className="pad-tag">{SLOT_NAMES[slot]}</div>
          {battle ? (
            <div className="pad-place">{[0, 1, 2].map((i) => <span key={i} className={'bal' + (i < (h.balloons ?? 3) ? ' on' : '')} />)}</div>
          ) : (
            <div className="pad-place">{h.place || '-'}º<small>/{h.total || 8}</small></div>
          )}
          {!battle && <div className="pad-lap">V {h.lap || 1}/{h.laps || 3}</div>}
          <button className="pad-pause" onClick={onToggleView} title="Ver el juego en el celular">📺</button>
          <button className="pad-pause" onClick={onPause}>II</button>
        </div>
        <div className="pad-status">
          <div className="pad-item">{h.item === '?' ? <span className="roul">?</span> : h.item ? <img src={art.i[h.item]} alt="" /> : null}</div>
          <div className="pad-power">
            {h.char && <img src={art.p[h.char]} alt="" />}
            <div className="pbar"><div className={'pfill' + (h.power >= 1 ? ' ready' : '')} style={{ width: `${(h.power || 0) * 100}%` }} /></div>
            <span>{h.charges > 0 ? `TURBO x${h.charges}` : h.power >= 1 ? '¡PODER LISTO!' : 'Poder'}</span>
          </div>
        </div>
        {h.manual && (
          <div className="pad-gear">
            <span className={h.lug ? 'lug' : ''}>M{h.gear}</span>
            <div className="rpm"><div className={'rpm-fill' + (h.rpm > 0.82 ? ' hot' : '')} style={{ width: `${(h.rpm || 0) * 100}%` }} /><i /></div>
          </div>
        )}
        {tilt ? (
          <div className="wheel-wrap" onClick={center}>
            <div className="wheel" ref={wheelRef}><div className="wheel-ring" /><div className="wheel-bar" /><div className="wheel-top" /></div>
            <div className="wheel-hint">{sensorOn ? 'Toca para centrar' : ''}</div>
          </div>
        ) : steerBtns}
        {tilt && !sensorOn && <button className="m-btn gold" onClick={activateSensor}>Activar volante</button>}
        {h.msg && <div className="pad-msg">{h.msg}</div>}
        {h.started === false && h.count > 0 && <div className="pad-count">{h.count > 3 ? '¡Prepárate!' : h.count}</div>}
        {h.elim && <div className="pad-msg">Eliminado</div>}
      </div>
      {rightCol}
      {overlays}
    </div>
  );
}
