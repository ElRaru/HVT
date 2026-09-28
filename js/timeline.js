/* ---------------- Elección de qué suena ---------------- */
// El transporte no está atado al video de referencia. Si no hay ninguno, manda
// la toma elegida de la línea activa, de modo que se puede escuchar lo grabado
// sin haber cargado ningún video. El <audio> se reutiliza siempre: antes cada
// clic en un bloque creaba un Audio() nuevo que el botón Detener no podía parar.
let takeAudioEl = null;
let takeAudioKey = null;
// Estado del recorrido (2.1). Se declara aquí arriba, y no junto al resto de sus
// funciones, porque la cabecera de reproducción ya lo consulta: leer una variable
// let antes de su declaración es un error, no un "false".
let walk = null;    // { items, i, times, timer, restante, paused }
let phWait = null;  // el silencio entre tomas: la cabecera avanza aunque no suene

// Toma que debe sonar para una línea: la marcada como elegida, y si no hay
// ninguna, la última grabada.
function takeToPlayFor(cue){
  if(!cue || !cue.takes || !cue.takes.length) return null;
  const sel = cue.selectedTake && cue.takes.find(t => t.id === cue.selectedTake);
  return sel || cue.takes[cue.takes.length - 1];
}

// La línea activa con la toma que le tocaría sonar, o null.
function activeCueWithTake(){
  const cue = cues.find(c => c.id === activeCueId);
  const take = takeToPlayFor(cue);
  return take ? { cue:cue, take:take } : null;
}

// Prepara (o reutiliza) el <audio> de una toma concreta.
function audioForTake(cue, take){
  if(!take) return null;
  const key = cue.id + '/' + take.id;
  if(takeAudioEl && takeAudioKey === key) return takeAudioEl;
  if(!takeAudioEl){
    takeAudioEl = new Audio();
    // Al acabar hay que dejar la cabecera fija en el final, no congelada donde
    // el rAF la dejó: sin esto se queda a medio camino para siempre. Y si hay un
    // recorrido en marcha, este 'ended' es el que dice "pasa a la siguiente".
    takeAudioEl.addEventListener('ended', ()=>{ updatePlayhead(); if(walk) walkOnEnded(); });
  }
  takeAudioKey = key;
  takeAudioEl.src = take.url || '';
  takeAudioEl.currentTime = 0;
  return takeAudioEl;
}

function playTake(cue, take){
  const el = audioForTake(cue, take);
  if(!el) return null;
  el.play();
  return el;
}

// Lo que el transporte gobierna: la referencia si está cargada; si no, la toma
// de la línea activa. Devuelve null si no hay nada que reproducir.
function transportTarget(){
  if(refMediaEl) return refMediaEl;
  const pair = activeCueWithTake();
  return pair ? audioForTake(pair.cue, pair.take) : null;
}

// Segundos dentro del timeline global. Una toma suena desde 0, pero en la línea
// de tiempo empieza en el timestamp de su línea, así que se le suma ese offset.
function playheadSeconds(){
  if(phWait) return Math.min(phWait.to, phWait.from + (Date.now()-phWait.t0)/1000);
  if(!takeAudioEl) return refMediaEl ? (refMediaEl.currentTime || 0) : 0;
  const cue = cues.find(c => (c.takes || []).some(t => c.id + '/' + t.id === takeAudioKey));
  if(!cue) return refMediaEl ? (refMediaEl.currentTime || 0) : 0;
  // En el recorrido manda la toma, aunque haya video de referencia cargado: la
  // referencia no suena, y la cabecera tiene que ir donde va el oído.
  if(walk && !takeAudioEl.paused && !takeAudioEl.ended) return (tsToSeconds(cue.start) || 0) + (takeAudioEl.currentTime || 0);
  if(refMediaEl) return refMediaEl.currentTime || 0;
  return (tsToSeconds(cue.start) || 0) + (takeAudioEl.currentTime || 0);
}

