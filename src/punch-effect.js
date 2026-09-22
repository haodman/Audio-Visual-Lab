/* Lightweight Audio Visual Lab adapter for the upper/lower punch treatment. */
function createPunchStudioEffect(){
 const cap=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=v=>{v=cap(v);return v*v*(3-2*v);};
 const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:Math.ceil(w),height:Math.ceil(h)});
 const random=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};
 function upperBound(a,t){let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(a[m]<=t)l=m+1;else r=m;}return l;}
 function build(photo,cfg){
  const width=ctx.canvas.width,height=ctx.canvas.height,half=height/2,photoTop=['tear','petal','leaf'].includes(cfg.shape),py=photoTop?0:half,by=photoTop?half:0;
  const iw=photo.naturalWidth||photo.videoWidth||photo.width,ih=photo.naturalHeight||photo.videoHeight||photo.height;
  const layout=PunchStudio.photoLayout(iw,ih,width,half,{fit:cfg.fit,focusX:cfg.focusX,focusY:cfg.focusY,zoom:cfg.zoom});
  const crop=make(width,half),cg=crop.getContext('2d');cg.drawImage(photo,layout.dx,layout.dy,layout.dw,layout.dh);
  const pal=PunchStudio.palette(photo,make,cfg.tone),paper=make(width,half),pg=paper.getContext('2d'),rand=random(cfg.seed);
  if(cfg.color)pal.hex=cfg.color;pg.fillStyle=pal.hex;pg.fillRect(0,0,width,half);
  pg.globalAlpha=.14;pg.strokeStyle=pal.text;pg.lineWidth=.55;
  const texStep=cfg.texture==='solid'?999:cfg.texture==='felt'?3:cfg.texture==='grid'?10:6;
  for(let x=0;x<width;x+=texStep){pg.beginPath();pg.moveTo(x,0);pg.lineTo(x,half);pg.stroke();}
  for(let y=0;y<half;y+=texStep){pg.beginPath();pg.moveTo(0,y);pg.lineTo(width,y);pg.stroke();}
  pg.globalAlpha=.12;for(let i=0;i<width*half/180;i++)pg.fillRect(rand()*width,rand()*half,1,1);pg.globalAlpha=1;
  const plan=PunchStudio.schedule(cfg.beats,{offset:cfg.offset,duration:cfg.duration,text:cfg.text});
  plan.motionCues=plan.beats.filter(b=>b>=plan.motionStart).filter((_,i)=>i%2===0);
  const bounds={x:width*.085,y:by+half*(photoTop ? .20 : .08),w:width*.83,h:half*.70},formations=PunchStudio.makeFormations(cfg.shape,cfg.count,bounds),pieces=[],placed=[];
  for(let i=0;i<cfg.count;i++){
   let sx=width/2,sy=half/2,best=-1;const inset=Math.min(width,half)*.07;
   for(let n=0;n<34;n++){const x=inset+rand()*(width-inset*2),y=inset+rand()*(half-inset*2),d=placed.reduce((v,q)=>Math.min(v,Math.hypot(q.x-x,q.y-y)),1e6);if(d>best){best=d;sx=x;sy=y;}}
   placed.push({x:sx,y:sy});const r=(10+rand()*3)*(cfg.size||1),size=Math.ceil(r*4),chip=make(size,size),q=chip.getContext('2d'),angle=(rand()-.5)*.55;
   q.translate(size/2,size/2);q.rotate(angle);PunchStudio.motif(q,cfg.shape,r);q.clip();q.rotate(-angle);q.drawImage(crop,-sx,-sy);
   pieces.push({i,sx,sy,r,size,chip,angle,phase:rand()*Math.PI*2,group:i%3,punch:plan.punch[Math.floor(i*plan.punch.length/cfg.count)]??0,paste:plan.paste[Math.floor(i*plan.paste.length/cfg.count)]??0});
  }
  return {width,height,half,photoTop,py,by,crop,paper,pal,plan,formations,pieces,cfg};
 }
 function stamp(c,a,x,y,rot=0,sx=1,sy=1,alpha=1){c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(rot);c.scale(sx,sy);c.drawImage(a.chip,-a.size/2,-a.size/2);c.restore();}
 function render(r,t,text){
  const {width,height,half,py,by,crop,paper,plan,pieces,formations,cfg}=r,c=ctx;c.clearRect(0,0,width,height);c.drawImage(paper,0,by);c.drawImage(crop,0,py);
  const cueIndex=upperBound(plan.motionCues,t)-1,bt=cueIndex>=0?plan.motionCues[cueIndex]:plan.motionStart,next=plan.motionCues[cueIndex+1]??bt+1.35,p=cap((t-bt)/Math.max(.1,next-bt)),pulse=cueIndex<0?0:Math.sin(Math.PI*p),step=Math.max(0,cueIndex+1),which=step%formations.length,old=(step-1+formations.length)%formations.length,u=step?ease((t-bt)/Math.min(1.15,(next-bt)*.78)):1;
  for(const a of pieces){if(t<a.punch)continue;c.save();c.translate(a.sx,py+a.sy);c.rotate(a.angle);PunchStudio.motif(c,cfg.shape,a.r);c.clip();c.rotate(-a.angle);c.drawImage(paper,-a.sx,-a.sy);c.restore();}
  c.save();c.beginPath();c.rect(0,0,width,height);c.clip();
  for(const a of pieces){if(t<a.paste)continue;const A=formations[step?old:0].points[a.i],B=formations[which].points[a.i];let x=A.x+(B.x-A.x)*u,y=A.y+(B.y-A.y)*u,rot=0,sx=1,sy=1;
   if(t<plan.motionStart){const k=ease((t-a.paste)/.34);x=a.sx+(formations[0].points[a.i].x-a.sx)*k;y=py+a.sy+(formations[0].points[a.i].y-(py+a.sy))*k;}
   else if(cfg.shape==='bird'||cfg.shape==='butterfly'){const flap=.38+.62*Math.abs(Math.cos(p*Math.PI));if(cfg.shape==='bird')sy=flap;else sx=flap;rot=Math.sin(p*Math.PI*2)*.07;}
   else if(cfg.shape==='tear'||cfg.shape==='leaf'||cfg.shape==='petal'){y+=cap((t-bt)/Math.max(.3,next-bt))*half*.16;rot=Math.sin(a.phase+t)*.22;}
   else if(a.group===step%3){sx=sy=1+pulse*.10;y-=pulse*5;}
   stamp(c,a,x,y,rot,sx,sy,.88+(a.group===step%3?pulse*.12:0));
  }c.restore();
  const copy=String(text||'').trim();if(copy&&t>=plan.textStart){let fs=13;c.font=`300 ${fs}px "Songti SC", Georgia, serif`;while(c.measureText(copy).width>width*.86&&fs>8){fs--;c.font=`300 ${fs}px "Songti SC", Georgia, serif`;}c.fillStyle=r.pal.text;c.textAlign='center';c.textBaseline='middle';c.fillText(copy,width/2,r.photoTop?by+33:by+half-33);}
 }
 return {name:'上下打孔',icon:'✂️',desc:'音乐剪纸 · 异位成群',hint:'轻量预览链路：照片与底纸只在换图或改参数时重建；播放仅更新打孔贴片与队形。预览使用真实画布尺寸，暂停定格。',
  params:[Sel('shape','剪影形状',['自动搭配',...Object.values(PunchStudio.names)],'自动搭配'),Sel('paper','背景质感',['自动搭配',...Object.values(PunchStudio.materials)],'自动搭配'),Sel('tone','背景明暗',['自动','深色','浅色'],'自动'),Sel('copy','文字来源',['自定义文字','自动歌词'],'自定义文字'),T('text','分界线旁的文字',''),Sel('crop','照片取景',['自动取景','手动取景'],'自动取景'),R('focusX','取景左右',0,1,.5,.01),R('focusY','取景上下',0,1,.5,.01),R('zoom','取景放大',1,2,1,.01),T('mood','歌曲补充词（可选）',''),R('count','打孔数量',12,26,22,1),R('size','剪影大小',.7,1.5,1,.05)],state:{},
  draw(f,p){const s=this.state,photo=S.media||splitFrame(),shape=Object.keys(PunchStudio.names).find(k=>PunchStudio.names[k]===p.shape)||'auto',texture=Object.keys(PunchStudio.materials).find(k=>PunchStudio.materials[k]===p.paper)||'auto',track=S.track?.id||'';
   if(s.source!==S.srcKey||s.track!==track||f.t<(s.last??f.t)-.1){s.source=S.srcKey;s.track=track;s.origin=f.t;s.key='';}s.last=f.t;
   if(s.cueSource!==S.srcKey){s.cueSource=S.srcKey;s.scene=PunchStudio.semantic({},'',PunchStudio.photoCues(photo,make));}
   const decision=PunchStudio.choose({scene:s.scene,mood:p.mood,title:S.track?.name||'',genre:S.track?.genre||'',lyrics:S.lyrics.map(x=>x.text).join(' '),shape,texture});
   const key=[S.srcKey,track,decision.shape,decision.texture,p.tone,p.count,p.size,p.crop,p.focusX,p.focusY,p.zoom,p.text,s.origin].join('|');
   if(key!==s.key){s.renderer=build(photo,{...decision,text:p.text,count:p.count,size:p.size,tone:({'深色':'dark','浅色':'light'})[p.tone]||'auto',beats:S.analysis?.beats||[],offset:s.origin,duration:Math.max(15,(S.buffer?.duration||15)-s.origin),seed:518,fit:p.crop==='手动取景'?'cover':'auto',focusX:p.focusX,focusY:p.focusY,zoom:p.zoom});s.key=key;s.decision=decision;}
   render(s.renderer,Math.max(0,f.t-s.origin),p.copy==='自动歌词'?lyricAt(f.t):p.text);
  }
 };
}
