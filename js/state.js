/* ---------------- Estado del proyecto ---------------- */
// {id, start, end, character, text:{<colId>: string}, emotion, takes:[{id,url,blob}], selectedTake}
let cues = [];
let activeCueId = null;
let cueCounter = 0;
let sourceRef = { type: null, name: null, url: null, srtName: null }; // 'local' mientras haya algo cargado

const EMOTIONS = {
  feliz: '😄', triste: '😢', enojado: '😠', deprimido: '😞',
  sorprendido: '😲', miedo: '😨', neutral: '😐', emocionado: '🤩'
};

function uid(){ return 'c' + (++cueCounter); }

/* ---------------- Modelo de columnas ---------------- */
// 'fr' es la proporción de ancho con la que reparte esta columna el grid.
// Un número ilimitado de columnas puede existir, pero solo se ven MAX_ACTIVE_COLS
// a la vez: el resto vive como pestañas ancladas a un borde.
// `readonly` es el estado de bloqueo POR DEFECTO de cada tipo, no un veto: el
// usuario puede liberar la Original con el candado de la cabecera cuando el SRT
// viene descuadrado, y bloquear una adaptación para no tocarla por error. El
// valor vivo va en `col.locked`; este campo solo decide con qué nace cada columna.
const COL_TYPES = {
  original: { fr:1,   readonly:true,  defaultTitle:'Original',         placeholder:null },
  adapted:  { fr:1.2, readonly:false, defaultTitle:'Adaptación',       placeholder:'Escribe tu adaptación…' },
  rough:    { fr:1,   readonly:false, defaultTitle:'Traducción bruta', placeholder:'Traducción IA / previa…' }
};
const MAX_ACTIVE_COLS = 3;

let columns = defaultColumns();

function defaultColumns(){
  return [
    { id:'colOriginal', type:'original', title:'📄 Original',         active:true, restoreIndex:0, side:null, locked:true },
    { id:'colAdapt',   type:'adapted',  title:'✎ Nueva adaptación', active:true, restoreIndex:1, side:null, locked:false },
    { id:'colRough',   type:'rough',    title:'🌐 Traducción bruta', active:true, restoreIndex:2, side:null, locked:false }
  ];
}

let colCounter = 0;
function newColId(type){ return 'col_' + type + '_' + (++colCounter); }

// Claves del modelo antiguo (una por tipo) que se migran a cue.text al vuelo.
const LEGACY_COL_KEYS = { original:'original', adapted:'adapted', rough:'rough' };

function newCue(partial){
  const cue = {
    id: uid(), start:'', end:'', character:'', text:{},
    emotion:null, takes:[], selectedTake:null
  };
  if(partial) Object.assign(cue, partial);
  // Los datos de ejemplo y los SRT antiguos traen `original`/`rough`/`adapted`
  // sueltos: se trasladan al mapa por columna y se borran del objeto.
  for(const [legacyKey, type] of Object.entries(LEGACY_COL_KEYS)){
    if(typeof cue[legacyKey] === 'string'){
      const target = columns.find(c=>c.type===type);
      if(target && !cue.text[target.id]) cue.text[target.id] = cue[legacyKey];
      delete cue[legacyKey];
    }
  }
  return cue;
}

function cueText(cue, colId){ return (cue.text && cue.text[colId]) || ''; }
function setCueText(cue, colId, value){
  if(!cue.text) cue.text = {};
  cue.text[colId] = value;
  scheduleAutosave();   // escribir es el cambio más frecuente: va directo al autoguardado
}

let lastRefAudioBuffer = null;

let refMediaEl = null; // <video> local actualmente cargado (null si no hay nada)

// Preferencia de vista: si el panel inferior está replegado. No es parte del
// proyecto en sí, pero se guarda con él para reabrirlo como lo dejaste.
let uiState = { bottomCollapsed: false, refStripCollapsed: false };

// Estado compartido del drag de marcadores (se usa con handlers globales en window,
// en lugar de añadir listeners por cada render, para evitar fugas de memoria).
let markerDragState = { active:false, moved:false, markerEl:null, cue:null,
  startX:0, startSec:0, dur:0, containerRect:null };
