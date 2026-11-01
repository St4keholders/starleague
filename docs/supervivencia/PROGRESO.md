# Progreso · Modo «Supervivencia Estelar»

## Lista de tareas

- [x] **T01 Preparación:** rama, plan copiado, `PROGRESO.md`, compilación base OK (sección 0.2).
- [x] **T02 Config y modo en el lobby:** `game/runner/config.js` con todas las constantes y la tabla de biomas. Modo `supervivencia` en `MODES` (todavía arranca una carrera normal como relleno). Verificar: aparece en el lobby del TV y del celular; `npm run build`.
- [x] **T03 Refactor seguro de `Sim`:** métodos `placeKarts`, `bounds` y `projBounds` (sección 3.4). Verificar: regresión 8.4 completa, idéntica.
- [x] **T04 Layout sin DOM:** `layout.js` (`centerX`, `halfW`, `biomeAt`, `generateChunk` con pasillo libre, por ahora solo obstáculos estáticos de la granja) y `scripts/runner-smoke.mjs` con las pruebas 1 y 2. Verificar: el script pasa.
- [x] **T05 Mundo y textura circular:** `world.js` (anillo 2048², `ensure`, pintado de trozos, tema `granja`, cielo y paredes) y cambios en `Renderer` (rama `ring`, `applyBiomeFor`, `visibleDecor`). Verificar: en el navegador se ve el campo infinito avanzando con un kart `cpu`, sin cortes, a 60 fps.
- [x] **T06 `RunnerSim` básico:** salida, aceleración con `speedFactor`, paredes laterales, perseguidor, eliminación por perseguidor, fin de partida, `results`, `rank`. Engine: `startRace` y `startDemo` del modo. Verificar: prueba 3 del smoke (con bots simples) y partida visible en el navegador hasta resultados.
- [ ] **T07 Obstáculos de la granja y vidas:** sprites `barn`, `tractor`, `haybale`, `fence`, `pumpkin`, `silo`, `windmill2`; choques, corazones, invulnerabilidad, escudo; HUD de corazones y VIVOS. Verificar: choque visible, se pierden vidas, eliminación por vidas.
- [ ] **T08 Recogibles y cajas:** corazón, escudo, turbos y filas de cajas; IDs estables; efectos `heart`. Verificar: se recogen y desaparecen; el corazón no pasa de 3.
- [ ] **T09 Salto, rampas y techos:** acción `jump` (teclado y motor), rampas, `groundAt`, plataformas de granero con techo proyectado, puentes. Verificar: saltar cercas; con rampa subir a un techo, avanzar encima y caer al final; choque al entrar de lado.
- [ ] **T10 Agua, hielo e islas:** lagos con grietas de hielo (seguro), agua sin hielo (−1 corazón y reaparición), islas. Verificar: caer al agua quita vida y reaparece a la misma Y.
- [ ] **T11 Pasto alto con surco:** zonas `grass`, `grasstuft`, `cutGrass`. Verificar: se ve el surco detrás de cada kart y persiste.
- [ ] **T12 Obstáculos que se mueven:** tractor que cruza, ovejas y los de los otros biomas (cangrejos, géiseres, autos flotantes, meteoritos) como funciones de `raceTime`. Verificar: se mueven igual en dos instancias con la misma semilla y el mismo tiempo.
- [ ] **T13 Biomas 2 a 8:** contenido de cada bioma (sección 1.5), transición con tramado y arco, letrero en el HUD, cielo, paredes y música por bioma, perseguidor de cada bioma (sprites). Verificar: recorrer todos los biomas forzando `y` (por ejemplo, teletransportando a los karts en una prueba) y capturar cada uno.
- [ ] **T14 Bots del modo:** `botThink` de la sección 3.8 y balance con el smoke (prueba 3 y criterios de 8.2). Verificar: el smoke pasa con las 3 dificultades.
- [ ] **T15 Objetos y poderes en el modo:** `kartAhead`, rayo, destello, panal y proyectiles con `projBounds` del campo. Verificar: cada poder funciona sin errores (forzar `power = 1` y probar los 8 personajes más el Barón).
- [ ] **T16 HUD completo y pantallas:** medidor de peligro, borde rojo, distancia y tiempo, vista del eliminado siguiendo al líder, `Results` del modo con «Otra partida», fondo del lobby, efectos de sonido nuevos. Verificar: capturas de 1, 2, 3 y 4 jugadores.
- [ ] **T17 Celular:** botón SALTO (`jc`) en los dos diseños del mando y en `HostPad`, campos nuevos del HUD, `raceInitMsg` y `snapshotMsg` del modo, `GameView` con `RunnerWorld`, `MirrorSim` con perseguidor, recogidos y surcos. Verificar: un celular con «Ver el juego aquí» ve lo mismo que el TV; «Jugar en este celular» (J1 local) funciona en este modo.
- [ ] **T18 Rendimiento:** medir los fps en el TV con 4 vistas y en el celular; pintado de trozos < 3 ms; si hace falta, bajar la densidad de adornos lejanos. Verificar: ≥ 55 fps sostenidos en la prueba de 2 minutos.
- [ ] **T19 Regresión y README:** regresión 8.4 completa, sección del modo en `README.md` (reglas, controles, biomas) y limpieza de logs. Verificar: todo pasa y `npm run build` está OK.
- [ ] **T20 Entrega:** `git push -u origin modo-supervivencia-estelar` y abrir un pull request a `main`. Título: «Nuevo modo: Supervivencia Estelar». Descripción: qué es, cómo se juega, cómo se probó y los resultados del smoke (duraciones). **No lo unas a `main`**: lo revisa el usuario.

