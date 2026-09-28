/* ---------------- Render ---------------- */

// El plegado del panel inferior se aplica aquí y no en el click, para que un
// render (o abrir un proyecto) siempre deje la vista como dice uiState.
function applyBottomPanelState(){
  const btn = document.getElementById('btnToggleBottom');
  document.body.classList.toggle('bottomCollapsed', !!uiState.bottomCollapsed);
  if(!btn) return;
  btn.textContent = uiState.bottomCollapsed ? '▴ panel' : '▾ panel';
  btn.title = uiState.bottomCollapsed ? 'Desplegar el panel inferior' : 'Plegar el panel inferior';
  btn.setAttribute('aria-expanded', uiState.bottomCollapsed ? 'false' : 'true');
}

function render(){
  applyBottomPanelState();
  applyRefStripState();
  renderRefStrip();
  syncColumnsShell();
  activeColumns().forEach(col=>{
    const body = document.getElementById('body_' + col.id);
    if(!body) return;
    body.innerHTML = '';
    cues.forEach(cue => body.appendChild(buildCueEl(cue, col)));
  });

  document.getElementById('activeLineLabel').textContent = activeCueId ?
    (cues.find(c=>c.id===activeCueId)?.character || activeCueId) : 'ninguna';
  renderEmoIndicator();
  renderTimeline();
  scheduleAutosave();
  updateDirtyTitle();
}

// El "•" en el título de la pestaña avisa de que hay cambios sin guardar en disco
// (el autoguardado sí los conserva, pero un .hvt es lo que sobrevive al navegador).
function updateDirtyTitle(){
  // El "sin audio" va en el título de la pestaña, que es lo único que se ve
  // siempre. La barra de estado se pisa con cualquier acción y a los dos minutos
  // ya nadie se acuerda de que el proyecto venía mudo.
  document.title = projectTitle(projectDirty, projectTomasSinAudio > 0);
}

// Construye el bloque de una línea dentro de una columna. El tipo de columna decide
// si está bloqueada por el candado, qué placeholder usa y si lleva conteo de sílabas.
function buildCueEl(cue, col){
  const el = document.createElement('div');
  el.className = 'cue' + (cue.id === activeCueId ? ' active' : '');
  el.dataset.cueid = cue.id;
  el.dataset.col = col.id;

  const ts = `<span class="ts-editable" data-field="start">${fmtTs(cue.start)}</span> → <span class="ts-editable" data-field="end">${fmtTs(cue.end)}</span>`
    + (col.type === 'original' && cue.character ? `<span class="charTag">· ${esc(cue.character)}</span>` : '')
    + (col.type === 'adapted' && cue.emotion ? `<span class="emoTag">${EMOTIONS[cue.emotion]}</span>` : '');

  const text = cueText(cue, col.id);
  if(isReadonlyCol(col)){
    el.innerHTML = `<div class="ts">${ts}</div>
      <div class="cue-text-readonly">${esc(text) || '<span style="color:#54565f">(vacío)</span>'}</div>`;
    el.onclick = ()=> setActiveLine(cue.id);
  } else {
    const isAdapt = col.type === 'adapted';
    const hint = isAdapt
      ? `<div class="syllHint">${countSyllables(text, document.getElementById('langSel').value)} sílabas (aprox.)</div>`
      : '';
    el.innerHTML = `<div class="ts">${ts}</div>
      <textarea data-id="${cue.id}" placeholder="${esc(colPlaceholder(col))}">${esc(text)}</textarea>
      ${hint}`;
    const ta = el.querySelector('textarea');
    // Sólo marcar como activa sin reconstruir el DOM (si no, se pierde el foco al escribir)
    ta.addEventListener('focus', ()=> setActiveLine(cue.id));
    ta.oninput = (e)=>{ setCueText(cue, col.id, e.target.value); updateSyllHint(el, cue); };
    if(isAdapt){
      ta.oncontextmenu = (e)=>{ e.preventDefault(); setActiveLine(cue.id); openCtxMenu(e.clientX, e.clientY, cue); };
    }
  }

  el.querySelector('.ts').onclick = (e)=>{
    if(e.target.classList.contains('ts-editable')){
      e.stopPropagation();
      editTimestamp(cue, e.target.dataset.field, e.target);
      return;
    }
    seekToCue(cue); setActiveLine(cue.id);
  };
  return el;
}

function updateSyllHint(container, cue){
  const hint = container.querySelector('.syllHint');
  if(!hint) return;
  const colId = container.dataset.col;
  hint.textContent = countSyllables(cueText(cue, colId), document.getElementById('langSel').value) + ' sílabas (aprox.)';
}

/* ---------------- Edición de timestamps por clic ---------------- */
function editTimestamp(cue, field, spanEl){
  const current = cue[field] || '00:00:00.000';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.style.cssText = 'width:110px; font-size:11px; padding:1px 4px; font-family:monospace; background:#141519; color:var(--text); border:1px solid var(--accent); border-radius:3px;';
  spanEl.replaceWith(input);
  input.focus();
  input.select();
  function commit(){
    const val = input.value.trim();
    if(val && tsToSeconds(val) !== null){
      cue[field] = val;
    }
    render();
  }
  input.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ e.preventDefault(); commit(); }
    if(e.key==='Escape'){ render(); }
  });
  input.addEventListener('blur', commit);
}

// Selección "ligera": solo actualiza resaltado/estado, NO reconstruye el DOM.
// Así el clic para posicionar el cursor en un textarea ya no le roba el foco.
// sinMarcar: el movimiento lo ha hecho el recorrido (▶), no el usuario. Escuchar
// no es editar, así que no se ensucia el proyecto. Y si el recorrido se para
// porque el usuario ha tocado otra línea, también se detiene: si no, el recorrido
// volverá a|latrás a la línea que tenía y le contradirá.
function setActiveLine(id, sinMarcar){
  // Va antes del "ya estaba activa": si el usuario toca justo la línea que está
  // sonando, también quiere decir "para", aunque el id no cambie.
  if(!sinMarcar && typeof walkStop === 'function') walkStop();
  if(activeCueId === id) return;
  activeCueId = id;
  document.querySelectorAll('.cue').forEach(el=>{
    el.classList.toggle('active', el.dataset.cueid === id);
  });
  document.getElementById('activeLineLabel').textContent =
    (cues.find(c=>c.id===id)?.character || id);
  renderEmoIndicator();
  renderTimeline();
  if(!sinMarcar) projectDirty = true;
}

function renderEmoIndicator(){
  const ind = document.getElementById('emoIndicator');
  const cue = cues.find(c=>c.id===activeCueId);
  if(cue && cue.emotion){
    ind.style.display='block';
    ind.textContent = EMOTIONS[cue.emotion];
  } else {
    ind.style.display='none';
  }
}
