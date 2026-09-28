/* ---------------- Menú contextual de emociones ---------------- */
function clampMenuPosition(menu){
  const r = menu.getBoundingClientRect();
  if(r.right > window.innerWidth) menu.style.left = Math.max(0, window.innerWidth - r.width - 4) + 'px';
  if(r.bottom > window.innerHeight) menu.style.top = Math.max(0, window.innerHeight - r.height - 4) + 'px';
}
function openCtxMenu(x,y,cue){
  const menu = document.getElementById('ctxMenu');
  menu.innerHTML = Object.entries(EMOTIONS).map(([key,emo])=>
    `<div data-emo="${key}">${emo} ${key}</div>`).join('') + `<hr><div data-emo="__clear">✕ Quitar emoción</div>`;
  menu.style.left = x+'px'; menu.style.top = y+'px'; menu.style.display='block';
  clampMenuPosition(menu);
  menu.querySelectorAll('div[data-emo]').forEach(el=>{
    el.onclick = ()=>{
      const v = el.dataset.emo;
      cue.emotion = v==='__clear' ? null : v;
      menu.style.display='none';
      render();
    };
  });
}
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#ctxMenu')) document.getElementById('ctxMenu').style.display='none';
});
