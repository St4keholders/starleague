// Prueba sin navegador para «Supervivencia Estelar» (sección 8.2)
// Importa SOLO módulos sin DOM. Si algo toca document o window, falla.

import { generateChunk, verifyFreeCorridor, obstacleStateAt } from '../game/runner/layout.js';
import { RunnerSim } from '../game/runner/sim.js';
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
    const chunk = generateChunk(seed, k, 2);
    const ok = verifyFreeCorridor(seed, chunk, MIN_CORRIDOR_W);
    assert(ok, `Sin pasillo libre >= ${MIN_CORRIDOR_W} u en seed=${seed}, chunk=${k}`);
  }
}
console.log('   ✓ Pasillo libre OK (1.490 trozos verificados).');

// 2.5 Verificar choques, escudo, invulnerabilidad y eliminación por vidas
{
  const sim = new RunnerSim({ seed: 123, humans: [{ slot: 0, char: 'pipo' }], difficulty: 1 });
  sim.started = true;
  const k = sim.karts[0];
  const ch3 = sim.world.getChunk(3);
  const obs = ch3.obstacles.find((o) => o.solid);
  assert(obs, 'Debe existir obstáculo sólido en el trozo 3');
  // Con escudo activo: absorbe el golpe sin quitar corazón
  k.shieldT = 5;
  k.x = obs.x; k.y = obs.y; k.z = 0; k.v = 200;
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 3 && k.shieldT === 0 && k.invulnT > 0, 'El escudo debe absorber el golpe sin quitar corazón');
  // Mientras está invulnerable, no pierde corazón
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 3, 'No debe perder corazón durante invulnerabilidad');
  // Tres choques sin invulnerabilidad eliminan por vidas
  for (let hit = 1; hit <= 3; hit++) {
    k.invulnT = 0;
    k.x = obs.x; k.y = obs.y; k.z = 0; k.v = 200;
    sim.bounds(k, 1 / 60);
    assert(k.hearts === 3 - hit, `Tras golpe ${hit} debería tener ${3 - hit} corazones`);
  }
  assert(k.eliminated && k.elimReason === 'vidas', 'Al llegar a 0 corazones debe quedar eliminado por vidas');
}

// 2.6 Verificar recogibles (corazón, escudo, caja) y que el corazón no pasa de 3
{
  const sim = new RunnerSim({ seed: 456, humans: [{ slot: 0, char: 'pipo' }], difficulty: 1 });
  sim.started = true;
  const k = sim.karts[0];
  let heartPk = null, shieldPk = null, boxPk = null;
  for (let ci = 3; ci < 80; ci++) {
    const ch = sim.world.getChunk(ci);
    for (const pk of ch.pickups) {
      if (pk.type === 'heart' && !heartPk) heartPk = pk;
      if (pk.type === 'shield' && !shieldPk) shieldPk = pk;
      if (pk.type === 'box' && !boxPk) boxPk = pk;
    }
    if (heartPk && shieldPk && boxPk) break;
  }
  assert(heartPk && shieldPk && boxPk, 'Deben generarse recogibles heart, shield y box');
  // Corazón con 2 vidas -> sube a 3 y se marca en taken
  k.hearts = 2; k.x = heartPk.x; k.y = heartPk.y; k.z = 0;
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 3 && sim.taken.has(heartPk.id), 'El corazón debe curar a 3 y marcarse en taken');
  // Corazón con 3 vidas -> no pasa de 3 y da mini-turbo
  sim.taken.delete(heartPk.id);
  k.boostT = 0; k.x = heartPk.x; k.y = heartPk.y;
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 3 && k.boostT > 0, 'Con 3 corazones no debe pasar de 3 y debe dar turbo');
  // Escudo -> activa shieldT = 8
  k.x = shieldPk.x; k.y = shieldPk.y;
  sim.bounds(k, 1 / 60);
  assert(k.shieldT >= 7.9 && sim.taken.has(shieldPk.id), 'El escudo debe activar shieldT y desaparecer');
  // Caja -> inicia ruleta de objeto
  k.item = null; k.rouletteT = 0; k.x = boxPk.x; k.y = boxPk.y;
  sim.bounds(k, 1 / 60);
  assert(k.rouletteT > 0 && sim.taken.has(boxPk.id), 'La caja debe iniciar ruleta y desaparecer');
}

