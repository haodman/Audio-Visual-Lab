/* Image-first matching rules. Scores are model similarities, not probabilities. */
(function(root) {
  'use strict';
  const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const targetLabels = ['a lit candle', 'a flower', 'a lollipop', 'cotton candy', 'a balloon', 'the sun', 'a person', 'a lamp', 'a bouquet of flowers', 'the sky', 'a birthday cake'];
  const objectNames = ['candle','single flower','lollipop','cotton candy','balloon','sun'];
  const rules = [
    {id:'sunshine',title:'Rotating sunshine',trigger:'A prominent foreground candle, single flower, lollipop, cotton candy, balloon or sun — not a small background detail.',detail:'Recognition alone is insufficient. Flower heads must cover >= 1.5% of the frame, with width >= 12% and height >= 5.5%; candy and balloons need >= 2% area and width >= 10% / height >= 8%. Object centers must remain within x 12–88%, y 10–88%. Small edge flowers, distant decorations and tiny sun disks are rejected. Standalone candles need >= 0.8% area and >= 14% height. A narrow birthday candle may qualify only when attached to a clearly detected foreground cake covering >= 3.5% of the frame. A recognized object with no prominent subject evidence falls back to the clock.',motion:'Soft, restrained accents. Candle halos retain their faster rotation and every spoke remains filled with words or text emoticons.'},
    {id:'clock',title:'Rotating text clock',trigger:'The default whenever no prominent sunshine subject qualifies.',detail:'Always fill 95% of both frame dimensions, with a 2.5% safety margin. Ignore subjects and composition. The outline and hand stay white with a soft dark shadow. Custom copy and timed lyrics share their exact active-word position with the hand.',motion:'The hand jumps to the highlighted word on a measured audio beat, moves for 85ms, settles for 35ms, then holds. Custom words advance on every verified beat by default; optional two/four-beat pacing remains available. The whole clock stays fixed.'}
  ];
  const appearanceRules=[
    {title:'Automatic photo selection',trigger:'Selecting a still photo in Smart dynamic stickers immediately starts matching.',detail:'Start with Rotating text clock. Switch to sunshine only if both recognition and foreground prominence checks pass. There is no Auto match button, and no umbrella fallback. Manual selection lasts until the next photo.',motion:'Image filenames and expected test labels never drive matching.'},
    {title:'Color and full-frame clock',trigger:'Sunshine uses image-adaptive ink. Clock outline and hand always use white (#ffffff), protected by a thin dark edge and soft shadow.',detail:'Clock words default to a soft multicolor palette: yellow, mint, pink, sky blue, lilac, peach, green and rose. Each word keeps its color through one complete turn; the next turn advances the palette by one color. Optional word modes are Photo accents, White and Manual. These controls never recolor the white outline or hand. Sunshine and optional Photo accents sample a 108 x 192 preview, measure luminance and saturation-weighted hue, and choose tinted light ink, tinted dark ink, ivory or navy by lower-quartile contrast. Accents below 3:1 median contrast use the base ink.',motion:'No random color changes or color flashing on every beat. The clock always occupies 95% of frame width and height, independent of people, foreground objects or the photograph.'},
    {title:'Beat locking and silence',trigger:'The clock follows measured WebAudio onsets, checked against the track beat grid when it has enough support.',detail:'Compare four beat-grid phases every 16 beats and favor the phase with stronger actual hits, so offbeat hats/chords do not displace the main accents. Snap supported beats to a real onset within 130ms or 26% of a beat, whichever is shorter. Retain onset candidates before the legacy 220ms debounce, so early quiet transients cannot hide the main hit. Reject weak events and use a tempo-aware minimum separation: 52% of one beat, clamped to 140–280ms. If fewer than 40% of active grid beats are supported, use prominent actual onsets instead. Every clock step must refer to a detected onset; no events are invented in silence.',motion:'The active word defines both hand angle and hand length. Custom copy advances every 1, 2 or 4 verified beats (default 1). Timed lyric groups snap forward to measured beats and occupy eight persistent slots; their text and hand advance together. A step settles after 120ms and holds. Pausing and seeking reproduce the same frame.'}
  ];
  function overlap(a,b) {const w=Math.max(0,Math.min(a.xmax,b.xmax)-Math.max(a.xmin,b.xmin)),h=Math.max(0,Math.min(a.ymax,b.ymax)-Math.max(a.ymin,b.ymin));return w*h;}
  function area(b){return Math.max(0,b.xmax-b.xmin)*Math.max(0,b.ymax-b.ymin);}
  function prominence(d,detections=[]){
    const b=d.box,a=area(b),w=b.xmax-b.xmin,h=b.ymax-b.ymin,cx=(b.xmin+b.xmax)/2,cy=(b.ymin+b.ymax)/2;
    const reject=reason=>({eligible:false,reason,area:a});
    if(cx<.12||cx>.88||cy<.10||cy>.88)return reject('Peripheral object; not a foreground focal subject.');
    if(a>.65)return reject('Object box is too broad to localize reliably.');
    if(d.label==='a lit candle'){
      const cake=detections.filter(v=>v.label==='a birthday cake'&&v.score>=.18&&area(v.box)>=.035&&area(v.box)<.45).find(v=>{const q=v.box;return cx>=q.xmin&&cx<=q.xmax&&b.ymax>=q.ymin-.025&&b.ymax<=q.ymax&&b.ymin>=q.ymin-.22&&(q.xmin+q.xmax)/2>=.15&&(q.xmin+q.xmax)/2<=.85;});
      if(cake&&a>=.0015&&w>=.02&&h>=.07&&d.score>=.25)return{eligible:true,reason:'Candle attached to a prominent foreground birthday cake.',area:a,contextArea:area(cake.box)};
      if(a<.008||w<.04||h<.14)return reject('Small candle without a prominent cake context.');
    }else if(d.label==='a flower'){
      if(a<.015||w<.12||h<.055)return reject('Small flower/background decoration, below foreground size thresholds.');
    }else if(d.label==='the sun'){
      if(a<.004||w<.075||h<.035)return reject('Tiny or distant sun disk; not a sufficiently large focal subject.');
    }else if(a<.02||w<.10||h<.08)return reject('Object is too small to be the foreground subject.');
    if(d.score<.18&&a<.08&&d.verifiedBy!=='local crop recheck'&&d.visualVerified!=='compact warm bright disk')return reject('Small object has insufficient recognition support.');
    return{eligible:true,reason:'Prominent foreground object passes size and composition checks.',area:a};
  }
  function objects(detections) {
    const kept=[];
    for(const d of [...detections].sort((a,b)=>b.score-a.score)){
      const index=targetLabels.indexOf(d.label),a=area(d.box);
      const softCandy=index===3&&d.score>=.10&&detections.some(v=>v.label!==d.label&&['a balloon','a lollipop'].includes(v.label)&&v.score>=.08&&overlap(v.box,d.box)/Math.min(area(v.box),a)>.8)&&!detections.some(v=>v.label==='a lamp'&&v.score>d.score&&overlap(v.box,d.box)/a>.5);
      const smallSun=index===5&&d.score>=.09&&d.visualVerified==='compact warm bright disk';
      if(index<0||index>5||(d.score<.12&&!softCandy&&!smallSun)||a<.0002||a>.65)continue;
      if(index===1&&detections.some(b=>b.label==='a bouquet of flowers'&&b.score>d.score&&overlap(b.box,d.box)/a>.5))continue;
      if(index===5&&detections.some(b=>b.label==='a lamp'&&b.score>d.score&&overlap(b.box,d.box)/a>.4))continue;
      if(kept.some(k=>overlap(k.box,d.box)/Math.min(area(k.box),a)>.5))continue;
      let box=d.box;
      // Prefer the round candy head over a box that includes its long stick.
      if(index===2){const head=detections.filter(v=>v.label===d.label&&v.score>=Math.max(.075,d.score*.48)&&overlap(v.box,d.box)/area(v.box)>.8).filter(v=>{const b=v.box,aspect=(b.xmax-b.xmin)*.5625/(b.ymax-b.ymin);return aspect>.65&&aspect<1.5;}).sort((a,b)=>b.score-a.score)[0];if(head)box=head.box;}
      const subject=prominence({...d,box},detections);if(!subject.eligible)continue;
      kept.push({...d,box,object:objectNames[index],subject});
    }
    return kept.slice(0,4);
  }
  function hsv(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d)h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;return [h*60,max?d/max:0,max];}
  function rank({detections=[]}={}){
    const matches=objects(detections).map(o=>({id:'sunshine',score:1+Math.sqrt(o.subject.contextArea||o.subject.area)+.2*o.score,anchor:{x:(o.box.xmin+o.box.xmax)/2,y:(o.box.ymin+o.box.ymax)/2},box:o.box,object:o.object,subject:o.subject,reason:`${o.subject.reason} ${o.object}; ${(o.subject.area*100).toFixed(1)}% of frame.`}));
    matches.push({id:'clock',score:.1,reason:'No prominent sunshine subject: use the beat-locked text clock.'});
    return matches.sort((a,b)=>b.score-a.score);
  }
  async function analyzeAudio(buffer){
    const hz=100,step=Math.max(1,Math.round(buffer.sampleRate/hz)),n=Math.ceil(buffer.length/step),rms=new Float32Array(n),bass=new Float32Array(n),flux=new Float32Array(n),values=new Float32Array(n),clock=new Float32Array(n),channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));let lp=0;
    const alpha=1-Math.exp(-2*Math.PI*180/buffer.sampleRate);
    for(let k=0;k<n;k++){let sum=0,low=0;const end=Math.min(buffer.length,(k+1)*step);for(let i=k*step;i<end;i++){let v=0;for(const ch of channels)v+=ch[i]/channels.length;lp+=alpha*(v-lp);sum+=v*v;low+=lp*lp;}const count=end-k*step;rms[k]=Math.sqrt(sum/count);bass[k]=Math.sqrt(low/count);if(k)flux[k]=Math.max(0,rms[k]-rms[k-1])+.9*Math.max(0,bass[k]-bass[k-1]);if(k%2500===0)await new Promise(r=>setTimeout(r,0));}
    const sorted=Array.from(rms).sort((a,b)=>a-b),ref=Math.max(.008,sorted[Math.floor(n*.95)]||0),peak=flux.reduce((a,b)=>Math.max(a,b),0),beats=[],strengths=[],clockCandidates=[];let last=-1,env=0;
    for(let k=0;k<n;k++){const target=rms[k]<.001?0:clamp(rms[k]/ref);env+=(target-env)*(target>env?.18:.045);values[k]=env;clock[k]=(clock[k-1]||0)+env/hz;
      if(k<2||k>=n-2||rms[k]<.003||flux[k]<peak*.065)continue;let mean=0;for(let j=Math.max(0,k-60);j<k;j++)mean+=flux[j];mean/=Math.min(60,k);
      if(flux[k]>Math.max(.001,mean*1.9)&&flux[k]>=flux[k-1]&&flux[k]>flux[k+1]){const time=k/hz,strength=clamp((flux[k]/Math.max(.001,peak))*.7+(bass[k]/ref)*.45,.15,1);clockCandidates.push({time,strength});if(time-last>.22){beats.push(time);strengths.push(strength);last=time;}}
    }
    return {hz,values,clock,beats,strengths,clockCandidates,duration:buffer.duration,source:'WebAudio PCM energy / bass-onset DSP'};
  }
  function at(a,t){
    if(!a)return {pulse:0,strength:0,index:-1,age:Infinity,phase:0,clock:0,level:0};
    let lo=0,hi=a.beats.length;while(lo<hi){const mid=(lo+hi)>>1;if(a.beats[mid]<=t)lo=mid+1;else hi=mid;}
    const index=lo-1,age=index<0?Infinity:Math.max(0,t-a.beats[index]),strength=a.strengths[index]||0,sample=clamp(Math.round(t*a.hz),0,a.values.length-1),pulse=(1-Math.exp(-age/.032))*Math.exp(-age/.26)*strength;
    return {pulse:Number.isFinite(pulse)?pulse:0,strength,index,age,phase:clamp(age/.13),clock:a.clock[sample]||0,level:a.values[sample]||0};
  }
  const gentleCache=new WeakMap();
  function gentleAnalysis(a){
    if(!a)return null;if(gentleCache.has(a))return gentleCache.get(a);
    const beats=[],strengths=[];for(let i=0;i<a.beats.length;i++)if(!beats.length||a.beats[i]-beats.at(-1)>=1.25){beats.push(a.beats[i]);strengths.push(a.strengths[i]);}
    const out={...a,beats,strengths};gentleCache.set(a,out);return out;
  }
  function gentleAt(a,t){const q=at(gentleAnalysis(a),t);q.phase=clamp(q.age/.55);q.phase=q.phase*q.phase*(3-2*q.phase);q.pulse=Number.isFinite(q.age)?(1-Math.exp(-q.age/.20))*Math.exp(-q.age/.65)*q.strength:0;return q;}
  const clockCache=new WeakMap();
  function clockAnalysis(a,track=null){
    if(!a)return null;const prior=clockCache.get(a);if(prior?.track===track)return prior.result;
    const candidates=a.clockCandidates||a.beats.map((time,i)=>({time,strength:a.strengths[i]||0}));
    const sorted=candidates.map(e=>e.strength).sort((x,y)=>x-y),threshold=Math.max(.16,(sorted[Math.floor(sorted.length*.45)]||0)*.75);
    const strong=candidates.filter(e=>e.strength>=threshold);
    let events=[],activeGrid=0;const gap=track?.lag||.5,window=Math.min(.13,gap*.26),minGap=Math.max(.14,Math.min(.28,gap*.52));
    // Re-evaluate phase every 16 grid beats: a full-band BPM grid can sit on
    // offbeat chords/hi-hats. Prefer the phase supported by stronger real hits.
    if(track?.beats?.length)for(let offset=0;offset<track.beats.length;offset+=16){
      const block=track.beats.slice(offset,offset+16);let bestPhase=null;
      for(const phase of [0,.25,.5,.75]){let selected=[],power=0,active=0,index=0;
        for(const base of block){const grid=base+gap*phase,sample=Math.min(a.values.length-1,Math.max(0,Math.round(grid*a.hz)));if(a.values[sample]<.06)continue;active++;while(index<strong.length&&strong[index].time<grid-window)index++;let best=null;for(let j=index;j<strong.length&&strong[j].time<=grid+window;j++){const event=strong[j],score=event.strength*(1-.2*Math.abs(event.time-grid)/window);if(!best||score>best.score)best={...event,score};}if(best&&(!selected.length||best.time-selected.at(-1).time>=minGap)){selected.push(best);power+=best.score*best.score;}}
        if(!bestPhase||power>bestPhase.power)bestPhase={selected,power,active};
      }
      activeGrid+=bestPhase.active;for(const event of bestPhase.selected)if(!events.length||event.time-events.at(-1).time>=minGap)events.push(event);
    }
    const supported=activeGrid>0&&events.length/activeGrid>=.4;
    if(!supported){events=[];for(const e of strong){if(!events.length||e.time-events.at(-1).time>=minGap)events.push(e);else if(e.strength>events.at(-1).strength)events[events.length-1]=e;}}
    const result={...a,beats:events.map(e=>e.time),strengths:events.map(e=>e.strength),source:supported?'Locally phase-aligned actual audio onsets':'Prominent actual audio onsets'};clockCache.set(a,{track,result});return result;
  }
  function clockAt(a,t,track=null){
    const q=at(clockAnalysis(a,track),t),u=clamp(q.age/.085);
    q.phase=q.age<.085?1.035*(1-(1-u)**3):q.age<.12?1+.035*(1-(q.age-.085)/.035):1;
    q.pulse=Number.isFinite(q.age)?(1-Math.exp(-q.age/.008))*Math.exp(-q.age/.16)*(.5+.5*q.strength):0;
    return q;
  }
  const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  function hsl(h,s,l){const f=n=>{const k=(n+h/30)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};return [f(0),f(8),f(4)];}
  const hex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  function adaptivePalette(samples){
    if(!samples.length)samples=[[100,100,100]];
    const light=samples.map(luminance).sort((a,b)=>a-b),median=light[Math.floor(light.length/2)],buckets=new Float64Array(12);
    for(const rgb of samples){const [h,s,v]=hsv(...rgb);if(v>.08&&v<.95)buckets[Math.floor(h/30)%12]+=s*s;}
    let hue=210,best=0;for(let i=0;i<12;i++)if(buckets[i]>best){best=buckets[i];hue=i*30+15;}
    const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const score=rgb=>{const l=luminance(rgb),r=light.map(v=>ratio(v,l)).sort((a,b)=>a-b);return r[Math.floor(r.length*.25)];};
    const candidates=[hsl(hue,.20,.93),hsl(hue,.27,.16),[255,249,234],[25,31,41]];
    candidates.sort((a,b)=>score(b)-score(a));const rgb=candidates[0],isLight=luminance(rgb)>.5;
    const palette=[0,55,310].map(offset=>{let c=hsl((hue+offset)%360,.40,isLight?.84:.20);if(ratio(luminance(c),median)<3)c=rgb;return hex(c);});
    return{color:hex(rgb),accent:palette[1],palette,halo:isLight?'#17202b':'#fffaf0',mode:isLight?'Light ink on a dark region':'Dark ink on a light region',contrast:score(rgb),hue,median};
  }
  root.MDPRules={rules,appearanceRules,targetLabels,objects,prominence,rank,analyzeAudio,at,gentleAt,gentleAnalysis,clockAnalysis,clockAt,adaptivePalette,luminance,hsv};
})(typeof window!=='undefined'?window:globalThis);
