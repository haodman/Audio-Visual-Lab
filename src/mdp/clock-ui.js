/* Clock controls and local-only review photographs; no object recognition. */
window.MDPClockUI=(()=>{
  let env;
  const state={clockState:null,appearance:null};
  function update(){
    document.querySelector('#mdpStatus').textContent='Full-frame white clock · smooth audio-reactive outline';
    document.querySelector('#mdpReason').textContent='The hand points to the highlighted word on each beat.';
    document.querySelector('#mdpAppearance').textContent=state.appearance?.mode||'White outline and hand with a soft shadow. Word colors are adjustable.';
  }
  function changed(){MDPComposition.invalidate();state.clockState=null;state.appearance=null;if(env?.S.effectGroup==='stickers')env.selectFx('mdpClock');}
  function maskReady(){} // The full-frame clock is independent of matting progress.
  function start(){env.selectFx('mdpClock');}
  function selected(id){document.querySelector('#mdpMatchBar').hidden=id!=='mdpClock';update();}
  function init(e){
    env=e;
    const rules=document.querySelector('#mdpRules');
    for(const r of [...MDPRules.rules,...MDPRules.appearanceRules]){
      const article=document.createElement('article'),h=document.createElement('h4');h.textContent=r.title;article.appendChild(h);
      for(const str of [r.trigger,r.detail,r.motion]){const p=document.createElement('p');p.textContent=str;article.appendChild(p);}rules.appendChild(article);
    }
    document.querySelector('#mdpRulesBtn').onclick=()=>{update();env.openSheet('stickers');};
    document.querySelector('#mdpPhotoUpload').onclick=()=>document.querySelector('#photoFile').click();
    if(['localhost','127.0.0.1'].includes(location.hostname)){
      fetch('review-assets/manifest.json').then(r=>r.ok?r.json():[]).then(photos=>{
        const grid=document.querySelector('#mdpTestPhotos');
        for(const p of photos){
          const b=document.createElement('button'),img=new Image(),name=document.createElement('span');img.src=p.src;img.loading='lazy';img.alt=p.name;name.textContent=p.name;b.append(img,name);
          b.onclick=()=>{const im=new Image();im.onload=()=>{start();env.setImage(im);env.S.photoIdx=-1;document.querySelector('#photoCount').textContent=p.name+' · local test';document.querySelectorAll('#photos button').forEach(b=>b.classList.remove('on'));env.closeSheet();};im.src=p.src;};grid.appendChild(b);
          if(new URLSearchParams(location.search).get('review')===p.id){const run=()=>setTimeout(()=>b.click(),150);document.readyState==='complete'?run():addEventListener('load',run,{once:true});}
        }
        document.querySelector('#mdpTests').hidden=!photos.length;
      }).catch(()=>{});
    }
    update();
  }
  return {state,init,changed,maskReady,start,selected};
})();
