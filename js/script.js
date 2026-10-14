'use strict';

/* ==========================================================
   CONFIGURACIÓN: cambia aquí los valores por defecto
   (también se pueden cambiar jugando, con el botón "Configurar")
   ========================================================== */
const CONFIG_POR_DEFECTO = {
  tiempo: 20, // segundos para encontrar todos los pares
  pares: 6,   // cantidad de pares en el tablero
  vista: 3,   // segundos de vista previa de las cartas (0 = sin vista previa)
  bono: 2,    // segundos que suma cada par encontrado (0 = sin bono)
};

const CARTAS = [
  { id: 'lucky',     alt: 'Grupo Lucky',               img: 'img/lucky.png' },
  { id: 'sonrisa',   alt: 'Carita sonriente',          img: 'img/sonrisa.png' },
  { id: 'equipo',    alt: 'Trabajo en equipo',         img: 'img/equipo.png' },
  { id: 'logros',    alt: 'Grandes logros',            img: 'img/logros.png' },
  { id: 'positivo',  alt: 'Siempre positivo',          img: 'img/positivo.png' },
  { id: 'fuertes',   alt: 'Juntos somos más fuertes',  img: 'img/fuertes.png' },
  { id: 'cohete',    alt: 'Suena, cree, logra',        img: 'img/cohete.png' },
  { id: 'ideas',     alt: 'Buenas ideas',              img: 'img/ideas.png' },
  { id: 'tu-puedes', alt: 'Tú puedes',                 img: 'img/tu-puedes.png' },
  { id: 'gracias',   alt: 'Gracias por tu esfuerzo',   img: 'img/gracias.png' },
  { id: 'vamos',     alt: 'Vamos por más',             img: 'img/vamos.png' },
];

const LOGO_BLANCO = 'img/logo-blanco.png';

const LIMITES = {
  tiempoMin: 5,
  tiempoMax: 600,
  paresMin: 2,
  paresMax: CARTAS.length,
  vistaMax: 10,
  bonoMax: 10,
};

const RETARDO_ERROR_MS = 800;
const CLAVE_GUARDADO = 'memoria-lucky-config';

const RATIO = 38 / 42; // ancho / alto de cada carta

const FRASES = {
  lucky: 'Grupo Lucky',
  sonrisa: '¡Sonríe!',
  equipo: 'Trabajo en equipo',
  logros: 'Grandes logros',
  positivo: 'Siempre positiv@',
  fuertes: 'Juntos somos más fuertes',
  cohete: 'Suena, cree, logra',
  ideas: 'Buenas ideas',
  'tu-puedes': '¡Tú puedes!',
  gracias: 'Gracias por tu esfuerzo',
  vamos: 'Vamos por más',
};

/* ==========================================================
   REFERENCIAS AL DOM
   ========================================================== */
const $ = (id) => document.getElementById(id);

const tablero     = $('tablero');
const paresEl     = $('pares');
const intentosEl  = $('intentos');
const mensajeEl   = $('mensaje');
const relojEl     = $('reloj');
const progresoEl  = $('progreso');
const segundosEl  = $('segundos');
const dlgConfig   = $('dlg-config');
const formConfig  = $('form-config');
const inTiempo    = $('in-tiempo');
const inPares     = $('in-pares');
const dlgFin      = $('dlg-fin');
const finTitulo   = $('fin-titulo');
const finTexto    = $('fin-texto');
const confetiEl   = $('confeti');
const zona        = $('zona');
const bordeEl     = $('alerta-borde');
const cuentaEl    = $('cuenta-final');
const avisoEl     = $('aviso');
const bonoEl      = $('bono');
const inVista     = $('in-vista');
const inBono      = $('in-bono');
const btnSonido   = $('btn-sonido');

const ALT = Object.fromEntries(CARTAS.map((c) => [c.id, c.alt]));

/* ==========================================================
   ESTADO
   ========================================================== */
const estado = {
  config: cargarConfig(),
  seleccion: [],
  bloqueado: false,
  iniciado: false,
  terminado: false,
  totalPares: 0,
  paresHallados: 0,
  intentos: 0,
  racha: 0,
  ultimoSeg: Infinity,
  finMs: 0,
  raf: null,
  esperas: new Set(),
};

/* ==========================================================
   UTILIDADES
   ========================================================== */
function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function limitar(valor, min, max, porDefecto) {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : porDefecto;
}