// 2.7 Verificar salto sobre cercas, rampa hacia techo de granero, avance sobre techo, caída y choque lateral
{
  const sim = new RunnerSim({ seed: 789, humans: [{ slot: 0, char: 'pipo' }], difficulty: 1 });
  sim.started = true;
  const k = sim.karts[0];

  // a) Saltar una cerca
  let fence = null;
  for (let ci = 3; ci < 60; ci++) {
    fence = sim.world.getChunk(ci).obstacles.find((o) => o.kind === 'fence');
    if (fence) break;
  }
  assert(fence, 'Debe generarse al menos una cerca (fence)');
  k.hearts = 3; k.invulnT = 0; k.jumpCd = 0;
  k.x = fence.x; k.y = fence.y - 28; k.z = 0; k.vz = 0;
  k.a = Math.PI / 2; k.v = 240; k.vx = 0; k.vy = 240;
  k.input = { steer: 0, acc: true, brake: false, drift: false, item: false, power: false, jump: true };
  sim.updateKart(k, 1 / 60);
  assert(k.vz === 240 - 780 * (1 / 60) || k.z > 0, 'La acción jump debe impulsar vz hacia arriba');
  k.input.jump = false;
  for (let s = 0; s < 25; s++) sim.updateKart(k, 1 / 60);
  assert(k.y > fence.y + 10 && k.hearts === 3, 'El kart debe saltar por encima de la cerca sin perder corazones');

  // b) Con rampa subir a un techo de granero, avanzar encima y caer al final
  let barnChunk = null, barnPl = null, barnRamp = null;
  for (let ci = 3; ci < 120; ci++) {
    const ch = sim.world.getChunk(ci);
    if (ch.platforms && ch.platforms.length > 0) {
      barnChunk = ch;
      barnPl = ch.platforms[0];
      barnRamp = ch.zones.find((z) => z.type === 'ramp');
      if (barnPl && barnRamp) break;
    }
  }
  assert(barnChunk && barnPl && barnRamp, 'Debe generarse un granero con plataforma y rampa frontal');
  const midX = (barnPl.x0 + barnPl.x1) * 0.5;
  k.hearts = 3; k.invulnT = 0; k.jumpCd = 0; k.spinT = 0;
  k.x = midX; k.y = barnRamp.y0 + 2; k.z = 0; k.vz = 0;
  k.a = Math.PI / 2; k.v = 250; k.vx = 0; k.vy = 250;
  k.input = { steer: 0, acc: true, brake: false, drift: false, item: false, power: false, jump: false };

  let onRoof = false;
  let fellAfter = false;
  for (let s = 0; s < 90; s++) {
    k.x = midX; k.a = Math.PI / 2;
    sim.updateKart(k, 1 / 60);
    if (k.y >= barnPl.y0 + 10 && k.y <= barnPl.y1 - 10 && k.z >= barnPl.h) {
      onRoof = true;
    }
    if (onRoof && k.y > barnPl.y1 + 15 && k.z < barnPl.h) {
      fellAfter = true;
      break;
    }
  }
  assert(onRoof && k.hearts === 3, 'El kart debe subir al techo del granero con la rampa sin chocar');
  assert(fellAfter, 'El kart debe caer al salir del borde final del techo');

  // c) Choque al entrar de lado con z < h - 8
  k.hearts = 3; k.invulnT = 0; k.spinT = 0;
  k.x = midX; k.y = (barnPl.y0 + barnPl.y1) * 0.5; k.z = 0; k._prevZ = 0; k.vz = 0; k.v = 200;
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 2, 'Entrar al granero con z < h - 8 debe producir un choque (-1 corazón)');
}

