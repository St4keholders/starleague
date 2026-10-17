'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { GameHost, peerParamsString } from '../game/engine';
import { PASSWORD_HASH, CHARACTERS, MODES, DIFFICULTIES, TRACK_NAMES, SLOT_COLORS, SLOT_NAMES, charById, GAME_NAME } from '../game/constants';
import { sha256 } from '../game/sha256';
import { getSprites, getShadowPortrait } from '../game/sprites';
import { STORY_LEVELS } from '../game/story';
import { fmtTime } from '../game/render';

export default function HostApp() {
  const [unlocked, setUnlocked] = useState(null);
  useEffect(() => {
    let ok = false;
    try { ok = localStorage.getItem('sl_ok') === PASSWORD_HASH; } catch (e) { ok = false; }
    setUnlocked(ok);
  }, []);
  if (unlocked === null) return <div className="screen" />;
  if (!unlocked) return <PasswordGate onOk={() => setUnlocked(true)} />;
  return <Game />;
}

function Logo({ small }) {
  return (
    <div className={small ? 'logo small' : 'logo'}>
      <span className="logo-star">★</span>
      <span className="logo-text">STAR<br />LEAGUE</span>
    </div>
  );
}

function PasswordGate({ onOk }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const h = await sha256(pw);
    setBusy(false);
    if (h === PASSWORD_HASH) {
      try { localStorage.setItem('sl_ok', h); } catch (er) { /* sin almacenamiento */ }
      onOk();
    } else {
      setErr('Contraseña incorrecta');
      setPw('');
    }
  };
  return (
    <div className="screen gate">
      <div className="stars" />
      <form className="gate-card" onSubmit={submit}>
        <Logo />
        <label htmlFor="pw">Contraseña</label>
        <input id="pw" type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} autoComplete="current-password" />
        <button className="btn gold" type="submit" disabled={busy || !pw}>Entrar</button>
        <p className="err" role="alert">{err}</p>
      </form>
    </div>
  );
}

