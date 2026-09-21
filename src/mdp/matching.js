/* Lazy local inference. Neither uploaded pixels nor audio leave the browser. */
window.MDPMatch=(()=>{
  const state={photoKey:null,audioKey:null,detections:[],colors:[],rejected:[],matches:MDPRules.rank(),music:null,photoStatus:'Select a photo to match a prominent subject.',audioStatus:'Music mood has not been checked.',photoBusy:false,audioBusy:false,automatic:true};
  let env,worker,sequence=0,pending=new Map(),photoTimer;const photoCache=new Map();
  function modelWorker(){
    let mod,vision,chain=Promise.resolve();
    async function run({id,kind,data}){
      const progress=message=>postMessage({id,progress:message});
      try{
        if(!mod){mod=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm');mod.env.allowLocalModels=false;mod.env.backends.onnx.wasm.numThreads=1;mod.env.backends.onnx.wasm.proxy=false;}
        const progress_callback=p=>{if(p.status==='progress'&&p.total)progress(`Downloading ${kind==='vision'?'image':'music'} model: ${Math.round(p.loaded/p.total*100)}%`);};
        if(kind==='vision'){
          if(!vision){progress('Loading image model for the first time…');vision=await mod.pipeline('zero-shot-object-detection','Xenova/owlvit-base-patch32',{device:'wasm',dtype:'q8',progress_callback});}
          progress('Finding objects and people…');
          const raw=new mod.RawImage(new Uint8ClampedArray(data.pixels),data.width,data.height,4);
          const found=await vision(raw,data.labels,{threshold:.055,top_k:45});
          const target=d=>data.labels.indexOf(d.label)>=0&&data.labels.indexOf(d.label)<6;
          const area=b=>Math.max(0,b.xmax-b.xmin)*Math.max(0,b.ymax-b.ymin);
          const overlaps=(a,b)=>Math.max(0,Math.min(a.xmax,b.xmax)-Math.max(a.xmin,b.xmin))*Math.max(0,Math.min(a.ymax,b.ymax)-Math.max(a.ymin,b.ymin))/Math.max(1,Math.min(area(a),area(b)));
          const seen=new Set(),candidates=found.filter(d=>{if(!target(d)||d.score<.075||d.score>=.12||seen.has(d.label)||found.some(v=>target(v)&&v.score>=.12&&overlaps(v.box,d.box)>.5))return false;seen.add(d.label);return true;}).sort((a,b)=>Number(b.label==='cotton candy')-Number(a.label==='cotton candy')).slice(0,2);
          for(const d of candidates){
            progress('Checking an uncertain object up close…');
            const b=d.box,cx=(b.xmin+b.xmax)/2,cy=(b.ymin+b.ymax)/2,bw=Math.max(96,(b.xmax-b.xmin)*1.3),bh=Math.max(96,(b.ymax-b.ymin)*1.3),x0=Math.max(0,Math.floor(cx-bw/2)),y0=Math.max(0,Math.floor(cy-bh/2)),cw=Math.min(data.width,Math.ceil(cx+bw/2))-x0,ch=Math.min(data.height,Math.ceil(cy+bh/2))-y0;
            if(cw<2||ch<2)continue;const crop=new Uint8ClampedArray(cw*ch*4);for(let y=0;y<ch;y++)crop.set(new Uint8ClampedArray(data.pixels).subarray(((y+y0)*data.width+x0)*4,((y+y0)*data.width+x0+cw)*4),y*cw*4);
            const labels=d.label==='cotton candy'?['cotton candy','candy floss','a stick of cotton candy','a lamp','a balloon','a person']:data.labels;
            const confirmed=(await vision(new mod.RawImage(crop,cw,ch,4),labels,{threshold:.075,top_k:12})).map(v=>({...v,label:['candy floss','a stick of cotton candy'].includes(v.label)?'cotton candy':v.label}));
            d.recheck=confirmed.map(v=>({label:v.label,score:v.score}));
            const best=confirmed.filter(v=>target(v)).sort((a,b)=>b.score-a.score)[0];
            const competitor=confirmed.filter(v=>v.label!==d.label&&v.label!=='a person').reduce((m,v)=>Math.max(m,v.score),0);
            if(best&&best.label===d.label&&best.score>=.12&&best.score-competitor>=.015){const v=best.box;found.push({...best,verifiedBy:'local crop recheck',initialScore:d.score,box:{xmin:x0+v.xmin,ymin:y0+v.ymin,xmax:x0+v.xmax,ymax:y0+v.ymax}});}
          }
          const result=found.map(d=>({...d,box:{xmin:Math.max(0,d.box.xmin/data.width),ymin:Math.max(0,d.box.ymin/data.height),xmax:Math.min(1,d.box.xmax/data.width),ymax:Math.min(1,d.box.ymax/data.height)}}));
          postMessage({id,result});
        }
      }catch(e){postMessage({id,error:e.message||String(e)});}
    }
    onmessage=e=>{chain=chain.then(()=>run(e.data));};
  }
  function request(kind,data,onProgress){
    if(!worker){const url=URL.createObjectURL(new Blob([`(${modelWorker.toString()})()`],{type:'text/javascript'}));worker=new Worker(url,{type:'module'});URL.revokeObjectURL(url);
      worker.onmessage=({data:d})=>{const p=pending.get(d.id);if(!p)return;if(d.progress){p.progress(d.progress);return;}clearTimeout(p.timeout);pending.delete(d.id);d.error?p.reject(Error(d.error)):p.resolve(d.result);};
      worker.onerror=()=>{for(const p of pending.values()){clearTimeout(p.timeout);p.reject(Error('The model worker could not start.'));}pending.clear();worker.terminate();worker=null;};
    }
    return new Promise((resolve,reject)=>{const id=++sequence,timeout=setTimeout(()=>{pending.delete(id);reject(Error('Model download or inference timed out. Try again.'));},240000);pending.set(id,{resolve,reject,timeout,progress:onProgress});worker.postMessage({id,kind,data});});
  }
  const fxFor={sunshine:'mdpSunshine',clock:'mdpClock'};
  function update(){
    state.matches=MDPRules.rank({detections:state.detections});
    state.rejected=state.detections.filter(d=>MDPRules.targetLabels.indexOf(d.label)<6&&MDPRules.targetLabels.indexOf(d.label)>=0&&d.score>=.10).map(d=>({label:d.label,box:d.box,...MDPRules.prominence(d,state.detections)})).filter(d=>!d.eligible);
    if(env)refineFlames();
    if(env&&state.automatic&&env.S.fx.startsWith('mdp')&&!state.photoBusy){
      let choice=state.matches[0].id;
      if(env.S.fx!==fxFor[choice])env.selectFx(fxFor[choice],{automatic:true});
    }
    const el=document.querySelector('#mdpStatus');if(el)el.textContent=state.photoStatus;
    const retry=document.querySelector('#mdpRetry');if(retry)retry.hidden=!state.error;
    const box=document.querySelector('#mdpChoices');if(box)box.replaceChildren();
    if(!env)return;
    const chosen=state.matches.find(m=>fxFor[m.id]===env.S.fx);
    const reason=document.querySelector('#mdpReason');if(reason)reason.textContent=state.automatic?(chosen?.reason||'Matched to the available photo space.'):'Manual selection · selecting another photo automatically matches again.';
    const appearance=document.querySelector('#mdpAppearance');if(appearance)appearance.textContent=(state.appearance?.mode||'Image-adaptive ink')+'. '+(state.layoutNote||'');
    const detail=document.querySelector('#mdpEvidence');if(detail)detail.textContent=JSON.stringify({detections:state.detections,rejectedSubjects:state.rejected,automatic:state.automatic,layout:state.layoutNote,palette:state.appearance},null,2);
  }
  function refineFlames(){
    const g=env.src.getContext('2d',{willReadFrequently:true}),{W,H}=env;
    for(const m of state.matches){if(m.object!=='candle')continue;const b=m.box,x0=Math.max(0,Math.floor(b.xmin*W)),x1=Math.min(W,Math.ceil(b.xmax*W)),y0=Math.max(0,Math.floor((b.ymin-.07)*H)),y1=Math.min(H,Math.ceil((b.ymin+(b.ymax-b.ymin)*.5)*H));if(x1<=x0||y1<=y0)continue;const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;let sx=0,sy=0,weight=0;for(let i=0;i<d.length;i+=4){const [r,gr,bl]=d.slice(i,i+3);if(r>205&&gr>140&&r>bl*1.1){const v=(r+gr)*.5;sx+=(x0+(i/4)%(x1-x0))*v;sy+=(y0+Math.floor(i/4/(x1-x0)))*v;weight+=v;}}if(weight)m.anchor={x:sx/weight/W,y:sy/weight/H};}
  }
  async function photo(force=false){
    if(!env||!env.S.media||env.S.isVideo){state.photoStatus='Use a still photo for automatic matching.';update();return;}
    const key=env.S.srcKey;if(!force&&state.photoKey===key)return;
    if(state.photoBusy){clearTimeout(photoTimer);photoTimer=setTimeout(()=>photo(force),500);return;}
    const cacheKey=env.S.media.currentSrc||env.S.media.src;
    if(!force&&photoCache.has(cacheKey)){state.photoKey=key;state.photoBusy=false;state.detections=structuredClone(photoCache.get(cacheKey));state.error=null;state.photoStatus='Photo matched automatically · cached image check';MDPComposition.invalidate();update();return;}
    state.photoBusy=true;state.photoKey=key;state.photoStatus='Preparing image matching…';state.detections=[];state.colors=[];state.rejected=[];update();
    const c=document.createElement('canvas');c.width=360;c.height=640;const g=c.getContext('2d');g.drawImage(env.src,0,0,360,640);const pixels=g.getImageData(0,0,360,640).data;
    try{
      const found=await request('vision',{pixels,width:360,height:640,labels:MDPRules.targetLabels},message=>{if(key===env.S.srcKey){state.photoStatus=message;update();}});
      if(key!==env.S.srcKey)return;state.error=null;state.detections=found;
      const samplePixels=env.src.getContext('2d',{willReadFrequently:true}).getImageData(0,0,env.W,env.H).data;
      for(const d of found){if(d.label!=='the sun')continue;const b=d.box,w=(b.xmax-b.xmin)*env.W,h=(b.ymax-b.ymin)*env.H;if(w/h<.65||w/h>1.5||w*h/(env.W*env.H)>.05)continue;let count=0,warm=0;for(let y=Math.ceil(b.ymin*env.H);y<b.ymax*env.H;y++)for(let x=Math.ceil(b.xmin*env.W);x<b.xmax*env.W;x++){const i=(y*env.W+x)*4;count++;if(samplePixels[i]>175&&samplePixels[i+1]>120&&samplePixels[i]>samplePixels[i+2]*1.1)warm++;}if(warm/Math.max(1,count)>.4)d.visualVerified='compact warm bright disk';}
      photoCache.set(cacheKey,structuredClone(found));
      state.photoStatus=`Photo matched automatically · ${MDPRules.objects(found).length} prominent subject match(es)`;
      update();refineFlames();
    }catch(e){if(key===env.S.srcKey){state.photoKey=null;state.photoStatus='Image model unavailable. The text clock is ready; Retry to match foreground objects.';state.error=e.message;update();}}
    finally{state.photoBusy=false;MDPComposition.invalidate();update();if(key!==env.S.srcKey)photo();}
  }
  function music(){} // This revision has no music-genre sticker branch.
  function trackChanged(){}
  function changed(){
    state.photoKey=null;state.detections=[];state.colors=[];state.rejected=[];state.error=null;state.appearance=null;state.layoutNote='';state.photoStatus='New photo · matching automatically…';MDPComposition.invalidate();
    if(env){const p=env.S.params.mdpSunshine;p.x=0;p.y=0;p.colorMode='Image adaptive';}
    if(env&&(env.S.fx.startsWith('mdp')||env.S.effectGroup==='stickers')){state.automatic=true;env.selectFx('mdpClock',{automatic:true});clearTimeout(photoTimer);photoTimer=setTimeout(()=>photo(),30);}else update();
  }
  function maskReady(){MDPComposition.invalidate();update();}
  function start(){state.automatic=true;env.selectFx('mdpClock',{automatic:true});photo();update();}
  function init(e){env=e;
    const rules=document.querySelector('#mdpRules');for(const r of [...MDPRules.rules,...MDPRules.appearanceRules]){const article=document.createElement('article');const h=document.createElement('h4');h.textContent=r.title;article.appendChild(h);for(const str of [r.trigger,r.detail,r.motion]){const p=document.createElement('p');p.textContent=str;article.appendChild(p);}rules.appendChild(article);}
    document.querySelector('#mdpRetry').onclick=()=>{state.automatic=true;photo(true);};
    document.querySelector('#mdpRulesBtn').onclick=()=>{update();env.openSheet('stickers');};
    document.querySelector('#mdpPhotoUpload').onclick=()=>document.querySelector('#photoFile').click();
    if(['localhost','127.0.0.1'].includes(location.hostname)){fetch('review-assets/manifest.json').then(r=>r.ok?r.json():[]).then(photos=>{const grid=document.querySelector('#mdpTestPhotos');for(const p of photos){const b=document.createElement('button');const img=new Image();img.src=p.src;img.loading='lazy';img.alt=p.name;const name=document.createElement('span');name.textContent=p.name;b.append(img,name);b.title=p.expected;b.onclick=()=>{const im=new Image();im.onload=()=>{state.automatic=true;env.selectFx('mdpClock',{automatic:true});env.setImage(im);env.S.photoIdx=-1;document.querySelector('#photoCount').textContent=p.name+' · local test';document.querySelectorAll('#photos button').forEach(b=>b.classList.remove('on'));env.closeSheet();};im.src=p.src;};grid.appendChild(b);if(new URLSearchParams(location.search).get('review')===p.id){const run=()=>setTimeout(()=>b.click(),150);document.readyState==='complete'?run():addEventListener('load',run,{once:true});}}document.querySelector('#mdpTests').hidden=!photos.length;}).catch(()=>{});}
    update();
  }
  function selected(id,{automatic=false}={}){state.automatic=automatic;const visible=id.startsWith('mdp');const row=document.querySelector('#mdpMatchBar');if(row)row.hidden=!visible;if(visible&&env?.S.media&&state.photoKey!==env.S.srcKey&&!state.photoBusy){clearTimeout(photoTimer);photoTimer=setTimeout(()=>photo(),30);}update();}
  return {state,init,photo,music,trackChanged,changed,maskReady,selected,start,update};
})();
