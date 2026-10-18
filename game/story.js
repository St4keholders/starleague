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

// ======================================================================
// HISTORIA 2 · El Torneo Galáctico (7 niveles)
// Quién habla: n = narrador, h0/h1 = jugadores, x = Barón Eclipse (aliado),
// z = Zorg el Invicto, b = jefe del nivel (clon)
// ======================================================================
export const STORY2_LEVELS = [
  {
    n: 1, chapter: 'Etapa 1 · Senda Estelar', title: 'La invitación', track: 4,
    type: 'top', target: 3, laps: 2, obj: 'Termina entre los 3 primeros',
    intro: [
      { cam: fly(0.05, 0.3, 160), title: 'STAR LEAGUE 2', sub: 'El Torneo Galáctico', dur: 3.4, lines: [] },
      { cam: fly(0.3, 0.45, 90), lines: [
        ['n', 'La Estrella Madre volvió a brillar… y su luz se vio hasta el otro lado de la galaxia.'],
        ['n', 'Una mañana llegó una invitación dorada a los cinco mundos.'],
      ] },
      { cam: orbit('grid', 110, 45, 0.3), fx: 'flash', tint: '#0a3a1a', song: 'zorg', lines: [
        ['z', '¡Saludos, terrícolas! Soy Zorg el Invicto, emperador de la Nebulosa Verde.'],
        ['z', 'Los invito a mi Torneo Galáctico. El premio: el legendario Trofeo Cometa.'],
        ['z', 'Nadie me ha ganado jamás… pero pueden intentarlo. ¡Jo, jo!'],
      ] },
      { cam: orbit('h0', 34, 6, 0.3), song: 'story', lines: [
        ['h0', '¡Un torneo en el espacio! Tenemos que ir.'],
        ['h1', 'Primera etapa: la Senda Estelar. ¡A calentar motores!'],
      ] },
    ],
    outro: [
      { cam: orbit('h1', 34, 6, 0.3), lines: [
        ['h1', '¡Pasamos la primera etapa!'],
      ] },
      { cam: fly(0.5, 0.7, 140), tint: '#1a0a2a', song: 'villain', lines: [
        ['x', 'Psst… soy yo, el Barón. Tengan cuidado: el torneo de Zorg está arreglado.'],
        ['x', 'Los voy a vigilar desde las sombras. Sigan corriendo.'],
      ] },
    ],
  },
  {
    n: 2, chapter: 'Etapa 2 · Anillos de Saturnia', title: 'Eliminación en los anillos', track: 6,
    type: 'elim', laps: 3, rivalSkin: 'alien', obj: 'Eliminación: que no te saquen y llega a la meta',
    intro: [
      { cam: fly(0.1, 0.35, 170), title: 'Etapa 2', sub: 'Anillos de Saturnia', dur: 3, lines: [] },
      { cam: fly(0.35, 0.5, 90), song: 'zorg', lines: [
        ['z', 'Bienvenidos a mis anillos. Aquí las reglas son simples:'],
        ['z', 'cada vez que el primero complete una vuelta, ¡los dos últimos quedan eliminados!'],
      ] },
      { cam: orbit('h0', 34, 6, 0.3), song: 'story', lines: [
        ['h0', 'Oigan… ¿por qué los otros corredores son verdes?'],
        ['h1', 'Se parecen a nuestros amigos… pero con ojos raros. Qué miedo.'],
        ['n', 'Objetivo: no quedes de último cuando el líder complete una vuelta y llega a la meta.'],
      ] },
    ],
    outro: [
      { cam: orbit('h0', 34, 6, 0.3), lines: [
        ['h0', '¡Sobrevivimos a la eliminación!'],
      ] },
      { cam: fly(0.6, 0.8, 140), tint: '#1a0a2a', song: 'villain', lines: [
        ['x', 'Esos corredores verdes son CLONES. Zorg tiene una máquina que copia a los campeones.'],
        ['x', 'La máquina funciona con cristales Gloop. Si se los quitamos, no podrá hacer más.'],
      ] },
    ],
  },
  {
    n: 3, chapter: 'Etapa 3 · Jungla Gloop', title: 'Cristales en la baba', track: 7,
    type: 'collect', goal: 12, laps: 2, rivalSkin: 'alien', obj: 'Recojan 12 cristales entre todos',
    intro: [
      { cam: fly(0.05, 0.3, 160), title: 'Etapa 3', sub: 'Jungla Gloop', dur: 3, lines: [] },
      { cam: fly(0.3, 0.45, 80), lines: [
        ['n', 'En la Jungla Gloop crecen los cristales que alimentan la máquina de clones.'],
        ['h1', '¡Cuidado con los charcos verdes! Esa baba frena muchísimo.'],
        ['n', 'Objetivo: recojan 12 cristales entre todos en 2 vueltas.'],
      ] },
    ],
    outro: [
      { cam: orbit('h0', 34, 6, 0.3), lines: [
        ['h0', '¡Tenemos los cristales! Sin ellos, la máquina se queda sin energía.'],
      ] },
      { cam: fly(0.6, 0.8, 140), tint: '#0a3a1a', song: 'zorg', lines: [
        ['z', '¡¿MIS CRISTALES?! Esto no se queda así, terrícolas.'],
        ['z', 'Y ya sé quién los está ayudando… ¡Clones, atrapen al Barón!'],
      ] },
    ],
  },
  {
    n: 4, chapter: 'Etapa 4 · Ciudad Neón', title: 'Cuiden al Barón', track: 8,
    type: 'protect', ally: 'baron', maxAhead: 1, laps: 2, rivalSkin: 'alien',
    obj: 'Protejan al Barón: máximo 1 clon puede llegar antes que él',
    intro: [
      { cam: fly(0.05, 0.3, 170), title: 'Etapa 4', sub: 'Ciudad Neón', dur: 3, lines: [] },
      { cam: orbit('a', 40, 8, 0.3), lines: [
        ['x', '¡Ya no me escondo! Me inscribí en el torneo para correr con ustedes.'],
        ['x', 'Pero todos los clones de Zorg vienen detrás de mí…'],
        ['h0', '¡Tranquilo, Barón! Nosotros te cuidamos.'],
        ['n', 'Objetivo: que el Barón llegue a la meta con máximo 1 clon adelante. Usen sus objetos contra los clones que lo pasen.'],
      ] },
    ],
    outro: [
      { cam: orbit('a', 40, 8, 0.3), lines: [
        ['x', '¡Gracias, equipo! Y descubrí algo: Zorg mandó a un espía con los planos de la máquina.'],
        ['h1', '¿Hacia dónde fue?'],
        ['x', '¡Al Volcán Fortaleza! Si lo alcanzan, recuperamos los planos.'],
      ] },
    ],
  },
  {
    n: 5, chapter: 'Etapa 5 · Volcán Fortaleza', title: 'El clon espía', track: 3,
    type: 'chase', boss: 'chispa', bossSkin: 'alien', hits: 3, laps: 2, rivalSkin: 'alien',
    obj: 'Alcancen 3 veces al Clon de Chispa',
    intro: [
      { cam: fly(0.1, 0.3, 160), title: 'Etapa 5', sub: 'Volcán Fortaleza', dur: 3, lines: [] },
      { cam: orbit('b', 36, 8, 0.4), tint: '#0a3a1a', song: 'zorg', lines: [
        ['b', '¡Ji, ji! Los planos son de Zorg. ¡No me van a alcanzar!'],
        ['h0', 'Es un clon de Chispa… ¡y es igual de rápida!'],
        ['n', 'Objetivo: alcancen 3 veces al {b}, chocándolo o con objetos, antes de 2 vueltas.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 34, 6, 0.3), fx: 'flash', song: 'story', lines: [
        ['b', '¡Está bien, me rindo! Tomen los planos…'],
        ['n', 'El clon se desvaneció en una nube de chispas verdes.'],
      ] },
      { cam: fly(0.4, 0.6, 150), tint: '#0a3a1a', song: 'zorg', lines: [
        ['z', '¿Creen que eso me detiene? Mi mejor clon los espera en la Fortaleza Eclipse.'],
        ['x', '¡¿En MI fortaleza?! Esto ya es personal.'],
      ] },
    ],
  },
  {
    n: 6, chapter: 'Etapa 6 · Fortaleza Eclipse', title: 'Tu propio clon', track: 5,
    type: 'boss', boss: 'h0', bossSkin: 'alien', laps: 2, rivalSkin: 'alien',
    obj: 'Llega antes que tu clon',
    intro: [
      { cam: fly(0.0, 0.2, 170), title: 'Etapa 6', sub: 'Fortaleza Eclipse', dur: 3, lines: [] },
      { cam: orbit('b', 40, 10, 0.35), tint: '#0a3a1a', song: 'zorg', lines: [
        ['z', 'Les presento mi obra maestra: ¡el {b}! Tiene tu misma velocidad y tus mismos trucos.'],
        ['h0', '¡¿Ese soy yo?! Pero verde…'],
        ['b', 'Yo soy el original ahora. ¡A ver quién llega primero!'],
        ['n', 'Objetivo: llega antes que el {b}.'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 36, 8, 0.4), fx: 'flash', song: 'story', lines: [
        ['b', 'Imposible… nadie le gana a una copia perfecta…'],
        ['n', 'Sin cristales y sin su mejor clon, la máquina de Zorg se apagó para siempre.'],
        ['x', 'Solo queda él. Lo encontrarán en su Coliseo.'],
      ] },
    ],
  },
  {
    n: 7, chapter: 'Etapa final · Coliseo de Zorg', title: 'Zorg el Invicto', track: 9,
    type: 'boss', boss: 'zorg', bossSkin: null, ally: 'baron', laps: 3, rivalSkin: 'alien',
    obj: 'Llega antes que Zorg el Invicto',
    intro: [
      { cam: fly(0.0, 0.25, 180), title: 'Etapa final', sub: 'Coliseo de Zorg', dur: 3.2, song: 'zorg', lines: [] },
      { cam: fly(0.25, 0.4, 90), lines: [
        ['n', 'El Coliseo de Zorg flota sobre un asteroide. Las tribunas rugen.'],
        ['n', 'Cuidado: aquí caen meteoritos sobre la pista.'],
      ] },
      { cam: orbit('b', 40, 10, 0.3), tint: '#0a3a1a', lines: [
        ['z', 'En mil años, nadie le ha ganado a Zorg el Invicto en su propio coliseo.'],
        ['h1', 'Nosotros vencimos al Barón Eclipse. ¡Tú no eres diferente!'],
        ['x', '¡Vamos, equipo! Esta vez corro a su lado.'],
        ['n', 'Objetivo final: llega antes que Zorg. ¡3 vueltas!'],
      ] },
    ],
    outro: [
      { cam: orbit('b', 40, 10, 0.4), fx: 'flash', lines: [
        ['z', '¿Perdí…? ¿YO? Bueno… fue una carrera limpia. Se ganaron el Trofeo Cometa.'],
        ['z', 'Prometo correr sin trampas en el próximo torneo.'],
      ] },
      { cam: fly(0.0, 0.3, 200), fx: 'flash', song: 'story', lines: [
        ['x', 'Amigos… gracias por confiar en mí. Ahora sí soy parte del equipo.'],
        ['h0', '¡Bienvenido a la Star League, Barón!'],
        ['n', '¡El Barón Eclipse ya se puede elegir como corredor! Gracias por jugar.'],
      ] },
    ],
  },
];

export const STORIES = [
  {
    id: 1, title: 'El Robo de las Estrellas', levels: STORY_LEVELS,
    end: { title: '¡La Estrella Madre volvió a brillar!', text: 'Recuperaron los cinco fragmentos y derrotaron al Barón Eclipse.' },
  },
  {
    id: 2, title: 'El Torneo Galáctico', levels: STORY2_LEVELS,
    end: { title: '¡Campeones del Torneo Galáctico!', text: 'Vencieron a Zorg el Invicto y ganaron el Trofeo Cometa. ¡El Barón Eclipse ya es jugable!', unlock: 'baron' },
  },
];

export function storyById(id) {
  return STORIES.find((s) => s.id === id) || STORIES[0];
}
