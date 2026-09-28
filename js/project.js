/* ---------------- Persistencia de proyectos ---------------- */
// Un proyecto .hvt es un JSON con todo el estado recuperable: columnas, líneas,
// textos, emociones, idioma y las grabaciones incrustadas en base64.
//
// Antes esto no existía: solo había un export a Markdown que no se podía volver
// a abrir, y las grabaciones eran blob URLs que morían al recargar la página.

const PROJECT_FORMAT = 'hvt';
const PROJECT_VERSION = 1;
const AUTOSAVE_KEY = 'hvt.autosave.v1';
const AUTOSAVE_DELAY = 700;

let projectDirty = false;   // hay cambios sin guardar en disco
// Cuántas tomas del proyecto abierto se sabe que existen pero sin su audio.
// Sale de abrir un .hvt guardado en modo texto: ahí el archivo guarda que la
// línea tenía una toma y cuánto duraba, pero no los bytes. Sin esto, el proyecto
// abriría callado y sin explicación.
let projectTomasSinAudio = 0;
let autosaveTimer = null;
let autosaveBroken = false; // localStorage lleno o no disponible: avisar una vez

/* ---------------- Conversión de audio ---------------- */
function blobToDataUrl(blob){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> resolve(fr.result);
    fr.onerror = ()=> reject(fr.error || new Error('No se pudo leer la grabación'));
    fr.readAsDataURL(blob);
  });
}