function Game() {
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const [st, setSt] = useState(null);
  const [qr, setQr] = useState('');
  const [url, setUrl] = useState('');
  const [portraits, setPortraits] = useState({});
  const [items, setItems] = useState({});

  useEffect(() => {
    const host = new GameHost(canvasRef.current, (s) => setSt(s));
    hostRef.current = host;
    window.__starLeague = host;
    setSt(host.snapshot());
    const sp = getSprites();
    const p = {}; for (const id in sp.portraits) p[id] = sp.portraits[id].toDataURL();
    for (const id in sp.portraits) { try { p[`shadow-${id}`] = getShadowPortrait(id).toDataURL(); } catch (e) { /* nada */ } }
    const it = {}; for (const id in sp.items) it[id] = sp.items[id].toDataURL();
    setPortraits(p); setItems(it);
    const unlock = () => { host.audio.init(); if (host.phase === 'lobby' && host.audio.song === -1) host.audio.playSong(6); };
    window.addEventListener('pointerdown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); host.destroy(); };
  }, []);

  useEffect(() => {
    if (!st || !st.code) return;
    const u = `${window.location.origin}/mando?c=${st.code}${peerParamsString()}`;
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#120a24', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [st && st.code]);

  const host = hostRef.current;
  return (
    <div className="screen game">
      <div className="stage"><canvas ref={canvasRef} /></div>
      {st && host && st.phase === 'lobby' && <Lobby st={st} host={host} qr={qr} url={url} portraits={portraits} />}
      {st && host && st.phase === 'race' && st.paused && <Pause host={host} />}
      {st && host && st.phase === 'results' && <Results st={st} host={host} portraits={portraits} />}
      {st && host && st.phase === 'podium' && <Podium st={st} host={host} portraits={portraits} />}
      {st && host && st.phase === 'cinematic' && <Cinematic st={st} host={host} portraits={portraits} />}
      {st && host && st.phase === 'storyresult' && <StoryResult st={st} host={host} />}
      {st && host && st.phase === 'storyend' && <StoryEnd host={host} portraits={portraits} st={st} />}
      {st && host && st.phase === 'race' && !st.paused && <button className="corner-btn" onClick={() => host.togglePause()} title="Pausa (Esc)">II</button>}
    </div>
  );
}

function fullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

function Lobby({ st, host, qr, url, portraits }) {
  const n = st.players.filter(Boolean).length;
  const { cfg } = st;
  return (
    <div className="overlay lobby">
      <div className="lobby-main">
        <div className="lobby-left">
          <Logo small />
          <div className="slots">
            {st.players.map((p, i) => (
              <div key={i} className={'slot' + (p ? ' on' : '')} style={{ '--c': SLOT_COLORS[i] }}>
                <div className="slot-tag">{SLOT_NAMES[i]}</div>
                {p ? (
                  <>
                    <img className="slot-face" src={portraits[p.char]} alt="" />
                    <div className="slot-info">
                      <div className="slot-name">{charById(p.char).name}</div>
                      <div className="slot-meta">{p.kind === 'phone' ? (p.connected ? '📱 Celular' : '📱 Desconectado') : p.kind === 'kbA' ? '⌨ WASD' : '⌨ Flechas'}</div>
                      <div className="slot-power">{charById(p.char).powerName}</div>
                    </div>
                    <button className="slot-x" title="Quitar" onClick={() => host.removePlayer(i)}>✕</button>
                  </>
                ) : (
                  <div className="slot-empty">Escanea el QR<br /><small>o pulsa W / ↑ en el teclado</small></div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="lobby-right">
          <div className="qr-card">
            {qr ? <img src={qr} alt="Código QR para conectar el celular" /> : <div className="qr-wait">Generando…</div>}
            <div className="code">{st.code || '·····'}</div>
            <div className={'peer ' + st.peerStatus}>
              {st.peerStatus === 'ready' ? '● Listo para conectar celulares' : st.peerStatus === 'error' ? '● ' + (st.peerError || 'Sin conexión') : '● Conectando…'}
            </div>
            <div className="qr-help">Escanea con la cámara del celular. Si no, abre <b>{url.split('?')[0].replace(/^https?:\/\//, '')}</b> y escribe el código.</div>
          </div>
        </div>
      </div>
      <div className="lobby-bar">
        <div className="cfg-group">
          <div className="cfg-label">Modo</div>
          <div className="seg">
            {MODES.map((m) => <button key={m.id} className={cfg.mode === m.id ? 'on' : ''} onClick={() => host.setCfg({ mode: m.id })} title={m.desc}>{m.name}</button>)}
          </div>
        </div>
        {cfg.mode === 'rapida' && (
          <div className="cfg-group">
            <div className="cfg-label">Pista</div>
            <div className="seg">
              {TRACK_NAMES.map((t, i) => <button key={t} className={cfg.track === i ? 'on' : ''} onClick={() => host.setCfg({ track: i })}>{t}</button>)}
            </div>
          </div>
        )}
        {cfg.mode === 'historia' && (
          <div className="cfg-group">
            <div className="cfg-label">Empezar en</div>
            <select className="sel" value={cfg.level || 0} onChange={(e) => host.setCfg({ level: Number(e.target.value) })}>
              {STORY_LEVELS.map((l, i) => <option key={l.n} value={i}>{l.n}. {l.title} · {l.chapter.split('·')[1] || l.chapter}</option>)}
            </select>
          </div>
        )}
        <div className="cfg-group">
          <div className="cfg-label">Rivales</div>
          <div className="seg">
            {DIFFICULTIES.map((d) => <button key={d.id} className={cfg.diff === d.id ? 'on' : ''} onClick={() => host.setCfg({ diff: d.id })}>{d.name}</button>)}
          </div>
        </div>
        <button className="btn gold start" disabled={!n} onClick={() => host.startGame()}>{n ? '¡Empezar!' : 'Esperando jugadores'}</button>
      </div>
      <div className="lobby-foot">
        <span>El carro acelera solo · Teclado de respaldo: <b>J con WASD</b> (W para unirse): A/D gira, S frena, Espacio derrapa, Q objeto, E poder · <b>J con flechas</b> (↑ para unirse): ←/→ gira, ↓ frena, Shift der. derrapa, «-» objeto, «.» poder · En el lobby: A/D o ←/→ cambia personaje</span>
        <span className="foot-btns">
          <button className="mini" onClick={() => host.toggleMute()}>{st.muted ? '🔇 Sonido' : '🔊 Sonido'}</button>
          <button className="mini" onClick={fullscreen}>⛶ Pantalla completa</button>
        </span>
      </div>
    </div>
  );
}

function Pause({ host }) {
  return (
    <div className="overlay center">
      <div className="card">
        <h2>Pausa</h2>
        <button className="btn gold" onClick={() => host.togglePause()}>Continuar</button>
        <button className="btn" onClick={() => host.toLobby()}>Salir al lobby</button>
      </div>
    </div>
  );
}

function nameFor(r) {
  const ch = charById(r.char);
  return ch.name;
}

function Results({ st, host, portraits }) {
  const res = st.results || [];
  const battle = st.mode === 'battle';
  const cupLast = st.cup && st.cup.current >= st.cup.total - 1;
  const nextLabel = st.cup ? (cupLast ? 'Ver podio' : 'Siguiente carrera') : 'Volver al lobby';
  return (
    <div className="overlay center">
      <div className="card results">
        <h2>{battle ? 'Batalla terminada' : st.raceName}</h2>
        {st.cup && <div className="sub">Copa · carrera {st.cup.current + 1} de {st.cup.total}</div>}
        <table>
          <tbody>
            {res.map((r) => (
              <tr key={r.key} className={r.human ? 'human' : ''} style={r.human ? { '--c': SLOT_COLORS[r.slot] } : undefined}>
                <td className="pl">{r.place}º</td>
                <td><img src={portraits[r.char]} alt="" /></td>
                <td className="nm">{nameFor(r)} {r.human && <span className="tag">{SLOT_NAMES[r.slot]}</span>}</td>
                <td className="tm">{battle ? `${r.balloons} globo${r.balloons === 1 ? '' : 's'}` : r.time !== null ? (r.est ? '~' : '') + fmtTime(r.time) : '—'}</td>
                {st.cup && <td className="pt">+{r.points} <b>{r.total}</b></td>}
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn gold" onClick={() => host.next()} autoFocus>{nextLabel}</button>
        {st.cup && !cupLast && <button className="btn" onClick={() => host.toLobby()}>Abandonar copa</button>}
      </div>
    </div>
  );
}

function Podium({ st, host, portraits }) {
  const list = host.cupStandings();
  const top = [list[1], list[0], list[2]];
  return (
    <div className="overlay center podium-ov">
      <div className="card podium">
        <h2>¡Final de la copa!</h2>
        <div className="podium-row">
          {top.map((s, i) => s && (
            <div key={s.key} className={'pod p' + s.place}>
              <img src={portraits[s.char]} alt="" />
              <div className="pod-name" style={s.human ? { color: SLOT_COLORS[s.slot] } : undefined}>{s.name}{s.human ? ` ${SLOT_NAMES[s.slot]}` : ''}</div>
              <div className="pod-block">{s.place}º<small>{s.points} pts</small></div>
            </div>
          ))}
        </div>
        <ol className="standings">
          {list.slice(3).map((s) => <li key={s.key} style={s.human ? { color: SLOT_COLORS[s.slot] } : undefined}>{s.place}º {s.name}{s.human ? ` ${SLOT_NAMES[s.slot]}` : ''} — {s.points} pts</li>)}
        </ol>
        <button className="btn gold" onClick={() => host.next()} autoFocus>Volver al lobby</button>
      </div>
    </div>
  );
}

function Typewriter({ text, id, host }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t); }, 26);
    host.cineHook = () => { if (i < text.length) { i = text.length; setN(i); clearInterval(t); return true; } return false; };
    return () => { clearInterval(t); host.cineHook = null; };
  }, [id]);
  return <>{text.slice(0, n)}<span className="caret">{n < text.length ? '' : ' ▶'}</span></>;
}

function Cinematic({ st, host, portraits }) {
  const c = st.cine;
  if (!c || c.done) return <div className="overlay cine"><div className="bar top" /><div className="bar bottom" /></div>;
  const line = c.line;
  const face = line && line.char ? portraits[line.shadow ? `shadow-${line.char}` : line.char] : null;
  return (
    <div className="overlay cine" onClick={() => { if (!(host.cineHook && host.cineHook())) host.cineNext(); }}>
      <div className="bar top" />
      <div className="bar bottom" />
      <button className="cine-skip" onClick={(e) => { e.stopPropagation(); host.cineSkip(); }}>Saltar ⏭</button>
      {c.title && (
        <div className="cine-title" key={c.v}>
          <div className="t1">{c.title}</div>
          {c.sub && <div className="t2">{c.sub}</div>}
        </div>
      )}
      {line && (
        <div className={'cine-box' + (line.char === 'baron' ? ' villain' : line.shadow ? ' shadow' : '')}>
          <div className="cine-face">{face ? <img src={face} alt="" /> : <span>★</span>}</div>
          <div className="cine-text">
            <div className="cine-name">{line.name}</div>
            <div className="cine-line"><Typewriter text={line.text} id={line.id} host={host} /></div>
          </div>
          <div className="cine-hint">Enter o clic</div>
        </div>
      )}
    </div>
  );
}

function StoryResult({ st, host }) {
  const s = st.story || {};
  const win = s.result === 'win';
  const last = s.n >= s.total;
  return (
    <div className="overlay center">
      <div className={'card story-card ' + (win ? 'win' : 'lose')}>
        <div className="sub">Nivel {s.n} de {s.total} · {s.chapter}</div>
        <h2>{win ? '¡Nivel superado!' : 'No lo lograron'}</h2>
        <p className="story-obj">{s.title} — {s.obj}</p>
        {win ? (
          <button className="btn gold" autoFocus onClick={() => host.next()}>{last ? 'Ver el final' : 'Continuar'}</button>
        ) : (
          <>
            <button className="btn gold" autoFocus onClick={() => host.next()}>Reintentar</button>
            <button className="btn" onClick={() => host.skipLevel()}>Saltar este nivel</button>
          </>
        )}
        <button className="btn" onClick={() => host.toLobby()}>Salir de la historia</button>
      </div>
    </div>
  );
}

function StoryEnd({ host, portraits, st }) {
  const heroes = st.players.filter(Boolean).map((p) => p.char);
  return (
    <div className="overlay center story-end">
      <div className="card podium">
        <div className="end-star">★</div>
        <h2>¡La Estrella Madre volvió a brillar!</h2>
        <p className="story-obj">Recuperaron los cinco fragmentos y derrotaron al Barón Eclipse.</p>
        <div className="end-heroes">{heroes.map((c, i) => <img key={i} src={portraits[c]} alt="" />)}</div>
        <div className="credits">
          <div>STAR LEAGUE · El Robo de las Estrellas</div>
          <div>Un juego para jugar en familia</div>
        </div>
        <button className="btn gold" autoFocus onClick={() => host.next()}>Volver al lobby</button>
      </div>
    </div>
  );
}
