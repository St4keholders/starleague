# PLAN · Nuevo modo de juego «Supervivencia Estelar» para Star League

> **Para el agente (Antigravity CLI):** este documento es la especificación completa de un **modo de juego nuevo** para el repositorio `St4keholders/starleague`. Vas a trabajar **en modo loop**: en cada vuelta tomas la siguiente tarea pendiente, la implementas, la verificas y la marcas. Lee primero las secciones 0, 1 y 2 completas. No inventes reglas que no estén aquí: si algo no está definido, elige la opción más simple que respete el espíritu del modo y anótala en `PROGRESO.md` en la sección «Decisiones tomadas».

---

## 0. Arranque del loop (léelo una sola vez)

### 0.1 Prompt de arranque sugerido

```
Lee docs/supervivencia/PLAN.md completo. Trabaja en modo loop siguiendo la sección 0.3.
El objetivo es agregar el modo de juego nuevo «Supervivencia Estelar» sin romper los modos existentes.
```

### 0.2 Preparación (solo la primera vuelta)

1. Copia este archivo a `docs/supervivencia/PLAN.md` dentro del repo.
2. Verifica que estás en la versión correcta: `git log --oneline -1` debe mostrar `6cc281b Merge pull request #4 …` (o un commit posterior de `main`). Si no, `git pull origin main`.
3. Crea la rama: `git checkout -b modo-supervivencia-estelar`.
4. Instala y compila la línea base: `npm install` y luego `npm run build`. Debe compilar sin errores **antes** de tocar nada. Si falla, detente y repórtalo.
5. Crea `docs/supervivencia/PROGRESO.md` copiando la lista de tareas de la sección 9 (todas sin marcar), más una sección vacía «Decisiones tomadas» y otra «Notas por vuelta».
6. Haz commit: `docs: plan y progreso del modo Supervivencia Estelar`.

### 0.3 Protocolo de cada vuelta del loop

1. Abre `docs/supervivencia/PROGRESO.md` y toma **la primera tarea sin marcar** (`- [ ]`).
2. Relee la sección del plan que corresponde a esa tarea.
3. Implementa **solo** esa tarea, con cambios pequeños y enfocados.
4. Ejecuta **todas** las verificaciones de esa tarea (sección 9) más `npm run build`.
5. Si algo falla: arréglalo en la misma vuelta. No pases a la siguiente tarea con algo roto.
6. Marca la tarea `- [x]`. En «Notas por vuelta» escribe 1 a 3 líneas: qué hiciste, cómo lo verificaste y si quedó algo pendiente.
7. Commit en español con el número de tarea, por ejemplo `T07: obstáculos de la granja y choques con vidas`.
8. Vuelve al paso 1.

**Condición de parada:** todas las tareas están marcadas, la regresión de la tarea final pasa y el pull request está abierto. Si dos vueltas seguidas fallan en lo mismo, detente y escribe el bloqueo en `PROGRESO.md`.

### 0.4 Reglas generales (aplican siempre)

- **No rompas nada existente:** Copa, Carrera rápida (10 pistas), Batalla de globos, Historia 1 y 2, cinemáticas, los mandos del celular, «Ver el juego aquí» y «Jugar en este celular» deben seguir funcionando igual.
- **Estilo visual:** pixel art generado por código, igual que el resto del juego (ver `game/sprites.js` y `game/trackgfx.js`). **No agregues imágenes, fuentes ni audios externos.** Todo se dibuja con canvas y Uint32Array.
- **Textos en español** (Colombia, tono amigable), igual que el resto.
- **Rendimiento:** 60 cuadros por segundo en PC y celular. Pintar un trozo nuevo del piso debe costar menos de 3 ms. No más de ~250 sprites por vista.
- **Lógica sin DOM:** todo lo que es simulación o generación del mundo (posiciones, obstáculos, reglas) va en módulos **sin DOM**, para poder probarlo con Node (sección 8). Igual que hoy `game/sim.js` no toca el DOM.
- **Determinismo:** el mundo se genera con una semilla (`mulberry32` en `game/geometry.js`). El PC y los celulares deben generar exactamente el mismo campo con la misma semilla.
- **Inspiración, no copia:** el modo se inspira en juegos de «deslizarse esquivando por un mundo infinito», pero el diseño es propio. No uses nombres, personajes ni arte de otros juegos.

---

## 1. Qué es el modo (diseño de juego)

**Nombre en el lobby:** `Supervivencia Estelar`.
**Descripción corta:** «Esquiva obstáculos en un camino sin fin. Gana el último en pie.»

### 1.1 Idea

Los corredores van en **sus mismos karts** y **aceleran solos**, como en el resto del juego. Avanzan por un **campo abierto infinito hacia adelante**: una franja ancha, con curvas suaves, bordeada por paredes de roca o del tema. **No hay meta.** Hay que esquivar obstáculos, saltar y usar rampas.

Por detrás viene un **perseguidor** que cambia según el mundo (avalancha, ola, lava, etc.). La velocidad sube con el tiempo. **Gana el último que quede en pie.** Una partida normal dura **entre 2 y 4 minutos**.

Referencia visual que describió el usuario:
- Granja de otoño con pasto o trigo naranja alto que se abre en un surco cuando pasa el corredor.
- Graneros rojos, tractores, pacas de heno, calabazas, ovejas en corrales, molinos y cercas de madera.
- Rampas amarillas con flechas.
- Lagos de agua con grietas de hielo e islitas.
- Techos a los que se sube saltando desde una rampa.
- Paredes de roca a los lados.

