'use client';
import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, MODES, DIFFICULTIES, TRACK_NAMES, SLOT_COLORS, SLOT_NAMES, PEER_PREFIX, charById } from '../game/constants';
import { getPortraitURLs, getItemIconURLs } from '../game/sprites';
import { peerOptionsFromURL } from '../game/peeropts';
import { Audio } from '../game/audio';
import { PadBtn } from './TouchControls';

const SENS = [{ id: 0, name: 'Suave', deg: 40 }, { id: 1, name: 'Normal', deg: 30 }, { id: 2, name: 'Fuerte', deg: 21 }];

function getPid() {
  try {
    let id = localStorage.getItem('sl_pid');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sl_pid', id); }
    return id;
  } catch (e) { return Math.random().toString(36).slice(2); }
}
function loadCtrl() {
  // view: null = automático (se ve el juego aquí cuando no hay pantalla principal)
  const def = { mode: 'buttons', invert: false, sens: 1, view: null, sound: true };
  try {
    const c = JSON.parse(localStorage.getItem('sl_ctrl3') || 'null');
    if (c) return { ...def, ...c };
    const old = JSON.parse(localStorage.getItem('sl_ctrl2') || 'null');
    if (old) { const { view, ...rest } = old; return { ...def, ...rest }; }
  } catch (e) { /* nada */ }
  return def;
}
function saveCtrl(c) { try { localStorage.setItem('sl_ctrl3', JSON.stringify(c)); } catch (e) { /* nada */ } }
// el juego en el celular para la pista (la Fortaleza Eclipse usa la canción 7)
const songFor = (m) => (m.cinema ? 8 : m.track === 'arena' ? 5 : m.track === 5 ? 7 : m.track);
async function goFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch (e) { /* nada */ }
}

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
  const [cine, setCine] = useState(null);

  const connRef = useRef(null);
  const phaseRef = useRef('lobby');
  const ctrlRef = useRef(ctrl);
  const inp = useRef({ steer: 0, brake: false, drift: false, left: false, right: false, ic: 0, pc: 0 });
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
  const noScreen = !!(lobby && lobby.noScreen);
  const viewOn = ctrl.view === null || ctrl.view === undefined ? noScreen : !!ctrl.view;
  const viewRef = useRef(viewOn);
  viewRef.current = viewOn;
  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== 'race' && phase !== 'cinematic' && audioRef.current) audioRef.current.stopSong();
  }, [phase]);
  useEffect(() => { slotRef.current = slot; }, [slot]);
  // avisar al PC si este celular quiere ver el juego
  useEffect(() => {
    if (status === 'online' && slot !== null) send({ t: 'view', on: viewOn });
    if (!viewOn && audioRef.current) audioRef.current.stopSong();
  }, [status, slot, viewOn]);

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
        case 'phase': setPhase(m.phase); setPinfo(m); setPaused(false); if (m.phase !== 'race') setHud(null); if (m.cine) setCine(m.cine); break;
        case 'cine': setCine(m); break;
        case 'hud':
          setHud(m);
          if (mirrorRef.current) mirrorRef.current.applyHud(slotRef.current, m);
          break;
        case 'raceinit': {
          raceInitRef.current = m;
          mirrorRef.current = null;
          setRaceKey((k) => k + 1);
          const c = ctrlRef.current;
          if (viewRef.current && c.sound && audioRef.current && audioRef.current.ctx) audioRef.current.playSong(songFor(m));
          break;
        }
        case 'snap':
          if (mirrorRef.current) mirrorRef.current.push(m);
          if (m.s && m.s.length && viewRef.current && ctrlRef.current.sound && audioRef.current) m.s.forEach((n) => audioRef.current.sfx(n));
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
      send({ t: 'in', s: Math.round(steer * 100) / 100, b: i.brake, d: i.drift, ic: i.ic, pc: i.pc });
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
    if (viewRef.current && ctrlRef.current.sound) getAudio().init();
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
    await goFullscreen();
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

  const useArrows = async () => {
    setCtrl((c) => ({ ...c, mode: 'buttons' }));
    if (viewRef.current && ctrlRef.current.sound) getAudio().init();
    await goFullscreen();
    try { if ('wakeLock' in navigator && !wakeRef.current) wakeRef.current = await navigator.wakeLock.request('screen'); } catch (e) { /* nada */ }
  };
  const sensorCard = (
    <div className="m-card">
      <div className="m-h">Cómo girar</div>
      <p className="m-small">El carro acelera solo. Tú giras, derrapas, usas objetos y frenas si hace falta.</p>
      <div className="m-seg">
        <button className={ctrl.mode === 'buttons' ? 'on' : ''} onClick={useArrows}>Flechas ◀ ▶</button>
        <button className={ctrl.mode === 'tilt' ? 'on' : ''} onClick={activateSensor}>Inclinar el celular</button>
      </div>
      {sensor === 'none' && <p className="m-small warn">Tu celular no envió datos del sensor. Se usarán las flechas.</p>}
      {ctrl.mode === 'tilt' && sensor !== 'on' && sensor !== 'none' && <button className="m-btn gold wide" onClick={activateSensor}>Activar volante</button>}
      {sensor === 'on' && ctrl.mode === 'tilt' && (
        <>
          <p className="m-small">Sostén el celular horizontal como un volante y gíralo: la barra debe moverse. Si al soltarlo la barra no queda en el centro, toca «Centrar».</p>
          <div className="m-meter"><div ref={barRef} className="m-meter-dot" /></div>
          <div className="m-row">
            <button className="m-btn" onClick={center}>Centrar</button>
            <button className={'m-btn' + (ctrl.invert ? ' on' : '')} onClick={() => setCtrl((c) => ({ ...c, invert: !c.invert }))}>Invertir</button>
          </div>
          <div className="m-seg">{SENS.map((x) => <button key={x.id} className={ctrl.sens === x.id ? 'on' : ''} onClick={() => setCtrl((c) => ({ ...c, sens: x.id }))}>{x.name}</button>)}</div>
        </>
      )}
    </div>
  );

  // ---------- carrera ----------
  if (phase === 'race') {
    return (
      <RacePad
        hud={hud} ctrl={{ ...ctrl, view: viewOn }} inp={inp} wheelRef={wheelRef} center={center} portrait={portrait}
        color={color} slot={slot} art={art} paused={paused} lost={lost} isHost={isHost}
        onPause={() => send({ t: 'pause' })} onQuit={() => send({ t: 'quit' })}
        sensorOn={sensor === 'on'} activateSensor={activateSensor}
        raceKey={raceKey} raceInitRef={raceInitRef} mirrorRef={mirrorRef}
        onToggleView={() => setCtrl((c) => ({ ...c, view: !viewOn }))}
      />
    );
  }

  if (phase === 'cinematic') {
    const c = cine || {};
    const line = c.line;
    if (viewOn && raceInitRef.current && raceInitRef.current.cinema) {
      return (
        <div className="m-cineview" style={{ '--c': color }} onClick={() => send({ t: 'cnext' })}>
          <GameView raceKey={raceKey} raceInitRef={raceInitRef} mirrorRef={mirrorRef} slot={slot} paused={false} className="cine-canvas" />
          {c.title && <div className="m-cine-title over"><b>{c.title}</b>{c.sub && <span>{c.sub}</span>}</div>}
          <div className="m-cineview-bottom">
            {line && (
              <div className={'m-cine-box row' + (line.char === 'baron' || line.shadow ? ' villain' : '')}>
                <div className="m-cine-face">{line.char ? <img className={line.shadow ? 'shadow' : ''} src={art.p[line.char]} alt="" /> : <span>★</span>}</div>
                <div><div className="m-cine-name">{line.name}</div><p className="m-cine-text">{line.text}</p></div>
              </div>
            )}
            <div className="m-row m-cine-btns">
              <button className="m-btn gold" onClick={(e) => { e.stopPropagation(); send({ t: 'cnext' }); }}>Siguiente ▶</button>
              {isHost && <button className="m-btn" onClick={(e) => { e.stopPropagation(); send({ t: 'cskip' }); }}>Saltar ⏭</button>}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="m-screen m-cine" style={{ '--c': color }} onClick={() => send({ t: 'cnext' })}>
        {c.title && <div className="m-cine-title"><b>{c.title}</b>{c.sub && <span>{c.sub}</span>}</div>}
        {line ? (
          <div className={'m-cine-box' + (line.char === 'baron' || line.shadow ? ' villain' : '')}>
            <div className="m-cine-face">{line.char ? <img className={line.shadow ? 'shadow' : ''} src={art.p[line.char]} alt="" /> : <span>★</span>}</div>
            <div className="m-cine-name">{line.name}</div>
            <p className="m-cine-text">{line.text}</p>
          </div>
        ) : (!c.title && <div className="m-spin" />)}
        <div className="m-row m-cine-btns">
          <button className="m-btn gold" onClick={(e) => { e.stopPropagation(); send({ t: 'cnext' }); }}>Siguiente ▶</button>
          {isHost && <button className="m-btn" onClick={(e) => { e.stopPropagation(); send({ t: 'cskip' }); }}>Saltar ⏭</button>}
        </div>
      </div>
    );
  }

  if (phase === 'storyresult' || phase === 'storyend') {
    const st = pinfo.story || {};
    const win = phase === 'storyend' || st.result === 'win';
    return (
      <div className="m-screen m-center" style={{ '--c': color }}>
        <div className="m-tag">{SLOT_NAMES[slot]}</div>
        <div className="m-big">{phase === 'storyend' ? '★' : win ? '✓' : '✗'}</div>
        <h2>{phase === 'storyend' ? '¡La Estrella Madre volvió a brillar!' : win ? '¡Nivel superado!' : 'No lo lograron'}</h2>
        {phase === 'storyresult' && <p>Nivel {st.n} de {st.total}: {st.title}<br />{st.obj}</p>}
        {isHost ? (
          phase === 'storyend' ? <button className="m-btn gold wide" onClick={() => send({ t: 'next' })}>Volver al lobby</button> : win ? (
            <button className="m-btn gold wide" onClick={() => send({ t: 'next' })}>Continuar</button>
          ) : (
            <>
              <button className="m-btn gold wide" onClick={() => send({ t: 'next' })}>Reintentar</button>
              <button className="m-btn wide" onClick={() => send({ t: 'skiplevel' })}>Saltar este nivel</button>
            </>
          )
        ) : <p className="m-small">Esperando a que J1 continúe…</p>}
        {isHost && phase === 'storyresult' && <button className="m-btn wide" onClick={() => send({ t: 'quit' })}>Salir de la historia</button>}
      </div>
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
        </div>
      )}
      {sensorCard}
      <div className="m-card">
        <div className="m-h">Pantalla en el celular</div>
        {noScreen
          ? <p className="m-small warn-ok">No hay pantalla principal: la carrera se ve en cada celular. Si no quieres verla aquí, elige «Solo mando».</p>
          : <p className="m-small">Para quien no está frente al televisor: tu carrera se ve aquí mismo, con los botones encima. Gasta más batería.</p>}
        <div className="m-seg">
          <button className={!viewOn ? 'on' : ''} onClick={() => setCtrl((c) => ({ ...c, view: false }))}>Solo mando</button>
          <button className={viewOn ? 'on' : ''} onClick={() => { getAudio().init(); setCtrl((c) => ({ ...c, view: true })); }}>Ver el juego aquí</button>
        </div>
        {viewOn && (
          <button className={'m-btn' + (ctrl.sound ? ' on' : '')} onClick={() => { getAudio().init(); setCtrl((c) => ({ ...c, sound: !c.sound })); }}>{ctrl.sound ? '🔊 Sonido en el celular' : '🔇 Sin sonido en el celular'}</button>
        )}
      </div>
      {isHost ? (
        <div className="m-card">
          <div className="m-h">Partida (eres el anfitrión)</div>
          <div className="m-seg col">{MODES.map((m) => <button key={m.id} className={lobby.cfg.mode === m.id ? 'on' : ''} onClick={() => send({ t: 'cfg', cfg: { mode: m.id } })}>{m.name}</button>)}</div>
          {lobby.cfg.mode === 'historia' && lobby.levels && (
            <>
              <div className="m-small">Empezar en:</div>
              <select className="m-sel" value={lobby.cfg.level || 0} onChange={(e) => send({ t: 'cfg', cfg: { level: Number(e.target.value) } })}>
                {lobby.levels.map((l, i) => <option key={l} value={i}>{l}</option>)}
              </select>
            </>
          )}
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

const trackCache = {};

function GameView({ raceKey, raceInitRef, mirrorRef, slot, paused, insetL = 0.22, insetR = 0.22, className = 'pad-canvas' }) {
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
        const [{ buildTrack }, { Renderer, drawCinemaFx }, { MirrorSim }] = await Promise.all([import('../game/trackgfx'), import('../game/render'), import('../game/mirror')]);
        await new Promise((r) => setTimeout(r, 40));
        if (!alive) return;
        if (!trackCache[init.track]) trackCache[init.track] = buildTrack(init.track);
        const track = trackCache[init.track];
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
          renderer.inset = [Math.round(W * insetL), Math.round(W * insetR)];
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
          if (m.cinema) {
            if (!m.cam) return;
            renderer.render(m, [m.cam], { demo: true, cinema: true });
            drawCinemaFx(renderer, m.fx);
            return;
          }
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
      <canvas ref={canvasRef} className={className} />
      {state !== 'ok' && <div className="view-loading">{state === 'error' ? 'No se pudo cargar la pista' : 'Cargando pista…'}</div>}
    </>
  );
}

function RacePad({ hud, ctrl, inp, wheelRef, center, portrait, color, slot, art, paused, lost, isHost, onPause, onQuit, sensorOn, activateSensor, raceKey, raceInitRef, mirrorRef, onToggleView }) {
  const set = (k, v) => () => { inp.current[k] = v; };
  const inc = (k) => () => { inp.current[k]++; };
  useEffect(() => () => { const i = inp.current; i.brake = i.drift = i.left = i.right = false; }, [inp]);
  const h = hud || {};
  const battle = h.mode === 'battle';
  const tilt = ctrl.mode === 'tilt';
  const view = !!ctrl.view;
  const driftCls = 'drift' + (h.drift === 2 ? ' lv2' : h.drift === 1 ? ' lv1' : '');
  const driftBtn = <PadBtn cls={driftCls} onDown={set('drift', true)} onUp={set('drift', false)}>DERRAPE</PadBtn>;
  const itemBtn = <PadBtn cls="item" onDown={inc('ic')}>OBJETO</PadBtn>;
  const powerBtn = <PadBtn cls={'power' + (h.power >= 1 || h.charges > 0 ? ' ready' : '')} onDown={inc('pc')}>PODER</PadBtn>;
  const brakeBtn = <PadBtn cls="brake" onDown={set('brake', true)} onUp={set('brake', false)}>FRENO</PadBtn>;
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

  // ----- vista de juego en el celular: botones a la izquierda, flechas a la derecha -----
  if (view) {
    return (
      <div className={'pad view' + (tilt ? ' tilt' : '')} style={{ '--c': color }}>
        <GameView raceKey={raceKey} raceInitRef={raceInitRef} mirrorRef={mirrorRef} slot={slot} paused={paused} insetL={0.24} insetR={0.3} />
        <div className="pad-col left">
          {!tilt && <div className="pad-col-big">{driftBtn}</div>}
          {itemBtn}
          {powerBtn}
          {brakeBtn}
        </div>
        <div className="pad-mid">
          {tilt && !sensorOn && <button className="m-btn gold view-act" onClick={activateSensor}>Activar volante</button>}
          <div className="view-top">
            {tilt && sensorOn && <button className="view-btn" onClick={center} title="Centrar volante">◎</button>}
            <button className="view-btn" onClick={onToggleView} title="Ocultar el juego">🎮</button>
            <button className="view-btn" onClick={onPause} title="Pausa">II</button>
          </div>
        </div>
        <div className="pad-col right">
          {tilt ? driftBtn : steerBtns}
        </div>
        {overlays}
      </div>
    );
  }

  // ----- solo mando -----
  return (
    <div className="pad" style={{ '--c': color }}>
      <div className="pad-col left">
        <div className="pad-col-big">{driftBtn}</div>
        {brakeBtn}
      </div>
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
        {h.obj && <div className="pad-obj">{h.obj}</div>}
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
      <div className="pad-col right">
        {itemBtn}
        {powerBtn}
      </div>
      {overlays}
    </div>
  );
}
