/* ---------------- Herramientas de texto (negrita/cursiva/personaje) ---------------- */
function wrapActiveTextarea(prefix, suffix){
  const cue = cues.find(c=>c.id===activeCueId);
  if(!cue) return;
  const col = firstActiveColOfType('adapted');
  if(!col) return;
  const ta = document.querySelector(`#body_${col.id} textarea[data-id="${cue.id}"]`);
  if(!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const val = ta.value;
  const selected = val.slice(start,end) || 'texto';
  ta.value = val.slice(0,start) + prefix + selected + suffix + val.slice(end);
  setCueText(cue, col.id, ta.value);
  updateSyllHint(ta.closest('.cue'), cue);
}
// Plegar el panel inferior (waveform de referencia + línea de tiempo). La barra
// de grabación se queda siempre visible: es donde está el botón de grabar.
document.getElementById('btnToggleBottom').onclick = ()=>{
  uiState.bottomCollapsed = !uiState.bottomCollapsed;
  applyBottomPanelState();
  scheduleAutosave();
};

document.getElementById('btnBold').onclick = ()=>{ wrapActiveTextarea('**','**'); syncSelectionTools(); };
document.getElementById('btnItalic').onclick = ()=>{ wrapActiveTextarea('*','*'); syncSelectionTools(); };
document.getElementById('btnChar').onclick = ()=>{
  const cue = cues.find(c=>c.id===activeCueId);
  if(!cue){ alert('Selecciona una línea primero.'); return; }
  const name = prompt('Nombre del personaje / voz:', cue.character || '');
  if(name !== null){ cue.character = name.trim(); render(); }
};

/* ---------------- La marca de versión, leída de VERSION ---------------- */
(function showVersion(){
  const el = document.getElementById('brandVersion');
  if(!el) return;
  // Fetch falla en file://; la versión es un detalle, no vale la pena un aviso.
  fetch('VERSION').then(r => r.text()).then(t =>{ el.textContent = '· ' + t.trim(); }).catch(()=>{});
})();

/* ---------------- Herramientas de la barra: estado y aperturas ---------------- */
// Negrita y cursiva solo hacen algo sobre un texto seleccionado, así que en vez
// de un aviso al fallar, se apagan cuando no hay nada seleccionado.
document.addEventListener('selectionchange', syncSelectionTools);
document.addEventListener('mouseup', syncSelectionTools);
document.addEventListener('keyup', syncSelectionTools);
function syncSelectionTools(){
  const sel = window.getSelection();
  const picked = !!(sel && String(sel).length > 0);
  document.querySelectorAll('#editPanel .onSelection').forEach(b =>{ b.disabled = !picked; });
}
syncSelectionTools();

/* Un solo manejador para todos los menús: abrir uno cierra los demás, y el botón
   se queda marcado mientras su panel está abierto. */
const TOGGLES = [
  { btn:'sourcesToggle', panel:'sourcesPanel', wrap:'sourcesWrap' },
  { btn:'btnAddColumn',  panel:'colPanel',     wrap:'colAddWrap' },
  { btn:'projToggle',    panel:'projPanel',    wrap:'projWrap' },
  { btn:'editToggle',    panel:'editPanel',    wrap:'editWrap' },
];
function closeAllMenus(except){
  TOGGLES.forEach(t =>{
    if(t.panel === except) return;
    document.getElementById(t.panel).classList.remove('show');
    document.getElementById(t.btn).classList.remove('open');
    document.getElementById(t.btn).setAttribute('aria-expanded', 'false');
  });
}
TOGGLES.forEach(t =>{
  const btn = document.getElementById(t.btn);
  btn.onclick = (e)=>{
    e.stopPropagation();
    const panel = document.getElementById(t.panel);
    const abrir = !panel.classList.contains('show');
    closeAllMenus(t.panel);
    panel.classList.toggle('show', abrir);
    btn.classList.toggle('open', abrir);
    btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  };
  document.addEventListener('click', (e)=>{
    if(e.target.closest('#' + t.wrap)) return;
    document.getElementById(t.panel).classList.remove('show');
    document.getElementById(t.btn).classList.remove('open');
    document.getElementById(t.btn).setAttribute('aria-expanded', 'false');
  });
});
// Al elegir algo, el menú se cierra solo: ya se ha pedido la acción.
TOGGLES.forEach(t =>{
  document.getElementById(t.panel).addEventListener('click', (e)=>{
    if(!e.target.closest('.menuItem > button')) return;
    document.getElementById(t.panel).classList.remove('show');
    document.getElementById(t.btn).classList.remove('open');
    document.getElementById(t.btn).setAttribute('aria-expanded', 'false');
  });
});
/* ---------------- Exportar subtítulos ---------------- */
// Un botón por formato y una columna destino, la que se está reescribiendo.
// Si un día hay varias columnas de adapting, se pregunta cuál; de momento se deduce.
function exportSubtitle(fmt){
  const col = subtitleTargetColumn();
  if(!col){ setStatus('No hay ninguna columna de texto que exportar.'); return; }
  const { text, skipped, total } = buildSubtitle(cues, col.id, fmt);
  if(!total){ setStatus('No hay líneas con timecode para exportar todavía.'); return; }
  const ext = fmt === 'vtt' ? 'vtt' : 'srt';
  const mime = fmt === 'vtt' ? 'text/vtt' : 'application/x-subrip';
  downloadTextFile('subtitulos.' + ext, text, mime);
  // El título se usa tal cual: los títulos llevan su icono delante ("✎ Nueva
  // adaptación") y quitarlo con una expresión regular no compensa.
  setStatus('Subtítulos exportados de «' + col.title + '»' + (skipped ? ` · ${skipped} línea(s) vacías fuera` : ''));
}
document.getElementById('btnExportSrt').onclick = ()=> exportSubtitle('srt');
document.getElementById('btnExportVtt').onclick = ()=> exportSubtitle('vtt');

/* ---------------- Audio del proyecto ---------------- */
// Un WAV con cada toma en su sitio y silencio en los huecos. Es lo contrario de
// "pegar las tomas unas detrás de otras": el archivo dura lo que dura el proyecto,
// así que se importa en el editor de vídeo y la imagen ya está en su sitio.

const MIX_MAX_BYTES = 250e6;   // por encima de esto el navegador se queda sin memoria

function wavBlobFromBuffer(buffer){
  const channels = buffer.numberOfChannels;
  const chanData = [];
  for(let c=0;c<channels;c++) chanData.push(buffer.getChannelData(c));
  return new Blob([ wavHeader(channels, buffer.sampleRate, buffer.length),
                    wavBody(chanData, channels) ], { type:'audio/wav' });
}

// Un AudioBuffer a WAV. En el arnés de pruebas esto no se puede ejecutar (no hay
// navegador), pero lo que sí se prueba aparte son wavHeader() y wavBody(), que
// son donde se cuelan los errores de formato.
function mixMb(bytes){ return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB'; }

async function exportMixdown(){
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if(!OAC){ setStatus('Este navegador no sabe mezclar audio sin reproducirlo.'); return; }
  const col = subtitleTargetColumn();
  const plan = mixPlan(col ? col.id : null);
  if(!plan.rows.length){
    setStatus('No hay ninguna toma que exportar: graba o importa audio en alguna línea.');
    return;
  }

  // Decodificar y medir antes de decidir nada. La duración que trae la toma
  // puede ser null si el navegador todavía no ha medido la grabación, y para saber
  // de cuánto va a ser el archivo hace falta la real, no la del hueco de la línea.
  const dctx = new (window.AudioContext||window.webkitAudioContext)();
  const pares = [];
  let sinDecodificar = 0;
  for(let i=0;i<plan.rows.length;i++){
    const row = plan.rows[i];
    setStatus('Decodificando ' + (i+1) + ' de ' + plan.rows.length + '...');
    let buf = null;
    try{
      // Se reutiliza la caché de la franja de referencia: si la onda ya está
      // dibujada, estas grabaciones ya están decodificadas y no se repite el trabajo.
      if(takeBufferCache.has(row.takeId)) buf = takeBufferCache.get(row.takeId);
      else if(row.take){
        const raw = row.take.blob ? await row.take.blob.arrayBuffer() : await fetch(row.take.url).then(r=>r.arrayBuffer());
        buf = await dctx.decodeAudioData(raw);
        takeBufferCache.set(row.takeId, buf);
      }
    }catch(e){ buf = null; }   // un webm raro no puede tirar abajo toda la mezcla
    if(buf && buf.duration > 0){ row.dur = buf.duration; pares.push({ row: row, buf: buf }); }
    else sinDecodificar++;
  }
  dctx.close();
  if(!pares.length){
    setStatus('Ninguna de las ' + plan.rows.length + ' tomas se ha podido decodificar.');
    return;
  }

  const channels = Math.min(2, pares.reduce((m,p) => Math.max(m, p.buf.numberOfChannels), 1));
  const rate = dctx.sampleRate;
  const utiles = pares.map(p => p.row);
  const solapes = maxSimultaneous(utiles);
  let finMaximo = 0;
  utiles.forEach(r => { finMaximo = Math.max(finMaximo, r.start + r.dur); });
  // Si una toma se saliera por el final, el archivo se estira. Cortarla sería
  // perder audio, y justamente de eso va esto.
  const total = Math.max(finMaximo, getTimelineTotal());
  const frames = Math.ceil(total * rate);
  const bytes = frames * channels * 2;
  if(bytes > MIX_MAX_BYTES){
    setStatus('El audio del proyecto ocuparía ' + mixMb(bytes) + ' y el navegador no lo aguanta.');
    return;
  }

  const octx = new OAC(channels, frames, rate);
  const master = octx.createGain();
  // Si dos tomas se pisan, su suma puede pasar de 1.0 y en 16 bits eso recorta.
  // Bajar el nivel de todo lo evita, y se avisa en vez de hacerlo a escondidas.
  master.gain.value = 1 / solapes;
  master.connect(octx.destination);
  pares.forEach(p => {
    const src = octx.createBufferSource();
    src.buffer = p.buf;
    const f = Math.min(MIX_FADE, p.buf.duration / 2);
    const t0 = p.row.start, t1 = t0 + p.buf.duration;
    const g = octx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + f);
    g.gain.setValueAtTime(1, t1 - f);
    g.gain.linearRampToValueAtTime(0, t1);
    src.connect(g); g.connect(master);
    src.start(t0);
  });

  setStatus('Mezclando ' + pares.length + ' tomas en ' + secondsToTs(total) + '...');
  const rendered = await octx.startRendering();
  downloadBlob('audio_proyecto.wav', wavBlobFromBuffer(rendered));
  const notas = [];
  if(plan.sinToma) notas.push(plan.sinToma + ' línea(s) sin toma, en silencio');
  if(sinDecodificar) notas.push(sinDecodificar + ' ilegible(s) fuera');
  if(solapes > 1) notas.push('nivel a ' + Math.round(100/solapes) + '% por solapes');
  setStatus('Audio exportado: ' + pares.length + ' tomas · ' + secondsToTs(total) + ' · ' + mixMb(bytes)
            + (notas.length ? ' · ' + notas.join(' · ') : ''));
}

// Dónde cae cada toma, en texto. Sin audio, se lee en un segundo y sirve para
// montar en un editor que admita CSV.
function exportTakeIndex(){
  const col = subtitleTargetColumn();
  const plan = mixPlan(col ? col.id : null);
  if(!plan.rows.length){ setStatus('Todavía no hay tomas que listar.'); return; }
  const head = ['n','id_linea','id_toma','inicio','fin','duracion','personaje','texto'];
  const filas = [ head.map(csvField).join(',') ];
  plan.rows.forEach(r => {
    filas.push([ r.n, r.cueId, r.takeId,
                 subtitleStamp(r.start, '.'), subtitleStamp(r.end, '.'),
                 r.dur.toFixed(3), r.character, r.text ].map(csvField).join(','));
  });
  // El BOM del principio es lo que hace que Excel abra el archivo como UTF-8 y no
  // como ANSI, que es donde los acentos se convierten en caracteres raros.
  downloadTextFile('indice_tomas.csv', '\ufeff' + filas.join('\n') + '\n', 'text/csv;charset=utf-8');
  setStatus('Índice de ' + plan.rows.length + ' tomas exportado.');
}
document.getElementById('btnExportWav').onclick = ()=> exportMixdown();
document.getElementById('btnExportIndex').onclick = ()=> exportTakeIndex();

/* ---------------- Modal de archivos crudos ---------------- */
document.getElementById('btnRawFiles').onclick = ()=>{
  const list = document.getElementById('rawList');
  const allTakes = [];
  cues.forEach(cue=>{
    cue.takes.forEach(t=>{
      allTakes.push({ cue, take: t });
    });
  });
  if(allTakes.length===0){
    list.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-dim); font-size:12.5px;">Todavía no hay grabaciones en este proyecto.</div>';
  } else {
    list.innerHTML = allTakes.map(({cue,take})=>`
      <div class="rawItem">
        <div>
          <div>${take.id} — ${esc(cue.character||'(sin personaje)')}</div>
          <div class="meta">${cue.start} → ${cue.end}${cue.selectedTake===take.id?' · seleccionada':''}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="rawPlay" data-url="${take.url}" style="padding:4px 8px; font-size:11px;">▶</button>
          <a class="fileHidden rawDl" download="${take.id}.webm" href="${take.url}"></a>
          <button class="rawDlBtn" style="padding:4px 8px; font-size:11px;">⬇</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.rawPlay').forEach(el=> el.onclick = ()=> new Audio(el.dataset.url).play());
    list.querySelectorAll('.rawDlBtn').forEach((el, idx)=>{
      el.onclick = ()=>{
        const { cue, take } = allTakes[idx];
        const a = document.createElement('a');
        a.href = take.url; a.download = `${(cue.character||'linea').replace(/\s+/g,'_')}_${take.id}.webm`;
        a.click();
      };
    });
  }
  document.getElementById('rawModalOverlay').classList.add('show');
};
document.getElementById('btnCloseRaw').onclick = ()=> document.getElementById('rawModalOverlay').classList.remove('show');
document.getElementById('rawModalOverlay').onclick = (e)=>{
  if(e.target.id==='rawModalOverlay') e.currentTarget.classList.remove('show');
};

/* ---------------- Exportar tabla legible ---------------- */
// La tabla Markdown es solo para leer y compartir. El proyecto que se puede
// volver a abrir es el .hvt (ver js/project.js).
document.getElementById('btnExportMd').onclick = ()=>{
  // La tabla se arma con las columnas que existan ahora: si el usuario minimizó,
  // reordenó o añadió columnas, el .hvt las refleja todas.
  const head = ['Timestamp', 'Personaje', ...columns.map(c=>c.title), 'Emoción', 'Toma'];
  let md = `# Proyecto HVT\n\n`;
  md += `**Fuente audiovisual:** ${sourceRef.type ? (sourceRef.type==='local' ? 'archivo local — '+sourceRef.name : 'web — '+sourceRef.url) : '(no cargada)'}\n`;
  md += `**SRT origen:** ${sourceRef.srtName || '(no cargado)'}\n\n`;
  md += `| ${head.join(' | ')} |\n`;
  md += `| ${head.map(()=>'---').join(' | ')} |\n`;
  cues.forEach(c=>{
    const cells = columns.map(col => (cueText(c, col.id) || '').replace(/\n/g, ' '));
    md += `| ${c.start} → ${c.end} | ${c.character||''} | ${cells.join(' | ')} | ${c.emotion||''} | ${c.selectedTake||''} |\n`;
  });
  downloadTextFile('proyecto.md', md, 'text/markdown');
};