Todo esto en **nuestro pixel art** y con nuestra cámara pseudo-3D detrás del kart.

### 1.2 Reglas

| Regla | Valor |
|---|---|
| Jugadores | 1 a 4 humanos + **bots hasta completar 6 corredores** |
| Vidas | **3 corazones** por corredor |
| Pierde 1 corazón | Chocar de frente contra un obstáculo sólido. Caer al agua sin hielo, a la lava o a un hueco |
| Eliminado | Llegar a 0 corazones, **o** que el perseguidor lo alcance (eliminación inmediata, aunque tenga corazones) |
| Fin de la partida | Cuando queda 1 corredor vivo (gana ese). Si todos los humanos quedan eliminados, la partida termina 2 s después y se muestran los resultados |
| Posiciones | El último vivo es 1º. Los demás quedan en el orden inverso de eliminación. Empate: el que llegó más lejos |
| Puntaje mostrado | Distancia en metros (unidades del mundo / 10) y tiempo sobrevivido |

### 1.3 Acciones del jugador

- **Girar** (◀ ▶ o inclinar el celular) y **frenar**: igual que en las carreras.
- **Saltar** (acción **nueva**): solo si está en el piso. Pasa por encima de obstáculos bajos (cercas, pacas, calabazas, ovejas, cangrejos y huecos angostos). Tiene 0,6 s de recarga.
- **Derrape y mini turbo:** igual que hoy.
- **Objetos y poderes:** cajas de objetos y poderes de siempre. **Los objetos y poderes no quitan corazones**: solo hacen girar o frenan, lo que puede dejarte al alcance del perseguidor.
- **Rampas:** lanzan muy alto. Sirven para pasar por encima de graneros y tractores y para **subir a techos**.

### 1.4 Cosas para recoger

| Recogible | Efecto | Frecuencia |
|---|---|---|
| Corazón | +1 vida (máximo 3) | Raro: ~1 cada 2.500 unidades de avance, en sitios algo arriesgados |
| Escudo burbuja | Aguanta 1 choque o caída sin perder vida (o dura 8 s) | ~1 cada 1.800 unidades |
| Turbos en el piso | Flechas que aceleran (lógica de la zona `boost` existente) | Varios por tramo |
| Cajas de objetos | Igual que en las carreras (filas de 4) | 1 fila cada ~1.200 unidades |

### 1.5 Mundos que van cambiando (biomas)

Cada **~9.000 unidades de avance** (unos 35 a 45 s) cambia el mundo, siempre en este orden:

| # | Bioma | Tema base en el código | Perseguidor | Obstáculos y terreno principales |
|---|---|---|---|---|
| 1 | **Granja de Otoño** *(NUEVO, como las fotos)* | nuevo tema `granja` | **Estampida** (vacas y ovejas) | Graneros (con techo para subir), tractores (quietos y que cruzan), pacas, calabazas, cercas, ovejas que cruzan, pasto/trigo alto que deja surco, lagos con hielo e islas, molinos de adorno |
| 2 | Playa Coral | `playa` | **Ola gigante** | Palmeras, rocas, sombrillas, cangrejos (existen), canales de agua sin hielo (saltar o usar puente), rampas |
| 3 | Cumbre Nevada | `nieve` | **Avalancha** | Pinos, muñecos de nieve (existen), placas de hielo resbaloso (zona `ice`), lago congelado (seguro), cercas |
| 4 | Volcán Fortaleza | `volcan` | **Río de lava** | Rocas de lava, torres, árboles secos, géiseres de fuego (hazard `fire`), ríos de lava con puentes |
| 5 | Jungla Gloop | `jungla` | **Ola de baba** | Plantas alienígenas, hongos, charcos de baba que frenan (zona `goo`), esporas |
| 6 | Ciudad Neón | `neon` | **Tormenta de glitch** | Torres, letreros neón, postes, autos flotantes que cruzan (sprite nuevo sencillo), turbos |
| 7 | Anillos de Saturnia / Senda Estelar | `anillos` y `estelar` | **Agujero negro** | Rocas de anillo, asteroides, satélites, **huecos al vacío** con puentes |
| 8 | Coliseo de Zorg | `coliseo` | **Nave de Zorg** | Graderías, estatua de Zorg, meteoritos (hazard `fire` con `skin: 'meteor'`) |

Después del 8 se repite desde el 1, más rápido. Rara vez se llega tan lejos.

**Transición entre biomas:** una banda de ~400 unidades donde el piso se mezcla con un tramado de píxeles (dithering). Además, un **arco de bienvenida** (sprite nuevo) con el nombre del mundo y un letrero grande en el HUD («¡CUMBRE NEVADA!») durante 2 s. Al cambiar de bioma también cambian el cielo, la niebla, las paredes laterales y la **música**: se usa la canción del tema (`THEMES[tema].music`; la Granja usa la canción de Pradera, la `0`).

### 1.6 Velocidad, perseguidor y duración

Todo se ajusta en **un solo archivo** de constantes, `game/runner/config.js`, para poder balancear:

- `SPEED_START = 0.85` y `SPEED_END = 1.35`: multiplicador de la velocidad máxima de los karts. Sube de forma lineal entre los 0 y los 180 s y después queda fijo.
- **Perseguidor:** posición `chaserY`.
  - Avanza a `vChaser(t) = CHASE_V0 + CHASE_ACC * t`. Valores iniciales sugeridos: `CHASE_V0 = 190` y `CHASE_ACC = 1.0` (unidades/s).
  - Nunca se queda a más de `MAXGAP(t)` del líder: `chaserY = max(chaserY, leaderY - MAXGAP(t))`, con `MAXGAP` bajando de `1100` a `350` entre los 0 y los 180 s.
  - Si `kart.y < chaserY + 10`, el kart queda **eliminado**.
