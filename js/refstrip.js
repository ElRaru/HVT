/* ---------------- Franja de waveform de arriba ---------------- */
// Qué muestra la franja, por orden de prioridad:
//   1. la waveform de la referencia, si hay un video/audio cargado;
//   2. si no hay referencia, la waveform de lo que se ha grabado, colocada sobre
//      el mismo eje temporal que la línea de tiempo de abajo;
//   3. si no hay nada, un texto que explica qué hacer.
//
// La franja y la línea de tiempo comparten eje: mismo total y mismos márgenes de
// 14px a cada lado, así que un mismo segundo cae en el mismo píxel en las dos.

const STRIP_INSET = 14;
function stripX(pct, width){ return STRIP_INSET + (width - STRIP_INSET*2) * pct; }
function stripSpan(pct, width){ return Math.max(1, (width - STRIP_INSET*2) * pct); }

async function loadRefStripWaveform(file){
  stripSig = null;          // fuerza el redibujado con la nueva referencia
  const empty = document.getElementById('refStripEmpty');
  empty.textContent = 'Generando waveform…';
  empty.style.display = 'flex';
  await new Promise(r => requestAnimationFrame(r)); // asegurar layout real antes de medir
  try{
    const buf = await file.arrayBuffer();
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(buf);
    drawRefStripWaveform(audioBuffer);
    ctx.close();
    empty.style.display = 'none';
  }catch(err){
    console.warn('No se pudo decodificar el audio para la waveform', err);
    empty.textContent = 'No se pudo generar la waveform (formato no soportado por el navegador)';
    empty.style.display = 'flex';
  }
}

// Tamaño real del lienzo, ya en píxeles de dispositivo.
function sizeStripCanvas(){
  const canvas = document.getElementById('refStripCanvas');
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  return canvas;
}

function drawRefStripWaveform(audioBuffer){
  lastRefAudioBuffer = audioBuffer;
  const canvas = document.getElementById('refStripCanvas');
  if(!canvas || document.getElementById('refStrip').classList.contains('collapsed')) return;
  sizeStripCanvas();
  const data = audioBuffer.getChannelData(0);
  const step = Math.max(1, Math.ceil(data.length / canvas.width));
  const amp = canvas.height/2;
  const cctx = canvas.getContext('2d');
  cctx.clearRect(0,0,canvas.width,canvas.height);
  cctx.fillStyle = '#3a8bd4';
  for(let i=0;i<canvas.width;i++){
    let min=1.0, max=-1.0;
    for(let j=0;j<step;j++){
      const datum = data[i*step+j];
      if(datum===undefined) continue;
      if(datum<min) min=datum;
      if(datum>max) max=datum;
    }
    const h = Math.max(1,(max-min)*amp);
    cctx.fillRect(i, amp - (max*amp), 1, h);
  }
}

/* ---------------- Waveform de lo grabado, cuando no hay referencia ---------------- */
// Los AudioBuffer decodificados se cachean por id de toma. Son solo para pintar:
// no se guardan en el proyecto (un .hvt lleva el audio en base64, no el PCM).
let takeBufferCache = new Map();
let stripToken = 0;          // invalida respuestas async que ya no sirven
let stripSig = null;

function takeStartSec(cue){ return tsToSeconds(cue.start) || 0; }

// Todas las tomas con sitio en el eje temporal, en orden.
function stripItems(){
  const out = [];
  cues.forEach(cue=>{
    const start = takeStartSec(cue);
    (cue.takes || []).forEach((take, i)=>{
      const dur = take.duration || (tsToSeconds(cue.end) - start) || 0;
      out.push({ cue:cue, take:take, start:start, dur:Math.max(dur, 0.15), index:i });
    });
  });
  return out.sort((a,b)=> a.start - b.start);
}

function decodeTake(it){
  if(takeBufferCache.has(it.take.id)) return Promise.resolve(takeBufferCache.get(it.take.id));
  if(!it.take.blob) return Promise.resolve(null);
  return it.take.blob.arrayBuffer()
    .then(buf => new (window.AudioContext||window.webkitAudioContext)().decodeAudioData(buf))
    .then(decoded=>{ takeBufferCache.set(it.take.id, decoded); return decoded; })
    .catch(()=> null);   // un webm que el navegador no decodifica no debe vaciar la franja
}

