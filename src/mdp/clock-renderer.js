/* Full-frame white clock. A single word event owns both label and hand target. */
window.LyricClock=(()=>{
 const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mod=(v,n)=>(v%n+n)%n;
 const palette=['#ffe28a','#97eed4','#ffb3cb','#aee9ff','#dab7ff','#ffd19c','#c5f09a','#f6a3b0'];
 const timelineCache=new WeakMap();
 function outline(a){const r=1+.10*Math.sin(3*a+.7)+.05*Math.cos(5*a-.4)+.013*Math.sin(7*a+1.1);return{x:354*Math.cos(a)*r,y:652*Math.sin(a)*r};}
 // Only the outer contour flows. Shared hand/word geometry stays steady.
 // Inward deformation preserves the resting outline's 2.5% frame margins.
 function flowingOutline(a,signal={},depth=1){
  const p=outline(a),energy=clamp(signal.energy||0),bass=clamp(signal.bass||0),detail=clamp(signal.detail||0),phase=signal.travel||0;
  const inset=clamp(depth,0,1.5)*(.008*energy+.032*energy*(.5+.5*Math.sin(3*a+phase))+.020*bass*(.5+.5*Math.cos(2*a-phase*.66+.7))+.008*detail*(.5+.5*Math.sin(5*a+phase*.43-.4)));
  return {x:p.x*(1-inset),y:p.y*(1-inset)};
 }
 const bounds=(()=>{let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;for(let j=0;j<1440;j++){const p=outline(j*TAU/1440);xmin=Math.min(xmin,p.x);xmax=Math.max(xmax,p.x);ymin=Math.min(ymin,p.y);ymax=Math.max(ymax,p.y);}return{xmin,xmax,ymin,ymax,cx:(xmin+xmax)/2,cy:(ymin+ymax)/2};})();
 function layout(width,height){const margin=.025;return{x:width/2,y:height/2,sx:width*(1-2*margin)/(bounds.xmax-bounds.xmin),sy:height*(1-2*margin)/(bounds.ymax-bounds.ymin),cx:bounds.cx,cy:bounds.cy,coverage:.95};}
 function point(index,count){const p=outline(-Math.PI/2+TAU*index/Math.max(1,count));return{x:p.x*.76,y:p.y*.80};}
 function fitWords(words,max=12){const out=[];for(let i=0;i<Math.min(words.length,max);i++){const a=Math.floor(i*words.length/Math.min(words.length,max)),b=Math.floor((i+1)*words.length/Math.min(words.length,max));out.push(words.slice(a,b).join(' '));}return out;}
 function nextBeat(beats,t){let lo=0,hi=beats.length;while(lo<hi){const mid=(lo+hi)>>1;if(beats[mid]<t)lo=mid+1;else hi=mid;}return lo<beats.length?beats[lo]:null;}
 function timeline(cues,beats=[]){
  const cached=timelineCache.get(cues);if(cached?.beats===beats)return cached.events;
  const events=[];
  for(let k=0;k<cues.length;k++){
   const cue=cues[k],end=cue.end??cues[k+1]?.time??cue.time+5;
   const tokens=String(cue.text||'').trim().split(/\s+/).filter(Boolean);
   const groups=cue.words?.length?cue.words.map(w=>({word:w.word||w.text,start:w.start})):fitWords(tokens,Math.max(1,Math.ceil(tokens.length/2))).map((word,i,all)=>({word,start:cue.time+(end-cue.time)*i/all.length}));
   for(const group of groups){const word=String(group.word||'').trim();if(!word)continue;const start=nextBeat(beats,group.start);if(start===null)continue;const previous=events.at(-1);if(previous?.start===start){previous.word+=' '+word;}else events.push({word,start});}
  }
  events.sort((a,b)=>a.start-b.start);events.forEach((e,i)=>{e.index=i;e.slot=i%8;});timelineCache.set(cues,{beats,events});return events;
 }
 function settle(age){if(!Number.isFinite(age))return 1;const u=clamp(age/.085);return age<.085?1.035*(1-(1-u)**3):age<.12?1+.035*(1-(age-.085)/.035):1;}
 function handBetween(previous,target,phase,advance){
  let from=Math.atan2(previous.y,previous.x),to=Math.atan2(target.y,target.x);
  if(advance){while(to<=from+1e-8)to+=TAU;}else from=to;
  const p=advance?phase:1;
  return{angle:from+(to-from)*p,distance:Math.hypot(previous.x,previous.y)+(Math.hypot(target.x,target.y)-Math.hypot(previous.x,previous.y))*p,targetAngle:Math.atan2(target.y,target.x)};
 }
 function stateAt(t,c,cues=[]){
  const q=c.rhythmAt?.(t)||c.rhythm||{index:-1,age:Infinity,pulse:0};
  const lyric=c.textMode==='auto'&&cues.length>0,events=lyric?timeline(cues,c.beatTimes||[]):[];
  let labels,index=0,previousIndex=0,slotCount,phase=1,advance=false,turn=0,eventTime=null;
  if(lyric&&events.length){
   let lo=0,hi=events.length;while(lo<hi){const m=(lo+hi)>>1;if(events[m].start<=t)lo=m+1;else hi=m;}const current=lo-1;
   labels=Array(8).fill(null);for(let j=Math.max(0,current-7);j<=current;j++)labels[events[j].slot]=events[j];
   if(current<0){labels[0]={word:events[0].word,slot:0};index=0;}else{index=events[current].slot;previousIndex=current>0?events[current-1].slot:index;eventTime=events[current].start;phase=settle(t-eventTime);advance=current>0&&index!==previousIndex;turn=Math.floor(current/8);}
   slotCount=8;
  }else{
   const words=fitWords(c.words||[]);labels=words.map((word,slot)=>({word,slot}));slotCount=Math.max(1,words.length);
   const stride=Math.max(1,Number(c.beatsPerWord)||1),event=q.index<0?0:Math.floor(q.index/stride);index=mod(event,slotCount);previousIndex=mod(event-1,slotCount);turn=Math.floor(event/slotCount);
   const startsWord=q.index>=0&&q.index%stride===0;advance=event>0&&startsWord&&index!==previousIndex;phase=advance?settle(q.age):1;eventTime=startsWord?t-q.age:null;
   if(!advance)previousIndex=index;
  }
  const target=point(index,slotCount),previous=point(previousIndex,slotCount),hand=handBetween(previous,target,phase,advance);
  return{labels,index,previousIndex,slotCount,target,previous,phase,advance,turn,eventTime,lyric,pulse:q.pulse||0,...hand};
 }
 function handAt(t,c,cues=[]){return stateAt(t,c,Array.isArray(cues)?cues:[]);}
 function textColors(c){return c.textStyle==='White'?['#ffffff']:c.textStyle==='Manual'?[c.textInk||'#ffe28a']:c.textStyle==='Photo accents'?(c.palette||palette):palette;}
 function draw(ctx,t,c,cues=[]){
  const state=stateAt(t,c,cues),colors=textColors(c),stroke=c.stroke||1.15;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  function whiteStroke(width){ctx.save();ctx.shadowColor='rgba(7,14,24,.64)';ctx.shadowBlur=6;ctx.shadowOffsetY=2;ctx.strokeStyle='rgba(8,14,24,.26)';ctx.lineWidth=width+1.5;ctx.stroke();ctx.shadowBlur=3;ctx.strokeStyle='#ffffff';ctx.lineWidth=width;ctx.stroke();ctx.restore();}
  ctx.beginPath();for(let j=0;j<=480;j++){const p=flowingOutline(-Math.PI/2+j*TAU/480,c.contour,c.outlineDepth??1);j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.closePath();whiteStroke(4.4*stroke);
  const active=state.labels[state.index],intensity=c.intensity??.75,activeScale=1+state.pulse*.13*intensity;
  let targetHalfWidth=25,targetHalfHeight=22;
  for(let j=0;j<state.labels.length;j++){
   const label=state.labels[j];if(!label||c.textMode==='none')continue;
   const pos=point(j,state.slotCount),selected=j===state.index,color=colors[mod(j+state.turn,colors.length)],fontSize=state.slotCount>10?36:42;
   ctx.save();ctx.font=`${fontSize}px LatinHand,cursive`;
   const maxWidth=state.slotCount>8?142:182,measured=ctx.measureText(label.word).width,fit=Math.min(1,maxWidth/Math.max(1,measured)),scale=fit*(selected?activeScale:1);
   if(selected){targetHalfWidth=measured*scale/2;targetHalfHeight=fontSize*scale*.55;}
   ctx.translate(pos.x,pos.y);ctx.scale(scale,scale);ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.globalAlpha=selected?1:.73;ctx.shadowColor='rgba(7,14,24,.68)';ctx.shadowBlur=5;ctx.shadowOffsetY=1.8;ctx.lineWidth=1.7;ctx.strokeStyle='rgba(10,17,29,.42)';ctx.strokeText(label.word,0,0);ctx.fillStyle=color;ctx.fillText(label.word,0,0);ctx.restore();
  }
  // The hand ray and the active label share exactly the same endpoint geometry.
  // Its tip stops before the label, rather than using the old fixed short length.
  const ux=Math.abs(Math.cos(state.targetAngle)),uy=Math.abs(Math.sin(state.targetAngle));
  const clearance=ux*targetHalfWidth+uy*targetHalfHeight+18;
  const length=Math.max(50,state.distance-clearance);state.length=length;
  ctx.save();ctx.rotate(state.angle);ctx.beginPath();ctx.moveTo(-17,-15);ctx.quadraticCurveTo(length*.5,-12,length,0);ctx.quadraticCurveTo(length*.5,12,-17,15);ctx.closePath();
  ctx.fillStyle='rgba(255,255,255,.07)';ctx.fill();whiteStroke(4.6*stroke);
  ctx.beginPath();ctx.arc(length,0,4.2+state.pulse*4.5*intensity,0,TAU);ctx.fillStyle='#ffffff';ctx.shadowColor='rgba(7,14,24,.65)';ctx.shadowBlur=5;ctx.fill();ctx.restore();
  ctx.beginPath();ctx.arc(0,0,4.2,0,TAU);ctx.fillStyle='#ffffff';ctx.shadowColor='rgba(7,14,24,.65)';ctx.shadowBlur=5;ctx.fill();ctx.restore();
  return state;
 }
 function render(p,t,c,cues=[]){p.clear();const ctx=p.drawingContext,f=layout(p.width,p.height);ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.sx,f.sy);ctx.translate(-f.cx,-f.cy);const state=draw(ctx,t,c,cues);ctx.restore();return{...state,layout:f};}
 return{draw,render,stateAt,handAt,timeline,point,outline,flowingOutline,bounds,layout,settle,palette,textColors,version:'2.0.0-dynamic-clock'};
})();