- **Meta de balance** (verificable con la prueba de la sección 8): con 6 bots en dificultad Normal, la **mediana de duración** debe estar **entre 120 y 240 s**, y ninguna partida debe pasar de 360 s.
- **Dificultad** (Fácil, Normal, Difícil, del lobby): cambia `CHASE_V0` (−15 %, 0, +10 %), la densidad de obstáculos (0,75, 1, 1,2) y la habilidad de los bots.

---

## 2. Mapa del código actual (lo que tienes que conocer)

Proyecto **Next.js 16** (App Router). Todo el juego vive en `game/`. Las pantallas están en `components/`.

| Archivo | Qué hace | Qué te importa para este modo |
|---|---|---|
| `game/constants.js` | Personajes (`CHARACTERS`, `VILLAIN`, `ZORG`), `MODES`, `DIFFICULTIES`, `TRACK_NAMES`, `VIEW_W/H = 480×270`, `MAP_SIZE = 2048` | Agregar el modo a `MODES` |
| `game/geometry.js` | `mulberry32(seed)`, `wrapAngle`, línea central de las pistas | Usar `mulberry32` para el mundo infinito |
| `game/tracks.js` | Definición de las 10 pistas y la arena. `TRACK_SCALE = 1.5`: 1 píxel de textura = 1,5 unidades de mundo | Referencia de cómo se definen zonas, cajas, peligros y decoración |
| `game/trackgfx.js` | `THEMES` (paletas, cielo y música de cada tema), `buildTrack(i)`: pinta la textura 2048×2048 del piso (Uint32Array), el `outer` (mosaico 64×64 de afuera), la tira de cielo panorámica (`makeSkyStrip`, **no exportada**) y la lista `decor` | Reusar paletas y cielos. **Exportar** `makeSkyStrip` y `noiseTile` |
| `game/sprites.js` | Sprites procedurales: karts voxel (24 ángulos), retratos, `makeDecor()` (árboles, molinos, palmeras, pinos, muñecos, rocas de lava, torres, hongos, torres neón, graderías, etc.), `makeFx()` (cajas, aceite, salsa, chicle, nieve, panal, cangrejo, fuego, meteorito, rayo, escudo, hielo, estrella) y helpers `mkCanvas`, `rect`, `ell`, `disc`, `outline` | Agregar los sprites nuevos **con el mismo estilo** |
| `game/render.js` | `Renderer`: piso «modo 7» (`drawFloor`), cielo (`drawSky`), `proj(c,x,y,z)`, `drawSprites` (ordena por distancia), `billboard`, `flat`, `shadow`, `drawKart`, `drawHUD`, `drawCountdown`, pantalla dividida (`layoutFor`) | Agregar soporte de **piso circular** (anillo), **bioma por cámara**, decoración dinámica y HUD del modo |
| `game/sim.js` | `class Sim`: física de karts (`updateKart`), derrape, objetos (`useItem`), poderes (`usePower`), golpes (`hit`), cajas, peligros, proyectiles, charcos, choques entre karts, bots (`botThink`, `botThinkArena`), `rank`, `checkEnd`, `results`, modo historia | **Extender** con una subclase `RunnerSim` (ver 3.4) |
| `game/engine.js` | `class GameHost`: lobby, fases (`lobby`, `race`, `results`, `podium`, `cinematic`, `storyresult`, `storyend`), jugadores (`phone`, `kbA`, `kbB`, `local`, `cpu`), red PeerJS, `startRace()`, `loop()`, `applyInputs()`, `sendHud()`, envío de fotos a los celulares | Crear el `RunnerSim` cuando el modo sea `supervivencia`; música por bioma; nueva acción `jump` |
| `game/mirror.js` | `MirrorSim` (copia de la carrera en el celular), `raceInitMsg`, `snapshotMsg` | Mandar semilla, perseguidor, vidas y recogidos |
| `game/audio.js` | Música chiptune y efectos sintetizados (`sfx(name)`, `playSong(i)`) | Efectos nuevos: `jump`, `crash`, `heart`, `danger`, `biome` |
| `components/HostApp.jsx` | Pantalla del TV/PC: lobby, resultados, podio, cinemáticas, `HostPad` (controles cuando J1 juega en el mismo celular) | Botón del modo, tabla de resultados del modo, botón SALTO en `HostPad` |
| `components/ControllerApp.jsx` | Mando del celular: lobby, `RacePad` (solo mando o vista de juego), `GameView` (dibuja la carrera en el celular con `MirrorSim`) | Botón SALTO, datos nuevos del HUD, `GameView` con el mundo infinito |
| `components/TouchControls.jsx` | `PadBtn`, `useTilt`, `goFullscreen` | Reusar `PadBtn` para SALTO |

**Datos útiles:**
- La contraseña de la pantalla principal es `juan2026*`.
- `window.__starLeague` expone el `GameHost` en el navegador, para pruebas.
- Para meter jugadores automáticos de prueba: `h.players = [{slot:0, kind:'cpu', char:'pipo', connected:true}, null, null, null]`. Los de tipo `cpu` manejan con piloto automático.
- **Coordenadas:** en las carreras la cámara usa el ángulo `k.camA`, y el vector hacia adelante es `(cos a, sin a)`.
- **Textura del piso:** `drawFloor` hoy muestrea la textura con `u = x/escala`, `v = y/escala` y usa `outer` si `u` o `v` salen de `[0, 2048)`.