function paintTakes(items, decoded){
  const canvas = sizeStripCanvas();
  const cctx = canvas.getContext('2d');
  cctx.clearRect(0,0,canvas.width,canvas.height);
  const total = getTimelineTotal();
  const amp = canvas.height/2;
  const W = canvas.width / devicePixelRatio;
  const colors = ['#d4553a','#3a8bd4','#3fae6a','#c9a23a','#9a5fd0','#d05f9a'];
  let slot = 0;

  items.forEach(it=>{
    const x = stripX(it.start / total, W) * devicePixelRatio;
    const w = stripSpan(it.dur / total, W) * devicePixelRatio;
    const color = colors[slot++ % colors.length];
    const buf = decoded[it.take.id];
    cctx.fillStyle = color;
    if(buf){
      // Envolvente min/max por columna, como en la referencia.
      const data = buf.getChannelData(0);
      const step = Math.max(1, Math.ceil(data.length / w));
      for(let i=0;i<w;i++){
        let min=1.0, max=-1.0;
        for(let j=0;j<step;j++){
          const datum = data[i*step+j];
          if(datum===undefined) continue;
          if(datum<min) min=datum;
          if(datum>max) max=datum;
        }
        const h = Math.max(1,(max-min)*amp);
        cctx.fillRect(x+i, amp - (max*amp), 1, h);
      }
    }else{
      // Sin decodificar: un bloque sordo, pero placed y con su duración. Mejor
      // que no dibujar nada, porque al menos se ve qué se ha grabado y cuándo.
      cctx.globalAlpha = .35;
      cctx.fillRect(x, amp*0.35, w, amp*1.3);
      cctx.globalAlpha = 1;
    }
  });
}

function drawTakesWaveform(){
  const empty = document.getElementById('refStripEmpty');
  const items = stripItems();
  if(!items.length){
    sizeStripCanvas().getContext('2d').clearRect(0,0,9999,9999);
    empty.textContent = 'Sin referencia — al grabar, aquí aparece la waveform de tu audio; al cargar un video, aparece la del video.';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  const token = ++stripToken;
  Promise.all(items.map(it => decodeTake(it).then(buf => [it.take.id, buf])))
    .then(pairs=>{
      if(token !== stripToken) return;          // hubo otra petición mientras tanto
      if(document.getElementById('refStrip').classList.contains('collapsed')) return;
      const decoded = {};
      pairs.forEach(([id, buf])=>{ if(buf) decoded[id] = buf; });
      paintTakes(items, decoded);
    });
}

// Redibuja solo cuando cambia lo que hay que pintar: el waveform se decodifica
// async y no puede ir en cada render.
function renderRefStrip(){
  const sig = lastRefAudioBuffer ? 'ref'
    : stripItems().map(it => it.take.id + '@' + it.start.toFixed(2) + '+' + it.dur.toFixed(2)).join('|');
  if(sig === stripSig) return;
  stripSig = sig;
  if(lastRefAudioBuffer) drawRefStripWaveform(lastRefAudioBuffer);
  else drawTakesWaveform();
}

function updateRefStripPlayhead(){
  const ph = document.getElementById('refStripPlayhead');
  const secs = playheadSeconds();
  if(!secs){ ph.style.left = '0px'; return; }
  const total = getTimelineTotal();
  // La fracción directamente: pasar por un porcentaje (x100 y luego /100) pierde
  // precision y la cabecera no cae justo en el segundo que le toca.
  const frac = Math.min(secs / total, 1);
  // Mismo margen que la línea de tiempo, para que caigan en el mismo píxel.
  ph.style.left = `calc(${STRIP_INSET}px + (100% - ${STRIP_INSET*2}px) * ${frac})`;
}

/* ---------------- Plegar la franja ---------------- */
// El estado vive en uiState, igual que el panel inferior, para que se guarde con
// el proyecto y no se desincronice con el render.
let lastExpandedHeight = 56;

function applyRefStripState(){
  const strip = document.getElementById('refStrip');
  const btn = document.getElementById('btnToggleStrip');
  if(!strip) return;
  if(uiState.refStripCollapsed){
    strip.classList.add('collapsed');
  }else{
    if(strip.classList.contains('collapsed')) strip.style.height = lastExpandedHeight + 'px';
    strip.classList.remove('collapsed');
  }
  if(btn){
    btn.textContent = uiState.refStripCollapsed ? '▴' : '▾';
    btn.title = uiState.refStripCollapsed ? 'Desplegar la waveform' : 'Plegar la waveform';
    btn.setAttribute('aria-expanded', uiState.refStripCollapsed ? 'false' : 'true');
  }
}

function toggleRefStrip(){
  const strip = document.getElementById('refStrip');
  if(!uiState.refStripCollapsed) lastExpandedHeight = strip.offsetHeight || lastExpandedHeight;
  uiState.refStripCollapsed = !uiState.refStripCollapsed;
  applyRefStripState();
  if(!uiState.refStripCollapsed) requestAnimationFrame(renderRefStrip);
  scheduleAutosave();
}

/* Tirador: arrastrar para redimensionar, doble clic para ocultar/mostrar */
(function setupRefStripHandle(){
  const strip = document.getElementById('refStrip');
  const handle = document.getElementById('refStripHandle');
  let dragging = false, startY = 0, startH = 0;

  handle.addEventListener('mousedown', (e)=>{
    if(strip.classList.contains('collapsed')) return;
    dragging = true; startY = e.clientY; startH = strip.offsetHeight;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    const newH = Math.max(24, Math.min(240, startH + (e.clientY - startY)));
    strip.style.height = newH + 'px';
    lastExpandedHeight = newH;
  });
  window.addEventListener('mouseup', ()=>{
    if(!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    renderRefStrip();
  });
  handle.addEventListener('dblclick', toggleRefStrip);
})();