function dataUrlToBlob(data){
  const comma = data.indexOf(',');
  const mime = (data.slice(0, comma).match(/:(.*?);/) || [,'application/octet-stream'])[1];
  const bin = atob(data.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function takeToData(take){
  return take.data || null;   // base64 cacheado; null si aún no se ha serializado
}

/* ---------------- Serializar ---------------- */
// includeAudio decide si se incrusta el base64. Por defecto NO: el autoguardado
// llama sin argumento y así nunca arrastra el audio cacheado a localStorage,
// que reventaría la cuota en cuanto el proyecto tiene una grabación larga.
function buildProjectData(includeAudio){
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    // Se escribe siempre, también cuando sí lleva audio. Al abrir, un archivo
    // viejo que no lo traiga se trata como si lo llevara, que es lo que pasaba
    // antes de que existiera el modo texto.
    audioOmitted: !includeAudio,
    lang: document.getElementById('langSel').value,
    ui: { bottomCollapsed: !!uiState.bottomCollapsed, refStripCollapsed: !!uiState.refStripCollapsed },
    sourceRef: {
      type: sourceRef.type, name: sourceRef.name,
      url: sourceRef.url, srtName: sourceRef.srtName
    },
    columns: columns.map(c=>({
      id:c.id, type:c.type, title:c.title,
      active:!!c.active, restoreIndex:c.restoreIndex, side:c.side,
      locked:isColLocked(c)
    })),
    cues: cues.map(c=>({
      id:c.id, start:c.start, end:c.end, character:c.character,
      text: Object.assign({}, c.text),
      emotion:c.emotion, selectedTake:c.selectedTake,
      takes: (c.takes||[]).map(t=>({ id:t.id, duration:t.duration, data: includeAudio ? takeToData(t) : null }))
    }))
  };
}

// Rellena el base64 de las grabaciones. Cachea el resultado en la toma para que
// un segundo guardado del mismo proyecto no vuelva a codificar el audio.
function attachAudio(data, onProgress){
  const jobs = [];
  data.cues.forEach(c => (c.takes||[]).forEach(t => {
    if(t.data) return;
    const live = findTake(c.id, t.id);
    if(live && live.blob) jobs.push({ take:live, slot:t });
  }));
  if(!jobs.length) return Promise.resolve(data);
  let done = 0;
  return Promise.all(jobs.map(j =>
    blobToDataUrl(j.take.blob)
      .then(d=>{ j.slot.data = d; j.take.data = d; })
      .catch(()=>{ j.slot.data = null; })
      .then(()=>{ done++; if(onProgress) onProgress(done, jobs.length); })
  )).then(()=> data);
}

function findTake(cueId, takeId){
  const cue = cues.find(c=>c.id===cueId);
  return cue ? cue.takes.find(t=>t.id===takeId) : null;
}

function projectAudioBytes(){
  let n = 0;
  cues.forEach(c=>(c.takes||[]).forEach(t=>{ if(t.blob) n += t.blob.size; }));
  return n;
}

/* ---------------- Aplicar un proyecto ---------------- */
function applyProject(data, opts){
  opts = opts || {};
  if(!data || typeof data !== 'object') throw new Error('El archivo está vacío o dañado.');
  if(data.format !== PROJECT_FORMAT) throw new Error('No es un proyecto HVT (falta la cabecera "format").');
  if(typeof data.version === 'number' && data.version > PROJECT_VERSION)
    throw new Error('El proyecto usa la versión ' + data.version + ' y esta app solo entiende hasta la ' + PROJECT_VERSION + '.');

  const sr = data.sourceRef || {};
  sourceRef = { type:sr.type||null, name:sr.name||null, url:sr.url||null, srtName:sr.srtName||null };

  // Columnas
  if(Array.isArray(data.columns) && data.columns.length){
    columns = data.columns.map(c=>{
      const type = COL_TYPES[c.type] ? c.type : 'rough';
      return {
        id: c.id, type,
        title: c.title || COL_TYPES[type].defaultTitle,
        active: !!c.active,
        restoreIndex: (typeof c.restoreIndex === 'number') ? c.restoreIndex : null,
        side: (c.side === 'left' || c.side === 'right') ? c.side : null,
        // Sin `locked` (proyectos viejos) cada tipo vuelve a su bloqueo por defecto.
        locked: (c.locked === undefined || c.locked === null) ? !!COL_TYPES[type].readonly : !!c.locked
      };
    });
  } else {
    columns = defaultColumns();
  }

  // Líneas
  cues = (Array.isArray(data.cues) ? data.cues : []).map(c=>({
    id: c.id, start: c.start||'', end: c.end||'', character: c.character||'',
    text: Object.assign({}, c.text || {}),
    emotion: c.emotion || null,
    selectedTake: c.selectedTake || null,
    takes: []
  }));

  // Grabaciones
  projectTomasSinAudio = 0;
  if(opts.audio !== false && Array.isArray(data.cues)){
    cues.forEach((cue, i)=>{
      const src = (data.cues[i].takes || []);
      // Una toma sin audio no se tira: se guarda como marcador con su duración.
      // Aquí está la diferencia entre "esta línea no tiene toma" y "esta línea
      // tenía una toma y este archivo no trae el sonido", y el proyecto lo nota:
      // el final de la línea de tiempo se calcula con la duración de las tomas,
      // así que si se descartaran, todo lo de detrás se movería hacia atrás.
      cue.takes = src.filter(t=> t && t.id).map(t=>{
        const dur = (typeof t.duration === 'number') ? t.duration : null;
        if(!t.data){
          projectTomasSinAudio++;
          return { id: t.id, duration: dur, data: null, blob: null, url: null, sinAudio: true };
        }
        const blob = dataUrlToBlob(t.data);
        return {
          id: t.id, duration: dur,
          data: t.data, blob: blob, url: URL.createObjectURL(blob)
        };
      });
    });
  }

  // Los contadores deben pasar por detrás de los ids cargados o los nuevos
  // elementos repetirían id y pisarían los existentes.
  cueCounter = 0;
  cues.forEach(c=>{ const n = /^c(\d+)$/.exec(c.id); if(n) cueCounter = Math.max(cueCounter, +n[1]); });
  colCounter = 0;
  columns.forEach(c=>{ const n = /^col_\w+_(\d+)$/.exec(c.id); if(n) colCounter = Math.max(colCounter, +n[1]); });

  const lang = document.getElementById('langSel');
  if(data.lang === 'en' || data.lang === 'es') lang.value = data.lang;

  // Cómo estaba plegado el panel. Un proyecto viejo no lo dice: se abre extendido.
  uiState.bottomCollapsed = !!(data.ui && data.ui.bottomCollapsed);
  uiState.refStripCollapsed = !!(data.ui && data.ui.refStripCollapsed);

  activeCueId = cues.length ? cues[0].id : null;
  colsSignature = null;          // forzar reconstrucción del esqueleto de columnas
  lastRefAudioBuffer = null;
  render();
  updateSourceUi();
  projectDirty = false;          // después de render(), que ya programa el autoguardado
  updateDirtyTitle();
}

/* ---------------- Guardar / abrir ---------------- */
function downloadJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 5000);
}