---

## 3. Arquitectura técnica del modo

### 3.1 Archivos nuevos

```
game/runner/config.js     ← constantes de balance (sección 1.6) y tablas de biomas
game/runner/layout.js     ← SIN DOM: forma del campo, generación de trozos (obstáculos, recogibles, zonas, agua, plataformas) por semilla
game/runner/sim.js        ← SIN DOM: class RunnerSim extends Sim
game/runner/world.js      ← CON DOM/Uint32: textura circular del piso, pintado de trozos, cielo/outer por bioma, decoración visible
scripts/runner-smoke.mjs  ← prueba sin navegador (sección 8)
```

### 3.2 Sistema de coordenadas del campo infinito

- **Adelante es +Y.** Un kart que va derecho tiene `a = Math.PI / 2`.
- **X es lateral.** El mundo mide `WORLD_W = 2048 * 1.5 = 3072` unidades de ancho (`TEX_SCALE = 1.5`, igual que `TRACK_SCALE`).
- **Centro del campo:** `centerX(y) = 1536 + A1·sin(y/2300 + φ1) + A2·sin(y/970 + φ2)`, con `A1 ≈ 380`, `A2 ≈ 120` y las fases sacadas de la semilla. Así salen curvas suaves.
- **Medio ancho jugable:** `halfW(y)` entre 300 y 420, variando suave con otra senoide. Más allá de `halfW` está la **pared** del bioma (roca en la granja; ver `outside` del tema): rebote como `trackBounds` con `outside: 'wall'`.
- `layout.js` exporta funciones puras: `centerX(seed, y)`, `halfW(seed, y)`, `biomeAt(y)` → `{ index, theme, t01 }` (t01 = posición dentro de la banda de transición) y `generateChunk(seed, chunkIndex, difficulty)`.

### 3.3 Trozos (chunks) y textura circular del piso

- Un **trozo** son **128 filas de textura = 192 unidades** de avance. `chunkIndex = floor(y / 192)`.
- `generateChunk` devuelve datos (sin DOM), siempre los mismos para la misma semilla y el mismo índice. Usa `mulberry32(seed * 7919 + chunkIndex)`:
  ```js
  {
    index, y0, y1, biome,
    obstacles: [{ id, kind, x, y, r | w,h(rect), height, solid, jumpable, moving?: {type, ...params} }],
    pickups:   [{ id, kind: 'heart'|'shield'|'box', x, y }],
    zones:     [{ kind: 'boost'|'ramp'|'ice'|'goo'|'grass'|'water'|'lava'|'hole'|'bridge', poly or rect }],
    platforms: [{ id, x0, x1, y0, y1, h }]   // techos (granero) — altura h
  }
  ```
  - Los IDs son estables, por ejemplo `${chunkIndex}:${n}`, para sincronizar con los celulares.
  - Los primeros 3 trozos (zona de salida) **no tienen obstáculos**.
  - Asegura siempre al menos un **pasillo libre** de ~90 unidades de ancho a través de cada trozo, comprobándolo en la generación.
- **Textura circular** (`world.js`): una textura de 2048×2048 en Uint32Array que se usa como anillo en el eje Y. La fila de textura para un `y` del mundo es `((y / 1.5) | 0) & 2047`. Cubre 3.072 unidades de avance.
  - **Ventana viva:** desde `chaserY - 300` hasta `leaderY + 1700`. Esto cabe en 3.072 gracias a `MAXGAP ≤ 1100`.
  - Cada cuadro, `world.ensure(minY, maxY)` pinta los trozos de la ventana que falten. Como máximo 2 trozos por cuadro, para no trabarse.
  - Pinta directo en el Uint32Array: piso base con ruido del tema, zonas, sombras planas, tramado de transición. Reusa las paletas de `THEMES`.
- **Cambio en `Renderer.drawFloor`:** si `this.t.ring` es verdadero, `v = (wy | 0) & 2047`, y solo se verifica `u` en `[0, 2048)`; afuera se usa `outer`. **Sin cambios** para las pistas normales: agrega una rama `if` antes de los bucles, no toques los bucles existentes.
- **Bioma por cámara:** antes de dibujar cada vista, `if (this.t.runner) this.t.applyBiomeFor(this, cam.target.y)`. Esa función cambia `sky`, `skyTop`, `skyHor`, `fog` y `outer` del tema de ese `y`, recalcula `fogCol` y limpia `gradCache` si cambió. Así cada jugador ve su propio mundo en pantalla dividida.
- **Decoración dinámica:** en `drawSprites`, si `t.runner`, en vez de `t.decor` usa `t.visibleDecor(c)`. Devuelve los obstáculos y adornos de los trozos vivos entre `cam.y - 50` y `cam.y + 1400`, ya con su sprite. Los obstáculos que se mueven toman su posición de la simulación.

### 3.4 `RunnerSim extends Sim` (reutilizar al máximo)

**Primero (tarea T03),** haz una **refactorización segura** de `Sim` que **no cambia el comportamiento**: extrae en métodos que la subclase pueda reemplazar:

| Hoy en `Sim` | Método nuevo (mismo comportamiento por defecto) |
|---|---|
| `if (this.arena) this.placeArena(); else this.placeGrid();` | `placeKarts()` |
| En `updateKart`: `if (this.arena) this.arenaBounds(k); else this.trackBounds(k, dt);` | `bounds(k, dt)` |
| Lógica de paredes en `updateProjectiles` | `projBounds(p)` → devuelve `true` si el proyectil muere |
| `botThink` (elige `botThinkArena` en la arena) | igual, la subclase lo reemplaza |
| `rank()`, `checkEnd(dt)`, `results()` | la subclase los reemplaza |

