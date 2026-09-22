/* Shared deterministic renderer: browser preview and offline movie use identical photo crops, rules and beat events. */
(function(root,factory){const shapes=typeof module==='object'?require('./punch-shapes.js'):root.PunchShapes;const api=factory(shapes);if(typeof module==='object')module.exports=api;else root.PunchStudio=api;})(globalThis,function(Shapes){
'use strict';
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const names={bird:'飞鸟',butterfly:'蝴蝶',tear:'水滴',petal:'花瓣',leaf:'树叶',spark:'四角星',hexstar:'六角星',star:'五角星',moon:'月亮',flower:'小花',tree:'树',square:'便利贴'};
const englishNames={bird:'Birds',butterfly:'Butterflies',tear:'Raindrops',petal:'Petals',leaf:'Leaves',spark:'Four-point stars',hexstar:'Six-point stars',star:'Five-point stars',moon:'Moons',flower:'Flowers',tree:'Trees',square:'Notes'};
const materials={weave:'细织布',linen:'亚麻',paper:'纤维纸',sand:'细沙砾',solid:'纯色',crayon:'蜡笔',rice:'宣纸',felt:'毛毡',grid:'方格纸',wash:'水彩纸'};
const englishMaterials={weave:'Woven cloth',linen:'Linen',paper:'Fiber paper',sand:'Fine sand',solid:'Solid color',crayon:'Crayon',rice:'Rice paper',felt:'Felt',grid:'Graph paper',wash:'Watercolor paper'};
const scenePatterns={sky:/sky|cloud|天空|云/,water:/water|sea\b|ocean|lake|beach|coast|湖|海|水面|沙滩/,forest:/forest|woods|woodland|森林/,tree:/tree|树/,flowers:/flower|floral|blossom|bouquet|花/,garden:/garden|vegetation|ferns|花园|植被|蕨/,night:/night|moon|starry|夜|月/,sheep:/sheep|flock|羊/,bird:/bird|鸟/,butterfly:/butterfly|蝴蝶/,leaf:/\bleaf\b|\bleaves\b|树叶|落叶/,autumn:/autumn|fall season|秋景/,blossom:/blossom|cherry|sakura|樱花|春日/,snow:/snow|雪/,city:/city|street|building|城市|街道/,portrait:/portrait|person|people|face|人像|人物/};
function rng(seed=92819){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function semantic(report={},hint='',visual={}){
 const scores={},repeated=[];for(const[k,re]of Object.entries(scenePatterns)){
  let global=0,tiles=0;
  for(const region of report.regions||[]){const score=Math.max(0,...(region.labels||[]).filter(v=>re.test(v.label.toLowerCase())&&!(k==='flowers'&&/sparse/.test(v.label.toLowerCase()))).map(v=>v.score));if(region.index===0)global=score;else if(score>=.20)tiles++;}
  scores[k]=Math.max(global,tiles>=4?.65:tiles>=2?.4:0,re.test(hint.toLowerCase())?.78:0);
  if(tiles>=4||((k==='forest'||k==='flowers'||k==='sheep')&&global>=.45))repeated.push(k);
 }
 // Color styling is direct evidence: no tree, flower or seasonal scene is required.
 scores.maillard=visual.maillard||0;scores.pink=visual.pink||0;
 const blooms=(report.regions||[]).filter(r=>r.index>0&&(r.labels||[]).some(v=>scenePatterns.blossom.test(v.label.toLowerCase())&&v.score>=.20));
 if(blooms.length>0&&blooms.length<4&&!repeated.includes('flowers'))scores.blossom=Math.max(scores.blossom,blooms.length>=2?.78:.55);
 if(repeated.includes('flowers'))scores.blossom=0;
 return {scores,repeated,engine:report.engine||'metadata'};
}
function choose({scene={},title='',lyrics='',genre='',mood='',shape='auto',texture='auto'}={}){
 const v=scene.scores||{},many=new Set(scene.repeated||[]),s=Object.fromEntries(Object.keys(names).map(k=>[k,0])),reasons=[];
 const add=(key,w,why)=>{s[key]+=w;if(w>0)reasons.push({shape:key,weight:w,reason:why});};
 add('spark',.7,'Neutral geometric fallback');add('hexstar',.6,'Neutral geometric fallback');
 const rules={sky:[['bird',4.8]],water:[['tear',5.2]],forest:[['butterfly',5]],tree:[['tree',3.8],['leaf',2.2]],flowers:[['butterfly',5.4]],garden:[['butterfly',4.5]],night:[['spark',4.9],['moon',4.2]],sheep:[['hexstar',5]],snow:[['hexstar',4.8]],city:[['square',3.2]],portrait:[['spark',1]],autumn:[['leaf',6]],blossom:[['petal',7]],maillard:[['leaf',12]],pink:[['petal',13]]};
 for(const[k,list]of Object.entries(rules))for(const[id,w]of list)add(id,w*(v[k]||0),`Image cue: ${k}`);
 const text=[title,lyrics.slice(0,5000),genre,mood].join(' ').toLowerCase();
 const moodRules=[[/stars?|celebrat|party|wish|星|庆祝|愿望/,['star',4.2],'Song cue: stars, celebration or wishes'],[/rain|tears?|cry|sad|unhappy|melanchol|lonely|忧郁|伤感|雨|泪|孤独/,['tear',3.4],'Song cue: rain, tears or melancholy'],[/romantic|love|kiss|touch|爱|浪漫|亲吻/,['butterfly',2.4],'Song cue: intimacy or romance'],[/young|youth|school|青春|校园|毕业/,['square',3.7],'Song cue: youth or school'],[/night|moon|夜|月/,['moon',2.7],'Song cue: night or moon'],[/autumn|falling leaves|秋|落叶/,['leaf',4],'Song cue: autumn or falling leaves'],[/spring|bloom|春|盛开/,['petal',3.2],'Song cue: spring or bloom'],[/sea|ocean|beach|海|沙滩/,['tear',3],'Song cue: sea or water'],[/playful|\bhappy\b|cute|俏皮|可爱/,['flower',2.2],'Song cue: playful or cute']];
 for(const[re,[id,w],why]of moodRules)if(re.test(text))add(id,w,why);
 // Repeated silhouettes are a hard veto for automatic selection; water is not a drop silhouette.
 const veto=new Set();if(many.has('flowers')||(v.flowers||0)>.45)veto.add('flower');if(many.has('forest')||(v.forest||0)>.4)veto.add('tree');if(many.has('bird'))veto.add('bird');if(many.has('butterfly'))veto.add('butterfly');if(many.has('leaf'))veto.add('leaf');if(many.has('flowers'))veto.add('petal');
 for(const id of veto)s[id]=-100;
 const ranked=Object.keys(s).sort((a,b)=>s[b]-s[a]),selected=shape!=='auto'&&names[shape]?shape:ranked[0];
 let mat=(v.water||0)>.35?'sand':(v.forest||0)>.4?'linen':Math.max(v.flowers||0,v.garden||0)>.35?'paper':selected==='square'?'grid':selected==='petal'?'rice':selected==='leaf'?'paper':selected==='flower'?'crayon':'weave';
 if(texture!=='auto'&&materials[texture])mat=texture;
 return {shape:selected,shapeName:names[selected],shapeEnglish:englishNames[selected],texture:mat,textureName:materials[mat],textureEnglish:englishMaterials[mat],photoTop:['tear','petal','leaf'].includes(selected),reasons:reasons.filter(x=>x.shape===selected).sort((a,b)=>b.weight-a.weight).slice(0,3).map(x=>x.reason),veto:[...veto],scores:s,alternatives:ranked.slice(0,3)};
}
function rgbHsl(r,g,b){r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;return[d?((hi===r?(g-b)/d:hi===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360:0,d?d/(1-Math.abs(2*l-1)):0,l];}
function hslRgb(h,s,l){const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return[f(0),f(8),f(4)].map(v=>Math.round(v*255));}
// Measure overall styling and central clothing-sized patches, not filenames or scene hints.
function photoCues(photo,createCanvas){
 const side=60,cv=createCanvas(side,side),g=cv.getContext('2d');g.drawImage(photo,0,0,side,side);const d=g.getImageData(0,0,side,side).data,tiles=Array.from({length:25},()=>({pink:0,brown:0,total:0}));let pink=0,brown=0,taupe=0,camel=0;
 for(let i=0;i<d.length;i+=4){const[h,s,l]=rgbHsl(d[i],d[i+1],d[i+2]),x=i/4%side,y=Math.floor(i/4/side),q=tiles[Math.floor(y/12)*5+Math.floor(x/12)];
  const isPink=((h>=315||h<=12)&&s>=.10&&l>=.48&&l<=.88)||(h>=305&&h<=345&&s>=.30&&l>=.32&&l<=.80);
  const isBrown=h>=8&&h<=45&&s>=.13&&s<=.70&&l>=.09&&l<=.44;
  if(isPink){pink++;q.pink++;}if(isBrown){brown++;q.brown++;}if(h>=15&&h<=48&&s>=.12&&s<=.48&&l>.44&&l<=.76)camel++;if(h>=15&&h<=55&&s>=.04&&s<.18&&l>=.20&&l<=.65)taupe++;q.total++;
 }
 const n=side*side,central=tiles.filter((_,i)=>i%5>=1&&i%5<=3&&Math.floor(i/5)>=1&&Math.floor(i/5)<=3),pinkPatch=Math.max(...central.map(t=>t.pink/t.total)),brownPatch=Math.max(...central.map(t=>t.brown/t.total)),pinkShare=pink/n,brownShare=brown/n,earthShare=(brown+camel+taupe)/n;
 // Require a substantial area, so lips, skin highlights and tiny accents do not decide the effect.
 const pinkCue=pinkShare>=.12||pinkShare>=.045&&pinkPatch>=.35;
 const brownCue=brownShare>=.15&&earthShare>=.35||brownShare>=.085&&brownPatch>=.48&&earthShare>=.25;
 return {pink:pinkCue?clamp(.72+pinkShare*.7,0,.98):0,maillard:brownCue?clamp(.72+brownShare*.5,0,.96):0,pinkShare,brownShare,earthShare,pinkPatch,brownPatch};
}
function palette(photo,createCanvas,mode='auto'){
 const cv=createCanvas(48,48),g=cv.getContext('2d');g.drawImage(photo,0,0,48,48);const data=g.getImageData(0,0,48,48).data,bins=Array.from({length:24},()=>({w:0,hx:0,hy:0,s:0,x:0,y:0}));let light=0;
 for(let i=0;i<data.length;i+=4){const[h,s,l]=rgbHsl(...data.slice(i,i+3));light+=l;if(s<.09||l<.07||l>.94)continue;const x=i/4%48,y=Math.floor(i/192),w=s*(.4+Math.sin(l*Math.PI)),q=bins[Math.floor(h/15)];q.w+=w;q.hx+=Math.cos(h*Math.PI/180)*w;q.hy+=Math.sin(h*Math.PI/180)*w;q.s+=s*w;q.x+=x*w;q.y+=y*w;}
 const b=bins.reduce((a,b)=>a.w>b.w?a:b),h=b.w?(Math.atan2(b.hy,b.hx)*180/Math.PI+360)%360:35,mean=light/(data.length/4),l=mode==='light'?.84:mode==='dark'?.26:mean>.5?.28:.82,s=b.w?clamp(b.s/b.w*.56,.12,.43):.04;
 const rgb=hslRgb(h,s,l),hex='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');return {hex,h,s,l,text:l<.5?'#f8f5ed':'#293138',source:{x:b.w?b.x/b.w/48:.5,y:b.w?b.y/b.w/48:.5},mean,rule:'Keep the dominant hue, reduce saturation, and contrast the paper lightness with the photo.'};
}
function schedule(beats=[],{offset=0,duration=15,text=''}={}){
 const all=[...new Set(beats.filter(Number.isFinite).map(b=>b-offset).filter(b=>b>=0&&b<duration))].sort((a,b)=>a-b),fallback=all.length<4;
 const events=fallback?Array.from({length:6},(_,i)=>.15+i*.55):all;
 const endpoint=events.filter(x=>x>=2.2&&x<=3.8).reduce((a,b)=>Math.abs(b-3)<Math.abs(a-3)?b:a,events[Math.min(5,events.length-1)]||3);
 let punch=events.filter(x=>x<=endpoint);if(punch.length>6)punch=Array.from({length:6},(_,i)=>punch[Math.round(i*(punch.length-1)/5)]);
 const punchEnd=punch.at(-1)||3;
 const pasteCandidates=all.filter(x=>x>punchEnd+.18&&x<=punchEnd+3.8);let paste;
 if(fallback||pasteCandidates.length<2)paste=Array.from({length:6},(_,i)=>punchEnd+.45+i*.48);else{const end=pasteCandidates.reduce((a,b)=>Math.abs(b-punchEnd-3)<Math.abs(a-punchEnd-3)?b:a);paste=pasteCandidates.filter(x=>x<=end);if(paste.length>6)paste=Array.from({length:6},(_,i)=>paste[Math.round(i*(paste.length-1)/5)]);}
 const pasteEnd=paste.at(-1)+.18,textStart=pasteEnd+.15,textEnd=textStart+(text.trim()?1.5:0),motionStart=textEnd+.15;
 return {punch,paste,punchEnd,pasteEnd,textStart,textEnd,motionStart,beats:all,fallback,duration,offset};
}
function motif(c,type,r){if(type==='hexstar'){c.beginPath();for(let i=0;i<12;i++){const a=-Math.PI/2+i*Math.PI/6,k=i%2?.55:1;i?c.lineTo(Math.cos(a)*r*k,Math.sin(a)*r*k):c.moveTo(Math.cos(a)*r*k,Math.sin(a)*r*k);}c.closePath();}else if(type==='petal'||type==='leaf'){c.beginPath();c.moveTo(0,-r);c.bezierCurveTo(r*1.1,-r*.3,r*.65,r*.8,0,r);c.bezierCurveTo(-r*.6,r*.7,-r*.8,-r*.2,0,-r);c.closePath();}else if(type==='tree'){c.beginPath();c.moveTo(0,-r);c.lineTo(r*.65,-r*.18);c.lineTo(r*.36,-r*.18);c.lineTo(r*.85,r*.6);c.lineTo(r*.15,r*.6);c.lineTo(r*.15,r);c.lineTo(-r*.15,r);c.lineTo(-r*.15,r*.6);c.lineTo(-r*.85,r*.6);c.lineTo(-r*.36,-r*.18);c.lineTo(-r*.65,-r*.18);c.closePath();}else Shapes.motif(c,type,r);}
function texture(c,w,h,kind,color,seed=441){const rand=rng(seed);c.fillStyle=color;c.fillRect(0,0,w,h);if(kind==='solid')return;
 // Stable fine grain is built once, never randomized per frame.
 for(let i=0;i<w*h/80;i++){const x=rand()*w,y=rand()*h;c.fillStyle=rand()>.5?'rgba(255,255,255,.12)':'rgba(12,17,26,.075)';c.fillRect(x,y,1+rand()*1.6,1+rand()*1.6);}
 if(['weave','linen','felt'].includes(kind)){const step=kind==='weave'?6:kind==='linen'?9:3;c.lineWidth=kind==='felt'?1:1.35;for(let x=0;x<w;x+=step){c.strokeStyle='rgba(255,255,255,.15)';c.beginPath();c.moveTo(x,0);c.lineTo(x+Math.sin(x)*.5,h);c.stroke();c.strokeStyle='rgba(5,10,25,.17)';c.beginPath();c.moveTo(x+2,0);c.lineTo(x+2,h);c.stroke();}for(let y=0;y<h;y+=step){c.strokeStyle='rgba(230,235,240,.13)';c.beginPath();c.moveTo(0,y);c.lineTo(w,y+.6);c.stroke();}}
 if(['paper','rice','linen'].includes(kind))for(let i=0;i<260;i++){const x=rand()*w,y=rand()*h;c.strokeStyle='rgba(255,255,245,.13)';c.lineWidth=.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*18,y+rand()*5);c.stroke();}
 if(kind==='sand')for(let i=0;i<2800;i++){c.fillStyle=rand()>.5?'rgba(246,231,203,.22)':'rgba(18,30,37,.14)';c.beginPath();c.arc(rand()*w,rand()*h,.5+rand()*1.6,0,TAU);c.fill();}
 if(kind==='grid'){c.strokeStyle='rgba(40,51,66,.16)';c.lineWidth=1;for(let x=0;x<w;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}}
 if(kind==='crayon')for(let i=0;i<800;i++){const x=rand()*w,y=rand()*h;c.strokeStyle='rgba(255,245,222,.09)';c.lineWidth=1+rand()*3;c.beginPath();c.moveTo(x,y);c.lineTo(x+25+rand()*40,y-10);c.stroke();}
 if(kind==='wash')for(let i=0;i<45;i++){const x=rand()*w,y=rand()*h,r=40+rand()*150,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,245,224,.06)');g.addColorStop(1,'rgba(255,245,224,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}}
// Every mode fills the photo panel. Automatic framing prioritizes detected faces.
function photoLayout(iw,ih,w,h,{fit='auto',focusX=.5,focusY=.5,zoom=1,faces=[]}={}){
 const scale=Math.max(w/iw,h/ih)*clamp(zoom,1,2),dw=iw*scale,dh=ih*scale;
 let fx=clamp(focusX),fy=clamp(focusY),reason='Manual edge-to-edge crop.';
 if(fit==='auto'){
  fx=.5;fy=ih>iw?.30:.5;reason='Automatic edge-to-edge crop.';
  if(faces.length){const x0=Math.min(...faces.map(f=>f.x)),x1=Math.max(...faces.map(f=>f.x+f.w)),y0=Math.min(...faces.map(f=>f.y)),y1=Math.max(...faces.map(f=>f.y+f.h));
   if(dw>w)fx=clamp(((x0+x1)*.5*dw-w*.5)/(dw-w));
   if(dh>h)fy=clamp(((y0+y1)*.5*dh-h*.34)/(dh-h));reason='Automatic crop places detected faces near the upper third.';
  }
 }
 const dx=-(dw-w)*fx,dy=-(dh-h)*fy;
 return {mode:'cover',requested:fit,reason,dx,dy,dw,dh,scale,retained:Math.min(1,w/dw)*Math.min(1,h/dh),bounds:{x:0,y:0,w,h}};
}
// All target formations share a center. Each piece travels to its own new position.
function makeFormations(shape,count,bounds){
 const titles=shape==='bird'?['Open flock','Chevron','Circle','Wave','Sweeping arc']:shape==='butterfly'?['Garden scatter','Ring','Figure eight','Spiral','Petal rosette']:['Loose constellation','Twin constellations','Halo','Diagonal ribbon'];
 const formations=titles.map((name,j)=>{let pts=Array.from({length:count},(_,i)=>{const a=TAU*i/count,u=i/(count-1),gold=i*2.399963,r=Math.sqrt((i+.5)/count);let x,y;
  if(j===0){x=Math.cos(gold)*r;y=Math.sin(gold)*r*.82;}
  else if(shape==='bird'&&j===1){x=.85-1.7*Math.abs(2*u-1);y=(u-.5)*1.8;}
  else if(j===1&&shape==='butterfly'||j===2&&shape==='bird'){x=Math.cos(a);y=Math.sin(a)*.84;}
  else if(j===2&&shape==='butterfly'){x=Math.sin(a);y=Math.sin(a*2)*.57;}
  else if(j===3&&shape==='butterfly'){x=Math.cos(i*.68)*r;y=Math.sin(i*.68)*r;}
  else if(j===4&&shape==='butterfly'){const k=.58+.36*Math.cos(5*a);x=Math.cos(a)*k;y=Math.sin(a)*k;}
  else if(j===3&&shape==='bird'){x=2*u-1;y=Math.sin(u*TAU)*.55;}
  else if(j===4){x=Math.cos(.3+u*2.5);y=Math.sin(.3+u*2.5);}
  else if(j===1){x=(i%2?-.52:.52)+Math.cos(gold)*r*.38;y=Math.sin(gold)*r*.65;}
  else if(j===2){x=Math.cos(a);y=Math.sin(a)*.75;}
  else{x=2*u-1;y=(2*u-1)*.65+Math.sin(gold)*.2;}
  return{x,y};});
  const mx=pts.reduce((s,p)=>s+p.x,0)/count,my=pts.reduce((s,p)=>s+p.y,0)/count;
  const ex=Math.max(...pts.map(p=>Math.abs(p.x-mx))),ey=Math.max(...pts.map(p=>Math.abs(p.y-my)));
  pts=pts.map(p=>({x:bounds.x+bounds.w/2+(p.x-mx)/Math.max(1,ex)*bounds.w*.43,y:bounds.y+bounds.h/2+(p.y-my)/Math.max(1,ey)*bounds.h*.40}));
  return {name,points:pts};
 });
 // Match nearby destinations between neighboring formations to reduce crossing and rushing.
 for(let j=1;j<formations.length;j++){const prev=formations[j-1].points,next=formations[j].points,pairs=[];for(let i=0;i<count;i++)for(let k=0;k<count;k++)pairs.push({i,k,d:Math.hypot(prev[i].x-next[k].x,prev[i].y-next[k].y)});pairs.sort((a,b)=>a.d-b.d);const used=new Set(),ordered=Array(count);for(const {i,k}of pairs)if(!ordered[i]&&!used.has(k)){ordered[i]=next[k];used.add(k);}formations[j].points=ordered;}
 return formations;
}
function makeRenderer(ctx,photo,createCanvas,options={}){
 const width=1080,height=1920,half=height/2,cfg={shape:'spark',texture:'weave',count:22,text:'',seed:518,beats:[],duration:15,offset:0,...options};
 const photoTop=['tear','petal','leaf'].includes(cfg.shape),py=photoTop?0:half,by=photoTop?half:0,cc=(w,h)=>createCanvas(Math.ceil(w),Math.ceil(h));
 const iw=photo.naturalWidth||photo.videoWidth||photo.width,ih=photo.naturalHeight||photo.videoHeight||photo.height;let layout=photoLayout(iw,ih,width,half,cfg);
 const pal=palette(photo,cc,cfg.tone),crop=cc(width,half),cg=crop.getContext('2d');cg.drawImage(photo,layout.dx,layout.dy,layout.dw,layout.dh);
 const paper=cc(width,half);if(cfg.color)pal.hex=cfg.color;texture(paper.getContext('2d'),width,half,cfg.texture,pal.hex,cfg.seed);
 const plan=schedule(cfg.beats,cfg),rand=rng(cfg.seed),pieces=[],positions=[];
 if(photoTop){plan.pasteEnd=plan.paste.at(-1)+.9;plan.textStart=plan.pasteEnd+.15;plan.textEnd=plan.textStart+(cfg.text.trim()?1.5:0);plan.motionStart=plan.textEnd+.15;}
 // One shared half-time clock controls every motion after the opening.
 plan.motionCues=plan.beats.filter(b=>b>=plan.motionStart).filter((_,i)=>i%2===0);
 const captionY=photoTop?by+82:by+half-82,contentBounds={x:90,y:by+(photoTop?190:75),w:900,h:695},captionBounds={x:60,y:captionY-52,w:960,h:104};
 const formations=makeFormations(cfg.shape,cfg.count,contentBounds),pb=layout.bounds;
 // Punch only photograph pixels, never the surrounding mat. Keep faces clear when supplied.
 const faces=(cfg.faces||[]).map(f=>({x:layout.dx+f.x*layout.dw,y:layout.dy+f.y*layout.dh,w:f.w*layout.dw,h:f.h*layout.dh}));
 for(let i=0;i<cfg.count;i++){
  let sx,sy,best=-Infinity;for(let n=0;n<160;n++){const inset=Math.min(55,pb.w*.15,pb.h*.15),x=pb.x+inset+rand()*Math.max(1,pb.w-2*inset),y=pb.y+inset+rand()*Math.max(1,pb.h-2*inset),nearFace=faces.some(f=>x>f.x-55&&x<f.x+f.w+55&&y>f.y-55&&y<f.y+f.h+55),d=positions.reduce((d,a)=>Math.min(d,Math.hypot(a.x-x,a.y-y)),1e6)-(nearFace?1e7:0);if(d>best){best=d;sx=x;sy=y;}}positions.push({x:sx,y:sy});
  const group=i%3,tx=formations[0].points[i].x,ty=formations[0].points[i].y;
  const r=Math.min((25+rand()*7)*(cfg.size||1),pb.w*.07,pb.h*.07),angle=(rand()-.5)*.6,size=Math.ceil(r*3.8),chip=cc(size,size),q=chip.getContext('2d');q.translate(size/2,size/2);q.rotate(angle);motif(q,cfg.shape,r);q.clip();q.rotate(-angle);q.drawImage(crop,-sx,-sy);
  pieces.push({i,group,sx,sy,tx,ty,r,angle,size,chip,phase:rand()*TAU,punch:plan.punch[Math.floor(i*plan.punch.length/cfg.count)],paste:plan.paste[Math.floor(i*plan.paste.length/cfg.count)]});
 }
 function stamp(c,a,x,y,rotation=0,scaleX=1,scaleY=1,alpha=1){c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(rotation);c.scale(scaleX,scaleY);c.shadowColor='rgba(8,16,28,.13)';c.shadowBlur=1.3;c.shadowOffsetY=1;c.drawImage(a.chip,-a.size/2,-a.size/2);c.restore();}
 function pose(a,t){let x=a.tx,y=a.ty,rot=0,sx=1,sy=1,alpha=1;const age=t-plan.motionStart;if(age<0)return{x,y,rot,sx,sy,alpha};
  const cues=plan.motionCues,bi=cues.filter(b=>b<=t).length-1,bt=bi>=0?cues[bi]:plan.motionStart,interval=cues.length>1?(cues.at(-1)-cues[0])/(cues.length-1):1.4,next=cues[bi+1]??bt+interval,p=clamp((t-bt)/(next-bt)),step=Math.max(0,bi+1),pulse=bi<0?0:Math.sin(Math.PI*p);
  if(['bird','butterfly','spark','star','hexstar','moon'].includes(cfg.shape)){
   const cycle=bi<0?0:bi+1,which=cycle%formations.length,old=(cycle-1+formations.length)%formations.length,u=cycle?ease((t-bt)/Math.min(1.6,(next-bt)*.78)):1,A=formations[cycle?old:0].points[a.i],B=formations[which].points[a.i];x=A.x+(B.x-A.x)*u;y=A.y+(B.y-A.y)*u;
   if(cfg.shape==='bird'||cfg.shape==='butterfly'){const flap=bi<0?1:[1,.58,.28,.72,1][Math.min(4,Math.floor(p*5))];if(cfg.shape==='bird')sy=flap;else sx=flap;rot=Math.sin(p*Math.PI*2)*.08;}
   else{const active=a.group===step%3;alpha=.86+(active?.14*pulse:0);sx=sy=1+(active?.08*pulse:0);}
  }else if(cfg.shape==='leaf'||cfg.shape==='petal'){
   return fallingPose(a,t);
  }else if(cfg.shape==='square'){const lift=pulse*(a.group===step%3?.16:.025);sy=1-lift;y-=a.r*lift;rot=lift*.13;
  }else{if(bi>=0){x+=Math.sin(a.phase)*14*pulse;y-=pulse*8;rot=Math.sin(a.phase)*.10*pulse;}}
  return{x,y,rot,sx:Math.sign(sx||1)*Math.max(.09,Math.abs(sx)),sy,alpha};
 }
 // Gravity paths begin at a real hole in the upper photograph and cross the seam.
 function fallingPose(a,t){
  const age=t-plan.motionStart;
  if(cfg.shape==='tear'){
   const all=plan.motionCues,interval=all.length>1?(all.at(-1)-all[0])/(all.length-1):1.3,lead=Math.min(2.2,Math.max(1.1,interval*1.2)),hits=all.filter(b=>b>=plan.motionStart+lead+.1),own=hits.filter((_,i)=>i%3===a.group),event=own.find(b=>t<=b+.48);
   if(event===undefined||t<event-lead)return {kind:'waiting',alpha:clamp(1-age/.4),x:a.tx,y:a.ty,sx:1,sy:1,rot:0};
   const wet=t-event,landingY=clamp(a.ty+50,by+240,by+half-95);
   if(wet>=0)return{kind:'impact',wet,event,x:a.sx,y:landingY,alpha:1};
   const u=clamp((wet+lead)/lead);return{kind:'fall',event,x:a.sx,y:a.sy+(landingY-a.sy)*(.12*u+.88*u*u),rot:0,sx:1,sy:1,alpha:Math.min(1,u/.10),lead};
  }
  const dur=4.8+(a.i%5)*.28,own=plan.motionCues.filter((_,i)=>i%3===a.group);let launch=-Infinity;
  // Relaunch only on this group's alternate-beat cue after its preceding fall has finished.
  for(const cue of own){if(cue>t)break;if(cue>=launch+dur+.1)launch=cue;}
  const life=t-launch;
  if(!Number.isFinite(launch)||life>=dur)return{kind:'waiting',x:a.tx,y:a.ty,rot:0,sx:1,sy:1,alpha:clamp(1-age/.4)};
  const u=life/dur,fall=clamp(u),x=a.sx+(a.tx-a.sx)*ease(fall)+Math.sin(life*1.5+a.phase)*30*Math.sin(Math.PI*u),y=a.sy+(height+70-a.sy)*fall;
  return {kind:'fall',event:launch,x,y,rot:Math.sin(life*1.4+a.phase)*.55+life*.18,sx:Math.sign(Math.cos(life*1.9+a.phase)||1)*Math.max(.09,Math.abs(Math.cos(life*1.9+a.phase))),sy:1,alpha:Math.min(1,life/.24,(dur-life)/.4)};
 }
 function render(t=0,textOverride){t=clamp(Number(t)||0,0,cfg.duration);const c=ctx,scale=c.canvas.width/width;c.save();c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,width,height);c.drawImage(paper,0,by);c.drawImage(crop,0,py);
  for(const a of pieces){if(t<a.punch)continue;c.save();c.translate(a.sx,py+a.sy);c.rotate(a.angle);motif(c,cfg.shape,a.r);c.clip();c.rotate(-a.angle);c.drawImage(paper,-a.sx,-a.sy);c.restore();
   const pulse=1-clamp((t-a.punch)/.16);if(pulse>0){c.save();c.translate(a.sx,py+a.sy);c.rotate(a.angle);motif(c,cfg.shape,a.r+2*pulse);c.strokeStyle=`rgba(255,255,246,${pulse*.6})`;c.lineWidth=1;c.stroke();c.restore();}
  }
  // Gravity cutouts travel across both panels. Captions are drawn last, above the motion.
  c.save();c.beginPath();if(photoTop)c.rect(0,0,width,height);else c.rect(12,by+12,width-24,half-162);c.clip();
  for(const a of pieces){if(t<a.paste)continue;
   if(t<plan.motionStart){const u=clamp((t-a.paste)/(photoTop?.9:.18));if(photoTop)stamp(c,a,a.sx+(a.tx-a.sx)*ease(u),a.sy+(a.ty-a.sy)*ease(u),0,1,1,clamp(u*8));else stamp(c,a,a.tx,a.ty-(1-u)*9,0,.85+.15*ease(u),.85+.15*ease(u),u);continue;}
   if(cfg.shape==='tear'){
    const q=fallingPose(a,t);if(q.kind!=='impact'){stamp(c,a,q.x,q.y,q.rot,q.sx,q.sy,q.alpha);continue;}
    const wet=q.wet,spread=ease(wet/.32),fade=1-clamp((wet-.12)/.36);if(wet<.14)stamp(c,a,q.x,q.y,0,1+.3*Math.sin(wet/.14*Math.PI),1-.3*Math.sin(wet/.14*Math.PI),fade);
    for(let j=0;j<6;j++){const angle=j*TAU/6+a.phase,d=spread*(40+j%2*14);stamp(c,a,q.x+Math.cos(angle)*d,q.y+Math.sin(angle)*d*.5,j*.5,.24,.24,fade);}
   }else{const q=pose(a,t);stamp(c,a,q.x,q.y,q.rot,q.sx,q.sy,q.alpha);}
  }c.restore();
  const text=String(textOverride??cfg.text).trim();if(text&&t>=plan.textStart){const base=captionY;let fs=32,lines=[];do{c.font=`300 ${fs}px "MDPSong", "Songti SC", "STSong", Georgia, serif`;lines=[];for(const raw of text.split('\n')){let line='';for(const ch of Array.from(raw)){if(line&&c.measureText(line+ch).width>width-140){lines.push(line);line=ch;}else line+=ch;}if(line)lines.push(line);}if(lines.length<=2)break;fs--;}while(fs>16);lines=lines.slice(0,2);
   c.save();c.beginPath();c.rect(60,captionBounds.y,(width-120)*ease((t-plan.textStart)/1.5),104);c.clip();c.fillStyle=pal.text;c.textAlign='center';c.textBaseline='middle';lines.forEach((line,i)=>c.fillText(line,width/2,base+(i-(lines.length-1)/2)*(fs*1.45)));c.restore();}
  c.restore();return stage(t);
 }
 function stage(t){return t<=plan.punchEnd?'打孔':t<plan.pasteEnd?'贴片':t<plan.motionStart&&cfg.text?'文字':'运动';}
 return{render,stage,plan,palette:pal,pieces,config:cfg,photoTop,pose,fallingPose,layout,formations,contentBounds,captionBounds};
}
return{names,materials,englishNames,englishMaterials,photoLayout,makeFormations,semantic,choose,photoCues,palette,schedule,makeRenderer,motif};
});
