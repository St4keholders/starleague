# ★ Star League

Juego de carreras retro (pixel art, cámara detrás del carro estilo 16 bits) para jugar en el televisor, con el **celular como volante**.

- Hasta **4 jugadores** en pantalla dividida + bots hasta completar 8 corredores.
- **8 personajes**, cada uno con su poder.
- **5 pistas**: Pradera Molinos, Playa Coral, Cumbre Nevada, Volcán Fortaleza y Senda Estelar.
- **Modos**: Copa (las 5 pistas con puntos y podio), Carrera rápida y Batalla de globos.
- **Derrape con mini turbo**, **caja automática o manual** (cada jugador elige), objetos en cajas.
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
3. En el celular: elige personaje, caja de cambios y toca **Activar volante**.
4. El primer celular conectado (J1) elige el modo y toca **¡Empezar!** (también se puede con el mouse en el PC).

### Ver el juego en el celular

Para quien no está frente al televisor (o juega desde otro cuarto): en el lobby del mando elige **Ver el juego aquí**. Su carrera se dibuja en el propio celular, con los botones semitransparentes encima, y puede tener sonido en el celular. Durante la carrera se cambia entre vista y solo mando con el botón 🎮 / 📺.

El PC con el juego tiene que seguir abierto: es el que lleva la carrera y le manda la posición de todos al celular unas 30 veces por segundo. Gasta más batería y datos que el modo solo mando (unos 2 MB por minuto).

### Controles en el celular

Sostén el celular **horizontal, como un volante**, y gíralo para girar el carro.

| Lado izquierdo | Lado derecho |
| --- | --- |
| ▲ ▼ subir/bajar marcha (solo caja manual) | OBJETO |
| DERRAPE (mantén en la curva y suelta para el mini turbo) | PODER (se carga solo; cuando brilla está listo) |
| FRENO / reversa | ACELERAR |

- **Centrar**: si el carro gira solo, toca el volante del medio.
- **Acelerar solo**: en el lobby puedes activar que el carro acelere solo (para no mantener el botón).
- **Girar con botones**: si el celular no tiene sensor de movimiento, aparecen ◀ ▶.
- **Caja manual**: cambia cuando la barra de revoluciones esté en la **zona verde** para ganar un mini turbo. Bien usada es un poco más rápida que la automática.
- **Pausa**: botón II en el celular, o `Esc` en el PC.

### Teclado de respaldo (en el PC)

- **J con WASD**: W acelera, A/D gira, S frena, Espacio derrapa, Q objeto, E poder, R/F marchas. En el lobby: W para unirse, A/D cambia personaje, S cambia la caja.
- **J con flechas**: ↑ acelera, ←/→ gira, ↓ frena, Shift derecho derrapa, `-` objeto, `.` poder, RePág/AvPág marchas.
- `M` silencia el sonido. `Enter` empieza la partida o continúa.

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
- **Android**: al tocar *Activar volante* el mando pasa a pantalla completa y horizontal.
- Si un celular se desconecta en plena carrera, su carro sigue solo hasta que vuelva a conectarse (abriendo el mismo link).
- El juego no guarda partidas: es una sesión a la vez.

## Estructura

```
app/            páginas de Next.js (/ = pantalla del TV, /mando = celular)
components/     HostApp (lobby, resultados, podio) y ControllerApp (mando)
game/           motor: render pseudo-3D, simulación, pistas, sprites, sonido, red
```