Verifica después del refactor que Copa, Carrera rápida, Batalla e Historia siguen idénticas (prueba de regresión de la sección 8).

**`RunnerSim`:**
- `this.runner = true`, `this.mode = 'runner'`, `this.world` (layout o mundo), `this.chaserY`, `this.leaderY`, `this.biome`.
- Cada kart tiene además `hearts = 3`, `crashT`, `jumpCd`, `distance`, `survived`, `elimReason` (`'perseguidor' | 'vidas'`) y `onPlatform`.
- **Salida:** 6 karts en 2 filas de 3 cerca de `y = 300`, mirando a +Y.
- **Aceleración:** igual que hoy (los humanos aceleran solos). `maxV` se multiplica por `speedFactor(raceTime)`.
- **`bounds(k)`:**
  - Paredes laterales con `centerX` y `halfW`.
  - Superficie bajo el kart según las zonas del trozo: `ice`, `goo`, `grass` (0,92 de velocidad), `water` o `lava` o `hole` (si `z < 2` y no hay puente → **caída**: −1 corazón), `boost`, `ramp`.
  - Plataformas (ver 3.5).
- **Choque con obstáculo sólido** (círculo o rectángulo): si `k.z < obst.height` y no está invulnerable:
  - Rebote hacia atrás (velocidad × −0,3), giro de 0,8 s.
  - `hearts -= 1`, salvo que tenga escudo (el escudo se gasta).
  - Invulnerable 2 s (parpadeo, ya existe con `invulnT`). Sonido `crash` y vibración en el celular.
  - Los obstáculos `jumpable` se pasan si `k.z > obst.height`.
- **Caída al agua, lava o hueco:**
  - Animación corta reusando `startFall`.
  - −1 corazón.
  - Reaparece a la **misma Y**, en la X segura más cercana, con `z = 30` e invulnerable 2 s.
  - **No** reaparece hacia atrás: eso lo dejaría en manos del perseguidor.
- **Recogibles:** al tocar → efecto. Guarda los IDs recogidos en `this.taken` (Set) y emite el evento para el celular.
- **Perseguidor:** según 1.6. Cuando alguien queda eliminado: `eliminated = true`, `elimAt = raceTime`, se agrega a `elimOrder`, mensaje «¡TE ATRAPÓ LA AVALANCHA!» (con el nombre del perseguidor del bioma) o «¡SIN VIDAS!».
- **Fin:** `checkEnd` según 1.2. `results()` devuelve filas con `place`, `char`, `human`, `slot`, `distance` (m), `time` (sobrevivido), `hearts` y `reason`.
- **Objetos y poderes:**
  - Reusa `useItem` y `usePower`.
  - `kartAhead(k)` = el kart vivo con la menor `y` mayor que la tuya.
  - El rayo va al **líder** (mayor `y`); el destello afecta a los que van adelante (mayor `y`).
  - Los proyectiles rebotan en las paredes del campo (`projBounds`).
- **Eventos nuevos** para el motor: `{type:'biome', theme, name}`, `{type:'eliminated', kart, reason}` y `{type:'pickup', id}`.

### 3.5 Salto, rampas y plataformas (techos)

- **Acción `jump`:** si `k.z <= groundAt(k) + 0.5` y `jumpCd <= 0`: `vz = 240`, `jumpCd = 0.6`. Sonido `jump`. Reusa la gravedad que ya existe (`GRAV`).
- **Rampa:** `vz = 320 + v * 0.25` y un turbo corto. Debe alcanzar para pasar graneros (`height 60`) y tractores (`height 45`).
- **`groundAt(x, y)`:** devuelve `h` si el punto está dentro de una plataforma y el kart viene de arriba (`k.z >= h - 6`); si no, devuelve 0.
  - Si el kart está sobre una plataforma, su suelo es `h`: no baja de `h` mientras siga encima.
  - Al salir del borde, cae.
  - Si entra a la plataforma de lado con `z < h - 8`, es un **choque**: el granero es sólido.
- **Dibujo de la plataforma:** el granero se dibuja con su sprite (`barn`) de frente. El techo se dibuja como un **cuadrilátero proyectado** a altura `h`: 4 esquinas con `proj(c, x, y, h)`, relleno con color del techo más líneas de tejas. Se ordena con los demás sprites por la distancia de su borde más cercano.
- **Puentes:** franjas seguras pintadas en la textura sobre agua, lava o huecos. Son zonas `bridge`, a nivel del piso.

### 3.6 Pasto alto que deja surco (granja y jungla)

- Las zonas `grass` se pintan en la textura con un patrón de hojas en pixel art: claros y oscuros del tema, más alto contraste. Encima, adornos `grasstuft` (sprite nuevo pequeño) repartidos dentro de la zona, ~1 cada 40×40 unidades.
- **Surco:** cada cuadro, por cada kart en el piso dentro de una zona `grass`, `world.cutGrass(x, y, r = 9)` pinta un círculo color tierra en la textura circular. Así el surco queda marcado. Los `grasstuft` a menos de 12 unidades de un kart se marcan `cut` y ya no se dibujan.
- **En el celular:** `MirrorSim` hace el mismo `cutGrass` con las posiciones que recibe. Es aproximado y está bien así.
- El pasto **no** es obstáculo: solo frena a 0,92.

### 3.7 Obstáculos que se mueven

Las posiciones son **funciones del tiempo de carrera** (`raceTime`) y de los parámetros del obstáculo. Así el PC y el celular calculan lo mismo sin mandar posiciones.

