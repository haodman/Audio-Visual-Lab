const assert=require('node:assert/strict');require('./rules.js');const R=globalThis.MDPRules;
const d=(label,score,box)=>({label,score,box:{xmin:box[0],ymin:box[1],xmax:box[2],ymax:box[3]}});
const flower=d('a flower',.8,[.05,.38,.09,.43]),foreground=d('a flower',.49,[.18,.25,.37,.34]);
assert.equal(R.rank({detections:[flower]})[0].id,'clock','high confidence tiny background flower cannot trigger');
assert.equal(R.rank({detections:[foreground]})[0].id,'sunshine','large foreground flower still qualifies');
assert.equal(R.rank({detections:[d('a flower',.9,[0,.2,.18,.4])]})[0].id,'clock','edge decoration rejected');
const candle=d('a lit candle',.5,[.316,.503,.347,.598]),cake=d('a birthday cake',.5,[.2,.565,.52,.725]);
assert.equal(R.rank({detections:[candle]})[0].id,'clock','narrow incidental candle is insufficient');
assert.equal(R.rank({detections:[candle,cake]})[0].id,'sunshine','prominent cake supports its attached candle');
assert.equal(R.rank({detections:[candle,d('a birthday cake',.5,[.6,.565,.92,.725])]})[0].id,'clock','unrelated cake elsewhere is not supporting context');
assert.equal(R.rank({detections:[d('a lit candle',.6,[.43,.2,.5,.5])]})[0].id,'sunshine','large standalone candle');
assert.equal(R.objects([foreground,{...foreground,score:.4}]).length,1);
assert.deepEqual(R.rules.map(r=>r.id),['sunshine','clock']);
assert.deepEqual(R.rank({colors:[{id:'leaves'}],music:{rain:true}}).map(r=>r.id),['clock'],'no umbrella fallback or retired color branch');
const sun={...d('the sun',.12,[.6,.3,.64,.33]),visualVerified:'compact warm bright disk'};assert.equal(R.objects([sun]).length,0,'tiny disk rejected even with pixel verification');
const cotton={...d('cotton candy',.13,[.25,.1,.9,.6]),verifiedBy:'local crop recheck'};assert.equal(R.objects([cotton])[0].object,'cotton candy');
const white=R.adaptivePalette(Array(40).fill([250,250,250])),black=R.adaptivePalette(Array(40).fill([15,15,20]));const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));assert.ok(R.luminance(rgb(white.color))<.15&&R.luminance(rgb(black.color))>.75);assert.deepEqual(white,R.adaptivePalette(Array(40).fill([250,250,250])));
function buffer(data,sr=12000){return{length:data.length,sampleRate:sr,numberOfChannels:1,duration:data.length/sr,getChannelData(){return data}};}
(async()=>{const silence=await R.analyzeAudio(buffer(new Float32Array(12000*4)));assert.equal(R.clockAnalysis(silence,{lag:.5,beats:[.5,1,1.5,2]}).beats.length,0);assert.equal(R.clockAt(silence,2).pulse,0);
const pcm=new Float32Array(12000*8),beats=[];for(let t=.5;t<8;t+=.5){beats.push(t);for(let j=0;j<1200;j++)pcm[Math.round(t*12000)+j]=.7*Math.sin(j/12000*2*Math.PI*90)*Math.exp(-j/180);}const a=await R.analyzeAudio(buffer(pcm)),track={lag:.5,beats},timing=R.clockAnalysis(a,track);assert.equal(timing.beats.length,beats.length);assert.ok(timing.beats.every((t,i)=>Math.abs(t-beats[i])<=.025));assert.ok(timing.beats.every(t=>a.beats.includes(t)),'never invent a beat');const b=timing.beats[4];assert.ok(R.clockAt(a,b+.03,track).phase>.7,'move decisively in first 30ms');assert.equal(R.clockAt(a,b+.12,track).phase,1);assert.equal(R.clockAt(a,b+.3,track).phase,1,'hold between beats');assert.ok(R.clockAt(a,b+.03,track).pulse>R.clockAt(a,b+.3,track).pulse);assert.deepEqual(R.clockAt(a,b+.04,track),R.clockAt(a,b+.04,track));console.log('PASS: tiny/background rejection, foreground flower/cake, context association, two effects, adaptive contrast, silence, exact actual-onset steps and 120ms settle/hold.');})().catch(e=>{console.error(e);process.exitCode=1});

const phaseCase={hz:100,values:new Float32Array(500).fill(.8),clock:new Float32Array(500),beats:[.5,.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75,4],strengths:[1,.2,1,.2,1,.2,1,.2,1,.2,1,.2,1,.2,1]};
const aligned=R.clockAnalysis(phaseCase,{lag:.5,beats:[.75,1.25,1.75,2.25,2.75,3.25]});assert.ok(aligned.beats.length>=5);assert.ok(aligned.beats.every(t=>Math.abs(t*2-Math.round(t*2))<.001),'phase correction favors main accents over weak offbeat hats');
