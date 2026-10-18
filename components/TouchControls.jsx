'use client';
import { useEffect, useRef, useState } from 'react';

// Botón táctil que soporta varios dedos a la vez
export function PadBtn({ label, cls, onDown, onUp, children }) {
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

export async function goFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch (e) { /* nada */ }
}

export async function keepAwake(ref) {
  try { if ('wakeLock' in navigator && !ref.current) ref.current = await navigator.wakeLock.request('screen'); } catch (e) { /* nada */ }
}

export function usePortrait() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const upd = () => setPortrait(mq.matches);
    upd();
    mq.addEventListener ? mq.addEventListener('change', upd) : mq.addListener(upd);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', upd) : mq.removeListener(upd); };
  }, []);
  return portrait;
}

// Volante con el sensor de movimiento (opcional). Devuelve el giro en ref.current.value (-1 a 1).
export function useTilt() {
  const st = useRef({ value: 0, theta: 0, theta0: 0, got: false, lastAng: null, conv: undefined, on: false });
  const [state, setState] = useState('off'); // off | on | none
  const handler = useRef((e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null) return;
    const gx = g.x || 0, gy = g.y || 0, gz = g.z || 0;
    const t = st.current;
    let ang = 0;
    if (screen.orientation && typeof screen.orientation.angle === 'number') ang = screen.orientation.angle;
    else if (typeof window.orientation === 'number') ang = window.orientation;
    ang = ((Math.round(ang / 90) * 90) % 360 + 360) % 360;
    if (ang !== t.lastAng) { t.lastAng = ang; t.theta0 = 0; t.value = 0; t.conv = undefined; }
    let sx, sy;
    if (ang === 0) { sx = gx; sy = gy; } else if (ang === 90) { sx = -gy; sy = gx; } else if (ang === 180) { sx = -gx; sy = -gy; } else { sx = gy; sy = -gx; }
    t.conv = t.conv === undefined ? (sy + gz) : t.conv * 0.97 + (sy + gz) * 0.03;
    const conv = t.conv >= 0 ? 1 : -1;
    const mag = Math.hypot(gx, gy, gz) || 9.81;
    const roll = Math.asin(Math.max(-1, Math.min(1, (-sx * conv) / mag)));
    t.theta = roll; t.got = true;
    let s = (roll - t.theta0) / (30 * Math.PI / 180);
    const dz = 0.06;
    s = Math.abs(s) < dz ? 0 : (s - Math.sign(s) * dz) / (1 - dz);
    s = Math.max(-1, Math.min(1, s));
    t.value = t.value * 0.45 + s * 0.55;
  }).current;

  const start = async () => {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') { setState('none'); return false; }
      }
    } catch (e) { /* nada */ }
    window.removeEventListener('devicemotion', handler);
    window.addEventListener('devicemotion', handler);
    st.current.got = false; st.current.on = true;
    setState('on');
    setTimeout(() => { if (!st.current.got) { stop(); setState('none'); } }, 1500);
    return true;
  };
  const stop = () => { window.removeEventListener('devicemotion', handler); st.current.on = false; st.current.value = 0; setState((s) => (s === 'none' ? s : 'off')); };
  const center = () => { st.current.theta0 = st.current.theta; st.current.value = 0; if (navigator.vibrate) navigator.vibrate(20); };
  useEffect(() => () => window.removeEventListener('devicemotion', handler), []);
  return { ref: st, state, start, stop, center };
}
