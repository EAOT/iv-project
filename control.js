const SALA = new URLSearchParams(location.search).get('sala');
const estado = document.getElementById('estado');
const ultimo = document.getElementById('ultimo') || { textContent: '' };
const btnActivar = document.getElementById('btn-activar');
const btnPrueba = document.getElementById('btn-prueba');                  // opcional
const cuenta = document.getElementById('cuenta') || { textContent: '' };  // opcional
const debug = document.getElementById('debug') || { textContent: '' };

const G = 9.81;
const CRUCE = 0.7 * G;        // bajo esto: en el aire
const IMPULSO_MIN = 1.2 * G;  // sobre esto: impulso o impacto
const VENTANA_IMPULSO = 0.6;  // s máx. entre impulso y despegue
const T_MIN = 0.1, T_MAX = 1.2;
const PAUSA = 0.8;            // s de descanso tras cada salto

// Deben coincidir exactamente con los nombres de CUERPOS en sketch.js
const PLANETAS = [
  ['Mercurio', 3.70, '#b5a7a7'], ['Venus', 8.87, '#e3bb76'], ['Tierra', 9.81, '#3fae9c'],
  ['Luna', 1.62, '#cfd3da'], ['Marte', 3.71, '#e0673a'], ['Cometa 67P', 0.0001, '#6b6f76'],
  ['Júpiter', 24.79, '#c9ad8a'], ['Saturno', 10.44, '#e3cb8f'], ['Urano', 8.69, '#a3d8d8'],
  ['Neptuno', 11.15, '#3d5ed1'], ['Plutón', 0.62, '#a08c78']
];
const contPlanetas = document.getElementById('planetas');
const planetaInfo = document.getElementById('planeta-info');
let refPlaneta = null;
let refFoco = null;

function elegirPlaneta(nombre) {
  refPlaneta.set(nombre).catch(err => estado.textContent = '⚠ ' + err.message);
}

function marcarPlaneta(nombre) {
  contPlanetas.querySelectorAll('button').forEach(b =>
    b.classList.toggle('activo', b.dataset.nombre === (nombre || '')));
  const p = PLANETAS.find(p => p[0] === nombre);
  planetaInfo.textContent = p ? 'En pantalla: ' + p[0] + ' · g = ' + p[1] + ' m/s²' : 'En pantalla: vista general';
  document.body.style.setProperty('--acento', p ? p[2] : '#3fae9c');
}

function crearSelector() {
  PLANETAS.forEach(([nombre, , col]) => {
    const b = document.createElement('button');
    b.className = 'planeta'; b.dataset.nombre = nombre; b.textContent = nombre;
    b.style.setProperty('--col', col);
    b.addEventListener('click', () => elegirPlaneta(nombre));
    contPlanetas.appendChild(b);
  });
  const vg = document.createElement('button');
  vg.className = 'planeta general'; vg.dataset.nombre = ''; vg.textContent = 'Vista general';
  vg.addEventListener('click', () => elegirPlaneta(null));
  contPlanetas.appendChild(vg);
  const todos = document.createElement('button');
  todos.className = 'planeta general';
  todos.addEventListener('click', () =>
    refFoco.set(null).catch(err => estado.textContent = '⚠ ' + err.message));
  contPlanetas.appendChild(todos);
  refFoco.on('value', s => {
    const f = s.val();
    todos.disabled = !f;
    todos.textContent = f ? '✨ Quitar halo de ' + f + ' (saltan todos)' : '✨ Saltan todos los planetas';
  });
  refPlaneta.on('value', s => marcarPlaneta(s.val()));
}

let ref = null, audio = null, escala = 1, muestrasCal = [];
let fase = 'APAGADO';         // APAGADO · REPOSO · IMPULSO · VUELO · PAUSA
let tImpulso = 0, tDespegue = 0, tPausa = 0, bajas = 0, altas = 0;
let prev = [];                // últimas 3 magnitudes, para suavizar en vivo

function mostrar(texto, f) { cuenta.textContent = texto; document.body.dataset.fase = f; }

