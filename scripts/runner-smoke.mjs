// Prueba sin navegador para «Supervivencia Estelar» (sección 8.2)
// Importa SOLO módulos sin DOM. Si algo toca document o window, falla.

import { generateChunk, verifyFreeCorridor } from '../game/runner/layout.js';
import { MIN_CORRIDOR_W } from '../game/runner/config.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FALLO:', msg);
    process.exit(1);
  }
}

// 0. Garantizar que no existe DOM en este entorno
assert(typeof document === 'undefined', 'El entorno de smoke no debe definir document');

// 1. Determinismo: generateChunk(123, k) llamado dos veces devuelve exactamente lo mismo para k = 0..200
console.log('1) Verificando determinismo (k = 0..200)...');
for (let k = 0; k <= 200; k++) {
  const a = JSON.stringify(generateChunk(123, k, 1));
  const b = JSON.stringify(generateChunk(123, k, 1));
  assert(a === b, `No determinista en trozo k=${k}`);
}
// Los primeros 3 trozos no deben tener obstáculos
for (let k = 0; k < 3; k++) {
  const c = generateChunk(123, k, 1);
  assert(c.obstacles.length === 0, `El trozo de salida k=${k} tiene obstáculos`);
}
console.log('   ✓ Determinismo OK (201 trozos idénticos y salida limpia).');

// 2. Pasillo libre: en cada trozo k = 3..300 de 5 semillas existe un pasillo libre de >= 90 u (barrido de X cada 10 u)
console.log('2) Verificando pasillo libre >= 90 u (5 semillas × trozos 3..300)...');
const SEEDS = [101, 2026, 7777, 424242, 987654];
for (const seed of SEEDS) {
  for (let k = 3; k <= 300; k++) {
    const chunk = generateChunk(seed, k, 2); // probamos incluso con densidad alta
    const ok = verifyFreeCorridor(seed, chunk, MIN_CORRIDOR_W);
    assert(ok, `Sin pasillo libre >= ${MIN_CORRIDOR_W} u en seed=${seed}, chunk=${k}`);
  }
}
console.log('   ✓ Pasillo libre OK (1.490 trozos verificados).');

console.log('✅ runner-smoke pasó correctamente.');