function normalizarConfig(cfg = {}) {
  return {
    tiempo: limitar(cfg.tiempo, LIMITES.tiempoMin, LIMITES.tiempoMax, CONFIG_POR_DEFECTO.tiempo),
    pares: limitar(cfg.pares, LIMITES.paresMin, LIMITES.paresMax, CONFIG_POR_DEFECTO.pares),
    vista: limitar(cfg.vista, 0, LIMITES.vistaMax, CONFIG_POR_DEFECTO.vista),
    bono: limitar(cfg.bono, 0, LIMITES.bonoMax, CONFIG_POR_DEFECTO.bono),
  };
}

function cargarConfig() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    return normalizarConfig(guardado ?? CONFIG_POR_DEFECTO);
  } catch {
    return normalizarConfig(CONFIG_POR_DEFECTO);
  }
}

function guardarConfig(cfg) {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(cfg));
  } catch {
    /* sin almacenamiento disponible: se ignora */
  }
}

function esperar(fn, ms) {
  const id = setTimeout(() => {
    estado.esperas.delete(id);
    fn();
  }, ms);
  estado.esperas.add(id);
}

function limpiarEsperas() {
  estado.esperas.forEach(clearTimeout);
  estado.esperas.clear();
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

/* ==========================================================
   TABLERO
   ========================================================== */
function crearCarta(carta, indice) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'carta';
  el.dataset.id = carta.id;
  el.style.setProperty('--i', indice);
  el.setAttribute('aria-label', 'Carta boca abajo');
  el.innerHTML = `
    <span class="carta-interior">
      <span class="cara dorso"><img src="${LOGO_BLANCO}" alt="" draggable="false"></span>
      <span class="cara frente"><img src="${carta.img}" alt="${carta.alt}" draggable="false"></span>
    </span>`;
  return el;
}

// Elige las columnas que dan las cartas más grandes para el espacio disponible
function aplicarDisposicion() {
  const total = estado.totalPares * 2;
  const gap = parseFloat(getComputedStyle(tablero).columnGap) || 12;
  const W = zona.clientWidth;
  const H = zona.clientHeight;
  if (!total || !W || !H) return;

  let mejor = { cw: 0, cols: 2 };
  for (let cols = 2; cols <= total; cols++) {
    const filas = Math.ceil(total / cols);
    const cw = Math.min((W - (cols - 1) * gap) / cols, ((H - (filas - 1) * gap) / filas) * RATIO);
    if (cw > mejor.cw + 0.5) mejor = { cw, cols };
  }

  const cw = Math.floor(Math.max(40, Math.min(mejor.cw, 420)));
  tablero.style.setProperty('--cw', `${cw}px`);
  tablero.style.setProperty('--tw', `${mejor.cols * cw + (mejor.cols - 1) * gap}px`);
}

function construirTablero() {
  const elegidas = barajar(CARTAS).slice(0, estado.config.pares);
  const mazo = barajar([...elegidas, ...elegidas]);

  estado.totalPares = elegidas.length;
  tablero.replaceChildren(...mazo.map(crearCarta));
  aplicarDisposicion();
}

function mostrar(carta, silencio = false) {
  if (!silencio) Sonido.voltear();
  carta.classList.add('volteada');
  carta.setAttribute('aria-label', `Carta: ${ALT[carta.dataset.id]}`);
}

function ocultar(carta) {
  carta.classList.remove('volteada', 'error');
  carta.setAttribute('aria-label', 'Carta boca abajo');
}

/* ==========================================================
   MARCADOR Y RELOJ
   ========================================================== */
function actualizarMarcador() {
  paresEl.textContent = `${estado.paresHallados}/${estado.totalPares}`;
  intentosEl.textContent = estado.intentos;
}

