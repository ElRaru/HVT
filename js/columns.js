/* ---------------- Sistema de columnas ---------------- */
// #columns es un CSS grid: el ancho real de cada columna lo decide
// grid-template-columns, no las propiedades flex del hijo. El array `columns` es
// la única fuente de verdad — no existen IDs de columna hardcodeados en el render.
//
// Reglas:
//   · como máximo MAX_ACTIVE_COLS (3) columnas visibles a la vez;
//   · el resto se guarda como pestañas ancladas a un borde (izq./der.);
//   · el orden dentro de `columns` es el orden izquierda→derecha de las activas.

function activeColumns(){ return columns.filter(c=>c.active); }
function columnById(id){ return columns.find(c=>c.id===id); }
function colDef(col){ return COL_TYPES[col.type] || COL_TYPES.rough; }
function colFr(col){ return colDef(col).fr; }
function isReadonlyCol(col){ return isColLocked(col); }
// Una columna está bloqueada si su propio candado dice que sí. Las columnas que
// vienen de un .hvt viejo (o construidas a mano en las pruebas) no tienen el
// campo, y entonces manda el valor por defecto del tipo.
function isColLocked(col){
  if(col.locked === undefined || col.locked === null) return !!colDef(col).readonly;
  return !!col.locked;
}
function colPlaceholder(col){ return colDef(col).placeholder || 'Escribe aquí…'; }
function firstColOfType(type){ return columns.find(c=>c.type===type); }
function firstActiveColOfType(type){ return activeColumns().find(c=>c.type===type); }

// La columna con estilo destacado es la primera adaptación activa; si el usuario
// no tiene ninguna, cae en la columna del medio.
function centerColId(){
  const act = activeColumns();
  if(!act.length) return null;
  const ad = act.find(c=>c.type==='adapted');
  if(ad) return ad.id;
  return act[Math.floor((act.length-1)/2)].id;
}

// Lado al que se ancla la pestaña: solo la columna más a la izquierda docks a la
// izquierda; cualquier otra (incluida la central) va a la derecha.
function anchorSideFor(index){ return index === 0 ? 'left' : 'right'; }

/* ---------------- Grid: reparto de ancho ---------------- */
// Con 3 activas -> 1fr 1.2fr 1fr · con 2 -> reparten según su fr · con 1 -> 1fr (100%).
function updateColumnsGrid(){
  const grid = document.getElementById('columns');
  if(!grid) return;
  const act = activeColumns();
  grid.style.gridTemplateColumns = act.length ? act.map(c => colFr(c) + 'fr').join(' ') : '1fr';
  grid.classList.toggle('empty', act.length === 0);
}

/* ---------------- Estructura del DOM ---------------- */
// Solo se reconstruye el esqueleto (headers + pestañas) cuando cambia la
// estructura. Si no cambia, los <textarea> sobreviven al render y no pierden foco.
// `locked` va en la firma porque el glifo del candado vive en la cabecera.
let colsSignature = null;
function columnsSignature(){
  return columns.map(c=>[c.id, c.active ? 1 : 0, c.title, isColLocked(c) ? 'L' : 'U'].join(':')).join('|');
}
function syncColumnsShell(){
  const sig = columnsSignature();
  if(sig === colsSignature) return;
  colsSignature = sig;
  renderColumnsShell();
}

function renderColumnsShell(){
  const grid = document.getElementById('columns');
  const railL = document.getElementById('tabsLeft');
  const railR = document.getElementById('tabsRight');
  const act = activeColumns();
  const center = centerColId();

  grid.innerHTML = '';
  act.forEach((col, i)=>{
    const wrap = document.createElement('div');
    wrap.className = 'col' + (col.id === center ? ' center' : '');
    wrap.dataset.col = col.id;
    wrap.innerHTML = `
      <div class="col-header">
        <span class="col-title-text">${esc(col.title)}</span>
        <span class="col-nav">
          <button class="colLockBtn ${isColLocked(col)?'locked':''}" data-col="${col.id}"
            title="${isColLocked(col)?'Desbloquear para poder editar':'Bloquear para que no se pueda editar'}"
            aria-pressed="${isColLocked(col)?'true':'false'}">${isColLocked(col)?'🔒':'🔓'}</button>
          <span class="colSep"></span>
          <button class="colMoveBtn" data-col="${col.id}" data-dir="-1" title="Mover a la izquierda" ${i===0?'disabled':''}>‹</button>
          <button class="colMoveBtn" data-col="${col.id}" data-dir="1" title="Mover a la derecha" ${i===act.length-1?'disabled':''}>›</button>
          <span class="colSep"></span>
          <button class="colMinBtn" data-col="${col.id}" data-side="${anchorSideFor(i)}" title="Minimizar a pestaña ${anchorSideFor(i)==='left'?'izquierda':'derecha'}">${anchorSideFor(i)==='left'?'«':'»'}</button>
        </span>
      </div>
      <div class="col-body" id="body_${col.id}"></div>`;
    grid.appendChild(wrap);
  });

  // Pestañas de las columnas ocultas
  railL.innerHTML = '';
  railR.innerHTML = '';
  columns.filter(c=>!c.active).forEach(col=>{
    const tab = document.createElement('button');
    tab.className = 'colTab';
    tab.dataset.col = col.id;
    tab.title = col.title + ' — clic para restaurar en su posición';
    tab.innerHTML = `<span class="colTabText">${esc(col.title)}</span><span class="colTabX" data-del="${col.id}" title="Eliminar esta columna">✕</span>`;
    (col.side === 'left' ? railL : railR).appendChild(tab);
  });

  wireColumnsShell();
  updateColumnsGrid();
}

