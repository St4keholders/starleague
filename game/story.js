// Modo historia: "Star League · El Robo de las Estrellas"
// 10 niveles, cada uno con cinemática de entrada y de salida.
//
// Tomas de cámara (cam):
//   fly   → vuela sobre la pista de la fracción f0 a f1, a altura z
//   orbit → gira alrededor de 'grid' (la largada), 'h0'/'h1' (jugadores) o 'b' (el jefe)
//   chase → sigue a un kart mientras la escena corre
// Quién habla: n = narrador, h0/h1 = personajes de los jugadores, b = jefe, x = Barón Eclipse
// {h0} {h1} {b} se reemplazan por los nombres.

const fly = (f0, f1, z = 90) => ({ kind: 'fly', f0, f1, z });
const orbit = (on, r = 40, z = 10, spd = 0.25) => ({ kind: 'orbit', on, r, z, spd });
const chase = (on) => ({ kind: 'chase', on });

export const STORY_LEVELS = [
  {
    n: 1, chapter: 'Capítulo 1 · Pradera Molinos', title: 'La gran largada', track: 0,
    type: 'top', target: 3, laps: 2, obj: 'Termina entre los 3 primeros',
    intro: [
      { cam: fly(0.55, 0.85, 140), title: 'STAR LEAGUE', sub: 'El Robo de las Estrellas', dur: 3.2, lines: [] },
      { cam: fly(0.85, 1.05, 110), lines: [
        ['n', 'Cada cien años, los mejores corredores de los cinco mundos se reúnen en la Star League.'],
        ['n', 'El campeón cuida la Estrella Madre: la luz que mantiene vivos a todos los mundos.'],
      ] },
      { cam: orbit('grid', 70, 20, 0.2), lines: [
        ['h0', '¡Por fin llegó el día! Este año la copa es nuestra.'],
        ['h1', 'Primero hay que ganarle a todos los demás…'],
      ] },
      { cam: orbit('grid', 110, 45, 0.3), fx: 'flash', tint: '#3a0a5a', song: 'villain', lines: [
        ['n', 'Pero en plena ceremonia, el cielo se oscureció…'],
        ['x', '¡Jo, jo, jo! La Estrella Madre ahora es MÍA… bueno, sus cinco pedazos.'],
        ['x', 'Escondí un fragmento en cada mundo. ¡Sin su luz, todo se apagará!'],
      ] },
      { cam: orbit('h0', 34, 6, 0.3), song: 'story', lines: [
        ['h0', '¡El Barón Eclipse! Hay que recuperar los fragmentos.'],
        ['h1', 'Empecemos aquí, en la Pradera. ¡A correr!'],
      ] },
    ],
    outro: [
      { cam: fly(0.2, 0.35, 70), lines: [
        ['h1', '¡Buena carrera! Pero miren… los molinos dejaron de girar.'],
        ['n', 'Sin su fragmento, el viento de la pradera se detuvo.'],
      ] },
      { cam: orbit('b', 34, 6, 0.3), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', 'Grrr… El fragmento es del Barón. Si lo quieren, tendrán que ganarme.'],
        ['h0', '¿{b}? ¡Tiene los ojos morados! El Barón lo hechizó.'],
      ] },
    ],
  },
  {
    n: 2, chapter: 'Capítulo 1 · Pradera Molinos', title: 'La roca hechizada', track: 0,
    type: 'boss', boss: 'rocco', laps: 2, obj: 'Llega antes que Rocco Sombrío',
    intro: [
      { cam: orbit('b', 36, 8, 0.35), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', 'Soy {b}. Mis rocas no conocen el freno.'],
        ['h0', 'Si le ganamos, a lo mejor se le pasa el hechizo.'],
        ['n', 'Objetivo: llega antes que {b}.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 34, 6, 0.3), fx: 'flash', song: 'story', lines: [
        ['b', '¿Eh? ¿Dónde estoy? Me duele mi cabeza de piedra…'],
        ['h1', '¡Volviste a ser tú! Y aquí está el primer fragmento.'],
      ] },
      { cam: fly(0.4, 0.6, 120), lines: [
        ['n', 'Los molinos vuelven a girar. Faltan cuatro fragmentos.'],
        ['x', '¡Bah! Uno no es nada. En la playa los espera una sorpresa…'],
      ] },
    ],
  },
  {
    n: 3, chapter: 'Capítulo 2 · Playa Coral', title: 'Estrellas en la arena', track: 1,
    type: 'collect', goal: 10, laps: 2, obj: 'Recojan 10 estrellas entre todos',
    intro: [
      { cam: fly(0.3, 0.55, 140), title: 'Capítulo 2', sub: 'Playa Coral', dur: 3, lines: [] },
      { cam: fly(0.55, 0.75, 80), lines: [
        ['n', 'En Playa Coral, la marea se está tragando la pista.'],
        ['h0', '¡Miren! Hay estrellitas brillando por todo el camino.'],
        ['n', 'Son chispas del fragmento. Junten 10 en 2 vueltas para encontrarlo.'],
        ['h1', '¡Entre todos las recogemos más rápido!'],
      ] },
    ],
    outro: [
      { cam: orbit('h0', 34, 6, 0.3), lines: [
        ['h0', '¡Las estrellas forman un mapa! El fragmento lo tiene… un tomate gigante.'],
      ] },
      { cam: orbit('b', 34, 6, 0.3), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', '¡Salsa para todos! Nadie toca el fragmento del Barón.'],
      ] },
    ],
  },
  {
    n: 4, chapter: 'Capítulo 2 · Playa Coral', title: 'Tomate en salsa', track: 1,
    type: 'boss', boss: 'tito', laps: 2, obj: 'Llega antes que Tito Sombrío',
    intro: [
      { cam: orbit('b', 36, 8, 0.35), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', 'Soy {b}. ¡Van a resbalar directo al mar!'],
        ['h1', 'Cuidado con sus charcos de salsa. ¡Hay que esquivarlos!'],
        ['n', 'Objetivo: llega antes que {b}.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 34, 6, 0.3), fx: 'flash', song: 'story', lines: [
        ['b', 'Uy… estaba rojo de la rabia. ¡Perdón, amigos!'],
        ['h0', '¡Segundo fragmento! La marea vuelve a su lugar.'],
      ] },
      { cam: fly(0.1, 0.3, 140), tint: '#1a0a2a', lines: [
        ['x', 'Grrr… En la montaña hace mucho frío para los perdedores.'],
      ] },
    ],
  },
  {
    n: 5, chapter: 'Capítulo 3 · Cumbre Nevada', title: '¡Atrapa a la ladrona!', track: 2,
    type: 'chase', boss: 'gelida', hits: 3, laps: 2, obj: 'Alcancen 3 veces a Gélida Sombría',
    intro: [
      { cam: fly(0.2, 0.4, 150), title: 'Capítulo 3', sub: 'Cumbre Nevada', dur: 3, lines: [] },
      { cam: fly(0.4, 0.55, 90), lines: [
        ['n', 'Una tormenta eterna cubre la Cumbre Nevada.'],
      ] },
      { cam: orbit('b', 36, 8, 0.4), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', '¿Buscan esto? ¡Atrápenme si pueden!'],
        ['h0', '¡Se lleva el fragmento! Hay que alcanzarla.'],
        ['n', 'Objetivo: alcancen a {b} 3 veces, chocándola o con objetos, antes de 2 vueltas.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 34, 6, 0.3), lines: [
        ['b', '¡Está bien, está bien! Pero no se los doy sin una carrera de verdad.'],
        ['h1', '¡Trato hecho! Una carrera y el fragmento es nuestro.'],
      ] },
    ],
  },
  {
    n: 6, chapter: 'Capítulo 3 · Cumbre Nevada', title: 'Reina del hielo', track: 2,
    type: 'boss', boss: 'gelida', laps: 2, obj: 'Llega antes que Gélida Sombría',
    intro: [
      { cam: orbit('b', 36, 8, 0.35), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', 'En el hielo mando yo. ¡Sus ruedas van a patinar!'],
        ['n', 'Objetivo: llega antes que {b}. Cuidado con las placas de hielo.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 34, 6, 0.3), fx: 'flash', song: 'story', lines: [
        ['b', 'Brrr… qué frío tan raro tenía en el corazón. ¡Gracias!'],
        ['h0', '¡Tercer fragmento! La tormenta se está calmando.'],
      ] },
      { cam: fly(0.6, 0.8, 140), tint: '#1a0a2a', lines: [
        ['x', '¡Basta de juegos! En el volcán los voy a derretir.'],
      ] },
    ],
  },
  {
    n: 7, chapter: 'Capítulo 4 · Volcán Fortaleza', title: 'Antes de la erupción', track: 3,
    type: 'time', time: 0, laps: 2, obj: 'Terminen 2 vueltas antes de que acabe el tiempo',
    intro: [
      { cam: fly(0.1, 0.3, 160), title: 'Capítulo 4', sub: 'Volcán Fortaleza', dur: 3, lines: [] },
      { cam: fly(0.3, 0.45, 90), fx: 'shake', lines: [
        ['n', 'El Volcán Fortaleza está a punto de estallar.'],
        ['h1', '¡El fragmento está en la cima! Hay que llegar antes de la erupción.'],
        ['n', 'Objetivo: terminen 2 vueltas antes de que se acabe el tiempo.'],
      ] },
    ],
    outro: [
      { cam: orbit('h0', 34, 6, 0.3), lines: [
        ['h0', '¡Llegamos a tiempo! Pero alguien nos está esperando…'],
      ] },
      { cam: orbit('b', 34, 6, 0.3), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', 'Este panal y este fragmento son míos. ¡Grrrr!'],
      ] },
    ],
  },
  {
    n: 8, chapter: 'Capítulo 4 · Volcán Fortaleza', title: 'El oso de lava', track: 3,
    type: 'boss', boss: 'bruno', laps: 2, obj: 'Llega antes que Bruno Sombrío',
    intro: [
      { cam: orbit('b', 36, 8, 0.35), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', 'Soy {b}. Mis panales siempre encuentran a su presa.'],
        ['h1', 'Si un panal te persigue, ¡usa el escudo burbuja!'],
        ['n', 'Objetivo: llega antes que {b}.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 34, 6, 0.3), fx: 'flash', song: 'story', lines: [
        ['b', '¿Panal? ¿Cuál panal? ¡Ay, perdón por todo!'],
        ['h0', '¡Cuarto fragmento! Solo falta uno.'],
      ] },
      { cam: fly(0.7, 0.9, 150), tint: '#1a0a2a', lines: [
        ['x', 'El último está en la Senda Estelar… y lo cuida mi corredora más rápida.'],
      ] },
    ],
  },
  {
    n: 9, chapter: 'Capítulo 5 · Senda Estelar', title: 'Sin barandas', track: 4,
    type: 'boss', boss: 'chispa', laps: 2, obj: 'Llega antes que Chispa Sombría',
    intro: [
      { cam: fly(0.05, 0.25, 160), title: 'Capítulo 5', sub: 'Senda Estelar', dur: 3, lines: [] },
      { cam: fly(0.25, 0.4, 80), lines: [
        ['n', 'La Senda Estelar se está apagando, estrella por estrella.'],
      ] },
      { cam: orbit('b', 36, 8, 0.4), tint: '#2a0a3a', song: 'villain', lines: [
        ['b', '¡Tres turbos y ninguna baranda! A ver si me alcanzan.'],
        ['h0', 'Aquí no hay paredes. ¡Un error y caemos al espacio!'],
        ['n', 'Objetivo: llega antes que {b}.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 34, 6, 0.3), fx: 'flash', song: 'story', lines: [
        ['b', '¡Wow, qué rápido van! Ya me siento yo misma otra vez.'],
        ['h1', '¡Tenemos los cinco fragmentos! La Estrella Madre puede volver a brillar…'],
      ] },
      { cam: orbit('grid', 110, 45, 0.4), fx: 'shake', tint: '#3a0a5a', song: 'villain', lines: [
        ['x', '¡NO TAN RÁPIDO! Si los quieren, vengan a mi Fortaleza Eclipse.'],
      ] },
    ],
  },
  {
    n: 10, chapter: 'Capítulo final · Fortaleza Eclipse', title: 'El último eclipse', track: 5,
    type: 'boss', boss: 'baron', laps: 3, obj: 'Llega antes que el Barón Eclipse',
    intro: [
      { cam: fly(0.0, 0.25, 170), title: 'Capítulo final', sub: 'Fortaleza Eclipse', dur: 3.2, song: 'villain', lines: [] },
      { cam: fly(0.25, 0.4, 90), lines: [
        ['n', 'En el corazón de la oscuridad se alza la Fortaleza Eclipse.'],
      ] },
      { cam: orbit('b', 40, 10, 0.3), tint: '#2a0a3a', lines: [
        ['x', '¡Bienvenidos! Nadie le ha ganado nunca al Barón Eclipse en su propia pista.'],
        ['h0', 'Siempre hay una primera vez.'],
        ['h1', '¡Por la Estrella Madre y por los cinco mundos!'],
        ['n', 'Objetivo final: llega antes que el Barón Eclipse. ¡3 vueltas!'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 40, 10, 0.4), fx: 'flash', lines: [
        ['x', '¡Imposible! Mi eclipse… se está acabando…'],
      ] },
      { cam: fly(0.0, 0.3, 200), fx: 'flash', song: 'story', lines: [
        ['n', 'Los cinco fragmentos se unieron y la Estrella Madre volvió a brillar.'],
        ['x', 'Está bien… ustedes ganan. ¿Me dejan correr en la próxima Star League?'],
        ['h0', '¡Claro! Pero esta vez sin robarse nada.'],
        ['n', 'Y así, la luz volvió a los cinco mundos. ¡Gracias por jugar Star League!'],
      ] },
    ],
  },
];

// tiempo límite del contrarreloj según la dificultad (segundos para 2 vueltas)
export const TIME_LIMITS = [118, 102, 90];
