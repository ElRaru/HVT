function fmtTs(t){ return t || '--:--'; }

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------------- Contador silábico (heurístico) ---------------- */
function countSyllables(text, lang){
  if(!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  let total = 0;
  words.forEach(w=>{
    w = w.toLowerCase().replace(/[^a-záéíóúüñ]/gi,'');
    if(!w) return;
    let vowelGroups;
    if(lang === 'es'){
      vowelGroups = w.match(/[aeiouáéíóúü]+/g);
    } else {
      vowelGroups = w.match(/[aeiouy]+/g);
    }
    let n = vowelGroups ? vowelGroups.length : 1;
    if(lang==='en' && w.endsWith('e') && n>1) n -= 1; // e muda aproximada
    total += Math.max(n,1);
  });
  return total;
}

// Chrome guarda mal la duración de blobs webm de MediaRecorder (Infinity) hasta que
// se hace un "seek" al final. Este truco fuerza a que quede disponible.
function fixWebmDuration(url, onReady){
  const a = new Audio();
  a.src = url; a.preload = 'metadata';
  a.addEventListener('loadedmetadata', ()=>{
    if(a.duration === Infinity || isNaN(a.duration)){
      a.currentTime = 1e101;
      a.addEventListener('timeupdate', function handler(){
        a.removeEventListener('timeupdate', handler);
        onReady(a.duration || 0);
      });
    } else {
      onReady(a.duration);
    }
  });
}

// Convierte "HH:MM:SS.mmm" (o con coma) a segundos.
function tsToSeconds(ts){
  if(!ts) return null;
  const clean = ts.replace(',', '.');
  const m = clean.match(/(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
  if(!m) return null;
  const [, h, mi, s, ms] = m;
  return (+h)*3600 + (+mi)*60 + (+s) + (ms? (+ms)/1000 : 0);
}
// Inversa: segundos -> "HH:MM:SS.mmm"
function secondsToTs(s){
  s = Math.max(0, s);
  const h = Math.floor(s/3600);
  const mi = Math.floor((s%3600)/60);
  const sec = Math.floor(s%60);
  const ms = Math.round((s - Math.floor(s))*1000);
  const pad = (n,len=2)=> String(n).padStart(len,'0');
  return `${pad(h)}:${pad(mi)}:${pad(sec)}.${pad(ms,3)}`;
}

/* ---------------- Subtítulos: SRT y VTT ---------------- */
// Hasta ahora lo único que salía de aquí era una tabla Markdown para leer. Un SRT
// o un VTT sí se pueden usar: se abren en Premiere, en Resolve, en Subtitle Edit o
// en un móvil, y ahí es donde el trabajo se acaba de verdad.

// El texto de una línea tiene que caber en una sola línea del archivo: los SRT y
// VTT separan los bloques con una línea en blanco, así que un salto de línea
// dentro del texto partiría el bloque en dos y el lector lo descifraría mal.
function subtitleText(cue, colId){
  // split/map/join y no un replace con expresion regular: hace lo mismo y no deja
  // un asterisco pegado a la barra final, que tools/lint-comments.py contaria como
  // fin de comentario y daria un falso positivo. Las lineas vacias se descartan:
  // unidas tal cual dejarian un espacio de más en medio de la frase.
  return cueText(cue, colId).split('\n').map(l => l.trim()).filter(l => l.length).join(' ');
}

// Segundos -> "HH:MM:SS<sep>mmm". SRT usa coma, VTT punto.
function subtitleStamp(sec, sep){
  const s = Math.max(0, sec);
  const h = Math.floor(s/3600);
  const mi = Math.floor((s%3600)/60);
  const ss = Math.floor(s%60);
  const ms = Math.round((s - Math.floor(s))*1000);
  const pad = (n,len)=> String(n).padStart(len,'0');
  return `${pad(h,2)}:${pad(mi,2)}:${pad(ss,2)}${sep}${pad(ms,3)}`;
}

// Qué columna se exporta: la primera adaptación activa. Si no hay, la traducción
// bruta; si tampoco, el original. Es lo que se está reescribiendo casi siempre.
function subtitleTargetColumn(){
  return firstActiveColOfType('adapted')
      || firstActiveColOfType('rough')
      || firstActiveColOfType('original')
      || activeColumns()[0]
      || null;
}

// Devuelve el texto del archivo y cuántas líneas se quedaron fuera, para poder
// contárselo al usuario en vez de exportar un archivo con huecos silenciosos.
function buildSubtitle(cues, colId, fmt){
  const vtt = (fmt === 'vtt');
  const sep = vtt ? '.' : ',';
  const out = [];
  if(vtt) out.push('WEBVTT', '');

  // Se ordena por tiempo de inicio: los lectores dan por hecho el orden, y una
  // línea añadida a mano puede haber quedado fuera de sitio.
  const items = cues
    .map((cue, i) => ({ cue:cue, i:i, start:tsToSeconds(cue.start), end:tsToSeconds(cue.end) }))
    .filter(it => it.start !== null && it.end !== null && it.end > it.start)
    .sort((a,b) => a.start - b.start || a.i - b.i);

  let skipped = 0, n = 0;
  items.forEach(it => {
    const text = subtitleText(it.cue, colId);
    // Línea vacía: un SRT no puede tenerla, y no puede numerarse. El contador va
    // aparte del índice para no dejar un "3" después de saltarse la 2.
    if(!text){ skipped++; return; }
    const body = it.cue.character ? `${it.cue.character}: ${text}` : text;
    out.push(String(++n));
    out.push(`${subtitleStamp(it.start, sep)} --> ${subtitleStamp(it.end, sep)}`);
    out.push(body, '');
  });
  return { text: out.join('\n'), skipped: skipped, total: items.length };
}

// Descargar texto. El .hvt es lo único que se puede volver a abrir; esto es salida.
// Todos los downloads pasan por aquí: un Blob, una URL de objeto, un <a> que no
// está en el documento y que se suelta solo. Si el <a> se dejara colgado en el
// DOM, sus descargas se acumularían.
function downloadBlob(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

function downloadTextFile(filename, text, mime){
  downloadBlob(filename, new Blob([text], { type: mime }));
}

/* ---------------- Audio del proyecto ---------------- */
// Un solo WAV con cada toma colocada en su momento y silencio en los huecos. Es
// lo contrario de "pegar las tomas unas detrás de otras": aquí se respeta el
// sitio de cada línea, que es justo lo que hace falta para montar contra la
// imagen sin ir ajustando a ojo.

// 5 ms de entrada y de salida al principio y al final de cada toma. No es para suavizar: es que
// una grabación cortada en seco y pegada sobre silencio da un chasquido. Solo
// toca unas muestras de cada borde y no se oye.
const MIX_FADE = 0.005;

// Qué se va a mezclar y dónde cae cada cosa. Devuelve una fila por línea con
// toma, más los contadores de lo que no se puede exportar.
function mixPlan(colId){
  const validas = cues
    .map(c => ({ cue:c, start:tsToSeconds(c.start), end:tsToSeconds(c.end) }))
    .filter(it => it.start !== null && it.end !== null && it.end > it.start)
    .sort((a,b) => a.start - b.start);
  const rows = [];
  let sinToma = 0;
  validas.forEach(it => {
    const take = takeToPlayFor(it.cue);
    // Una línea sin toma no es un hueco que se invente: es silencio, y el hueco
    // de la línea es justo el sitio donde le tocaría caer.
    if(!take){ sinToma++; return; }
    rows.push({
      n: rows.length + 1,
      cueId: it.cue.id,
      takeId: take.id,
      start: it.start,
      end: it.end,
      // Si el navegador aún no ha medido la grabación, se estima con el hueco de
      // la línea. Para el WAV manda la duración real, que sale al decodificar.
      dur: take.duration || (it.end - it.start),
      character: it.cue.character || '',
      text: subtitleText(it.cue, colId)
    });
  });
  let finMaximo = 0;
  rows.forEach(r => { finMaximo = Math.max(finMaximo, r.start + r.dur); });
  return {
    rows: rows,
    sinToma: sinToma,
    sinTiempo: cues.length - validas.length,
    solapes: maxSimultaneous(rows),
    // El total del proyecto manda: si el audio se saliera por el final se estira
    // el archivo en vez de cortar una toma por la mitad.
    total: Math.max(getTimelineTotal(), finMaximo)
  };
}

// Cuántas tomas suenan a la vez en el peor momento. Sirve para no recortar: si
// dos se pisan, la suma puede pasar de 1.0 y en un WAV de 16 bits eso es un
// chasquido. Mejor bajar el nivel de todo y avisar.
function maxSimultaneous(rows){
  if(rows.length < 2) return 1;
  const ev = [];
  rows.forEach(r => {
    ev.push([r.start, 1]);
    ev.push([r.start + (r.dur || 0), -1]);
  });
  // En el mismo instante, primero las que salen: dos tomas que se tocan justas
  // no están sonando las dos a la vez.
  ev.sort((a,b) => a[0] - b[0] || a[1] - b[1]);
  let ahora = 0, maximo = 0;
  ev.forEach(e => {
    ahora += e[1];
    if(ahora > maximo) maximo = ahora;
  });
  return maximo || 1;
}

/* ---------------- WAV de 16 bits ---------------- */
// El WAV no comprime: el archivo pesa lo que pesa, pero lo que suena dentro es
// exactamente lo mismo que lo que sonaba en la app. Con FLAC o MP3 se ahorraría
// sitio a costa de perder faithfulness, y aquí la gracia es no perder nada.

function wavHeader(channels, sampleRate, frames){
  const bytes = frames * channels * 2;
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const str = (off, s) => { for(let i=0;i<s.length;i++) v.setUint8(off+i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + bytes, true);     // lo que viene detrás de este número
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);            // tamaño del bloque fmt
  v.setUint16(20, 1, true);             // 1 = PCM sin comprimir
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);   // bytes por segundo
  v.setUint16(32, channels * 2, true);                 // bytes por muestra y canal
  v.setUint16(34, 16, true);                          // bits por muestra
  str(36, 'data');
  v.setUint32(40, bytes, true);
  return buf;
}

// Los floats del AudioBuffer (−1..1) a int16, intercalando canales: L,R,L,R...
function wavBody(chanData, channels){
  const frames = chanData[0].length;
  const out = new Int16Array(frames * channels);
  for(let c=0;c<channels;c++){
    const data = chanData[c];
    for(let i=0;i<frames;i++){
      let s = data[i];
      // Un pico por encima de 1.0 (al sumar dos tomas, o simplemente un
      // archivo mal grabado) se recorta aquí y sonaría como chasquido.
      if(s > 1) s = 1; else if(s < -1) s = -1;
      out[i*channels + c] = (s < 0) ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF);
    }
  }
  return out;
}

// Un campo de CSV: entrecomillado y con las comillas dobladas, que es lo que
// dice el formato y lo que un texto con comillas dentro rompería.
// El título de la pestaña. Vive aquí, sin tocar el DOM, porque render.js no se
// puede cargar fuera del navegador y el arnés de pruebas lo necesita: cuando
// esa función vivía solo en render.js, el arnés tenía su propia copia y las dos
// se fueron por caminos distintos sin que nada se enterara.
function projectTitle(dirty, sinAudio){
  return (dirty ? '• ' : '')
    + (sinAudio ? '(sin audio) ' : '')
    + 'HVT — Handy Vocal Translation (Alpha)';
}

function csvField(v){
  const s = String(v === null || v === undefined ? '' : v);
  return '"' + s.replace(/"/g, '""') + '"';
}