function stopTakeAudio(){
  if(!takeAudioEl) return;
  takeAudioEl.pause();
  takeAudioEl.currentTime = 0;
}

/* ---------------- Transporte ---------------- */
document.getElementById('tlPlay').onclick = ()=>{
  // En pausa a mitad de recorrido, ▶ sigue por donde iba en vez de empezar de nuevo.
  if(walk && walk.paused){ walkResume(); return; }
  if(walk) return; // ya está sonando
  if(recorrerOn() && startWalk()) return;
  const target = transportTarget();
  if(!target){
    alert('No hay nada que reproducir todavía.\n\n'
        + 'Opciones: carga un video o audio desde "Fuentes" para reproducir la referencia, '
        + 'graba alguna toma — el transporte reproducirá la toma elegida de la línea activa —, '
        + 'o pulsa "Recorrer" para escuchar las tomas de todas las líneas seguidas.');
    return;
  }
  applySpeed();
  target.play();
  // El bucle de la cabecera solo lo arrancaba el <video> con su evento 'play';
  // sin esto, ▶ sobre una toma no movía nada.
  startPlayheadLoop();
};
document.getElementById('tlPause').onclick = ()=>{
  if(refMediaEl) refMediaEl.pause();
  if(walk){ walkPause(); return; }
  if(takeAudioEl) takeAudioEl.pause();
};
document.getElementById('tlStop').onclick = ()=>{
  walkStop();
  if(refMediaEl){ refMediaEl.pause(); refMediaEl.currentTime = 0; }
  stopTakeAudio();
  updatePlayhead();
};
document.getElementById('tlPrev').onclick = ()=> walkJump(-1);
document.getElementById('tlNext').onclick = ()=> walkJump(1);
document.getElementById('tlWalk').onclick = (e)=>{
  const on = !recorrerOn();
  e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false');
  e.currentTarget.classList.toggle('on', on);
  if(on) setStatus('Recorrido listo. Pulsa ▶ y sonarán las tomas de todas las líneas, una detrás de otra.');
  else walkStop();
};
document.getElementById('tlSpeed').onchange = applySpeed;

// timeupdate del navegador solo dispara ~4 veces por segundo y de forma irregular —
// eso es lo que se veía "a saltos". Mientras se reproduce, usamos requestAnimationFrame
// (hasta 60 veces por segundo) para que la línea se mueva de forma realmente fluida.
let phRafId = null;
function startPlayheadLoop(){
  cancelAnimationFrame(phRafId);
  function step(){
    updatePlayhead();
    // En el silencio entre tomas no hay elemento de audio sonando, así que el
    // bucle se moriría en el primer frame y la cabecera se quedaría clavada.
    if(phWait){ phRafId = requestAnimationFrame(step); return; }
    const t = transportTarget();
    if(t && !t.paused && !t.ended){
      phRafId = requestAnimationFrame(step);
    }
  }
  step();
}
function stopPlayheadLoop(){
  cancelAnimationFrame(phRafId);
  updatePlayhead(); // fijar la posición final exacta
}

function updatePlayhead(){
  const ph = document.getElementById('timelinePlayhead');
  const secs = playheadSeconds();
  if(!secs){
    ph.style.left = '0px';
  }
  else {
    const total = getTimelineTotal();
    const pct = Math.min(secs / total, 1) * 100;
    ph.style.left = `calc(14px + (100% - 28px) * ${pct/100})`;
  }
  updateRefStripPlayhead();
}

/* ---------------- 2.1 · Recorrido continuo ---------------- */
// ▶ con "Recorrer" encendido suena la toma de cada línea, una detrás de otra, y
// la columna activa va siguiendo. Es el gesto de revisión: escuchar el diálogo
// entero del principio al final y parar en la línea que hay que repetir.

