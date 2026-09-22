const assert=require('node:assert/strict');global.window=global;require('./rules.js');require('./clock-renderer.js');
const R=MDPRules,C=LyricClock;
function buffer(data,sr=12000){return{length:data.length,sampleRate:sr,numberOfChannels:1,duration:data.length/sr,getChannelData:()=>data};}
(async()=>{
 const sr=12000,pcm=new Float32Array(sr*18);
 for(let i=0;i<sr*8;i++){const t=i/sr,amp=t<2?.08:t<6?.8:.08;pcm[i]=amp*(.7*Math.sin(t*Math.PI*2*90)+.3*Math.sin(t*Math.PI*2*720));}
 const a=await R.analyzeAudio(buffer(pcm)),silence=await R.analyzeAudio(buffer(new Float32Array(sr*3)));
 assert.deepEqual(R.contourAt(silence,2),{energy:0,bass:0,detail:0,travel:0},'silent PCM must not create contour motion');
 assert.ok(R.contourAt(a,5).energy>R.contourAt(a,1.8).energy*4,'louder PCM produces more contour depth');
 assert.ok(R.contourAt(a,17).energy<.00001&&R.contourAt(a,17).bass<.00001,'silent tail relaxes to rest');
 const f=C.layout(540,960),points=t=>Array.from({length:180},(_,i)=>C.flowingOutline(i*Math.PI*2/180,R.contourAt(a,t)));
 let maximumStep=0,maximumAcceleration=0,previous=points(0),velocity=previous.map(()=>({x:0,y:0}));
 for(let frame=1;frame<18*60;frame++){
  const p=points(frame/60);
  for(let i=0;i<p.length;i++){
   const dx=(p[i].x-previous[i].x)*f.sx,dy=(p[i].y-previous[i].y)*f.sy;
   maximumStep=Math.max(maximumStep,Math.hypot(dx,dy));maximumAcceleration=Math.max(maximumAcceleration,Math.hypot(dx-velocity[i].x,dy-velocity[i].y));velocity[i]={x:dx,y:dy};
  }
  previous=p;
 }
 assert.ok(maximumStep<960*.008,`no contour jumps at 60fps: ${maximumStep}`);
 assert.ok(maximumAcceleration<2,`no abrupt velocity changes: ${maximumAcceleration}`);
 const signal=R.contourAt(a,5),b=C.bounds;
 for(let phase=0;phase<10;phase+=.37)for(let i=0;i<360;i++){
  const angle=i*Math.PI*2/360,p=C.flowingOutline(angle,{...signal,travel:phase},1.5);
  assert.ok(p.x>=b.xmin&&p.x<=b.xmax&&p.y>=b.ymin&&p.y<=b.ymax,'maximum depth remains inside frame margins');
  assert.deepEqual(C.flowingOutline(angle,signal,0),C.outline(angle),'zero depth restores resting outline');
 }
 const time=4.125,expected=points(time);points(12);points(1);assert.deepEqual(points(time),expected,'arbitrary seeks reproduce the same contour');
 const cfg={words:['Move','with','the','music'],rhythm:{index:3,age:.2,pulse:.2}};
 const moving=C.stateAt(time,{...cfg,contour:signal,outlineDepth:1}),rest=C.stateAt(time,{...cfg,contour:signal,outlineDepth:0});
 assert.notDeepEqual(moving.positions,rest.positions,'words must follow the stretched contour');
 assert.equal(moving.index,rest.index,'stretch does not change beat/word selection');
 const tracks=Array.from({length:6},()=>[]),widths=[],heights=[];
 for(let k=0;k<300;k++){
  const contour={energy:.8,bass:.75,detail:.1,travel:k*.08};
  const state=C.stateAt(time,{...cfg,words:['Keep','a','little','wonder','with','you'],contour});
  assert.deepEqual(state.target,state.positions[state.index],'hand and label share the moving endpoint');
  assert.ok(Math.abs(state.angle-Math.atan2(state.target.y,state.target.x))<1e-9,'settled hand follows moving word angle');
  assert.ok(Math.abs(state.distance-Math.hypot(state.target.x,state.target.y))<1e-9,'hand length follows moving word radius');
  for(let j=0;j<6;j++)tracks[j].push(state.positions[j]);
  const rim=Array.from({length:180},(_,j)=>C.flowingOutline(j*Math.PI*2/180,contour));
  widths.push((Math.max(...rim.map(p=>p.x))-Math.min(...rim.map(p=>p.x)))*f.sx);
  heights.push((Math.max(...rim.map(p=>p.y))-Math.min(...rim.map(p=>p.y)))*f.sy);
 }
 const travels=tracks.map(pts=>Math.hypot((Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)))*f.sx,(Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y)))*f.sy));
 assert.ok(travels.every(v=>v>35),'every default word must move visibly, including top and bottom');
 assert.ok(Math.max(...widths)-Math.min(...widths)>35,'width stretches visibly');
 assert.ok(Math.max(...heights)-Math.min(...heights)>55,'height stretches visibly');
 for(let frame=0;frame<60;frame++){
  const contour=R.contourAt(a,4+frame/60),c={...cfg,textMode:'auto',beatTimes:[.5,1,1.5,2,2.5,3,3.5,4],contour};
  const state=C.stateAt(4.2+frame/60,c,[{time:0,end:3.8,text:'Words travel with the changing wave'}]);
  assert.deepEqual(state.target,state.positions[state.index]);assert.ok(Math.abs(state.angle-state.targetAngle)<1e-9,'lyric hand follows its deformed label');
 }
 console.log('Visible displacement (canvas pixels):',{words:travels,widthRange:Math.max(...widths)-Math.min(...widths),heightRange:Math.max(...heights)-Math.min(...heights)});
 console.log('PASS: audio-dependent contour, silent rest, deterministic seek, safe frame bounds, moving word/hand targeting and multidirectional stretching.',{maximumStep,maximumAcceleration});
})().catch(e=>{console.error(e);process.exitCode=1});