| Tipo | Movimiento |
|---|---|
| Tractor que cruza | Va y viene en X entre los bordes del campo, a 70 u/s, con fase según su ID |
| Ovejas | Grupo de 3 a 5 que cruza más lento. Son saltables |
| Cangrejos (playa) | Ya existen como hazard `crab`: reusa la fórmula |
| Géiser y meteoritos | Ya existen como hazard `fire` (con `skin: 'meteor'`): reusa la fórmula con período y fase |
| Auto flotante (neón) | Cruza rápido en X a cierta altura (`height 25`): saltable |

### 3.8 Bots (`botThink` del modo)

- Cada 0,15 s (en Difícil, 0,1 s; en Fácil, 0,25 s) prueban **7 candidatos de X** a lo ancho del campo, a una distancia de 160 a 260 unidades adelante.
- **Puntaje** de cada candidato:
  - Despeje mínimo a obstáculos sólidos en la línea, muestreando cada 20 u.
  - −1000 si cruza agua, lava o hueco sin puente.
  - −200 si cruza baba.
  - +120 si toma un turbo; +150 si toma un corazón cuando tiene menos de 3; +60 si toma una caja.
  - Un poco de preferencia por quedarse cerca de su X actual (histéresis).
- **Saltar** si hay un obstáculo `jumpable` a menos de 55 u justo adelante y no puede esquivarlo, o si hay un hueco o canal angosto.
- **Errores** según la dificultad: probabilidad de elegir mal (Fácil 12 %, Normal 6 %, Difícil 2 %) y retraso de reacción.
- Objetos y poderes con la misma lógica de `botThink` actual. Usa `kartAhead` del modo.

---

## 4. Pantallas, HUD y sonido

### 4.1 Lobby (`HostApp` y `ControllerApp`)

- `MODES` → agregar `{ id: 'supervivencia', name: 'Supervivencia Estelar', desc: 'Esquiva obstáculos en un camino sin fin; gana el último en pie' }`. Debe aparecer en el TV y en el panel de J1 del celular.
- En este modo **no** se muestran «Pista» ni «Historia». Sí se muestra **Rivales** (dificultad).
- **Fondo del lobby** (`startDemo`): cuando el modo es `supervivencia`, muestra un `RunnerSim` con 6 bots y `demo: true`, sin perseguidor que termine la partida (`demo` = `checkEnd` no hace nada y el perseguidor no elimina).

### 4.2 HUD en la carrera (`Renderer.drawHUD` cuando `sim.mode === 'runner'`)

Reemplaza los datos de vuelta, posición y minimapa por:
- **Arriba a la izquierda:** 3 **corazones** en pixel art (llenos o vacíos). Debajo, `VIVOS 4/6`.
- **Arriba a la derecha:** distancia `1.234 m` y tiempo sobrevivido.
- **Abajo, al centro:** **medidor de peligro**. Una barra con el ícono del perseguidor que muestra a qué distancia está (verde → amarillo → rojo). Si está a menos de 150 u: borde rojo parpadeante en la vista y sonido `danger` cada 1 s.
- **Al entrar a un bioma:** letrero grande con el nombre, 2 s.
- Se mantienen el cuadro de objeto, la barra de poder y el velocímetro.
- **Jugador eliminado** en pantalla dividida: su vista pasa a **seguir al líder vivo**, con el letrero `ELIMINADO · mirando a <nombre>` y su distancia final.

### 4.3 Perseguidor (dibujo)

Una **banda** a lo ancho del campo, en `chaserY`. Se arma con billboards repetidos del sprite del perseguidor del bioma, cada ~40 u, más uno grande al centro, con partículas (polvo, nieve, salpicaduras o brasas). Sprites nuevos en la sección 6.

### 4.4 Resultados (`HostApp` → `Results`)

Si `st.mode === 'runner'`: tabla con puesto, retrato, nombre (más J1 o J2…), «Sobrevivió 2:31 · 1.234 m» y el motivo («Lo atrapó la avalancha» o «Sin vidas»). Botones: **Otra partida** (la reinicia con otra semilla) y **Volver al lobby**. Sin puntos de copa.

### 4.5 Sonido (`game/audio.js` → `sfx`)

Agrega `jump`, `crash` (golpe grave + ruido), `heart` (arpegio subiendo), `danger` (dos tonos de alarma), `biome` (fanfarria corta) y `eliminated`. Música: al recibir el evento `biome`, `audio.playSong(THEMES[tema].music)`.

---

## 5. Celular y red

- **Acción SALTO:**
  - **Teclado:** jugador WASD = `W`; jugador flechas = `↑`. En el lobby esas teclas siguen siendo «unirse»; en la carrera son salto.
  - **Celular:** contador `jc` en el mensaje `in`, igual que `ic` y `pc`.
  - **`engine.applyInputs`:** pasa `jump` como evento de un solo toque, igual que `item` y `power`.
- **Botones del celular (`RacePad`)** en este modo:
  - **Vista de juego:** columna izquierda con **SALTO (grande)**, DERRAPE, OBJETO, PODER y FRENO; a la derecha, ◀ ▶ (o DERRAPE grande si usa el sensor). Es la misma regla que hoy, más SALTO arriba.
  - **Solo mando:** izquierda SALTO (grande) y FRENO; centro ◀ ▶ o volante; derecha OBJETO, PODER y DERRAPE.
  - **J1 jugando en el mismo celular** (`HostPad` en `HostApp.jsx`): agrega SALTO igual que en la vista de juego.
