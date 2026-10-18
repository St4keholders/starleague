# ★ Star League

Juego de carreras retro (pixel art, cámara detrás del carro estilo 16 bits) para jugar en el televisor, con el **celular como volante**.

- Hasta **4 jugadores** en pantalla dividida + bots hasta completar 8 corredores.
- **8 personajes**, cada uno con su poder.
- **6 pistas**: Pradera Molinos, Playa Coral, Cumbre Nevada, Volcán Fortaleza, Senda Estelar y Fortaleza Eclipse.
- **Modos**: Historia (10 niveles con cinemáticas), Copa (5 pistas con puntos y podio), Carrera rápida y Batalla de globos.
- **Manejo automático**: el carro acelera solo; tú giras, derrapas, usas objetos y frenas.
- **Derrape con mini turbo** y objetos en cajas.
- Todo el arte y la música se generan con código: no descarga imágenes ni audio, consume muy pocos datos.

## Subirlo a Vercel

1. Crea un repositorio nuevo en GitHub (puede ser privado).
2. Sube **todo el contenido de esta carpeta** al repositorio (sin `node_modules` ni `.next`, que ya están excluidos).
3. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repositorio.
4. Vercel detecta Next.js solo. No hay que configurar nada: dale **Deploy**.
5. Abre el link que te da Vercel (por ejemplo `https://star-league.vercel.app`) en el PC conectado al televisor.

Para probarlo en tu computador antes de subirlo:

```bash
npm install
npm run dev
```

y abre `http://localhost:3000`. (El celular no puede entrar a `localhost`; para el celular usa el link de Vercel.)

## Contraseña

La pantalla principal pide contraseña: **`juan2026*`**. El navegador la recuerda después de entrar la primera vez.

Los celulares no la piden: entran directo con el QR.

Para cambiarla, calcula el SHA-256 de la nueva contraseña (por ejemplo en una terminal: `echo -n 'nueva' | shasum -a 256`) y reemplaza `PASSWORD_HASH` en `game/constants.js`.

## Cómo se juega

1. Abre el link en el PC/TV y pon la contraseña.
2. Cada jugador escanea el **QR** con la cámara del celular (o abre `tu-link.vercel.app/mando` y escribe el código de 5 letras).
3. En el celular: elige personaje y cómo girar (**Flechas ◀ ▶** por defecto, o **Inclinar el celular**).
4. El primer celular conectado (J1) elige el modo y toca **¡Empezar!** (también se puede con el mouse en el PC).

### Jugar sin televisor (solo celulares)

Para jugar en la calle o donde no haya pantalla:

1. Uno abre el link en su celular, pone la contraseña y toca **🎮 Jugar en este celular**. Ese celular es J1: elige personaje y cómo girar ahí mismo.
2. Los demás escanean el QR de ese celular o abren el link que se comparte con **📤 Compartir link**.
3. Como no hay pantalla principal, **cada celular muestra su propia carrera** automáticamente (también las cinemáticas de la historia). Quien no quiera verla elige **Solo mando**.
4. J1 elige el modo y toca **¡Empezar!**

El celular de J1 lleva la partida: si cierra la página o cambia de app, el juego se pausa para todos. Se juega en horizontal.

### Ver el juego en el celular

Para quien no está frente al televisor (o juega desde otro cuarto): en el lobby del mando elige **Ver el juego aquí**. Su carrera se dibuja en el propio celular, con los botones semitransparentes encima, y puede tener sonido en el celular. Durante la carrera se cambia entre vista y solo mando con el botón 🎮 / 📺.

El PC con el juego tiene que seguir abierto: es el que lleva la carrera y le manda la posición de todos al celular unas 30 veces por segundo. Gasta más batería y datos que el modo solo mando (unos 2 MB por minuto).

### Controles en el celular

El carro **acelera solo** y la caja es automática.

**Solo mando** (mirando el TV):

| Izquierda | Centro | Derecha |
| --- | --- | --- |
| DERRAPE (grande) | ◀ ▶ para girar | OBJETO |
| FRENO / reversa | posición, vuelta, objeto y poder | PODER (brilla cuando está listo) |

**Ver el juego en el celular**: el juego ocupa toda la pantalla y los botones van encima:
- **Izquierda:** DERRAPE, OBJETO, PODER y FRENO.
- **Derecha:** ◀ ▶ grandes. Si usas el sensor, las flechas desaparecen y ese lado queda para un DERRAPE grande.

**Derrape con mini turbo:** mantén DERRAPE mientras giras con las flechas. El carro da un saltito, desliza y las chispas cargan solas: primero **azules** y, a los 1,5 s, **naranjas**. Al soltar sales disparado; el turbo es más largo con las naranjas.

