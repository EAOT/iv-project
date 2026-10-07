/* =====================================================================
   La gravedad no es un número — p5.js (modo global)
   Secciones: DATOS · VISTA GENERAL · DETALLE · SONIFICACIÓN · INTERACCIÓN
   ===================================================================== */

/* ============================== DATOS ================================ */
const ASSETS = {
  Mercurio:     { img: '', sonido: '' },
  Venus:        { img: '', sonido: '' },
  Tierra:       { img: '', sonido: '' },
  Luna:         { img: '', sonido: '' },
  Marte:        { img: '', sonido: '' },
  'Cometa 67P': { img: '', sonido: '' },
  'Júpiter':    { img: '', sonido: '' },
  Saturno:      { img: '', sonido: '' },
  Urano:        { img: '', sonido: '' },
  Neptuno:      { img: '', sonido: '' },
  'Plutón':     { img: '', sonido: '' }
};

const CUERPOS = [ 
  { nombre:'Mercurio',   au:0.39,  r:6,  g:3.70,   vEsc:4250,  tipo:'rocoso',  col:'#b5a7a7' },
  { nombre:'Venus',      au:0.72,  r:9,  g:8.87,   vEsc:10360, tipo:'rocoso',  col:'#e3bb76' },
  { nombre:'Tierra',     au:1,     r:10, g:9.81,   vEsc:11186, tipo:'rocoso',  col:'#3fae9c' },
  { nombre:'Luna',       au:1.05,  r:5,  g:1.62,   vEsc:2380,  tipo:'rocoso',  col:'#cfd3da' },
  { nombre:'Marte',      au:1.52,  r:8,  g:3.71,   vEsc:5030,  tipo:'rocoso',  col:'#e0673a' },
  { nombre:'Cometa 67P', au:3.46,  r:4,  g:0.0001, vEsc:0.9,   tipo:'menor',   col:'#6b6f76' },
  { nombre:'Júpiter',    au:5.2,   r:17, g:24.79,  vEsc:59500, tipo:'gigante', col:'#c9ad8a' },
  { nombre:'Saturno',    au:9.54,  r:15, g:10.44,  vEsc:35500, tipo:'gigante', col:'#e3cb8f' },
  { nombre:'Urano',      au:19.2,  r:12, g:8.69,   vEsc:21300, tipo:'gigante', col:'#a3d8d8' },
  { nombre:'Neptuno',    au:30.06, r:12, g:11.15,  vEsc:23500, tipo:'gigante', col:'#3d5ed1' },
  { nombre:'Plutón',     au:39.5,  r:5,  g:0.62,   vEsc:1210,  tipo:'menor',   col:'#a08c78' }
];

const G_MIN = 0.0001, G_MAX = 24.79, DUR_MAX = 12; 
let v0 = 3.0; 
let tOrbita = 0; 
let faseSaltoDetalle = 0;

const altura = c => v0 * v0 / (2 * c.g);
const tiempo = c => 2 * v0 / c.g;
const fmtM = m => m < 10 ? m.toFixed(2) + ' m' : m < 1000 ? m.toFixed(1) + ' m' : Math.round(m).toLocaleString('es') + ' m';
const fmtT = s => s < 60 ? s.toFixed(2) + ' s' : s < 3600 ? (s / 60).toFixed(1) + ' min' : (s / 3600).toFixed(1) + ' h';
const escalaLog = h => Math.log(1 + h / 0.1) / Math.log(1 + 1e5 / 0.1);

function comparar(h) {
  const l = [[0.3,'un escalón bajo'],[0.8,'saltar una silla'],[1.5,'saltar una mesa alta'],[3,'llegar al techo de una habitación'],
    [12,'saltar un edificio de 3 pisos'],[100,'superar un edificio de 30 pisos'],[500,'superar la Torre Eiffel (330 m)']];
  for (const [m, t] of l) if (h < m) return 'Equivale a ' + t;
  return 'Equivale a superar el Burj Khalifa (828 m) y seguir subiendo';
}

