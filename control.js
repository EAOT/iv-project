const SALA = new URLSearchParams(location.search).get('sala');
const estado = document.getElementById('estado');
const ultimo = document.getElementById('ultimo');
const btnActivar = document.getElementById('btn-activar');
const btnPrueba = document.getElementById('btn-prueba');
const btnSaltar = document.getElementById('btn-saltar');
const cuenta = document.getElementById('cuenta');

const G = 9.81;
const VENTANA = 3;             // s que graba después de «¡SALTA!»
const CRUCE = 0.7 * G;         // borde del vuelo: bajo esto está en el aire
const VALLE_MAX = 0.6 * G;     // el vuelo debe bajar al menos hasta aquí
const IMPULSO_MIN = 1.2 * G;   // impulso antes del despegue y pico de aterrizaje
const T_MIN = 0.1, T_MAX = 1.2;
let ref = null, escala = 1, muestrasCal = [], grabando = false, serie = [], audio = null;
const debug = document.getElementById('debug');

function enviar(v0, t) {
  ref.child('salto').set({ v0, t, ts: Date.now() });
  ultimo.textContent = v0.toFixed(2) + ' m/s';
}

function leerMovimiento(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x === null) return;
  let mag = Math.hypot(a.x, a.y, a.z);

  if (muestrasCal.length < 20) { // calibración con el teléfono quieto
    muestrasCal.push(mag);
    if (muestrasCal.length === 20) {
      const prom = muestrasCal.reduce((s, m) => s + m, 0) / 20;
      escala = prom > 0.5 ? G / prom : 1;
      mostrar('Listo', '');
      btnSaltar.disabled = false;
    }
    return;
  }
  if (grabando) serie.push({ t: performance.now() / 1000, m: mag * escala });
}

function mostrar(texto, fase) { cuenta.textContent = texto; document.body.dataset.fase = fase; }

function bip(f = 440, dur = 0.12) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = f; g.gain.value = 0.2;
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(audio.currentTime + dur);
}

// Promedio de 3 lecturas: un pico aislado no corta el vuelo
function suavizar(s) {
  return s.map((p, i) => {
    const v = s.slice(Math.max(0, i - 1), i + 2);
    return { t: p.t, m: v.reduce((acc, q) => acc + q.m, 0) / v.length };
  });
}

// Instante exacto en que la curva cruza CRUCE entre dos lecturas
function tCruce(p, q) { return p.t + (CRUCE - p.m) / ((q.m - p.m) || 1e-6) * (q.t - p.t); }

// Desde el valle, avanza (paso = ±1) hasta salir del vuelo.
// Sale con 3 lecturas seguidas sobre CRUCE o con un pico claro de contacto con el suelo.
function buscarBorde(s, i, paso) {
  let arriba = 0;
  for (let j = i + paso; j >= 0 && j < s.length; j += paso) {
    if (s[j].m > IMPULSO_MIN) return j - arriba * paso;
    arriba = s[j].m >= CRUCE ? arriba + 1 : 0;
    if (arriba === 3) return j - 2 * paso;
  }
  return -1; // el vuelo llega al borde de la grabación
}

function fallo(msg) { mostrar('✗', 'error'); estado.textContent = msg; bip(200, 0.3); }

function analizar(crudo) {
  if (crudo.length < 30) return fallo('Muy pocas lecturas. ¿Se bloqueó la pantalla?');
  const s = suavizar(crudo);
  let iMin = 0;
  s.forEach((p, i) => { if (p.m < s[iMin].m) iMin = i; });
  debug.textContent = 'Lecturas: ' + s.length + ' · valle: ' + s[iMin].m.toFixed(1) + ' m/s²';

  if (s[iMin].m > VALLE_MAX) return fallo('No se detectó un salto. Inténtalo de nuevo.');
  const iIni = buscarBorde(s, iMin, -1), iFin = buscarBorde(s, iMin, +1);
  if (iIni < 0) return fallo('Saltaste antes de tiempo. Espera el «¡SALTA!».');
  if (iFin < 0) return fallo('No alcanzó a registrarse el aterrizaje.');

  const impulso = Math.max(...s.slice(0, iIni + 1).map(p => p.m));
  if (impulso < IMPULSO_MIN) return fallo('No se detectó el impulso. Salta con más fuerza.');

  const t = tCruce(s[iFin - 1], s[iFin]) - tCruce(s[iIni + 1], s[iIni]);
  debug.textContent += ' · vuelo: ' + t.toFixed(2) + ' s';
  if (t < T_MIN || t > T_MAX) return fallo('Salto fuera de rango (' + t.toFixed(2) + ' s).');

  enviar(G * t / 2, t);
  mostrar((G * t / 2).toFixed(2) + ' m/s', 'ok');
  estado.textContent = '¡Salto enviado! ' + t.toFixed(2) + ' s en el aire';
  bip(1200, 0.2);
}

function iniciarTurno() {
  btnSaltar.disabled = true;
  let n = 3;
  mostrar(n, 'cuenta'); bip();
  const id = setInterval(() => {
    if (--n > 0) { mostrar(n, 'cuenta'); bip(); return; }
    clearInterval(id);
    serie = []; grabando = true;
    mostrar('¡SALTA!', 'salta'); bip(880, 0.25);
    setTimeout(() => {
      grabando = false;
      analizar(serie);
      btnSaltar.disabled = false;
    }, VENTANA * 1000);
  }, 1000);
}

async function activarSensor() {
  audio = new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  if (typeof DeviceMotionEvent === 'undefined') {
    estado.textContent = '⚠ Este navegador no entrega datos de movimiento.'; return;
  }
  if (typeof DeviceMotionEvent.requestPermission === 'function') { // iOS
    try {
      if (await DeviceMotionEvent.requestPermission() !== 'granted') {
        estado.textContent = '⚠ Permiso denegado. Cierra la pestaña y vuelve a escanear el QR.'; return;
      }
    } catch (err) { estado.textContent = '⚠ No se pudo pedir el permiso.'; return; }
  }
  mostrar('Quieto…', '');
  window.addEventListener('devicemotion', leerMovimiento);
  try { await navigator.wakeLock?.request('screen'); } catch (err) {}
  btnActivar.hidden = true;
}

if (!SALA) {
  estado.textContent = '⚠ Falta el código de sala. Escanea el QR desde el computador.';
  btnActivar.disabled = btnPrueba.disabled = true;
  btnSaltar.disabled = true;
} else {
  ref = firebase.database().ref('salas/' + SALA);
  ref.child('telefono').set(true);
  ref.child('telefono').onDisconnect().remove();
  firebase.database().ref('.info/connected').on('value', s =>
    estado.textContent = s.val() ? 'Conectado a la sala ' + SALA : 'Sin conexión…');
  btnActivar.addEventListener('click', activarSensor);
  btnSaltar.addEventListener('click', iniciarTurno);
  btnPrueba.addEventListener('click', () => { const v0 = 2 + Math.random() * 2; enviar(v0, 2 * v0 / 9.81); });
}