- **`sendHud`:** agrega `hearts`, `alive`, `total`, `dist`, `danger` (distancia al perseguidor) y `biome`. En solo mando, la barra de arriba muestra corazones y VIVOS en vez de posición y vuelta.
- **`raceInitMsg`:** si `sim.runner`, agrega `runner: { seed, difficulty }`.
- **`snapshotMsg`:** agrega `ch` (`chaserY`), los corazones de cada kart (otro campo en el arreglo de karts) y `tk` (IDs recogidos desde la última foto).
- **`GameView` en el celular:**
  - Si `init.runner`, crea `RunnerWorld(seed, difficulty)` en vez de `buildTrack`.
  - Cada cuadro llama `world.ensure(...)` alrededor de su kart.
  - `MirrorSim` lee `ch`, `tk` y los corazones, calcula los obstáculos móviles con `rt` y aplica `cutGrass`.
- **«Ver el juego aquí» y «Jugar sin televisor»** deben funcionar en este modo exactamente igual que en las carreras.

---

## 6. Sprites nuevos (pixel art procedural, en `game/sprites.js`)

Sigue el estilo de `makeDecor()` y `makeFx()`: canvas pequeños de 16 a 70 px, colores planos con 2 o 3 tonos, borde oscuro con `outline()` y `add(nombre, canvas, anchoEnMundo, float)`.

| Nombre | Descripción | Ancho en mundo |
|---|---|---|
| `barn` | Granero rojo de frente: puerta blanca con X y techo gris oscuro | 120 |
| `tractor` | Tractor amarillo con cabina negra y ruedas grandes (de frente y de lado, 2 sprites) | 70 |
| `haybale` | Paca de heno redonda dorada con líneas | 34 |
| `fence` | Tramo de cerca de madera: 3 postes y 2 tablas | 80 |
| `pumpkin` | Calabaza naranja; 1 de cada 4 con cara iluminada | 20 |
| `sheep` | Oveja blanca esponjosa (2 cuadros de caminar) | 26 |
| `windmill2` | Molino de granja de metal con rueda roja y blanca (adorno, no sólido) | 60 |
| `silo` | Silo gris o rojo con techo de cúpula | 70 |
| `grasstuft` | Mechón de trigo o pasto naranja (granja) o verde lima (jungla) | 14 |
| `icecrack` | Plano: grietas blancas sobre azul (se pinta en la textura) | — |
| `gate` | Arco de bienvenida de madera o del tema, con letrero | 160 |
| `hovercar` | Auto flotante neón (Ciudad Neón) | 50 |
| `heart` | Corazón rojo brillante flotando (recogible) | 18 |
| `shieldpick` | Burbuja azul con brillo (recogible) | 20 |
| Perseguidores | `stampede` (vacas y ovejas en polvo), `wave` (ola azul con espuma), `avalanche` (bola de nieve con trozos), `lavaflow` (lava naranja con burbujas), `blackhole` (espiral morada), `goowave` (baba verde), `glitchstorm` (nube con píxeles magenta y cian), `zorgship` (nave verde con cúpula y luces) | 120–200 |

**Tema nuevo `granja`** en `THEMES` (`trackgfx.js`):
- **Cielo:** azul claro a durazno.
- **Piso:** naranja trigo (`#e8862a` con ruido `#d4761f`, `#f29a3c`, `#c96a1a`); caminos de tierra `#8a5a2a`.
- **Agua:** `#2a7ad8` con grietas `#cfe9ff`.
- **Paredes:** roca gris `#8a8a90`.
- **Tira del horizonte:** acantilados grises, graneros rojos lejanos y molinos.
- **Música:** la canción `0` (Pradera).

---

## 7. Cambios exactos por archivo existente (resumen)

| Archivo | Cambio |
|---|---|
| `game/constants.js` | `MODES` + `RUNNER_KARTS = 6` |
| `game/sim.js` | Refactor con métodos reemplazables (`placeKarts`, `bounds`, `projBounds`), **sin cambiar el comportamiento** |
| `game/trackgfx.js` | Tema `granja`; exportar `makeSkyStrip` y `noiseTile` |
| `game/sprites.js` | Sprites de la sección 6 |
| `game/render.js` | Rama `ring` en `drawFloor`; `applyBiomeFor` por cámara; `visibleDecor`; plataformas proyectadas; dibujo del perseguidor; HUD del modo; vista del eliminado |
| `game/engine.js` | Crear `RunnerSim` y `RunnerWorld` en `startRace` y `startDemo` cuando `cfg.mode === 'supervivencia'`; acción `jump` (teclado, celular, local); eventos `biome` y `eliminated` → música y efectos; `sendHud` con campos nuevos; `endRace` usa `results()` del modo |
| `game/mirror.js` | Campos `runner`, `ch`, `tk` y corazones; soporte en `MirrorSim` |
| `game/audio.js` | Efectos nuevos |
| `components/HostApp.jsx` | Opciones del lobby para el modo, `Results` del modo, botón SALTO en `HostPad` |
| `components/ControllerApp.jsx` | Botón SALTO, HUD del modo, `GameView` con `RunnerWorld` |
| `app/globals.css` | Estilos del botón SALTO (`.pad-btn.jump`, amarillo) y de la tabla de resultados |
| `README.md` | Sección «Supervivencia Estelar» con reglas y controles |

---

## 8. Cómo verificar (pruebas que el loop debe correr)

### 8.1 Compilar
`npm run build`: sin errores, en cada vuelta.

### 8.2 Prueba sin navegador: `scripts/runner-smoke.mjs`