function recorrerOn(){ return document.getElementById('tlWalk').getAttribute('aria-pressed') === 'true'; }
function tlSyncOn(){ return document.getElementById('tlSync').checked; }
function walkSpeed(){
  const v = parseFloat(document.getElementById('tlSpeed').value);
  return (v > 0 && isFinite(v)) ? v : 1;
}
function repeatTotal(){
  const v = document.getElementById('tlRepeat').value;
  return v === 'inf' ? Infinity : (parseInt(v, 10) || 1);
}

// Las líneas que suenan, en orden de tiempo. Las que no tienen toma no entran:
// en un recorrido no hay nada que escuchar, y pararse en silencio sin avisar es
// peor que saltárselas.
function walkItems(){
  return cues
    .filter(c => !!takeToPlayFor(c))
    .sort((a,b) => (tsToSeconds(a.start) || 0) - (tsToSeconds(b.start) || 0));
}

function shouldRepeat(times, total){
  return times + 1 < total;
}

// Cuánto se calla antes de la siguiente línea. De normal, nada: encadenar las
// tomas sin dead air es lo que hace falta para revisar. Con "respetar timecodes"
// se espera el hueco, que es como suena la mezcla final.
function silenceWait(prevFin, nextStart, sync){
  if(!sync) return 0;
  return Math.max(0, nextStart - prevFin);
}

// Dónde cae una línea dentro de la lista del recorrido. Si no tiene toma,
// devuelve el sitio más cercano por el que seguir, en vez de no encontrar nada.
function walkNearest(items, cue){
  const i = items.findIndex(c => c.id === cue.id);
  if(i >= 0) return i;
  const t = tsToSeconds(cue.start);
  if(t === null) return -1;
  for(let k = 0; k < items.length; k++) if((tsToSeconds(items[k].start) || 0) >= t) return k;
  return -1;
}

// A menos de 1× la voz tiene que seguir poniendo su altura: sin esto, 0,5× suena
// a dibujo animado y no sirve para juzgar cómo se pronuncia una frase.
function applySpeed(){
  const el = takeAudioEl || refMediaEl;
  if(!el) return;
  el.playbackRate = walkSpeed();
  if('preservesPitch' in el) el.preservesPitch = true;
  else if('mozPreservesPitch' in el) el.mozPreservesPitch = true;
  else if('webkitPreservesPitch' in el) el.webkitPreservesPitch = true;
}

function walkPlay(cue, take){
  const el = audioForTake(cue, take);
  if(!el) return false;
  setActiveLine(cue.id, true); // el recorrido no es una edición del proyecto
  el.currentTime = 0;
  applySpeed();
  el.play();
  startPlayheadLoop();
  return true;
}

function startWalk(){
  const items = walkItems();
  if(!items.length) return false;
  stopTakeAudio();
  if(refMediaEl) refMediaEl.pause(); // el recorrido manda: la referencia se calla
  walk = { items: items, i: 0, times: 0, timer: null, restante: 0, paused: false };
  phWait = null;
  if(!walkPlay(items[0], takeToPlayFor(items[0]))){ walk = null; return false; }
  setStatus('Recorriendo ' + items.length + (items.length === 1 ? ' línea.' : ' líneas.'));
  return true;
}

function walkStop(){
  if(!walk && !phWait) return;
  if(walk) clearTimeout(walk.timer);
  phWait = null;
  if(takeAudioEl) takeAudioEl.pause();
  stopPlayheadLoop();
  walk = null;
}

function walkPause(){
  if(!walk) return;
  clearTimeout(walk.timer); walk.timer = null;
  if(phWait){
    // Queda apuntado cuánto faltaba de silencio, para seguir el callado al reanudar.
    walk.restante = Math.max(0, (phWait.to - playheadSeconds()) * 1000);
    phWait = null;
  }
  if(takeAudioEl) takeAudioEl.pause();
  walk.paused = true;
  stopPlayheadLoop();
  setStatus('Recorrido en pausa.');
}

