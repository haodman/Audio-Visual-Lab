const assert=require('node:assert/strict');global.window=global;require('./clock-renderer.js');const C=LyricClock;
const rhythmAt=t=>{const index=Math.floor(t/.5),age=t-index*.5;return{index,age,pulse:Math.exp(-age/.16)};};
const config={words:['Keep','a','little','wonder','with','you'],textMode:'words',beatsPerWord:2,rhythmAt};
const diff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
for(let step=0;step<24;step++){
 const t=step+0.2,s=C.stateAt(t,config);assert.equal(s.labels[s.index].word,config.words[step%6]);assert.ok(diff(s.angle,Math.atan2(s.target.y,s.target.x))<1e-9,'hand ray must point exactly at its active word after settling');assert.equal(s.index,step%6);
 const held=C.stateAt(step+.7,config);assert.equal(held.index,s.index);assert.ok(diff(held.angle,s.angle)<1e-9,'intervening beat accents the same word without drifting');
}
const changing=C.stateAt(1.04,config),settled=C.stateAt(1.2,config);assert.equal(changing.index,settled.index);assert.ok(diff(changing.angle,settled.angle)>1e-3);assert.ok(diff(C.stateAt(1.35,config).angle,settled.angle)<1e-9);
for(const size of [[540,960],[1080,1920]]){const f=C.layout(...size),b=C.bounds;assert.ok(Math.abs((b.xmax-b.xmin)*f.sx/size[0]-.95)<1e-9);assert.ok(Math.abs((b.ymax-b.ymin)*f.sy/size[1]-.95)<1e-9);}
const beats=Array.from({length:30},(_,i)=>i*.5),cues=[{time:.2,end:2.7,text:'Every word belongs here'},{time:2.7,end:5.7,text:'Follow the hand around'}];
const lyrical={...config,textMode:'auto',beatTimes:beats};const events=C.timeline(cues,beats);assert.ok(events.every(e=>beats.includes(e.start)));assert.ok(events.map(e=>e.word).join(' ').includes('Every word belongs here'));for(const e of events){const s=C.stateAt(e.start+.15,lyrical,cues);assert.equal(s.labels[s.index].word,e.word);assert.ok(diff(s.angle,Math.atan2(s.target.y,s.target.x))<1e-9,'lyrics and hand share slot geometry');}
assert.deepEqual(C.stateAt(3.14,lyrical,cues),C.stateAt(3.14,lyrical,cues),'seek is deterministic');
const fastPeriod=60/186,fast={...config,beatsPerWord:undefined,rhythmAt:t=>{const index=Math.floor(t/fastPeriod);return{index,age:t-index*fastPeriod,pulse:0};}};
for(let beat=0;beat<24;beat++){const s=C.stateAt(beat*fastPeriod+.13,fast);assert.equal(s.index,beat%6,'default advances one word on every verified beat at 186 BPM');assert.ok(diff(s.angle,s.targetAngle)<1e-9);const hold=C.stateAt(beat*fastPeriod+.28,fast);assert.ok(diff(hold.angle,s.angle)<1e-9,'fast steps still hold between beats');}
console.log('PASS: 95% full-frame geometry, current-word targeting, shared beat event, hold, lyric beat snapping and deterministic seek.');