/* ============================ ESTADO ================================= */
let sel = null, imgs = {};
let z = 0, zObj = 0;   
let mVal = 1, mObj = 1;  // 0 = en línea · 1 = órbitas en movimiento
const ZOOM_MAX = 40;
const suave = (a, b, x) => { const t = constrain((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function preload() {
  for (const c of CUERPOS) if (ASSETS[c.nombre].img) imgs[c.nombre] = loadImage(ASSETS[c.nombre].img);
}

function setup() {
  const cv = createCanvas(100, 100); 
  cv.parent('lienzo');
  textFont('Trebuchet MS'); 
  ajustar(); 
  iniciarUI();
}

function windowResized() { ajustar(); }

function ajustar() {
  const contenedor = document.getElementById('lienzo');
  const w = contenedor.clientWidth;
  const hHeader = document.querySelector('header').offsetHeight;
  const hControles = document.getElementById('controles').offsetHeight;
  const hFooter = document.querySelector('footer').offsetHeight;
  const hDisponible = windowHeight - hHeader - hControles - hFooter - 20;
  
  const h = max(380, min(650, hDisponible));
  resizeCanvas(w, h);
}

function draw() {
  background('#07090f'); 
  estrellas();
  
  const dt = min(deltaTime, 50) / 1000;
  const antes = z;
  z = constrain(z + (zObj ? 1 : -1) * dt, 0, 1);
  if ((antes < 1 && z === 1) || (antes > 0 && z === 0)) ajustar();
  
  if (z === 0) {
    tOrbita += dt * mVal;
    mVal += constrain(mObj - mVal, -dt * 1.5, dt * 1.5);
    if (zObj === 0) sel = null; 
  }

  if (sel) {
    const tAnim = min(tiempo(sel), DUR_MAX);
    faseSaltoDetalle += dt / (tAnim + 0.6);
    if (faseSaltoDetalle >= 1) faseSaltoDetalle %= 1;
  }

  const e = suave(0, 1, z);
  if (z < 1) dibujarSistema(e);                                   
  if (z > 0 && sel) { push(); drawingContext.globalAlpha = suave(0.55, 1, z); dibujarDetalle(); pop(); } 
}

function estrellas() { 
  randomSeed(7); noStroke(); fill(255, 90);
  for (let i = 0; i < 90; i++) circle(random(width), random(height), random(1, 2.2));
}

/* ======================= VISTA GENERAL: SISTEMA ====================== */
function posiciones() {
  const cx = width / 2, cy = height / 2;
  const y0 = height * 0.6; // Altura de la línea base
  const maxRx = min(width / 2 - 40, 550); 
  const n = CUERPOS.length;
  
  // Posiciones en línea recta logarítmica
  const m0 = width < 600 ? 70 : 110, ancho = width - m0 - 40, gap = min(78, ancho / n), xs = [];
  CUERPOS.forEach((c, i) => { 
    const p = m0 + (Math.log10(c.au) + 0.45) / 2.1 * ancho; 
    xs.push(i ? max(p, xs[i - 1] + gap) : p); 
  });
  const k = min(1, ancho / (xs[n - 1] - m0));

  const pos = [];
  
  CUERPOS.forEach((c, i) => {
    // Posiciones orbitales
    const logAu = Math.log10(c.au);
    const rx = map(logAu, -0.45, 1.6, min(width * 0.08, 50), maxRx);
    const ry = rx * 0.42; 
    
    const periodo = Math.pow(c.au, 1.5);
    const ang = (tOrbita * 0.4 / periodo) + (i * 2.3); 
    
    let ox = cx + rx * Math.cos(ang);
    let oy = cy + ry * Math.sin(ang);
    
    if (c.nombre === 'Luna') {
      const pTierra = pos.find(p => p.nombre === 'Tierra');
      if (pTierra) {
        ox = pTierra.ox + 16 * Math.cos(tOrbita * 4);
        oy = pTierra.oy + 16 * Math.sin(tOrbita * 4);
      }
    }
    
    // Interpolar según mVal
    const lx = m0 + (xs[i] - m0) * k;
    pos.push({ 
      x: lerp(lx, ox, mVal), 
      y: lerp(y0, oy, mVal), 
      rx, ry, ox, oy, lx, 
      nombre: c.nombre 
    });
  });
  return pos;
}

function cuerpoEn(mx, my, posArr) {
  let mejor = -1, minDist = 30;
  posArr.forEach((p, i) => {
    const d = dist(mx, my, p.x, p.y);
    if (d < minDist) { minDist = d; mejor = i; }
  });
  return mejor;
}

function dibujarSistema(e) {
  const pos = posiciones(), cx = width / 2, cy = height / 2, y0 = height * 0.6;
  const hover = (z === 0 && zObj === 0) ? cuerpoEn(mouseX, mouseY, pos) : -1;
  push();
  drawingContext.globalAlpha = 1 - suave(0.6, 1, e);
  
  if (sel) { 
    const i = CUERPOS.findIndex(c => c.nombre === sel.nombre);
    if (i !== -1 && pos[i]) {
      const s = 1 + e * (ZOOM_MAX - 1);
      translate(lerp(pos[i].x, cx, e), lerp(pos[i].y, cy, e)); 
      scale(s); 
      translate(-pos[i].x, -pos[i].y);
    }
  }
  
  const sr = 35;
  const solX = lerp(max(sr + 8, (width < 600 ? 70 : 110) - 70), cx, mVal);
  const solY = lerp(y0, cy, mVal);

  // Línea base modo alineado
  stroke(255, 45 * (1 - mVal)); strokeWeight(1); line(solX + sr, y0, width - 20, y0);

  // Sol
  noStroke(); fill(255, 170, 60, 30); circle(solX, solY, 70); fill(255, 190, 80, 70); circle(solX, solY, 50); fill('#ffb347'); circle(solX, solY, 36);
  
  // Rutas orbitales (desvanecen al alinear)
  noFill(); stroke(255, 20 * mVal); strokeWeight(1);
  pos.forEach(p => { if (p.nombre !== 'Luna') ellipse(cx, cy, p.rx * 2, p.ry * 2); });
  
  noStroke(); fill(120); textAlign(CENTER); textSize(11); textStyle(NORMAL);
  text((mVal > 0.5 ? 'Sistema planetario en movimiento orbital continuo' : 'Planetas alineados por distancia al Sol') + ' · Escala logarítmica', cx, height - 12);

  // Cuerpos celestes
  CUERPOS.forEach((c, i) => {
    const p = pos[i], x = p.x, y = p.y, r = c.r, sobre = i === hover;
    
    if (c.nombre === 'Saturno') {
      noFill(); stroke(180, 160, 120, 150); strokeWeight(3);
      ellipse(x, y, r * 3.5, r * 1.5);
      strokeWeight(1);
    }
    
    if (sobre) { noFill(); stroke(c.col); strokeWeight(1.5); circle(x, y, 2 * r + 12); }
    noStroke(); fill(c.col); circle(x, y, 2 * r);
    if (imgs[c.nombre]) image(imgs[c.nombre], x - r, y - r, 2 * r, 2 * r); else { fill(255, 45); circle(x - r * 0.3, y - r * 0.3, r * 0.8); }
    
    const altMax = lerp(min(130, y0 - 90), 130, mVal);
    const alt = altMax * escalaLog(altura(c)), ph = ((millis() / 1000) / 2.2 + i * 0.17) % 1, hSuelo = 4 * ph * (1 - ph) * alt;
    stroke(c.col); strokeWeight(1); drawingContext.setLineDash([3, 4]); line(x - 12, y - r - alt - 18, x + 12, y - r - alt - 18); drawingContext.setLineDash([]);
    astronauta(x, y - r - hSuelo + 10, 0.4, ph > 0.05 && ph < 0.95, c.col);
    
    if (z < 0.5) { 
      const fila = i % 2;
      const ly = y0 + 34 + fila * 72;
      const finalY = lerp(ly, y + r + 24, mVal);

      if (fila && mVal < 0.5) { stroke(255, 30 * (1 - 2 * mVal)); line(x, y + r + 4, x, ly - 15); }

      noStroke(); textAlign(CENTER); fill(sobre ? c.col : 255); textSize(11); textStyle(BOLD); 
      if (!(c.nombre === 'Luna' && mVal > 0.5 && !sobre)) text(c.nombre, x, finalY - 10);
      textStyle(NORMAL); textSize(9.5); fill(c.col); text(fmtM(altura(c)), x, finalY);
    }
  });
  pop();
  if (z === 0 && zObj === 0) { cursor(hover >= 0 ? HAND : ARROW); if (hover >= 0) tooltip(CUERPOS[hover]); }
}

function tooltip(c) {
  textStyle(NORMAL); textSize(13);
  const t = 'g = ' + c.g + ' m/s²', w = textWidth(t) + 20, x = constrain(mouseX + 12, 4, width - w - 4), y = max(4, mouseY - 34);
  fill(15, 20, 30, 235); stroke(c.col); strokeWeight(1); rect(x, y, w, 26, 6);
  noStroke(); fill(255); textAlign(LEFT); text(t, x + 10, y + 18);
}

function astronauta(x, ySuelo, k, aire, acento) {
  push(); translate(x, ySuelo); scale(k); rectMode(CORNER); noStroke();
  const sep = aire ? 9 : 3;
  fill(230); rect(-8 - sep / 2, -22, 7, 22, 2); rect(1 + sep / 2, -22, 7, 22, 2);      
  fill(245); rect(-11, -46, 22, 26, 4);                                                 
  fill(200); rect(-15, -44, 5, 20, 2);                                                  
  fill(230); rect(aire ? -20 : -17, aire ? -52 : -44, 6, 18, 3); rect(aire ? 14 : 11, aire ? -52 : -44, 6, 18, 3); 
  fill(245); circle(0, -56, 22);                                                        
  fill(acento); circle(2, -56, 13);                                                     
  pop();
}

/* ============================== DETALLE ============================== */
function dibujarDetalle() {
  if (!sel) return;
  const c = sel, h = altura(c), t = tiempo(c), suelo = height - 70;
  const pxM = 60 / 1.8, hPx = min(h * pxM, height - 200), acotado = h * pxM > height - 200;
  
  const ph = faseSaltoDetalle;
  const y = ph < 1 ? 4 * ph * (1 - ph) * hPx : 0;
  
  if (ph < 1 && ph < detalleFaseAnt && zObj === 1) reproducir(c);
  detalleFaseAnt = ph;
  
  noStroke(); fill(c.col); imgs[c.nombre] ? image(imgs[c.nombre], width / 2 - 40, suelo, 80, 80) : rect(0, suelo, width, 12);
  const cx = width * 0.35;
  stroke(c.col); strokeWeight(1); drawingContext.setLineDash([4, 6]); line(cx - 90, suelo - hPx - 62, cx + 90, suelo - hPx - 62); drawingContext.setLineDash([]);
  noStroke(); fill(c.col); textAlign(LEFT); textSize(12); text(fmtM(h) + (acotado ? ' (fuera de escala)' : ''), cx + 96, suelo - hPx - 58);
  astronauta(cx, suelo - y, 1, ph < 1 && ph > 0.03, c.col);
  
  const px = width < 640 ? 16 : width * 0.55, py = 25;
  fill(255); textAlign(LEFT); textStyle(BOLD); textSize(24); text(c.nombre, px, py + 10);
  textStyle(NORMAL); textSize(14); fill(220);
  const filas = ['Gravedad: ' + c.g + ' m/s²', 'Altura del salto: ' + fmtM(h), 'Tiempo en el aire: ' + fmtT(t),
    comparar(h), 'Velocidad de escape: ' + c.vEsc.toLocaleString('es') + ' m/s'];
  filas.forEach((f, i) => text(f, px, py + 40 + i * 24, width - px - 10, 40));
  if (v0 > c.vEsc) { fill('#ffd166'); text('⚠ ¡Tu salto (' + v0.toFixed(1) + ' m/s) supera la velocidad de escape! El astronauta no volvería a caer.', px, py + 175, width - px - 10, 80); }
  if (t > DUR_MAX) { fill(150); textSize(11); text('Animación y sonido acelerados (salto real: ' + fmtT(t) + ').', px, height - 15); }
  cursor(ARROW);
}
let detalleFaseAnt = 1;

/* =========================== SONIFICACIÓN ============================ */
let ctx = null, sonidoOn = false, fuente = null;
const F_MIN = 180;
const F_MAX = 1200;

const frecuenciaBase = g =>
  F_MIN * Math.pow(
    F_MAX / F_MIN,
    (Math.log(G_MAX) - Math.log(g)) /
    (Math.log(G_MAX) - Math.log(G_MIN))
  );
  
function detener() { if (fuente) { try { fuente.stop(); } catch (e) {} fuente = null; } }

function reproducir(c) {
  if (!sonidoOn || !ctx) return;
  detener();
  const url = ASSETS[c.nombre].sonido;
  if (url) { 
    const a = new Audio(url); a.play(); fuente = { stop: () => a.pause() }; return;
  }
  const dur = min(tiempo(c), DUR_MAX), f = frecuenciaBase(c.g), t0 = ctx.currentTime;
  const osc = ctx.createOscillator(), filtro = ctx.createBiquadFilter(), amp = ctx.createGain();
  osc.type = c.tipo === 'rocoso' ? 'triangle' : c.tipo === 'gigante' ? 'sine' : 'sawtooth';
  filtro.type = 'lowpass'; filtro.frequency.value = c.tipo === 'menor' ? f * 3 : 8000;  
  
  const f1 = f * (1 + 0.8 * escalaLog(altura(c)));
  osc.frequency.setValueAtTime(f, t0);
  osc.frequency.linearRampToValueAtTime(f1, t0 + dur / 2);
  osc.frequency.linearRampToValueAtTime(f, t0 + dur);
  
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.linearRampToValueAtTime(0.25, t0 + Math.min(0.03, dur / 4));
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  
  osc.connect(filtro).connect(amp).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.05); fuente = osc;
}

/* ============================ INTERACCIÓN ============================ */
function mousePressed() {
  if (z !== 0 || zObj !== 0 || mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  const pos = posiciones();
  const i = cuerpoEn(mouseX, mouseY, pos);
  if (i < 0) return;
  sel = CUERPOS[i]; 
  zObj = 1; 
  detalleFaseAnt = 1; 
  faseSaltoDetalle = 0;   
  document.getElementById('btn-volver').hidden = false;
  reproducir(sel);
}

function iniciarUI() {
  const sl = document.getElementById('v0'), out = document.getElementById('v0-out');
  const bs = document.getElementById('btn-sonido'), bm = document.getElementById('btn-modo'); // Agregado botón de modo
  
  sl.addEventListener('input', () => { 
    v0 = parseFloat(sl.value); 
    out.textContent = v0.toFixed(1); 
  });
  
  bs.addEventListener('click', () => { 
    sonidoOn = !sonidoOn;
    if (sonidoOn) { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); if (sel && zObj) reproducir(sel); }
    else detener();
    bs.classList.toggle('on', sonidoOn);
    bs.textContent = sonidoOn ? '🔊 Sonido activo (pulsa para detener)' : '🔇 Sonido apagado (pulsa para activar)';
  });

  // Listener para el botón que intercambia las vistas
  if (bm) {
    bm.addEventListener('click', () => { 
      if (z !== 0) return;
      mObj = mObj ? 0 : 1;
      bm.textContent = mObj ? '🪐 Vista: órbitas (pulsa para alinear)' : '➖ Vista: en línea (pulsa para orbitar)';
    });
  }
  
  document.getElementById('btn-volver').addEventListener('click', () => { 
    zObj = 0; 
    detener(); 
    document.getElementById('btn-volver').hidden = true;
  });
}