/* Deterministic p5.js drawing: all positions depend on audio time, never frame count. */
window.LightStickers=(()=>{
 const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),fract=x=>x-Math.floor(x),hash=x=>fract(Math.sin(x*127.1+19.7)*43758.5453);
 const presets={
  clock:{name:'不规则歌词时钟',en:'A little time for the lyrics.',x:.5,y:.5,scale:1,color:'#fffdf3',green:'#82ae76',words:['Take','your','time','and','enjoy','the','little','things'],textMode:'auto',multicolor:true},
  sunshine:{name:'旋转阳光',en:'A little sunshine.',x:.5,y:.27,scale:1,color:'#fff8ce',green:'#76b292'},
  willow:{name:'花雨星光柳枝',en:'Three little wishes.',x:.5,y:.17,scale:1,color:'#fff1ad',green:'#82ae76'},
  bloom:{name:'花与太阳的乐谱',en:'Let it bloom.',x:.5,y:.58,scale:1,color:'#fffdf3',green:'#82ae76'},
  staff:{name:'环绕五线谱',en:'A melody around you.',x:.5,y:.48,scale:1,color:'#fffdf3',green:'#82ae76'}
 };
 const cache=new WeakMap();
 function prepare(a){
  if(!a||!a.values?.length)return null;if(cache.has(a))return cache.get(a);
  const hz=a.hz||100,v=Float32Array.from(a.values),clock=new Float32Array(v.length);let e=v[0]||0;
  for(let i=0;i<v.length;i++){e+=(v[i]-e)*(1-Math.exp(-1/(hz*.65)));v[i]=e;clock[i]=(i?clock[i-1]:0)+(.32+.88*e)/hz;}
  const result={v,clock,hz};cache.set(a,result);return result;
 }
 function at(v,t,hz){const n=clamp(t*hz,0,v.length-1),i=Math.floor(n);return v[i]+((v[i+1]??v[i])-v[i])*(n-i);}
 function motion(t,a){const m=prepare(a);return m?{level:at(m.v,t,m.hz),clock:at(m.clock,t,m.hz),music:true}:{level:.35+.15*Math.sin(t*.55),clock:t*.65,music:false};}
 function wordsAt(t,cues,fallback,mode){
  if(mode==='none')return [];
  if(mode==='words'||!cues.length)return fallback;
  let cue=null;for(const q of cues){if(q.time<=t)cue=q;else break;}
  if(!cue||t>(cue.end??cue.time+6))return [];
  if(cue.words?.length)return cue.words.filter(w=>t>=w.start).slice(-8).map(w=>w.word||w.text).filter(Boolean);
  return cue.text.replace(/[，。！？]/g,' ').split(/\s+/).filter(Boolean).slice(0,9);
 }
 const lyricCache=new WeakMap(),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 function lyricTimeline(cues){
  if(lyricCache.has(cues))return lyricCache.get(cues);
  const events=[];
  for(let q=0;q<cues.length;q++){
   const cue=cues[q],end=cue.end??cues[q+1]?.time??cue.time+6;
   const tokens=cue.text.trim().split(/\s+/).filter(Boolean);
   const words=cue.words?.length?cue.words:tokens.map((word,i)=>({word,start:cue.time+(end-cue.time)*i/tokens.length,end:cue.time+(end-cue.time)*(i+1)/tokens.length}));
   for(const w of words){
    const word=String(w.word||w.text||'').replace(/^[.,!?，。！？（()）]+|[.,!?，。！？（()）]+$/g,'');
    if(word&&Number.isFinite(w.start))events.push({word,start:w.start,end:Number.isFinite(w.end)?w.end:w.start+.3,phraseEnd:end});
   }
  }
  events.sort((a,b)=>a.start-b.start);
  for(let i=0;i<events.length;i++){
   const e=events[i];e.index=i;e.slot=i%7;
   // Every word stays on its spoke. It fades before that spoke receives another word.
   e.finish=Math.min(Math.max(e.start+2.65,e.end+.8),e.phraseEnd+.7,events[i+7]?.start??Infinity);
  }
  lyricCache.set(cues,events);return events;
 }
 function lyricWordsAt(t,cues){
  return lyricTimeline(cues).filter(e=>t>=e.start&&t<e.finish).map(e=>{
   const age=t-e.start,life=e.finish-e.start,fadeIn=Math.min(.18,life*.2),fadeOut=Math.min(1.05,life*.48);
   const fade=smooth((age-life+fadeOut)/fadeOut);
   return {...e,alpha:smooth(age/fadeIn)*(1-fade),fade,appear:smooth(age/fadeIn)};
  });
 }

 const partNames={flowers:'红色小花',stars:'节拍星星',leaves:'随风柳枝'};
 function defaultParts(x=.5,y=.32){return {
  flowers:{type:'flowers',x,y:Math.max(.02,y-.174),scale:1,speed:.75,intensity:.85,wind:.8,density:1,stroke:1,color:'#f05260',green:'#267d43',enabled:true},
  stars:{type:'stars',x,y:Math.max(.04,y-.102),scale:1,speed:.75,intensity:1,wind:.8,density:1,stroke:1,color:'#ffed9a',green:'#267d43',enabled:true},
  leaves:{type:'leaves',x,y,scale:1.05,speed:.75,intensity:.85,wind:.8,density:1,stroke:1,color:'#287d48',green:'#287d48',enabled:true}
 };}
 // Bass energy onsets for newly uploaded tracks; supplied beat times take precedence.
 function analyzeBeats(buffer){const hz=100,step=Math.max(1,Math.floor(buffer.sampleRate/hz)),n=Math.ceil(buffer.length/step),flux=[],energy=[],channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));let low=0,prior=0;
  const alpha=1-Math.exp(-TAU*180/buffer.sampleRate);
  for(let k=0;k<n;k++){let sum=0;for(let i=k*step;i<Math.min(buffer.length,(k+1)*step);i++){let v=0;for(const ch of channels)v+=ch[i];v/=channels.length;low+=(v-low)*alpha;sum+=low*low;}const e=Math.sqrt(sum/step);energy.push(e);flux.push(Math.max(0,e-prior));prior=e;}
  const peak=flux.reduce((best,x)=>Math.max(best,x),0),events=[];let last=-1;
  for(let k=3;k<n-3;k++){let mean=0;for(let j=Math.max(0,k-50);j<k;j++)mean+=flux[j];mean/=Math.min(50,k);const t=k/hz;if(energy[k]>.002&&flux[k]>Math.max(peak*.1,mean*2.4)&&flux[k]>=flux[k-1]&&flux[k]>flux[k+1]&&t-last>.28){events.push(t);last=t;}}
  return events;
 }
 const beatCache=new WeakMap();
 function beatTimes(a){if(!a)return null;const source=a.beats;if(!Array.isArray(source)&&!ArrayBuffer.isView(source))return [];
  const cached=beatCache.get(a);if(cached?.source===source)return cached.times;
  const times=Array.from(source,b=>typeof b==='number'?b:b.time).filter(Number.isFinite).sort((x,y)=>x-y);beatCache.set(a,{source,times});return times;
 }
 function beatPulse(t,a){const beats=beatTimes(a);if(!a){const age=fract(t/.68)*.68;return Math.exp(-age/.22);}
  let lo=0,hi=beats.length;while(lo<hi){const mid=(lo+hi)>>1;if(beats[mid]<=t)lo=mid+1;else hi=mid;}
  return lo?Math.exp(-(t-beats[lo-1])/.22):0;
 }
 function fallingParticles(t,c,a){const beats=beatTimes(a),speed=clamp(c.speed/.75,.25,2),lifetime=7.2/speed,events=[];
  if(beats){let i=0;while(i<beats.length&&beats[i]<t-lifetime)i++;for(;i<beats.length&&beats[i]<=t;i++)events.push({time:beats[i],index:i});}
  else for(let i=Math.max(0,Math.ceil((t-lifetime)/.68));i<=Math.floor(t/.68);i++)events.push({time:i*.68,index:i});
  const particles=[],pulse=beatPulse(t,a),flower=c.type==='flowers',count=Math.max(1,Math.round((flower?3:4)*c.density));
  for(const event of events)for(let j=0;j<count;j++){
   const seed=event.index*17+j+(flower?1000:2000),age=(t-event.time)*speed,life=5.1+hash(seed)*2.1;if(age<0||age>life)continue;
   const q=age/life,side=flower?-1:1,spread=(35+hash(seed+6)*195)*c.wind;
   const x=side*spread*(1-Math.exp(-age*.8))+Math.sin(age*.85+seed)*12*q*c.wind;
   const y=9+(flower?42:47)*age+(6+hash(seed+9)*4)*age*age;
   const fade=smooth(age/.1)*(1-smooth((q-.73)/.27));
   particles.push({x,y,seed,age,r:(j===0?8:3.4+hash(seed+4)*3.4)*(1+.16*pulse*c.intensity),alpha:fade*(flower?.86+.14*pulse:.42+.58*pulse),pulse,trail:!flower&&j%2===0});
  }return particles;
 }
 function render(p,t,c,a,cues=[]){p.clear();if(c.type==='willow'){
  const parts=c.parts||defaultParts(c.x,c.y);
  for(const id of ['leaves','flowers','stars']){const part=parts[id];if(!part||c.onlyPart&&c.onlyPart!==id||!c.onlyPart&&part.enabled===false)continue;draw(p,t,{...c,...part,type:id,green:part.color},a,cues);}
  const m=motion(t,a);return {level:m.level,clock:m.clock,hasMusic:m.music};
 }return draw(p,t,c,a,cues);}
 function draw(p,t,c,a,cues=[]){
  const ctx=p.drawingContext,m=c.rhythm?{level:c.rhythm.level,clock:c.rhythm.clock,music:true}:motion(t,a),W=p.width,H=p.height;
  const s=W/900*c.scale,energy=m.level*c.intensity,clock=m.clock*c.speed;
  ctx.save();ctx.translate(c.x*W,c.y*H);ctx.scale(s,s);ctx.shadowColor=c.halo||'transparent';ctx.shadowBlur=c.halo?1.4:0;ctx.lineCap='round';ctx.lineJoin='round';
  const pulse=c.rhythm?.pulse||0;
  const breath=c.rhythm ? .055*pulse*c.intensity : Math.sin(t*TAU/5.8)*(.018+.018*energy);
  if(c.rhythm&&['leaves','flowers','stars'].includes(c.type)){const dir=c.rhythm.index%2?1:-1;ctx.rotate(dir*pulse*.09*c.intensity);}
  function ink(fn,id,color=c.color,width=1.6,alpha=1,n=65){
   ctx.strokeStyle=color;ctx.lineWidth=width*c.stroke;ctx.globalAlpha=alpha;ctx.beginPath();
   for(let i=0;i<=n;i++){const u=i/n,q=fn(u),w=Math.sin(u*Math.PI),j=(Math.sin(u*39+id)*.42+Math.sin(u*71+id*3)*.16)*w;const x=q.x+j,y=q.y+j*.8;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.globalAlpha=1;
  }
  function star(x,y,r,alpha=1,seed=1,color=c.color){
   ctx.save();ctx.translate(x,y);ctx.rotate(seed*.71);ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.beginPath();
   for(let k=0;k<10;k++){const ang=k*Math.PI/5-Math.PI/2,rr=r*(k%2?.42:1)*(1+hash(k+seed)*.08);const px=Math.cos(ang)*rr,py=Math.sin(ang)*rr;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.restore();
  }
  function glow(x,y,r,amount=.14){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,240,171,'+amount+')');g.addColorStop(1,'rgba(255,240,171,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  function text(word,x,y,size,color,angle=0,alpha=1){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.font=`${size}px ${/[\u3400-\u9fff]/.test(word)?'RainHand':'LatinHand'},cursive`;ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(word,0,0);ctx.restore();}
  if(c.type==='clock'){window.LyricClock.draw(ctx,t,c,cues,m);}
  else if(c.type==='sunshine'){
   const lyricMode=c.textMode==='auto'&&cues.length>0;
   const words=lyricMode?[]:wordsAt(t,cues,c.words,c.textMode),particles=lyricMode?lyricWordsAt(t,cues):[];
   const n=lyricMode?7:Math.max(7,words.length),spin=clock*(c.candle?.34:.10),r=(c.radius||162)*(1+breath);
   const colors=c.palette||[c.color];
   glow(0,0,51,.11+.09*energy);
   if(c.center!=='none')star(0,0,c.center==='sun'?15:13,1,0,'#ffde79');
   if(c.center==='sun')for(let j=0;j<10;j++){const ang=j*TAU/10+spin;ink(u=>({x:Math.cos(ang)*(20+u*9),y:Math.sin(ang)*(20+u*9)}),j,c.color,1.3,.9,10);}
   for(let i=0;i<n;i++){
    const ang=i*TAU/n+spin,ray=1+Math.sin(t*.8+i)*.025;
    ink(u=>({x:Math.cos(ang)*(34+u*(r-67))*ray,y:Math.sin(ang)*(34+u*(r-67))*ray}),i,c.color,1.8,.85+.12*energy,35);
    const label=words[i]||[':)', '<3', 'xo', ':D'][i%4];
    if(!lyricMode||!particles.some(w=>w.slot===i&&w.alpha>.15))text(label,Math.cos(ang)*(r+22),Math.sin(ang)*(r+22),clamp(31-label.length*.6,18,29),colors[i%colors.length],Math.sin(ang)*.065);
    if(i%2===0)star(Math.cos(ang)*(r-16),Math.sin(ang)*(r-16),2.4,.5+.4*Math.pow(.5+.5*Math.sin(t*1.3+i),3),i);
   }
   for(const w of particles){
    const ang=w.slot*TAU/7+spin,radius=r+22+w.fade*9;
    const size=clamp(32-w.word.length*.6,19,30)*(.94+.06*w.appear);
    text(w.word,Math.cos(ang)*radius,Math.sin(ang)*radius,size,colors[w.index%colors.length],Math.sin(ang)*.075,w.alpha);
   }
  }else if(c.type==='leaves'){
   for(let j=0;j<7;j++){
    const L=320+hash(j+30)*310,base=(j-3)*21;
    const curve=u=>({x:base+Math.sin(u*1.9+j*.8+clock*.37)*u*u*(33+30*energy)*c.wind+(j-3)*u*16,y:u*L});
    ink(curve,j,c.green,1.25,.82);
    for(let k=1;k<10;k++){
     const u=(k+.25*hash(j+k))/10,q=curve(u),side=k%2?1:-1,angle=side*(.55+.17*Math.sin(clock*.4+j+u*2));
     ctx.save();ctx.translate(q.x,q.y);ctx.rotate(angle);ctx.fillStyle=c.green;ctx.globalAlpha=.84+.14*hash(j*9+k);const len=(14+11*hash(j*3+k))*(1-u*.3);
     ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*13,-4,side*18,len*.58,side*12,len);ctx.bezierCurveTo(side*2,len*.7,side*1,8,0,0);ctx.fill();ctx.restore();
    }
   }
  }else if(c.type==='stars'||c.type==='flowers'){
   const pulse=beatPulse(t,a),flower=c.type==='flowers';
   if(!flower)glow(0,0,27,.035+pulse*.11*c.intensity);
   for(const q of fallingParticles(t,c,a)){
    if(!flower){
     if(q.trail)ink(u=>({x:q.x-u*9,y:q.y-u*(10+q.age*2)}),q.seed,c.color,.65,q.alpha*.28,13);
     ctx.save();ctx.shadowColor=c.color;ctx.shadowBlur=(2+q.pulse*9*c.intensity);star(q.x,q.y,q.r,q.alpha,q.seed,c.color);ctx.restore();
    }else{
     ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.seed*.7+q.age*.38);ctx.globalAlpha=q.alpha;ctx.fillStyle=c.color;
     for(let j=0;j<5;j++){ctx.save();ctx.rotate(j*TAU/5);ctx.beginPath();ctx.ellipse(0,-q.r*.57,q.r*.44,q.r*.66,0,0,TAU);ctx.fill();ctx.restore();}
     ctx.fillStyle='#ffdfa0';ctx.beginPath();ctx.arc(0,0,q.r*.24,0,TAU);ctx.fill();ctx.restore();
    }
   }
  }else{
   function ribbon(u,branch){
    if(c.type==='staff')return{x:(u-.5)*1850,y:Math.sin(u*TAU*1.04+clock*.21)*115*c.wind+Math.sin(u*Math.PI)*25};
    const angles=[-2.36,-.69,.86,2.68],ang=angles[branch],distance=25+u*740;
    const bend=Math.sin(u*3.7+clock*.19+branch)*105*c.wind*u;
    return{x:Math.cos(ang)*distance-Math.sin(ang)*bend,y:Math.sin(ang)*distance+Math.cos(ang)*bend};
   }
   function frame(u,b,offset=0){const q=ribbon(u,b),a=ribbon(u-.001,b),z=ribbon(u+.001,b),ang=Math.atan2(z.y-a.y,z.x-a.x);return{x:q.x-Math.sin(ang)*offset,y:q.y+Math.cos(ang)*offset,ang};}
   const branches=c.type==='bloom'?4:1,spacing=(c.type==='staff'?22:14)*(1+breath);
   for(let b=0;b<branches;b++){
    for(let k=0;k<5;k++)ink(u=>frame(u,b,(k-2)*spacing),b*11+k,c.color,1.4,.84,110);
    const count=Math.round(17*c.density);
    for(let j=0;j<count;j++){
     const u=fract(j/count+clock*.025+hash(b+90)*.2),line=Math.round(hash(j*8+b)*8)-4;
     const q=frame(u,b,line*spacing*.5),alpha=Math.min(1,u*16,(1-u)*18)*(.72+.22*energy);
     ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.ang*.16);ctx.scale(c.type==='staff'?1.4:1.15,c.type==='staff'?1.4:1.15);ctx.globalAlpha=alpha;ctx.fillStyle=c.color;ctx.strokeStyle=c.color;ctx.lineWidth=1.7*c.stroke;
     ctx.beginPath();ctx.ellipse(0,0,5.8,3.5,-.35,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(5,-1);ctx.lineTo(5,-24);ctx.stroke();
     if(j%3!==1){ctx.beginPath();ctx.moveTo(5,-24);ctx.bezierCurveTo(17,-21,18,-14,12,-11);ctx.stroke();}
     if(j%5===0){ctx.beginPath();ctx.ellipse(18,2,5.8,3.5,-.35,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(23,1);ctx.lineTo(23,-21);ctx.lineTo(5,-24);ctx.stroke();}
     ctx.restore();
    }
   }
   if(c.type==='bloom')for(let j=0;j<14;j++){const ang=hash(j)*TAU,r=38+hash(j+100)*57;star(Math.cos(ang)*r,Math.sin(ang)*r,2.5+hash(j+2)*2,.25+.6*Math.pow(.5+.5*Math.sin(t*1.1+j),3),j);}
  }
  ctx.restore();return {level:m.level,clock:m.clock,hasMusic:m.music};
 }
 return {presets,render,motion,prepare,wordsAt,lyricWordsAt,defaultParts,partNames,analyzeBeats,beatPulse,fallingParticles,version:'1.3.0-mdp-review'};
})();
