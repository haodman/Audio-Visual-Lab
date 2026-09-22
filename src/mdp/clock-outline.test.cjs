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
 assert.ok(maximumStep<1.8,`no contour jumps at 60fps: ${maximumStep}`);
 assert.ok(maximumAcceleration<.4,`no abrupt velocity changes: ${maximumAcceleration}`);
 const signal=R.contourAt(a,5),b=C.bounds;
 for(let phase=0;phase<10;phase+=.37)for(let i=0;i<360;i++){
  const angle=i*Math.PI*2/360,p=C.flowingOutline(angle,{...signal,travel:phase},1.5);
  assert.ok(p.x>=b.xmin&&p.x<=b.xmax&&p.y>=b.ymin&&p.y<=b.ymax,'maximum depth remains inside frame margins');
  assert.deepEqual(C.flowingOutline(angle,signal,0),C.outline(angle),'zero depth restores resting outline');
 }
 const time=4.125,expected=points(time);points(12);points(1);assert.deepEqual(points(time),expected,'arbitrary seeks reproduce the same contour');
 const cfg={words:['Move','with','the','music'],rhythm:{index:3,age:.2,pulse:.2}};
 assert.deepEqual(C.stateAt(time,{...cfg,contour:signal,outlineDepth:1.5}),C.stateAt(time,{...cfg,contour:signal,outlineDepth:0}),'outline changes cannot move the paired word/hand targets');
 console.log('PASS: audio-dependent contour, silent rest, deterministic seek, safe frame bounds, stable word/hand geometry.',{maximumStep,maximumAcceleration});
})().catch(e=>{console.error(e);process.exitCode=1});
