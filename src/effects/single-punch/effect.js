/* Single-image punch: photo analysis and composition are cached, while the
 * reveal schedule is derived exclusively from analysed audio and sample RMS. */
function createSinglePunchEffect({W, H, src, ctx, S, R, Sel, songTime}) {
  const cap = (x, a, b) => Math.max(a, Math.min(b, x));
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rgb = c => `rgb(${c.map(Math.round).join(',')})`;
  const luminance = c => (c[0] * .2126 + c[1] * .7152 + c[2] * .0722) / 255;
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  const random = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const state = { variation: 0, showAll: false, scene: null, origin: 0, count: 0 };
  // These palettes never borrow colors from the photograph. The two color
  // modes have separate provenance, including every small accent square.
  const clashPalettes = {
    '柠檬紫蓝': ['#E9EF54','#A68AF2','#4E79EE','#FF896C','#F28CB8','#7EE0C3','#FFC65C','#D0B9FF'],
    '珊瑚青橙': ['#F67868','#57CBCD','#FFCA57','#9888ED','#F8A6C9','#7EDA99','#5E95EB','#F0DE93'],
    '电光糖果': ['#DFF34F','#7181F5','#FD7FA3','#FBB464','#69DCC8','#BF83E7','#66ACEF','#F7DA68']
  };
  const fromHex = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  function analyse(photo) {
    // Samples are exact pixels of the visible photo, not synthesized colors.
    // Bin averages only help choose a representative; the output is always one
    // actual member pixel of that bin, with no hue/saturation/lightness edits.
    let pixels;
    try { pixels=photo.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data; }
    catch (_) { return {unreadable:true,blank:.4,colors:[],samples:[],cells:[]}; }
    const w=108,h=192,lum=new Float32Array(w*h),bins=new Map(),samples=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const sx=Math.min(W-1,Math.floor((x+.5)*W/w)),sy=Math.min(H-1,Math.floor((y+.5)*H/h)),i=(sy*W+sx)*4;
      const color=[pixels[i],pixels[i+1],pixels[i+2]],key=(color[0]>>5)*64+(color[1]>>5)*8+(color[2]>>5);
      lum[y*w+x]=luminance(color);const sample={color,x:sx,y:sy};samples.push(sample);
      let bin=bins.get(key);if(!bin)bins.set(key,bin={n:0,sum:[0,0,0],members:[]});
      bin.n++;color.forEach((v,j)=>bin.sum[j]+=v);bin.members.push(sample);
    }
    const candidates=[...bins.values()].filter(b=>b.n>=samples.length*.003).sort((a,b)=>b.n-a.n).map(bin=>{
      const mean=bin.sum.map(v=>v/bin.n);let representative=bin.members[0];
      for(const sample of bin.members)if(distance(sample.color,mean)<distance(representative.color,mean))representative=sample;
      return {...representative,n:bin.n};
    });
    const selected=[];
    if(candidates.length)selected.push(candidates[0]);
    while(selected.length<8) {
      let best=null,score=-1;
      for(const c of candidates) {
        const separation=Math.min(...selected.map(p=>distance(c.color,p.color)));
        if(separation<35)continue;
        const importance=.65+.35*Math.sqrt(c.n/candidates[0].n),value=separation*importance;
        if(value>score){score=value;best=c;}
      }
      if(!best)break;selected.push(best);
    }
    const colors=selected.map(c=>c.color);
    const cells=[]; let blank=0;
    for(let cy=0;cy<16;cy++) for(let cx=0;cx<9;cx++) {
      let sum=0,sq=0,e=0,n=0;
      for(let y=cy*12+1;y<(cy+1)*12-1;y++)for(let x=cx*12+1;x<(cx+1)*12-1;x++) {
        const i=y*w+x,v=lum[i],gx=Math.abs(v-lum[i+1]),gy=Math.abs(v-lum[i+w]); sum+=v;sq+=v*v;e+=gx+gy;n++;
      }
      const detail=cap(Math.sqrt(Math.max(0,sq/n-(sum/n)**2))*2.8+e/n*3,0,1);
      if(detail<.22)blank++; cells.push({x:(cx+.5)/9,y:(cy+.5)/16,detail,lum:sum/n});
    }
    blank/=cells.length;
    return {w,h,blank,colors,samples:selected,cells};
  }
  function makeScene(p) {
    const photo=canvas(W,H);photo.getContext('2d').drawImage(src,0,0); const a=state.analysis;
    const rng=random(state.seed+state.variation*104729);
    const paletteSource=p.palette==='照片取色'?'photo':'clash';
    const colorSet=paletteSource==='photo'?a.colors:(clashPalettes[p.clash]||clashPalettes['柠檬紫蓝']).map(fromHex);
    const count=colorSet.length?Math.round(cap((20+a.blank*14)*p.density,10,48)):0,nodes=[];
    const colorOrder=colorSet.map((_,i)=>i);
    for(let i=colorOrder.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[colorOrder[i],colorOrder[j]]=[colorOrder[j],colorOrder[i]];}
    for(let i=0;i<count;i++) {
      const size=p.size*(.78+rng()*.42)*(i%9===0?1.1:1);
      const c=canvas(Math.ceil(size)+4,Math.ceil(size)+4),g=c.getContext('2d');
      const color=colorSet[colorOrder[i%colorOrder.length]];
      // Opaque square: no photo fragments, complementary accents, gradients,
      // white/black grain or tint layers may contaminate the chosen palette.
      g.fillStyle=rgb(color);g.fillRect((c.width-size)/2,(c.height-size)/2,size,size);
      nodes.push({size,sprite:c,phase:rng()*Math.PI*2,color:color.slice(),paletteSource});
    }
    const scene={photo,a,nodes,shape:'正方形',paletteSource,colorSet,count};
    scene.baseLayout=arrange(scene,p,0);return scene;
  }
  function arrange(scene,p,step) {
    const rng=random(state.seed+state.variation*104729+step*13007),placed=[];
    for(const n of scene.nodes) {
      const size=n.size,margin=size*.72+6;let best=null,bestScore=-Infinity;
      for(let attempt=0;attempt<70;attempt++) {
        const x=margin+rng()*(W-2*margin),y=margin+rng()*(H-2*margin),cell=scene.a.cells[Math.min(15,Math.floor(y/H*16))*9+Math.min(8,Math.floor(x/W*9))];
        const detail=cell?.detail||0,center=Math.exp(-Math.pow((x/W-.5)/.23,2)-Math.pow((y/H-.4)/.28,2));
        let separation=1.6;for(const q of placed)separation=Math.min(separation,Math.hypot(x-q.x,y-q.y)/(size*.6+q.size*.6+22));
        const zone=placed.filter(q=>Math.floor(q.y/H*4)===Math.floor(y/H*4)).length;
        const score=Math.min(2.6,separation)*2.4-detail*(.6+p.protect)-center*p.protect*.85-zone*.12+rng()*.35;
        if(score>bestScore){bestScore=score;best={x,y,size};}
      }
      placed.push(best);
    }
    return placed;
  }
  function schedule(analysis,buffer) {
    if(!analysis||!buffer)return [];
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),sr=buffer.sampleRate;
    // Refine the shared beat grid to a nearby audible attack. This is local
    // PCM energy analysis, never a wall-clock BPM animation or an AI beat model.
    const hop=Math.max(1,Math.round(sr*.005)),energy=new Float32Array(Math.ceil(buffer.length/hop));
    for(let j=0;j<energy.length;j++) {
      let sum=0,n=0;for(let i=j*hop;i<Math.min(buffer.length,(j+1)*hop);i+=8)for(const ch of channels){sum+=ch[i]*ch[i];n++;}
      energy[j]=Math.sqrt(sum/Math.max(1,n));
    }
    const beats=analysis.beats.map((gridTime,beatIndex)=>{
      let t=gridTime,best=.001;
      const start=Math.max(2,Math.floor((gridTime-.07)*sr/hop)),end=Math.min(energy.length-1,Math.ceil((gridTime+.07)*sr/hop));
      for(let j=start;j<=end;j++) {
        const attack=energy[j]-energy[j-2],proximity=1-.45*Math.abs(j*hop/sr-gridTime)/.075;
        const score=attack*proximity;
        if(attack>energy[j]*.18 && score>best){best=score;t=j*hop/sr;}
      }
      let sum=0,n=0;for(let i=Math.max(0,Math.floor((t-.015)*sr));i<Math.min(buffer.length,Math.floor((t+.065)*sr));i+=12)for(const ch of channels){sum+=ch[i]*ch[i];n++;}
      return {t,gridTime,beatIndex,rms:Math.sqrt(sum/Math.max(1,n))};
    });
    const sorted=beats.map(b=>b.rms).sort((a,b)=>a-b),strong=sorted[Math.floor((sorted.length-1)*.82)]||0;
    return beats.filter(b=>b.rms>Math.max(.0025,strong*.075));
  }
  function resetStart(){state.origin=songTime();state.showAll=false;state.birthKey='';state.count=0;state.layoutStep=0;}
  function syncPanel() {
    const status=document.getElementById('singlePunchStatus'),scene=state.scene;
    if(!status||!scene)return;
    const text=scene.paletteSource==='photo'?(scene.a.unreadable?'无法读取照片颜色，请换成本地照片或选择和谐撞色':`全部照片取色 · ${scene.colorSet.length} 色 · 正方形`):`全部和谐撞色 · ${S.params.singlePunch.clash} · ${scene.colorSet.length} 色`;
    if(status.textContent!==text)status.textContent=text;
    const swatches=document.getElementById('singlePunchSwatches'),paletteKey=scene.paletteSource+scene.colorSet.map(rgb).join('|');
    if(swatches&&swatches.dataset.color!==paletteKey){
      swatches.dataset.color=paletteKey;swatches.replaceChildren();for(const color of scene.colorSet){const dot=document.createElement('span');dot.style.background=rgb(color);dot.title=rgb(color);swatches.appendChild(dot);}
    }
    const clashRow=document.querySelector('#params .p-clash');if(clashRow)clashRow.hidden=scene.paletteSource==='photo';
    const progress=document.getElementById('singlePunchProgress');if(progress)progress.textContent=state.showAll?'构图预览 · 每两拍重排':`${state.count} / ${scene.count} · ${state.count===scene.count?'每两拍重排':'每拍一个'}`;
    const all=document.getElementById('singlePunchAll');if(all){all.textContent=state.showAll?'返回节奏动效':'看铺满效果';all.setAttribute('aria-pressed',String(state.showAll));}
  }
  return {
    name:'单图方块打孔',icon:'■',desc:'一拍一个 · 隔拍重排 · 独立配色',
    hint:'只用正方形，每个有效拍点只出现一个，利落落位。铺满后每两拍重新排布一次，拍点之间轻微漂浮。照片取色的全部方块都来自当前画面；和谐撞色的全部方块都来自独立配色方案，两种来源不混用。暂停定格。',
    params:[Sel('palette','配色来源',['照片取色','和谐撞色'],'照片取色'),Sel('clash','撞色方案',Object.keys(clashPalettes),'柠檬紫蓝'),R('density','方块疏密',.55,1.6,1,.05),R('size','方块大小',20,62,38,1),R('drift','轻飘幅度',0,5,1.5,.1),R('protect','主体留白',0,2,1,.1)],state,
    enter(){resetStart();},
    buildPanel(box) {
      const panel=document.createElement('div');panel.className='single-punch-panel';
      const status=document.createElement('div');status.id='singlePunchStatus';status.className='single-punch-status';status.textContent='正在分析照片…';panel.appendChild(status);
      const info=document.createElement('div');info.className='single-punch-info';const swatches=document.createElement('div');swatches.id='singlePunchSwatches';info.appendChild(swatches);const progress=document.createElement('span');progress.id='singlePunchProgress';info.appendChild(progress);panel.appendChild(info);
      const actions=document.createElement('div');actions.className='single-punch-actions';
      for(const [label,id,action] of [['重新铺开','singlePunchReplay',()=>resetStart()],['看铺满效果','singlePunchAll',()=>{state.showAll=!state.showAll;state.previewOrigin=songTime();state.birthKey='';}],['换个排布','singlePunchShuffle',()=>{state.variation++;state.sceneKey='';}]]) {const b=document.createElement('button');b.type='button';b.className='chip';b.id=id;b.textContent=label;b.onclick=()=>{action();syncPanel();};actions.appendChild(b);}panel.appendChild(actions);box.prepend(panel);syncPanel();
    },
    draw(f,p) {
      if(!S.media){ctx.drawImage(src,0,0);return;}
      if(state.sourceKey!==S.srcKey){
        state.sourceKey=S.srcKey;state.analysis=analyse(src);state.seed=1;for(const c of state.analysis.colors)for(const v of c)state.seed=(state.seed*31+Math.round(v))|0;
        state.sceneKey='';state.variation=0;resetStart();
      }
      const key=[state.sourceKey,p.palette,p.clash,p.density,p.size,p.protect,state.variation].join('|');
      if(key!==state.sceneKey){state.scene=makeScene(p);state.sceneKey=key;state.birthKey='';state.layoutStep=-1;}
      if(state.buffer!==S.buffer||state.audioAnalysis!==S.analysis){state.buffer=S.buffer;state.audioAnalysis=S.analysis;state.events=schedule(S.analysis,S.buffer);state.origin=f.t;state.birthKey='';state.showAll=false;}
      // A backward seek or song loop restarts from that musical position.
      if(f.t<(state.lastSongTime??f.t)-.15){state.origin=f.t;state.birthKey='';}
      state.lastSongTime=f.t;
      const scene=state.scene,birthKey=[state.origin,scene.count,state.showAll,state.previewOrigin].join('|');
      if(state.birthKey!==birthKey){
        state.birthKey=birthKey;
        const eligible=(state.events||[]).filter(b=>b.t>=state.origin-.001);
        const birthEvents=eligible.slice(0,scene.count);state.births=birthEvents.map(b=>b.t);
        const fullEvent=state.showAll?(state.events||[]).find(b=>b.t>=state.previewOrigin):birthEvents.length===scene.count?birthEvents[scene.count-1]:null;
        state.reflows=fullEvent?(state.events||[]).filter(b=>b.beatIndex>fullEvent.beatIndex&&(b.beatIndex-fullEvent.beatIndex)%2===0):[];
        state.layoutStep=-1;
      }
      let layoutStep=0,reflowTime=-Infinity;
      for(const e of state.reflows){if(e.t>f.t)break;layoutStep++;reflowTime=e.t;}
      if(layoutStep!==state.layoutStep){state.layoutStep=layoutStep;state.layout=layoutStep?arrange(scene,p,layoutStep):scene.baseLayout;}
      state.reflowTime=reflowTime;
      ctx.drawImage(scene.photo,0,0);let count=0;
      scene.nodes.forEach((n,i)=>{
        const birth=state.births[i]??Infinity,age=state.showAll?2:f.t-birth;if(age<0)return;count++;
        const hitAge=Math.min(age,f.t-reflowTime),u=cap(hitAge/.10,0,1),arrival=1-(1-u)**3,settle=Math.sin(Math.PI*u)*.045;
        const drift=p.drift*(.65+.35*Math.sin(n.phase+f.t*.12));
        const dx=Math.sin(f.t*.71+n.phase)*drift,dy=Math.cos(f.t*.56+n.phase)*drift;
        ctx.save();const anchor=state.layout[i];ctx.translate(anchor.x+dx,anchor.y+dy);ctx.scale(.9+arrival*.1+settle,.9+arrival*.1+settle);ctx.globalAlpha=1;
        ctx.drawImage(n.sprite,-n.sprite.width/2,-n.sprite.height/2);ctx.restore();
      });
      // Reuse the app's shared MODNet result; never run an effect-specific
      // person cutout. It naturally occludes marks behind the person.
      if(p.protect>0 && S.cache.subjHQ && S.cache.subj){ctx.save();ctx.globalAlpha=Math.min(1,p.protect);ctx.drawImage(S.cache.subj,0,0);ctx.restore();}
      state.count=count;syncPanel();
    }
  };
}