function wireColumnsShell(){
  document.querySelectorAll('#columns .colLockBtn').forEach(btn=>{
    btn.onclick = ()=> toggleColumnLock(btn.dataset.col);
  });
  document.querySelectorAll('#columns .colMoveBtn').forEach(btn=>{
    btn.onclick = ()=> moveColumn(btn.dataset.col, Number(btn.dataset.dir));
  });
  document.querySelectorAll('#columns .colMinBtn').forEach(btn=>{
    btn.onclick = ()=> minimizeColumn(btn.dataset.col, btn.dataset.side);
  });
  document.querySelectorAll('.colTab').forEach(tab=>{
    tab.onclick = (e)=>{
      const del = e.target.dataset && e.target.dataset.del;
      if(del){ e.stopPropagation(); removeColumn(del); return; }
      restoreColumn(tab.dataset.col);
    };
  });
}

/* ---------------- Acciones ---------------- */
// Inserta `col` en el array para que quede como la en esa posición columna activa.
function insertActiveAt(col, at){
  const others = columns.filter(c=>c.id !== col.id);
  const activeIdx = [];
  others.forEach((c,i)=>{ if(c.active) activeIdx.push(i); });
  let pos;
  if(!activeIdx.length) pos = others.length;
  else if(at >= activeIdx.length) pos = activeIdx[activeIdx.length-1] + 1;
  else pos = activeIdx[at];
  others.splice(pos, 0, col);
  columns = others;
}

// Intercambio con la vecina inmediata (A › B -> B › A). Solo swap adyacente.
// Libera o bloquea la edición de una columna. El texto no se toca: solo cambia
// si se pinta como textarea editable o como texto plano.
function toggleColumnLock(id){
  const col = columnById(id);
  if(!col) return;
  col.locked = !isColLocked(col);
  render();
}

function moveColumn(id, dir){
  const act = activeColumns();
  const i = act.findIndex(c=>c.id===id);
  const j = i + dir;
  if(i < 0 || j < 0 || j >= act.length) return;
  const gi = columns.indexOf(act[i]);
  const gj = columns.indexOf(act[j]);
  const tmp = columns[gi];
  columns[gi] = columns[gj];
  columns[gj] = tmp;
  render();
}

function minimizeColumn(id, side){
  const act = activeColumns();
  const i = act.findIndex(c=>c.id===id);
  if(i < 0) return;
  const col = columnById(id);
  col.restoreIndex = i;          // se restaurará aquí
  col.side = side || anchorSideFor(i);
  col.active = false;
  render();
}

// Si ya hay 3 visibles, se minimiza la que ocupa el sitio que le tocaría a la
// que se está restaurando; así la pestaña siempre es utilizable.
function restoreColumn(id){
  const col = columnById(id);
  if(!col || col.active) return;
  let act = activeColumns();
  if(act.length >= MAX_ACTIVE_COLS){
    const slot = Math.min(col.restoreIndex == null ? act.length - 1 : col.restoreIndex, act.length - 1);
    const victim = act[slot];
    victim.restoreIndex = slot;
    victim.side = anchorSideFor(slot);
    victim.active = false;
  }
  act = activeColumns();
  const at = Math.max(0, Math.min(col.restoreIndex == null ? act.length : col.restoreIndex, act.length));
  col.active = true;
  col.restoreIndex = null;
  col.side = null;
  insertActiveAt(col, at);
  render();
}

function addColumn(type){
  if(!COL_TYPES[type]) return;
  const n = columns.filter(c=>c.type===type).length + 1;
  const col = {
    id: newColId(type), type,
    title: COL_TYPES[type].defaultTitle + (n > 1 ? ' ' + n : ''),
    active: false, restoreIndex: null, side: null,
    locked: !!COL_TYPES[type].readonly     // nace como manda su tipo
  };
  if(activeColumns().length < MAX_ACTIVE_COLS){
    col.active = true;
    insertActiveAt(col, activeColumns().length);
  } else {
    columns.push(col);
    col.side = 'right';           // sin sitio visible: nace como pestaña
  }
  render();
}

function removeColumn(id){
  const col = columnById(id);
  if(!col) return;
  if(!confirm('¿Eliminar la columna "' + col.title + '"?\nSe perderá el texto que tenga.')) return;
  cues.forEach(c=>{ if(c.text) delete c.text[id]; });
  columns = columns.filter(c=>c.id !== id);
  if(!activeColumns().length && columns.length) columns[0].active = true;
  render();
}

/* ---------------- Botón "+ columna" ---------------- */
document.querySelectorAll('#colPanel [data-type]').forEach(btn=>{
  btn.onclick = ()=>{
    addColumn(btn.dataset.type);
    document.getElementById('colPanel').classList.remove('show');
  };
});
