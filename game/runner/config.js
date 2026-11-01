// Constantes de balance y tabla de biomas para el modo «Supervivencia Estelar»

export const RUNNER_KARTS = 6;
export const START_HEARTS = 3;
export const MAX_HEARTS = 3;

// Geometría del mundo y trozos
export const TEX_SCALE = 1.5;
export const WORLD_W = 2048 * TEX_SCALE; // 3072
export const CHUNK_TEX_ROWS = 128;
export const CHUNK_LEN = CHUNK_TEX_ROWS * TEX_SCALE; // 192 unidades de mundo
export const SAFE_START_CHUNKS = 3;
export const MIN_CORRIDOR_W = 90;

// Velocidad del kart a lo largo de la partida
export const SPEED_START = 0.85;
export const SPEED_END = 1.35;
export const SPEED_RAMP_TIME = 180;

// Perseguidor
export const CHASE_V0 = 190;
export const CHASE_ACC = 1.0;
export const MAXGAP_START = 1100;
export const MAXGAP_END = 350;
export const MAXGAP_RAMP_TIME = 180;
export const CHASER_KILL_OFFSET = 10;

// Ajustes por dificultad (0 = Fácil, 1 = Normal, 2 = Difícil)
export const DIFF_CHASE_MUL = [0.85, 1.0, 1.1];
export const DIFF_OBS_DENSITY = [0.75, 1.0, 1.2];
export const DIFF_BOT_ERROR = [0.12, 0.06, 0.02];
export const DIFF_BOT_THINK_DT = [0.25, 0.15, 0.1];

// Acciones, rampas y daño
export const JUMP_VZ = 240;
export const JUMP_COOLDOWN = 0.6;
export const RAMP_VZ = 320;
export const RAMP_V_FACTOR = 0.25;
export const RAMP_BOOST = 0.45;
export const SHIELD_DURATION = 8.0;
export const INVULN_DURATION = 2.0;
export const CRASH_SPIN_DURATION = 0.8;

// Frecuencia de recogibles (en unidades de avance)
export const HEART_EVERY = 2500;
export const SHIELD_EVERY = 1800;
export const BOX_ROW_EVERY = 1200;

// Biomas: cambian cada ~9.000 unidades con banda de transición de ~400 unidades
export const BIOME_LENGTH = 9000;
export const BIOME_TRANSITION = 400;

export const BIOMES = [
  {
    index: 0,
    id: 'granja',
    name: 'Granja de Otoño',
    theme: 'granja',
    chaser: 'stampede',
    chaserName: 'la estampida',
  },
  {
    index: 1,
    id: 'playa',
    name: 'Playa Coral',
    theme: 'playa',
    chaser: 'wave',
    chaserName: 'la ola gigante',
  },
  {
    index: 2,
    id: 'nieve',
    name: 'Cumbre Nevada',
    theme: 'nieve',
    chaser: 'avalanche',
    chaserName: 'la avalancha',
  },
  {
    index: 3,
    id: 'volcan',
    name: 'Volcán Fortaleza',
    theme: 'volcan',
    chaser: 'lavaflow',
    chaserName: 'el río de lava',
  },
  {
    index: 4,
    id: 'jungla',
    name: 'Jungla Gloop',
    theme: 'jungla',
    chaser: 'goowave',
    chaserName: 'la ola de baba',
  },
  {
    index: 5,
    id: 'neon',
    name: 'Ciudad Neón',
    theme: 'neon',
    chaser: 'glitchstorm',
    chaserName: 'la tormenta de glitch',
  },
  {
    index: 6,
    id: 'anillos',
    name: 'Anillos de Saturnia',
    theme: 'anillos',
    altTheme: 'estelar',
    chaser: 'blackhole',
    chaserName: 'el agujero negro',
  },
  {
    index: 7,
    id: 'coliseo',
    name: 'Coliseo de Zorg',
    theme: 'coliseo',
    chaser: 'zorgship',
    chaserName: 'la nave de Zorg',
  },
];

export function speedFactor(t) {
  const f = Math.max(0, Math.min(1, t / SPEED_RAMP_TIME));
  return SPEED_START + (SPEED_END - SPEED_START) * f;
}

export function maxGapAt(t) {
  const f = Math.max(0, Math.min(1, t / MAXGAP_RAMP_TIME));
  return MAXGAP_START + (MAXGAP_END - MAXGAP_START) * f;
}

export function chaserSpeed(t, diff = 1, cycle = 0) {
  const mul = DIFF_CHASE_MUL[diff] ?? 1.0;
  const cycleBonus = cycle > 0 ? cycle * 25 : 0;
  return (CHASE_V0 * mul + CHASE_ACC * t) + cycleBonus;
}
