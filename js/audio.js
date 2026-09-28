/* ---------------- Grabación de audio + waveform + tomas ---------------- */
let mediaStream = null, mediaRecorder = null, audioChunks = [];
let audioCtx = null, analyser = null, sourceNode = null, gainNode = null, rafId = null;

const canvas = document.getElementById('wave');
const canvasCtx = canvas.getContext('2d');

function resizeCanvas(){
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawIdle(){
  canvasCtx.clearRect(0,0,canvas.width,canvas.height);
  canvasCtx.strokeStyle = '#3a3c44';
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, canvas.height/2);
  canvasCtx.lineTo(canvas.width, canvas.height/2);
  canvasCtx.stroke();
}
drawIdle();

function drawWave(){
  if(!analyser) return;
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);
  canvasCtx.clearRect(0,0,canvas.width,canvas.height);
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#d4553a';
  canvasCtx.beginPath();
  const sliceWidth = canvas.width / bufferLength;
  let x = 0;
  for(let i=0;i<bufferLength;i++){
    const v = dataArray[i]/128.0;
    const y = v * canvas.height/2;
    if(i===0) canvasCtx.moveTo(x,y); else canvasCtx.lineTo(x,y);
    x += sliceWidth;
  }
  canvasCtx.stroke();
  rafId = requestAnimationFrame(drawWave);
}

document.getElementById('volRange').oninput = (e)=>{
  if(gainNode) gainNode.gain.value = e.target.value/100;
};

const recBtn = document.getElementById('recBtn');
recBtn.onclick = async ()=>{
  if(!activeCueId){ alert('Selecciona una línea antes de grabar.'); return; }
  if(mediaRecorder && mediaRecorder.state === 'recording'){
    mediaRecorder.stop();
    return;
  }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    // Sin contexto seguro el navegador ni siquiera expone mediaDevices, así que
    // la llamada reventaría con un TypeError que no explica nada al usuario.
    alert('Este navegador no da acceso al micrófono en la forma en que se abrió la app.\n\n'
        + 'Por qué: grabar el micrófono exige un contexto seguro.\n\n'
        + 'Qué hacer: abre la app con ./start.sh, que la sirve en http://127.0.0.1,'
        + ' o publícala en un sitio con HTTPS.');
    return;
  }
  try{
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio:true });
  }catch(err){
    alert('No se pudo acceder al micrófono: ' + err.message);
    return;
  }
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaStreamSource(mediaStream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  gainNode = audioCtx.createGain();
  gainNode.gain.value = document.getElementById('volRange').value/100;
  sourceNode.connect(gainNode).connect(analyser);
  drawWave();

  audioChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream);
  mediaRecorder.ondataavailable = (e)=> audioChunks.push(e.data);
  mediaRecorder.onstop = ()=>{
    const blob = new Blob(audioChunks, { type:'audio/webm' });
    const url = URL.createObjectURL(blob);
    const cue = cues.find(c=>c.id===activeCueId);
    const takeId = 'toma.' + (cue.takes.length+1);
    const take = { id: takeId, url, blob, duration: null };
    cue.takes.push(take);
    cue.selectedTake = takeId; // la toma recién grabada queda seleccionada por defecto
    recBtn.classList.remove('recording');
    cancelAnimationFrame(rafId);
    drawIdle();
    mediaStream.getTracks().forEach(t=>t.stop());
    if(sourceNode) sourceNode.disconnect();
    if(analyser) analyser.disconnect();
    if(gainNode) gainNode.disconnect();
    if(audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    sourceNode = null; analyser = null; gainNode = null; audioCtx = null; mediaStream = null;
    renderTimeline();
    renderRefStrip();
    fixWebmDuration(url, (dur)=>{ take.duration = dur; renderTimeline(); renderRefStrip(); });
  };
  mediaRecorder.start();
  recBtn.classList.add('recording');
};

/* ---------------- Volumen retráctil ---------------- */
document.getElementById('volToggle').onclick = (e)=>{
  e.stopPropagation();
  document.getElementById('volPanel').classList.toggle('show');
};
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#volBtn')) document.getElementById('volPanel').classList.remove('show');
});