// 2.8 Verificar lagos con hielo (seguro), islas/puentes (seguro) y agua sin hielo (-1 corazón y reaparición en la misma Y)
{
  const sim = new RunnerSim({ seed: 321, humans: [{ slot: 0, char: 'pipo' }], difficulty: 1 });
  sim.started = true;
  const k = sim.karts[0];

  let frozenZone = null, openWaterChunk = null, openWaterZone = null, islandZone = null;
  for (let ci = 3; ci < 80; ci++) {
    const ch = sim.world.getChunk(ci);
    for (const z of ch.zones) {
      if (z.type === 'water' && z.frozen && !frozenZone) frozenZone = z;
      if (z.type === 'water' && !z.frozen && !openWaterZone) {
        openWaterChunk = ch;
        openWaterZone = z;
        islandZone = ch.zones.find((oz) => oz.type === 'island');
      }
    }
    if (frozenZone && openWaterZone && islandZone) break;
  }
  assert(frozenZone && openWaterZone && islandZone, 'Deben generarse lagos congelados, de agua abierta e islas');

  // a) Lago congelado con grietas de hielo: seguro, cambia surface a 'ice'
  k.hearts = 3; k.invulnT = 0; k.z = 0; k._prevZ = 0;
  k.x = (frozenZone.x0 + frozenZone.x1) * 0.5;
  k.y = (frozenZone.y0 + frozenZone.y1) * 0.5;
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 3 && k.surface === 'ice', 'El lago congelado debe ser seguro y poner surface="ice"');

  // b) Isla dentro del agua abierta: segura
  k.hearts = 3; k.invulnT = 0; k.z = 0; k._prevZ = 0;
  k.x = islandZone.x;
  k.y = islandZone.y;
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 3, 'La isla sobre el agua debe ser segura');

  // c) Agua abierta fuera de isla y puente: quita 1 corazón y reaparece a la misma Y con z = 30
  const bridge = openWaterChunk.zones.find((z) => z.type === 'bridge');
  let waterX = openWaterZone.x0 + 18;
  for (let tx = openWaterZone.x0 + 15; tx <= openWaterZone.x1 - 15; tx += 12) {
    const onBridge = bridge && tx >= bridge.x0 && tx <= bridge.x1;
    const onIsland = Math.hypot((tx - islandZone.x) / islandZone.rx, (islandZone.y - islandZone.y) / islandZone.ry) <= 1.05;
    if (!onBridge && !onIsland) {
      waterX = tx;
      break;
    }
  }
  const waterY = (openWaterZone.y0 + openWaterZone.y1) * 0.5;
  k.hearts = 3; k.invulnT = 0; k.z = 0; k._prevZ = 0;
  k.x = waterX; k.y = waterY;
  sim.bounds(k, 1 / 60);
  assert(k.hearts === 2, 'Caer al agua sin hielo debe quitar 1 corazón');
  assert(Math.abs(k.y - waterY) < 0.01 && k.z === 30 && k.invulnT > 0, 'Debe reaparecer en la misma Y con z=30 e invulnT');
}

