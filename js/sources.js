/* ---------------- Carga de SRT ---------------- */
document.getElementById('btnLoadSrt').onclick = ()=> document.getElementById('srtFileInput').click();

document.getElementById('srtFileInput').onchange = (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    parseSrt(reader.result);
    sourceRef.srtName = file.name;
    document.getElementById('srtFileNote').textContent = file.name;
    render();
  };
  reader.readAsText(file);
};

function parseSrt(content){
  const blocks = content.replace(/\r/g,'').split(/\n\n+/).filter(b=>b.trim());
  const newCues = [];
  blocks.forEach(b=>{
    const lines = b.split('\n').filter(l=>l.trim());
    if(lines.length < 2) return;
    let idx = 0;
    if(/^\d+$/.test(lines[0].trim())) idx = 1;
    const timeLine = lines[idx];
    const m = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if(!m) return;
    const text = lines.slice(idx+1).join(' ').trim();
    newCues.push(newCue({ start: m[1].replace(',', '.'), end: m[2].replace(',', '.'), original: text }));
  });
  if(newCues.length){
    cues = newCues;
    activeCueId = cues[0].id;
  }
}

/* ---------------- Añadir línea manual ---------------- */
document.getElementById('btnAddCue').onclick = ()=>{
  const c = newCue({});
  cues.push(c);
  activeCueId = c.id;
  render();
};

/* ---------------- Video/audio local ---------------- */
document.getElementById('btnLoadVideo').onclick = ()=> document.getElementById('videoFileInput').click();

document.getElementById('videoFileInput').onchange = (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  sourceRef = { type:'local', name:file.name, url:null, srtName:sourceRef.srtName };
  const box = document.getElementById('videoBox');
  box.querySelector('.placeholder')?.remove();
  box.querySelectorAll('video').forEach(el=>el.remove());
  document.getElementById('localFileNote').textContent = file.name;
  // Esto va a la barra de estado y no al texto de ayuda de la fila: si se
  // escribiera ahí, cargar el video borraría de un plumazo la explicación de
  // "Recorrer" y no volvería nunca.
  setStatus('Transporte controlando: ' + file.name);

  // Siempre <video>: funciona igual para archivos de solo audio (el navegador
  // muestra su propia barra de reproducción) — evita depender de detectar el
  // tipo de archivo, que falla con formatos como .webm (ambiguo: audio o video).
  const vid = document.createElement('video');
  vid.src = url; vid.controls = refSuelta;
  box.insertBefore(vid, box.firstChild);
  refMediaEl = vid;
  vid.addEventListener('play', startPlayheadLoop);
  vid.addEventListener('pause', stopPlayheadLoop);
  vid.addEventListener('ended', stopPlayheadLoop);
  vid.addEventListener('seeked', updatePlayhead); // reflejar saltos manuales aunque esté en pausa
  vid.addEventListener('loadedmetadata', renderTimeline);

  loadRefStripWaveform(file);
};

/* ---------------- Anclar / soltar la referencia ---------------- */
// El pin de la barra derecha manda. Anclada, la referencia es una miniatura en la
// barra; suelta, es una ventana grande que se lleva a donde quieras. Al volver a
// anclarla se queda donde la sueltas, para no tener que buscarla otra vez.
let refSuelta = false;        // qué hizo el pin, para los casos en que hay que refrescar
let refSoltadaEn = null;     // esquina superior izquierda de la última posición suelta

function applyRefDock(){
  const box = document.getElementById('videoBox');
  const pin = document.getElementById('btnPinRef');
  const suelta = !!refSuelta;
  box.classList.toggle('floating', suelta);
  box.classList.toggle('docked', !suelta);
  // Los controles del <video> no caben en la miniatura y solo estorban.
  box.querySelectorAll('video').forEach(v =>{ v.controls = suelta; });
  if(suelta){
    // Se recoloca en el sitio donde estaba al soltar, y no donde la dejaron
    // hecha una bola de papel si se ha movido de sitio.
    const x = refSoltadaEn ? refSoltadaEn.x : Math.max(20, window.innerWidth - 360);
    const y = refSoltadaEn ? refSoltadaEn.y : 96;
    box.style.left = Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, x)) + 'px';
    box.style.top = Math.max(8, Math.min(window.innerHeight - box.offsetHeight - 8, y)) + 'px';
    box.style.right = 'auto';
  }else{
    box.style.left = ''; box.style.top = ''; box.style.right = '';
  }
  pin.setAttribute('aria-pressed', suelta ? 'true' : 'false');
  pin.title = suelta ? 'Anclar la referencia en la barra' : 'Soltar la referencia para verla en grande';
  renderRefStrip();
}

document.getElementById('btnPinRef').onclick = ()=>{
  refSuelta = !refSuelta;
  applyRefDock();
};

/* Arrastrar la referencia suelta: desde el grip de arriba, no desde toda la caja,
   para noardybar los controles de reproducción del propio <video>. */
(function makeVideoDraggable(){
  const box = document.getElementById('videoBox');
  const grip = document.getElementById('videoGrip');
  let drag = false, dx = 0, dy = 0;
  grip.addEventListener('mousedown', (e)=>{
    if(!refSuelta) return;
    drag = true;
    const r = box.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    box.classList.add('dragging');
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e)=>{
    if(!drag) return;
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(0, Math.min(window.innerWidth - w, e.clientX - dx)) + 'px';
    box.style.top = Math.max(0, Math.min(window.innerHeight - h, e.clientY - dy)) + 'px';
    box.style.right = 'auto';
  });
  window.addEventListener('mouseup', ()=>{
    if(!drag) return;
    drag = false;
    refSoltadaEn = { x: box.offsetLeft, y: box.offsetTop };
    box.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();