function walkResume(){
  if(!walk || !walk.paused) return false;
  const cue = walk.items[walk.i];
  if(!cue) return false;
  walk.paused = false;
  if(walk.restante > 0){
    const hasta = tsToSeconds(cue.start) || 0;
    phWait = { from: Math.min(hasta, playheadSeconds()), to: hasta, t0: Date.now() };
    startPlayheadLoop();
    walk.timer = setTimeout(()=>{ phWait = null; walk.restante = 0; walkPlay(cue, takeToPlayFor(cue)); }, walk.restante);
    return true;
  }
  walk.times++;
  return walkPlay(cue, takeToPlayFor(cue));
}

function walkOnEnded(){
  if(!walk || walk.paused) return;
  const cue = walk.items[walk.i];
  if(!cue) return walkStop();
  if(shouldRepeat(walk.times, repeatTotal())){
    walk.times++;
    const el = audioForTake(cue, takeToPlayFor(cue));
    if(!el) return walkStop();
    el.currentTime = 0;
    applySpeed();
    el.play();
    startPlayheadLoop();
    return;
  }
  walkNext();
}

function walkNext(){
  if(!walk) return;
  const prevFin = playheadSeconds(); // dónde se ha quedado la cabecera
  walk.i++;
  if(walk.i >= walk.items.length) return walkStop();
  const cue = walk.items[walk.i];
  walk.times = 0;
  const hasta = tsToSeconds(cue.start) || 0;
  const espera = silenceWait(prevFin, hasta, tlSyncOn());
  if(espera > 0.01){
    phWait = { from: prevFin, to: hasta, t0: Date.now() };
    startPlayheadLoop();
    walk.timer = setTimeout(()=>{ phWait = null; walkPlay(cue, takeToPlayFor(cue)); }, espera * 1000);
  }else{
    walkPlay(cue, takeToPlayFor(cue));
  }
}

// |◀ y ▶|: saltar a la línea anterior o siguiente que tenga toma. Si la línea
// activa no tiene toma, se va a la más cercana por tiempo en esa dirección: al
// revisar, lo que se busca es la toma de al lado que exista, no la línea de al
// lado aunque no tenga nada grabado.
function walkJump(delta){
  const items = walkItems();
  if(!items.length){ setStatus('Todavía no hay ninguna línea con toma.'); return; }
  const activa = cues.find(c => c.id === activeCueId);
  let i = activa ? walkNearest(items, activa) : -1;
  if(i < 0) i = delta > 0 ? 0 : items.length - 1;
  else i += delta;
  i = Math.max(0, Math.min(i, items.length - 1));
  stopTakeAudio();
  if(refMediaEl) refMediaEl.pause();
  walk = { items: items, i: i, times: 0, timer: null, restante: 0, paused: false };
  phWait = null;
  walkPlay(items[i], takeToPlayFor(items[i]));
}

/* ---------------- #3: clic en el timestamp de un diálogo = saltar el audio ahí ---------------- */
function seekToCue(cue){
  const start = tsToSeconds(cue.start);
  if(start===null) return;
  if(!refMediaEl){
    // Sin referencia no hay a qué saltar: lo que se puede hacer es oír esa línea.
    const take = takeToPlayFor(cue);
    if(take) playTake(cue, take);
    return;
  }
  refMediaEl.currentTime = Math.min(start, refMediaEl.duration || start);
  updatePlayhead();
};