function bip(f = 440, dur = 0.12) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = f; g.gain.value = 0.2;
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(audio.currentTime + dur);
}

function enviarEvento(datos) {
  if (!ref) { estado.textContent = '⚠ Sin conexión con Firebase'; return; }
  ref.child('evento').set({ ...datos, ts: Date.now() })
    .catch(err => estado.textContent = '⚠ ' + err.message);
}

function leerMovimiento(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x === null) return;
  const crudo = Math.hypot(a.x, a.y, a.z);
  const ahora = performance.now() / 1000;

  if (muestrasCal.length < 20) {           // calibración con el teléfono quieto
    muestrasCal.push(crudo);
    if (muestrasCal.length === 20) {
      const prom = muestrasCal.reduce((s, m) => s + m, 0) / 20;
      escala = prom > 0.5 ? G / prom : 1;
      fase = 'REPOSO';
      mostrar('Salta cuando quieras', '');
    }
    return;
  }

  prev.push(crudo * escala);
  if (prev.length > 3) prev.shift();
  const mag = prev.reduce((s, m) => s + m, 0) / prev.length;
  debug.textContent = fase + ' · ' + mag.toFixed(1) + ' m/s²';

  switch (fase) {
    case 'REPOSO':
      if (mag > IMPULSO_MIN) { fase = 'IMPULSO'; tImpulso = ahora; }
      break;

    case 'IMPULSO':
      if (mag < CRUCE && ++bajas >= 2) {   // 2 lecturas bajas confirman el despegue
        fase = 'VUELO';
        tDespegue = ahora - 0.035;         // compensa las 2 lecturas de confirmación
        altas = 0;
        enviarEvento({ fase: 'despegue' });
        mostrar('¡En el aire!', 'salta');
      } else if (mag >= CRUCE) {
        bajas = 0;
        if (ahora - tImpulso > VENTANA_IMPULSO) fase = 'REPOSO'; // impulso sin salto
      }
      break;

    case 'VUELO': {
      const t = ahora - tDespegue;
      const aterrizo = mag > IMPULSO_MIN || (mag >= CRUCE && ++altas >= 3);
      if (mag < CRUCE) altas = 0;
      if (aterrizo) {
        fase = 'PAUSA'; tPausa = ahora; bajas = 0;
        if (t >= T_MIN && t <= T_MAX) {
          const v0 = G * t / 2;
          enviarEvento({ fase: 'aterrizaje', v0, t });
          ultimo.textContent = v0.toFixed(2) + ' m/s';
          mostrar(v0.toFixed(2) + ' m/s', 'ok');
          estado.textContent = t.toFixed(2) + ' s en el aire';
          bip(1200, 0.2);
        } else {
          enviarEvento({ fase: 'cancelar' });
          mostrar('✗', 'error');
        }
      } else if (t > T_MAX) {              // nunca llegó el impacto
        fase = 'PAUSA'; tPausa = ahora; bajas = 0;
        enviarEvento({ fase: 'cancelar' });
        mostrar('✗', 'error');
      }
      break;
    }

    case 'PAUSA':
      if (ahora - tPausa > PAUSA) { fase = 'REPOSO'; mostrar('Salta cuando quieras', ''); }
      break;
  }
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
  btnActivar.disabled = true;
    if (btnPrueba) btnPrueba.disabled = true;
} else {
  ref = firebase.database().ref('salas/' + SALA);
  ref.child('telefono').set(true);
  ref.child('telefono').onDisconnect().remove();
  refPlaneta = ref.child('planeta');
  refFoco = ref.child('foco');
  crearSelector();
  firebase.database().ref('.info/connected').on('value', s =>
    estado.textContent = s.val() ? 'Conectado a la sala ' + SALA : 'Sin conexión…');
  btnActivar.addEventListener('click', activarSensor);
  btnPrueba?.addEventListener('click', () => {
    const v0 = 2 + Math.random() * 2;
    enviarEvento({ fase: 'despegue' });
    setTimeout(() => enviarEvento({ fase: 'aterrizaje', v0, t: 2 * v0 / G }), 400);
  });
}