const assert=require('node:assert/strict');require('./rules.js');const R=globalThis.MDPRules;
(async()=>{
 const sr=12000,pcm=new Float32Array(sr*10),expected=[],period=60/186;
 const hit=(t,amplitude,freq)=>{for(let j=0;j<sr*.06;j++){const i=Math.round(t*sr)+j;if(i<pcm.length)pcm[i]+=amplitude*Math.sin(j/sr*2*Math.PI*freq)*Math.exp(-j/(sr*.014));}};
 for(let t=.5;t<9.8;t+=period){expected.push(t);hit(t-.11,.28,600);hit(t,.85,90);}
 const audio={length:pcm.length,sampleRate:sr,numberOfChannels:1,duration:pcm.length/sr,getChannelData:()=>pcm};
 const a=await R.analyzeAudio(audio),track={lag:period,beats:expected},c=R.clockAnalysis(a,track);
 assert.ok(a.clockCandidates.length>a.beats.length,'preserve strong hits hidden by earlier weaker transients');
 assert.equal(c.beats.length,expected.length,'186 BPM main hits must not be halved');
 assert.ok(c.beats.every((t,i)=>Math.abs(t-expected[i])<.025),'follow the strong main hit, not the early guitar-like transient');
 assert.ok(c.beats.every(t=>a.clockCandidates.some(e=>e.time===t)),'every step must be a measured candidate');
 const jittered=expected.map((t,i)=>({time:t+(i%2?.045:-.035),strength:1}));
 const variant={...a,clockCandidates:jittered},j=R.clockAnalysis(variant,track);
 assert.equal(j.beats.length,expected.length,'tempo-aware separation must retain adjacent fast hits with natural timing variation');
 console.log('PASS: 186 BPM early-transient recovery, all main hits, natural onset jitter and no invented events.');
})().catch(e=>{console.error(e);process.exitCode=1});