function projectFileName(suffix){
  const d = new Date();
  const p = n=> String(n).padStart(2, '0');
  return `hvt-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
    + (suffix ? '-' + suffix : '') + '.hvt';
}

// Cuánto pesa el proyecto tal y como se va a escribir. Blob.size mide bytes de
// verdad, que no es lo mismo que los caracteres del JSON: un acento son dos bytes
// y el texto de las líneas va lleno de ellos.
function projectDataSize(data){
  return new Blob([JSON.stringify(data, null, 2)]).size;
}

document.getElementById('btnSaveProject').onclick = ()=>{
  const bytes = projectAudioBytes();
  const mb = (bytes / 1048576).toFixed(1);
  if(bytes && !confirm(`El proyecto incluye ${mb} MB de grabaciones.\nEl archivo .hvt será más grande. ¿Guardar?`)) return;
  setStatus('Guardando proyecto…');
  attachAudio(buildProjectData(true), (done, total)=> setStatus(`Codificando grabaciones… ${done}/${total}`))
    .then(data=>{
      downloadJson(data, projectFileName());
      projectDirty = false;
      updateDirtyTitle();
      setStatus('Proyecto guardado' + (bytes ? ` (${mb} MB de audio)` : ''));
    })
    .catch(err=> setStatus('No se pudo guardar: ' + err.message));
};

// Modo texto: el mismo proyecto sin los bytes de audio. Sirve para pasarle el
// guion a quien lo revisa o maquetar el texto sin tirar por la borda el tamaño
// del archivo. El texto, los timecodes, los personajes y qué línea tenía toma
// se guardan igual; solo faltan los samples.
document.getElementById('btnSaveTextOnly').onclick = ()=>{
  const bytesAudio = projectAudioBytes();
  if(!bytesAudio){
    setStatus('Este proyecto no tiene grabaciones: el archivo ya es solo texto.');
    return;
  }
  const data = buildProjectData(false);
  setStatus('Preparando proyecto sin audio…');
  // El base64 que ya estuviera cacheado en las tomas no se toca: se mide lo que
  // pesaría con audio para poder comparar, que es el número que convence.
  const conAudio = projectDataSize(buildProjectData(true));
  const texto = projectDataSize(data);
  downloadJson(data, projectFileName('texto'));
  projectDirty = false;
  updateDirtyTitle();
  setStatus(`Guardado sin audio: ${mixMb(texto)} en vez de ${mixMb(conAudio)} `
    + `(${cues.reduce((n,c)=> n + (c.takes||[]).length, 0)} tomas sin su sonido)`);
};

document.getElementById('btnOpenProject').onclick = ()=> document.getElementById('projectFileInput').click();

document.getElementById('projectFileInput').onchange = (e)=>{
  const file = e.target.files[0];
  e.target.value = '';                       // permite reabrir el mismo archivo
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    let data;
    try{ data = JSON.parse(reader.result); }
    catch(err){ setStatus('El archivo no es un JSON válido: ' + err.message); return; }
    try{
      revokeTakeUrls();
      applyProject(data);
      scheduleAutosave();
      if(projectTomasSinAudio){
        setStatus('Proyecto abierto: ' + file.name + ' — ' + projectTomasSinAudio
          + ' toma(s) solo con su tiempo, este archivo no lleva el audio.');
      }else{
        setStatus('Proyecto abierto: ' + file.name);
      }
    }catch(err){
      setStatus('No se pudo abrir: ' + err.message);
    }
  };
  reader.onerror = ()=> setStatus('No se pudo leer el archivo.');
  reader.readAsText(file);
};

document.getElementById('btnNewProject').onclick = ()=>{
  if(!confirm('¿Empezar un proyecto nuevo?\nSe descartará lo que haya en pantalla.')) return;
  revokeTakeUrls();
  columns = defaultColumns();
  cues = [];
  activeCueId = null;
  cueCounter = 0;
  colCounter = 0;
  colsSignature = null;
  sourceRef = { type:null, name:null, url:null, srtName:null };
  projectTomasSinAudio = 0;
  updateSourceUi();
  clearAutosave();
  projectDirty = true;
  render();
  setStatus('Proyecto nuevo. Carga un SRT o crea líneas manualmente.');
};

function revokeTakeUrls(){
  cues.forEach(c=>(c.takes||[]).forEach(t=>{ if(t.url) URL.revokeObjectURL(t.url); }));
}

/* ---------------- Autoguardado ---------------- */
// Sin audio (localStorage es pequeño y no caben blobs), pero con TODO el texto:
// recargar la página ya no borra el trabajo.
function scheduleAutosave(){
  projectDirty = true;
  if(autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(flushAutosave, AUTOSAVE_DELAY);
}

function flushAutosave(){
  autosaveTimer = null;
  if(autosaveBroken) return;
  try{
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildProjectData()));
  }catch(err){
    autosaveBroken = true;
    setStatus('Autoguardado desactivado: no hay espacio suficiente en el navegador. Guarda el proyecto con "Guardar .hvt".');
  }
}

function readAutosave(){
  try{
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(err){ return null; }
}

function clearAutosave(){
  try{ localStorage.removeItem(AUTOSAVE_KEY); }catch(err){ /* sin storage disponible */ }
}

window.addEventListener('beforeunload', ()=>{ if(autosaveTimer) flushAutosave(); });

/* ---------------- Estado y arranque ---------------- */
function setStatus(text){
  const el = document.getElementById('statusMsg');
  if(el) el.textContent = text;
}

function updateSourceUi(){
  document.getElementById('localFileNote').textContent = sourceRef.name || 'ninguno';
  document.getElementById('srtFileNote').textContent = sourceRef.srtName || 'ninguno';
}

function loadDemoProject(){
  columns = defaultColumns();
  cues = [
    newCue({ start:'00:00:01.000', end:'00:00:03.500', character:'Protagonista',
      original:"I've been waiting for this moment all my life",
      rough:'He estado esperando este momento toda mi vida' }),
    newCue({ start:'00:00:04.000', end:'00:00:06.200', character:'Protagonista',
      original:"Nothing's gonna stop me now",
      rough:'Nada me va a detener ahora' })
  ];
  activeCueId = cues[0].id;
  colsSignature = null;
  render();
}

function bootProject(){
  const saved = readAutosave();
  // Un proyecto vacío es una decisión legítima ("Nuevo"): si hay un autoguardado
  // con cabecera válida hay que respetarlo, aunque no tenga ni una línea.
  if(saved && saved.format === PROJECT_FORMAT && Array.isArray(saved.cues)){
    try{
      applyProject(saved, { audio:false });   // el autoguardado no trae grabaciones
      if(saved.cues.length){
        setStatus('Recuperado del autoguardado. Se ha restaurado el texto, pero no las grabaciones: vuelve a cargar el video y regraba lo que necesites.');
      }else{
        setStatus('Recuperado del autoguardado (proyecto vacío).');
      }
      return;
    }catch(err){
      clearAutosave();
    }
  }
  loadDemoProject();
  setStatus('Sin proyecto. Carga un SRT, abre un .hvt o crea líneas manualmente.');
}