- **Inclinar el celular** (opcional): sostenlo horizontal como un volante. *Centrar* lo corrige si gira solo; *Invertir* y la sensibilidad están en el lobby.
- **Pausa**: botón II en el celular, o `Esc` en el PC.

### Teclado de respaldo (en el PC)

- **J con WASD** (W para unirse): A/D gira, S frena, Espacio derrapa, Q objeto, E poder. En el lobby, A/D cambia personaje.
- **J con flechas** (↑ para unirse): ←/→ gira, ↓ frena, Shift derecho derrapa, `-` objeto, `.` poder.
- `M` silencia el sonido. `Enter` empieza la partida o continúa.

## Modo historia: El Robo de las Estrellas

El Barón Eclipse rompió la Estrella Madre en cinco fragmentos y los escondió en los cinco mundos. Hay 10 niveles, y antes y después de cada uno hay una cinemática. En las cinemáticas hablan los personajes que eligieron los jugadores.

| Nivel | Pista | Objetivo |
| --- | --- | --- |
| 1 | Pradera Molinos | Terminar entre los 3 primeros |
| 2 | Pradera Molinos | Jefe: llegar antes que Rocco Sombrío |
| 3 | Playa Coral | Recoger 10 estrellas entre todos en 2 vueltas |
| 4 | Playa Coral | Jefe: Tito Sombrío |
| 5 | Cumbre Nevada | Persecución: alcanzar 3 veces a Gélida Sombría |
| 6 | Cumbre Nevada | Jefe: Gélida Sombría |
| 7 | Volcán Fortaleza | Contrarreloj: 2 vueltas antes de que acabe el tiempo |
| 8 | Volcán Fortaleza | Jefe: Bruno Sombrío |
| 9 | Senda Estelar | Jefe: Chispa Sombría |
| 10 | Fortaleza Eclipse | Final: llegar antes que el Barón Eclipse (3 vueltas) |

- **Equipo:** juegan de 1 a 4. Basta con que uno cumpla el objetivo.
- **Si fallan:** pueden **reintentar** o **saltar el nivel**.
- **Sin guardado:** la historia no se guarda (unos 25 a 35 minutos de una sentada), pero en el lobby se puede **empezar en cualquier nivel**.
- **Cinemáticas:** avanzan con Enter, clic o *Siguiente* en el celular. *Saltar* (Esc en el PC) solo lo tiene J1 en el celular.
- **Dificultad:** la de *Rivales* en el lobby cambia la velocidad de los jefes y el tiempo del contrarreloj.

## Personajes

| Personaje | Poder |
| --- | --- |
| Pipo el Pollito | Aletazo: salto que esquiva todo lo del piso |
| Rocco el Gólem | Temblor: hace derrapar a los que están cerca |
| Lumi la Luciérnaga | Destello: ciega 2 segundos a los que van adelante |
| Bruno el Oso | Panal: persigue al de adelante y lo frena |
| Nimbo la Nube | Rayo: cae sobre el que va primero |
| Chispa la Ardilla | Triple turbo |
| Tito el Tomate | Charco de salsa detrás |
| Gélida la Pingüina | Bola de nieve que rebota y congela |

Objetos de las cajas: turbo de chile, mancha de aceite, bola de chicle, escudo burbuja e imán (roba el objeto del de adelante).

## Notas

- La conexión celular ↔ PC usa el servidor público gratuito de PeerJS solo para "presentarlos"; después los datos van directo. Funciona mejor si todos están en el **mismo Wi-Fi**.
- **iPhone**: la primera vez pide permiso para el sensor de movimiento (toca *Permitir*). Si la pantalla no gira a horizontal, desactiva el bloqueo de rotación.
- **Android**: al elegir cómo girar, el mando pasa a pantalla completa y horizontal.
- Si un celular se desconecta en plena carrera, su carro sigue solo hasta que vuelva a conectarse (abriendo el mismo link).
- El juego no guarda partidas: es una sesión a la vez.
- **Crear la sala desde un celular**: también funciona. El lobby se acomoda a la pantalla y trae el botón **Compartir link** para mandarlo por WhatsApp.

## Estructura

```
app/            páginas de Next.js (/ = pantalla del TV, /mando = celular)
components/     HostApp (lobby, cinemáticas, resultados, podio) y ControllerApp (mando)
game/           motor: render pseudo-3D, simulación, pistas, sprites, sonido, red
game/story.js   niveles, objetivos y guiones de las cinemáticas del modo historia
game/cinema.js  cámara y diálogos de las cinemáticas
```