function formatearTiempo(seg) {
  if (seg < 60) return String(seg);
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

function pintarReloj(restanteMs) {
  const limiteMs = estado.config.tiempo * 1000;
  const restante = Math.max(0, restanteMs);
  const umbralUrgente = Math.min(10000, limiteMs * 0.5);

  segundosEl.textContent = formatearTiempo(Math.ceil(restante / 1000));
  progresoEl.style.strokeDashoffset = String(100 * (1 - Math.min(1, restante / limiteMs)));
  progresoEl.style.opacity = restante > 0 ? '1' : '0';
  relojEl.classList.toggle('urgente', restante > 0 && restante <= umbralUrgente);
}

function animar(el, clase) {
  el.classList.remove(clase);
  void el.offsetWidth; // reinicia la animación
  el.classList.add(clase);
}

function avisar(texto) {
  avisoEl.textContent = texto;
  animar(avisoEl, 'ver');
}

// Últimos 10 segundos: sirena, tic-tac, número gigante y destello en los bordes
function alertaFinal(seg) {
  if (seg >= estado.ultimoSeg) {
    estado.ultimoSeg = seg;
    return;
  }
  estado.ultimoSeg = seg;
  if (seg > 10 || seg < 1) return;

  if (seg === 10) Sonido.sirena();
  else Sonido.tictac(seg);
  cuentaEl.textContent = seg;
  animar(cuentaEl, 'pulso');
  animar(bordeEl, 'pulso');
}

function tick() {
  const restante = estado.finMs - performance.now();
  if (restante <= 0) {
    pintarReloj(0);
    perder();
    return;
  }
  pintarReloj(restante);
  alertaFinal(Math.ceil(restante / 1000));
  estado.raf = requestAnimationFrame(tick);
}

function iniciarReloj() {
  estado.iniciado = true;
  estado.ultimoSeg = Infinity;
  estado.finMs = performance.now() + estado.config.tiempo * 1000;
  mensajeEl.textContent = '¡El tiempo corre!';
  estado.raf = requestAnimationFrame(tick);
}

function detenerReloj() {
  if (estado.raf !== null) cancelAnimationFrame(estado.raf);
  estado.raf = null;
}

/* ==========================================================
   JUGADA
   ========================================================== */
function voltear(carta) {
  Sonido.activar();
  if (estado.bloqueado || estado.terminado) return;
  if (carta.disabled || carta.classList.contains('volteada')) return;

  if (!estado.iniciado) iniciarReloj();

  mostrar(carta);
  estado.seleccion.push(carta);

  if (estado.seleccion.length === 2) evaluarPareja();
}

function evaluarPareja() {
  const [a, b] = estado.seleccion;
  estado.intentos++;

  if (a.dataset.id === b.dataset.id) {
    [a, b].forEach((c) => {
      c.classList.add('acertada');
      c.disabled = true;
    });
    estado.paresHallados++;
    estado.racha++;
    estado.seleccion = [];
    actualizarMarcador();

    if (estado.paresHallados === estado.totalPares) return ganar();

    Sonido.acierto(estado.racha);
    avisar(FRASES[a.dataset.id] + (estado.racha > 1 ? ` · ¡Combo x${estado.racha}!` : ''));

    const bono = estado.config.bono;
    if (bono) {
      estado.finMs += bono * 1000;
      bonoEl.textContent = `+${bono}s`;
      animar(bonoEl, 'ver');
    }
    return;
  }

  estado.racha = 0;
  Sonido.fallo();
  estado.bloqueado = true;
  actualizarMarcador();
  [a, b].forEach((c) => c.classList.add('error'));

  esperar(() => {
    [a, b].forEach(ocultar);
    estado.seleccion = [];
    estado.bloqueado = false;
  }, RETARDO_ERROR_MS);
}

/* ==========================================================
   FIN DE PARTIDA
   ========================================================== */
function ganar() {
  estado.terminado = true;
  const sobraMs = Math.max(0, estado.finMs - performance.now());
  detenerReloj();
  Sonido.victoria();
  relojEl.classList.remove('urgente');
  mensajeEl.textContent = '¡Los encontraste todos!';

  esperar(() => mostrarFin(true, Math.floor(sobraMs / 1000)), 900);
}

function perder() {
  estado.terminado = true;
  estado.bloqueado = true;
  detenerReloj();
  Sonido.alarma();
  mensajeEl.textContent = 'Se acabó el tiempo.';

  esperar(() => mostrarFin(false, 0), 600);
}

function mostrarFin(gano, sobra) {
  if (gano) {
    const resto = sobra > 0
      ? ` y te sobraron ${plural(sobra, 'segundo', 'segundos')}.`
      : '.';
    finTitulo.textContent = '¡Grandes logros!';
    finTexto.textContent =
      `Encontraste los ${estado.totalPares} pares en ${plural(estado.intentos, 'intento', 'intentos')}${resto}`;
  } else {
    finTitulo.textContent = '¡Vamos por más!';
    finTexto.textContent =
      `Se acabó el tiempo. Encontraste ${estado.paresHallados} de ${estado.totalPares} pares.`;
  }

  dlgFin.showModal();
  if (gano) lanzarConfeti();
}

function lanzarConfeti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colores = ['#ffffff', '#a98be0', '#5b2fa6', '#d9ccf4', '#ffffff'];
  const piezas = Array.from({ length: 90 }, () => {
    const p = document.createElement('i');
    p.style.setProperty('--x', `${Math.random() * 100}%`);
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`);
    p.style.setProperty('--giro', `${360 + Math.random() * 720}deg`);
    p.style.setProperty('--demora', `${Math.random() * 0.8}s`);
    p.style.setProperty('--dura', `${2.4 + Math.random() * 1.6}s`);
    p.style.setProperty('--color', colores[Math.floor(Math.random() * colores.length)]);
    return p;
  });
  confetiEl.replaceChildren(...piezas);
}

/* ==========================================================
   PARTIDA NUEVA Y CONFIGURACIÓN
   ========================================================== */
// Muestra todas las cartas un momento para que los jugadores las memoricen
function vistaPrevia() {
  const ms = estado.config.vista * 1000;
  if (!ms) return;

  const cartas = [...tablero.children];
  estado.bloqueado = true;
  mensajeEl.textContent = '¡Memoriza las cartas!';

  esperar(() => {
    Sonido.whoosh();
    cartas.forEach((c) => mostrar(c, true));
  }, 600);

  esperar(() => {
    Sonido.whoosh();
    cartas.forEach(ocultar);
    estado.bloqueado = false;
    mensajeEl.textContent = 'Voltea una carta para empezar.';
  }, 600 + ms);
}

function nuevaPartida(opciones) {
  detenerReloj();
  limpiarEsperas();
  confetiEl.replaceChildren();

  Object.assign(estado, {
    seleccion: [],
    bloqueado: false,
    iniciado: false,
    terminado: false,
    paresHallados: 0,
    intentos: 0,
    racha: 0,
    ultimoSeg: Infinity,
    finMs: 0,
  });

  construirTablero();
  actualizarMarcador();
  pintarReloj(estado.config.tiempo * 1000);
  mensajeEl.textContent = 'Voltea una carta para empezar.';
  if (opciones?.vista !== false) vistaPrevia();
}

function abrirConfig() {
  // Se pausa la partida en curso; al cerrar el diálogo empieza una nueva
  detenerReloj();
  limpiarEsperas();
  estado.bloqueado = true;

  inTiempo.value = estado.config.tiempo;
  inPares.value = estado.config.pares;
  inVista.value = estado.config.vista;
  inBono.value = estado.config.bono;
  dlgConfig.showModal();
}

/* ==========================================================
   EVENTOS
   ========================================================== */
tablero.addEventListener('click', (e) => {
  const carta = e.target.closest('.carta');
  if (carta) voltear(carta);
});

$('btn-reiniciar').addEventListener('click', () => nuevaPartida());
$('btn-config').addEventListener('click', abrirConfig);

document.querySelectorAll('.stepper-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.objetivo);
    const min = Number(input.min);
    const max = Number(input.max);
    const actual = Number(input.value) || min;
    input.value = Math.min(max, Math.max(min, actual + Number(btn.dataset.paso)));
  });
});

// El formulario usa method="dialog": al enviarse, el diálogo se cierra solo
formConfig.addEventListener('submit', () => {
  Sonido.activar();
  estado.config = normalizarConfig({
    tiempo: inTiempo.value,
    pares: inPares.value,
    vista: inVista.value,
    bono: inBono.value,
  });
  guardarConfig(estado.config);
});

// Cualquier cierre del diálogo de configuración arranca una partida limpia
dlgConfig.addEventListener('close', () => nuevaPartida());
dlgFin.addEventListener('close', () => nuevaPartida());

$('btn-otra').addEventListener('click', () => dlgFin.close());
$('btn-ajustes').addEventListener('click', () => {
  dlgFin.close();
  abrirConfig();
});

// El tablero se reacomoda solo cuando cambia el espacio disponible
new ResizeObserver(aplicarDisposicion).observe(zona);

function pantallaCompleta() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}

function pintarSonido() {
  btnSonido.textContent = Sonido.silenciado ? 'Sonido: no' : 'Sonido: sí';
  btnSonido.setAttribute('aria-pressed', String(!Sonido.silenciado));
}

btnSonido.addEventListener('click', () => {
  Sonido.alternar();
  pintarSonido();
});
$('btn-pantalla').addEventListener('click', pantallaCompleta);

// Atajos para quien presenta: F pantalla completa, R reiniciar, M sonido, C configurar
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (k === 'f') pantallaCompleta();
  else if (k === 'r') nuevaPartida();
  else if (k === 'm') {
    Sonido.alternar();
    pintarSonido();
  } else if (k === 'c') abrirConfig();
});

/* ==========================================================
   INICIO
   ========================================================== */
function iniciar() {
  inTiempo.min = LIMITES.tiempoMin;
  inTiempo.max = LIMITES.tiempoMax;
  inPares.min = LIMITES.paresMin;
  inPares.max = LIMITES.paresMax;
  inVista.min = 0;
  inVista.max = LIMITES.vistaMax;
  inBono.min = 0;
  inBono.max = LIMITES.bonoMax;

  // Precarga para que no haya parpadeo al voltear la primera carta
  [LOGO_BLANCO, ...CARTAS.map((c) => c.img)].forEach((src) => {
    new Image().src = src;
  });

  nuevaPartida({ vista: false });
  pintarSonido();
  abrirConfig();
}

iniciar();