---

## Decisiones tomadas

- **T06:** Se ajustó `CHASE_V0 = 168` y `CHASE_ACC = 0.92` en `game/runner/config.js` junto con un ligero efecto de rebufo de grupo en `RunnerSim.botSpeedMul` para compensar la diferencia de velocidad base entre personajes (252 a 282 u/s) y lograr una duración mediana en Normal de `143.0s` (objetivo: 120..240s).

---

## Notas por vuelta

- **T01:** Se vinculó el repositorio con `origin/main` en `6cc281b`, se creó la rama `modo-supervivencia-estelar`, se copió `PLAN.md` y se creó `PROGRESO.md`. Verificado con `npm install` y `npm run build` sin errores.
- **T02:** Se creó `game/runner/config.js` con constantes de balance, velocidades, frecuencias y los 8 biomas. Se añadió `RUNNER_KARTS = 6` y el modo `supervivencia` («Supervivencia Estelar») a `MODES` en `game/constants.js` (oculta Pista/Historia y mantiene Rivales en TV y celular). Verificado con `node` y `npm run build`.
- **T03:** Se extrajeron `placeKarts()`, `bounds(k, dt)` y `projBounds(p)` en `Sim` (`game/sim.js`) sin alterar el comportamiento existente. Verificado con la regresión completa de la sección 8.4 (10 pistas, Batalla, Historia 1 L1 e Historia 2 L1) y `npm run build`.
- **T04:** Se creó `game/runner/layout.js` libre de DOM con `centerX`, `halfW`, `biomeAt` y `generateChunk` (con garantía de pasillo libre ≥ 90 u y salida limpia en los 3 primeros trozos), y `scripts/runner-smoke.mjs` con las pruebas 1 (determinismo) y 2 (pasillo libre en 5 semillas × trozos 3..300). Verificado con `node scripts/runner-smoke.mjs` y `npm run build`.
- **T05:** Se añadió el tema `granja` y se exportaron `makeSkyStrip`, `noiseTile` y `toU32` en `game/trackgfx.js`. Se implementó `RunnerWorld` en `game/runner/world.js` (anillo 2048², pintado directo en `Uint32Array`, dithering 4×4 entre biomas, `ensure`, `applyBiomeFor`, `visibleDecor`) y se integró en `Renderer` (`game/render.js`). Verificado con `runner-smoke` y `npm run build`.
- **T06:** Se implementó `RunnerSim` (`game/runner/sim.js`) extendiendo `Sim` con parrilla de 6 karts, progresión de velocidad `speedFactor`, perseguidor `chaserY`, `maxGapAt`, fin de partida por último sobreviviente, `rank` y `results`. Se conectó el modo `supervivencia` en `game/engine.js` (`startDemo`, `startRace`, `loop`) y se añadieron las pruebas 3 y 4 a `scripts/runner-smoke.mjs`. Verificado con `node scripts/runner-smoke.mjs` (mediana Normal 143.0s, 0 atascados) y `npm run build`.
