const SALA = new URLSearchParams(location.search).get('sala');
const estado = document.getElementById('estado');
const ultimo = document.getElementById('ultimo');
const btnActivar = document.getElementById('btn-activar');
const btnPrueba = document.getElementById('btn-prueba');

const UMBRAL_CAIDA = 3;           // m/s²: bajo esto, el teléfono está en caída libre
const T_MIN = 0.15, T_MAX = 1.2;  // s: duración válida de un vuelo
const PAUSA = 0.8;                // s: ignora rebotes tras aterrizar
let ref = null, enVuelo = false, t0 = 0, tAterrizaje = 0;

function enviar(v0, t) {
  ref.child('salto').set({ v0, t, ts: Date.now() });
  ultimo.textContent = v0.toFixed(2) + ' m/s';
}

function leerMovimiento(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x === null) return;
  const mag = Math.hypot(a.x, a.y, a.z);
  const ahora = performance.now() / 1000;
  if (!enVuelo) {
    if (mag < UMBRAL_CAIDA && ahora - tAterrizaje > PAUSA) { enVuelo = true; t0 = ahora; }
  } else if (mag >= UMBRAL_CAIDA) {
    enVuelo = false;
    tAterrizaje = ahora;
    const t = ahora - t0;
    if (t > T_MIN && t < T_MAX) enviar(9.81 * t / 2, t);
  }
}

async function activarSensor() {
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
  window.addEventListener('devicemotion', leerMovimiento);
  try { await navigator.wakeLock?.request('screen'); } catch (err) {}
  btnActivar.disabled = true;
  btnActivar.textContent = 'Sensor activo ✓';
}

if (!SALA) {
  estado.textContent = '⚠ Falta el código de sala. Escanea el QR desde el computador.';
  btnActivar.disabled = btnPrueba.disabled = true;
} else {
  ref = firebase.database().ref('salas/' + SALA);
  ref.child('telefono').set(true);
  ref.child('telefono').onDisconnect().remove();
  firebase.database().ref('.info/connected').on('value', s =>
    estado.textContent = s.val() ? 'Conectado a la sala ' + SALA : 'Sin conexión…');
  btnActivar.addEventListener('click', activarSensor);
  btnPrueba.addEventListener('click', () => { const v0 = 2 + Math.random() * 2; enviar(v0, 2 * v0 / 9.81); });
}