// Datos generales de Star League

export const GAME_NAME = 'Star League';
// SHA-256 de la contraseña (no se guarda la contraseña en texto plano)
export const PASSWORD_HASH = 'b84278f09dc30d6b6710c7628dbe93a440013d3dd152c147c19fe00ba4fecf4f';
export const PEER_PREFIX = 'starleague-v1-';

export const VIEW_W = 480;
export const VIEW_H = 270;
export const MAP_SIZE = 2048;
export const MAP_SHIFT = 11;

export const MAX_PLAYERS = 4;
export const RACE_KARTS = 8;
export const BATTLE_KARTS = 6;
export const LAPS = 3;
export const CUP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
export const BATTLE_TIME = 150;

export const SLOT_COLORS = ['#ff4d5e', '#3fa0ff', '#3ddc84', '#ffd23f'];
export const SLOT_NAMES = ['J1', 'J2', 'J3', 'J4'];

export const CHARACTERS = [
  {
    id: 'pipo', name: 'Pipo', full: 'Pipo el Pollito',
    kart: '#ffcf2e', trim: '#ff8a1e',
    stats: { speed: 2, accel: 5, handling: 4, weight: 1 },
    power: 'aletazo', powerName: 'Aletazo', powerDesc: 'Salto que esquiva todo lo del piso',
  },
  {
    id: 'rocco', name: 'Rocco', full: 'Rocco el Gólem',
    kart: '#7f8794', trim: '#5fae4a',
    stats: { speed: 5, accel: 1, handling: 2, weight: 5 },
    power: 'temblor', powerName: 'Temblor', powerDesc: 'Hace derrapar a los que están cerca',
  },
  {
    id: 'lumi', fem: true, name: 'Lumi', full: 'Lumi la Luciérnaga',
    kart: '#8a52e0', trim: '#ffe45c',
    stats: { speed: 3, accel: 4, handling: 4, weight: 2 },
    power: 'destello', powerName: 'Destello', powerDesc: 'Ciega 2 segundos a los que van adelante',
  },
  {
    id: 'bruno', name: 'Bruno', full: 'Bruno el Oso',
    kart: '#e89a2c', trim: '#7a4a22',
    stats: { speed: 4, accel: 2, handling: 3, weight: 4 },
    power: 'panal', powerName: 'Panal', powerDesc: 'Persigue al de adelante y lo frena',
  },
  {
    id: 'nimbo', fem: true, name: 'Nimbo', full: 'Nimbo la Nube',
    kart: '#56b9ff', trim: '#ffffff',
    stats: { speed: 3, accel: 3, handling: 5, weight: 2 },
    power: 'rayo', powerName: 'Rayo', powerDesc: 'Cae sobre el que va primero',
  },
  {
    id: 'chispa', fem: true, name: 'Chispa', full: 'Chispa la Ardilla',
    kart: '#e8452c', trim: '#ffd9a0',
    stats: { speed: 5, accel: 3, handling: 1, weight: 2 },
    power: 'triple', powerName: 'Triple turbo', powerDesc: 'Tres turbos para usar cuando quieras',
  },
  {
    id: 'tito', name: 'Tito', full: 'Tito el Tomate',
    kart: '#3fae49', trim: '#e83a2e',
    stats: { speed: 3, accel: 3, handling: 3, weight: 3 },
    power: 'salsa', powerName: 'Charco de salsa', powerDesc: 'Deja un charco resbaloso detrás',
  },
  {
    id: 'gelida', fem: true, name: 'Gélida', full: 'Gélida la Pingüina',
    kart: '#2f5fc4', trim: '#bff3ff',
    stats: { speed: 4, accel: 3, handling: 3, weight: 3 },
    power: 'bola', powerName: 'Bola de nieve', powerDesc: 'Rebota por la pista y congela',
  },
];

// Villano del modo historia (no se puede elegir)
export const VILLAIN = {
  id: 'baron', name: 'Barón Eclipse', full: 'Barón Eclipse',
  kart: '#2a0c3c', trim: '#b44dff',
  stats: { speed: 4, accel: 3, handling: 4, weight: 5 },
  power: 'rayo', powerName: 'Eclipse', powerDesc: 'Rayo oscuro sobre el que va primero',
};

export const ITEMS = {
  chile: { name: 'Turbo de chile' },
  aceite: { name: 'Mancha de aceite' },
  chicle: { name: 'Bola de chicle' },
  burbuja: { name: 'Escudo burbuja' },
  iman: { name: 'Imán' },
};
export const ITEM_LIST = Object.keys(ITEMS);

export const MODES = [
  { id: 'copa', name: 'Copa', desc: 'Las 5 pistas seguidas, con puntos y podio' },
  { id: 'rapida', name: 'Carrera rápida', desc: 'Una pista, una carrera' },
  { id: 'batalla', name: 'Batalla de globos', desc: '3 globos cada uno, gana el último' },
  { id: 'historia', name: 'Historia', desc: '10 niveles con cinemáticas contra el Barón Eclipse' },
];

export const DIFFICULTIES = [
  { id: 0, name: 'Fácil' },
  { id: 1, name: 'Normal' },
  { id: 2, name: 'Difícil' },
];

export const TRACK_NAMES = ['Pradera Molinos', 'Playa Coral', 'Cumbre Nevada', 'Volcán Fortaleza', 'Senda Estelar', 'Fortaleza Eclipse'];
export const CUP_TRACKS = [0, 1, 2, 3, 4];
export const ARENA_NAME = 'Arena Cometa';

export function charById(id) {
  if (id === VILLAIN.id) return VILLAIN;
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

// nombre del jefe en versión sombra
export function shadowName(id) {
  if (id === VILLAIN.id) return VILLAIN.name;
  const c = charById(id);
  return `${c.name} ${c.fem ? 'Sombría' : 'Sombrío'}`;
}