// 2.9 Verificar pasto alto (grass), mechones (grasstuft), surco persistente (cutGrass) y freno a 0.92
{
  const sim = new RunnerSim({ seed: 654, humans: [{ slot: 0, char: 'pipo' }], difficulty: 1 });
  sim.started = true;
  const k = sim.karts[0];
  let grassChunk = null, grassZone = null, tuft = null;
  for (let ci = 3; ci < 50; ci++) {
    const ch = sim.world.getChunk(ci);
    const gz = ch.zones.find((z) => z.type === 'grass');
    const gt = ch.decor.find((d) => d.kind === 'grasstuft' && !d.cut);
    if (gz && gt) {
      grassChunk = ch;
      grassZone = gz;
      tuft = gt;
      break;
    }
  }
  assert(grassChunk && grassZone && tuft, 'Deben generarse zonas grass y mechones grasstuft');
  k.x = tuft.x; k.y = tuft.y; k.z = 0; k._prevZ = 0; k.boostT = 0; k.v = k.maxV;
  sim.updateKart(k, 1 / 60);
  assert(k.surface === 'grass', 'El kart dentro de una zona grass debe tener surface="grass"');
  assert(tuft.cut === true && sim.world.grassCuts > 0, 'cutGrass debe cortar el mechón cercano y dejar surco persistente');
  assert(k.v <= k.maxV * 0.92 + 0.01, 'El pasto alto debe frenar la velocidad máxima a 0.92');

  // Prueba de obstáculos móviles (tractor_side, sheep): determinismo en dos instancias al mismo raceTime
  const chA = generateChunk(12345, 4, 1);
  const chB = generateChunk(12345, 4, 1);
  const movA = chA.obstacles.find((o) => o.moving);
  const movB = chB.obstacles.find((o) => o.moving);
  assert(movA && movB, 'El trozo 4 debe tener obstáculo móvil en la granja');
  const st0 = obstacleStateAt(movA, 0);
  const st1A = obstacleStateAt(movA, 2.35);
  const st1B = obstacleStateAt(movB, 2.35);
  assert(st1A.x === st1B.x && st1A.y === st1B.y && st1A.frame === st1B.frame, 'Dos instancias con misma semilla y raceTime deben dar igual posición móvil');
  assert(Math.abs(st1A.x - st0.x) > 5, 'El obstáculo móvil debe desplazarse con raceTime');
}

// 3. Partidas automáticas: RunnerSim con 6 bots, 10 semillas × 3 dificultades
console.log('3) Simulando partidas automáticas (10 semillas × 3 dificultades)...');
const MATCH_SEEDS = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010];
const DIFF_NAMES = ['Fácil', 'Normal', 'Difícil'];
const durationsByDiff = [[], [], []];

for (let diff = 0; diff <= 2; diff++) {
  for (const seed of MATCH_SEEDS) {
    const sim = new RunnerSim({ seed, humans: [], difficulty: diff });
    const dt = 1 / 60;
    const maxTime = 400;
    const windowCheck = new Map();
    for (const k of sim.karts) windowCheck.set(k.id, { t: 0, y: k.y });

    while (!sim.done && sim.raceTime < maxTime) {
      sim.step(dt);
      sim.events.length = 0;
      if (sim.started && sim.endTimer < 0) {
        for (const k of sim.karts) {
          if (k.eliminated) continue;
          const w = windowCheck.get(k.id);
          if (sim.raceTime - w.t >= 3.0) {
            const dy = k.y - w.y;
            assert(
              dy >= 100,
              `Bot ${k.char} atascado en seed=${seed} diff=${diff} t=${sim.raceTime.toFixed(1)}s (avanzó ${dy.toFixed(1)}u en 3s)`
            );
            w.t = sim.raceTime;
            w.y = k.y;
          }
        }
      }
    }

    assert(sim.done, `La partida no terminó antes de ${maxTime}s (seed=${seed}, diff=${diff})`);
    assert(sim.raceTime <= 360, `La partida duró más de 360s: ${sim.raceTime.toFixed(1)}s (seed=${seed}, diff=${diff})`);
    const res = sim.results();
    durationsByDiff[diff].push(sim.raceTime);
    const reasons = res.slice(1).map((r) => `${r.char}:${r.reason}`).join(', ');
    console.log(
      `   [${DIFF_NAMES[diff]} | seed=${seed}] dur=${sim.raceTime.toFixed(1)}s | ganador=${res[0].char} (${res[0].distance}m) | elim=[${reasons}]`
    );
  }
}

const normalSorted = [...durationsByDiff[1]].sort((a, b) => a - b);
const mid = normalSorted.length / 2;
const medianNormal = (normalSorted[mid - 1] + normalSorted[mid]) / 2;
console.log(`   Mediana en Normal: ${medianNormal.toFixed(1)}s (objetivo: 120..240s)`);
assert(
  medianNormal >= 120 && medianNormal <= 240,
  `Mediana en Normal fuera de [120, 240]s: ${medianNormal.toFixed(1)}s`
);

console.log('✅ runner-smoke pasó todas las pruebas (1, 2, 3 y 4).');