/* ---------------- #2: arrastrar/clic en la franja o la línea de tiempo para reposicionar ---------------- */
function setupScrub(containerEl, getContentRect){
  let dragging = false;
  function seekFromEvent(e){
    if(!refMediaEl || !refMediaEl.duration) return;
    const rect = getContentRect();
    let pct = (e.clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    refMediaEl.currentTime = pct * refMediaEl.duration;
    updatePlayhead();
  }
  containerEl.addEventListener('mousedown', (e)=>{
    if(e.target.closest('.dlgMarker, .trackStar, .trackBlock')) return;
    if(markerDragState && markerDragState.active) return;
    dragging = true;
    seekFromEvent(e);
  });
  window.addEventListener('mousemove', (e)=>{
    if(dragging && !(markerDragState && markerDragState.active)) seekFromEvent(e);
  });
  window.addEventListener('mouseup', ()=>{ if(!(markerDragState && markerDragState.active)) dragging = false; });
}
setupScrub(document.getElementById('refStrip'), ()=> document.getElementById('refStrip').getBoundingClientRect());
setupScrub(document.getElementById('timelineScroll'), ()=>{
  // La zona útil excluye los 14px de margen de cada lado, igual que ruler/marcadores/playhead
  const r = document.getElementById('timelineScroll').getBoundingClientRect();
  return { left: r.left + 14, width: r.width - 28 };
});

/* ---------------- #4: arrastrar un marcador de diálogo reubica esa línea en el tiempo ---------------- */

function wireMarkerDrag(markerEl, cue){
  const grab = markerEl.querySelector('.grabZone');
  grab.addEventListener('mousedown', (e)=>{
    e.stopPropagation();
    markerDragState.active = true; markerDragState.moved = false;
    markerDragState.markerEl = markerEl; markerDragState.cue = cue;
    markerDragState.startX = e.clientX;
    markerDragState.startSec = tsToSeconds(cue.start) || 0;
    const endSec = tsToSeconds(cue.end);
    markerDragState.dur = (endSec!==null) ? Math.max(0, endSec - markerDragState.startSec) : 0;
    markerDragState.containerRect = document.getElementById('timelineMarkers').getBoundingClientRect();
    markerEl.classList.add('dragging');
  });
}

// Handlers globales de drag — se registran UNA sola vez en window.
window.addEventListener('mousemove', (e)=>{
  if(!markerDragState.active) return;
  markerDragState.moved = true;
  const { markerEl, cue, startX, startSec, dur, containerRect } = markerDragState;
  const totalMax = getTimelineTotal();
  const deltaSec = ((e.clientX - startX) / containerRect.width) * totalMax;
  const newStart = Math.max(0, startSec + deltaSec);
  const pct = (newStart/totalMax)*100;
  markerEl.style.left = pct+'%';
  markerEl.title = secondsToTs(newStart) + ' — ' + (cue.character||'(sin personaje)');
});

window.addEventListener('mouseup', (e)=>{
  if(!markerDragState.active) return;
  const { markerEl, cue, startX, startSec, dur, containerRect, moved } = markerDragState;
  markerDragState.active = false;
  markerEl.classList.remove('dragging');
  if(!moved){
    seekToCue(cue);
    setActiveLine(cue.id);
    return;
  }
  const totalMax = getTimelineTotal();
  const deltaSec = ((e.clientX - startX) / containerRect.width) * totalMax;
  const newStart = Math.max(0, startSec + deltaSec);
  const newEnd = newStart + dur;
  cue.start = secondsToTs(newStart);
  cue.end = secondsToTs(newEnd);
  render();
});

/* ---------------- Línea de tiempo (revisión + marcadores de diálogo arrastrables) ---------------- */

const TRACK_COLORS = ['#d4553a','#3a8bd4','#3fae6a','#c9a23a','#9a5fd0','#d05f9a'];

// Duración total de referencia para escalar la regla: la mayor entre timestamps de
// diálogo, tomas grabadas (inicio de su línea + su propia duración) y el media cargado.
function getTimelineTotal(){
  const dlgTimes = cues.flatMap(c => [tsToSeconds(c.start), tsToSeconds(c.end)]).filter(v=>v!==null);
  const takeEnds = cues.flatMap(c=>{
    const start = tsToSeconds(c.start) || 0;
    return c.takes.map(t => start + (t.duration || (tsToSeconds(c.end)-tsToSeconds(c.start)) || 0));
  });
  const mediaDur = (refMediaEl && refMediaEl.duration && isFinite(refMediaEl.duration)) ? [refMediaEl.duration] : [];
  return Math.max(...dlgTimes, ...takeEnds, ...mediaDur, 1);
}

function renderTimeline(){
  const ruler = document.getElementById('timelineRuler');
  const markers = document.getElementById('timelineMarkers');
  const tracks = document.getElementById('timelineTracks');

  const anyTakes = cues.some(c => c.takes.length>0);
  const anyDlg = cues.some(c => tsToSeconds(c.start)!==null);
  if(!anyTakes && !anyDlg){
    markers.innerHTML = '';
    tracks.innerHTML = '<div id="timelineEmpty">Sin diálogos ni tomas todavía. Carga un SRT y graba audio para que aparezcan aquí como marcadores y pistas.</div>';
    return;
  }
  const totalMax = getTimelineTotal();

  // Regla de tiempo
  const ticks = 8;
  ruler.querySelectorAll('span').forEach(s=>s.remove());
  for(let i=0;i<=ticks;i++){
    const t = (totalMax/ticks)*i;
    const pct = (t/totalMax)*100;
    const mm = Math.floor(t/60), ss = Math.floor(t%60);
    const span = document.createElement('span');
    span.style.left = pct+'%';
    span.textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    ruler.appendChild(span);
  }

  // Marcadores de diálogo — arrastrables: mover uno reposiciona el timestamp real
  // de esa línea (start y end se desplazan juntos, conservando su duración).
  markers.innerHTML = '';
  cues.forEach(cue=>{
    const start = tsToSeconds(cue.start);
    if(start===null) return;
    const pct = (start/totalMax)*100;
    const m = document.createElement('div');
    m.className = 'dlgMarker';
    m.style.left = pct+'%';
    m.innerHTML = `<span class="lbl">${esc(cue.character||'—')}</span><div class="grabZone"></div>`;
    m.title = `${cue.start} — ${cue.character||'(sin personaje)'} — arrastra para reubicar, clic para saltar el audio aquí`;
    wireMarkerDrag(m, cue);
    markers.appendChild(m);
  });

  // Pistas: una por cada TOMA INDIVIDUAL (no agrupadas por número compartido)
  tracks.innerHTML = '';
  let trackIndex = 0;
  cues.forEach(cue=>{
    const start = tsToSeconds(cue.start);
    cue.takes.forEach(take=>{
      const color = TRACK_COLORS[trackIndex % TRACK_COLORS.length];
      trackIndex++;
      const track = document.createElement('div');
      track.className = 'track';
      const isSel = cue.selectedTake === take.id;
      track.innerHTML = `
        <button class="trackStar ${isSel?'on':''}" title="Marcar como toma elegida para esta línea">${isSel?'★':'☆'}</button>
        <div class="trackLabel">${esc(cue.character||'—')} · ${take.id}</div>
        <div class="trackLane"></div>`;
      const lane = track.querySelector('.trackLane');
      if(start!==null){
        const dur = take.duration || (tsToSeconds(cue.end)-start) || 1;
        const left = (start/totalMax)*100, width = Math.max((dur/totalMax)*100, 0.6);
        const block = document.createElement('div');
        block.className = 'trackBlock' + (isSel ? ' selected' : '');
        block.style.left = left+'%'; block.style.width = width+'%'; block.style.background = color;
        block.title = `${cue.character||'(sin personaje)'} — ${take.id}${isSel?' (elegida)':''} — inicia en ${cue.start}`;
        block.textContent = take.id;
        block.onclick = ()=>{ playTake(cue, take); setActiveLine(cue.id); startPlayheadLoop(); };
        lane.appendChild(block);
      }
      track.querySelector('.trackStar').onclick = ()=>{
        cue.selectedTake = take.id;
        renderTimeline();
      };
      tracks.appendChild(track);
    });
  });
  if(trackIndex === 0){
    tracks.innerHTML = '<div id="timelineEmpty">Sin tomas grabadas todavía — los marcadores de diálogo ya están arriba como referencia.</div>';
  }
  updatePlayhead();
}