Importa **solo** módulos sin DOM (`game/runner/layout.js` y `game/runner/sim.js`). Si algo de esos archivos toca `document` o `canvas`, la prueba debe fallar: así se garantiza la separación.

```bash
node scripts/runner-smoke.mjs
```

Debe:
1. **Determinismo:** `generateChunk(123, k)` llamado dos veces devuelve exactamente lo mismo (compara con `JSON.stringify`), para `k = 0..200`.
2. **Pasillo libre:** en cada trozo `k = 3..300` de 5 semillas existe un pasillo libre de ≥ 90 u (barrido de X cada 10 u).
3. **Partidas automáticas:** `RunnerSim` con 6 bots, para 10 semillas × 3 dificultades, simulando a `dt = 1/60` hasta que termine o hasta 400 s. Debe imprimir duración, ganador y motivos de eliminación.
4. **Aceptación:**
   - Ninguna excepción.
   - Todas las partidas terminan.
   - Mediana de duración en Normal entre 120 y 240 s.
   - Ninguna dura más de 360 s.
   - Ningún bot queda «atascado»: su `y` avanza al menos 100 u en cada ventana de 3 s mientras está vivo.

Sale con código `1` si algo falla.

### 8.3 Prueba en el navegador

1. `npm run dev`, abre `http://localhost:3000` y entra con la contraseña `juan2026*`.
2. En la consola:
   ```js
   const h = window.__starLeague;
   h.players = [{slot:0,kind:'cpu',char:'pipo',connected:true},{slot:1,kind:'cpu',char:'lumi',connected:true},null,null];
   h.setCfg({mode:'supervivencia', diff:1}); h.startGame();
   ```
3. Revisa:
   - Se ve el campo de la Granja con obstáculos.
   - La pantalla dividida funciona.
   - Cambia el bioma, el cielo y la música.
   - Aparece el perseguidor.
   - Los corazones bajan al chocar.
   - La partida termina con resultados.
4. Con teclado: pulsa `W` en el lobby para unirte, `Enter` para empezar y prueba A/D, `W` (salto), Espacio, Q y E.
5. Si tienes Playwright disponible, automatiza capturas en 390×844, 844×390 y 1280×720.

**Celulares (opcional, local):** el mando necesita un servidor PeerJS. Puedes correr uno local y abrir el juego con `?peerhost=127.0.0.1&peerport=9000` (`game/peeropts.js` ya lo soporta).

### 8.4 Regresión (obligatoria al final y después del refactor T03)

Con jugadores `cpu`, simula hasta el final:
- Carrera rápida en las 10 pistas (índices 0 a 9).
- Una Batalla de globos.
- Historia 1 nivel 1 e Historia 2 nivel 1.

Todas deben terminar en la fase `results` o `storyresult` sin excepciones. Revisa a ojo una carrera normal, para confirmar que se ve igual que antes.

---

## 9. Lista de tareas del loop (cópiala a `PROGRESO.md`)

- [ ] **T01 Preparación:** rama, plan copiado, `PROGRESO.md`, compilación base OK (sección 0.2).
- [ ] **T02 Config y modo en el lobby:** `game/runner/config.js` con todas las constantes y la tabla de biomas. Modo `supervivencia` en `MODES` (todavía arranca una carrera normal como relleno). Verificar: aparece en el lobby del TV y del celular; `npm run build`.
- [ ] **T03 Refactor seguro de `Sim`:** métodos `placeKarts`, `bounds` y `projBounds` (sección 3.4). Verificar: regresión 8.4 completa, idéntica.
- [ ] **T04 Layout sin DOM:** `layout.js` (`centerX`, `halfW`, `biomeAt`, `generateChunk` con pasillo libre, por ahora solo obstáculos estáticos de la granja) y `scripts/runner-smoke.mjs` con las pruebas 1 y 2. Verificar: el script pasa.
- [ ] **T05 Mundo y textura circular:** `world.js` (anillo 2048², `ensure`, pintado de trozos, tema `granja`, cielo y paredes) y cambios en `Renderer` (rama `ring`, `applyBiomeFor`, `visibleDecor`). Verificar: en el navegador se ve el campo infinito avanzando con un kart `cpu`, sin cortes, a 60 fps.
- [ ] **T06 `RunnerSim` básico:** salida, aceleración con `speedFactor`, paredes laterales, perseguidor, eliminación por perseguidor, fin de partida, `results`, `rank`. Engine: `startRace` y `startDemo` del modo. Verificar: prueba 3 del smoke (con bots simples) y partida visible en el navegador hasta resultados.
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

## 10. Decisiones ya tomadas por el usuario (no cambiarlas)

1. Van en **sus mismos karts** (no trineos).
2. Camino de **campo abierto infinito hacia adelante**, con curvas suaves y obstáculos regados (no carriles fijos ni circuitos en bucle).
3. Eliminación por **3 vidas** **y** por el **perseguidor** que viene detrás.
4. Los **mundos cambian** durante la misma partida.
5. Acciones: **girar y frenar**, **saltar con botón**, **rampas** que lanzan y **objetos y poderes**.
6. El perseguidor **cambia con el mundo**.
7. Recogibles: **corazones**, **turbos en el piso** y **escudo** (más las cajas de objetos, porque hay objetos).
8. **1 a 4 jugadores + bots** hasta completar 6.
9. Terreno: **pasto alto que deja surco**, **agua con islas**, **techos y puentes** y **obstáculos que se mueven**.
10. Nombre: **Supervivencia Estelar**. Duración objetivo: **2 a 4 minutos**.
11. Estilo **pixel art** como el resto del juego. **Es un modo nuevo**: los modos existentes no cambian.
