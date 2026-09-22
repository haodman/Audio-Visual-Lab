/* Dynamic clock: measured audio motion and stable photo-derived word colors. */
(function(root) {
  'use strict';
  const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const rules = [
    {id:'clock',title:'Dynamic clock',trigger:'One full-frame clock for any photo. Selecting another photo keeps this effect active.',detail:'The resting outline covers 95% of each frame dimension. The outline stretches in multiple directions. Words follow the same deforming contour and the white hand follows its moving target.',motion:'The hand advances on measured audio beats, moves for 85ms, settles for 35ms, then follows that word until the next event. One beat per word is the default, with two/four-beat options.'}
  ];
  const appearanceRules = [
    {title:'Flowing audio outline',trigger:'Measured full-band energy, bass and transient detail shape the outer white contour.',detail:'WebAudio reads the decoded PCM at 100Hz. Normalize by track energy, then smooth attack/release over 120/460ms (energy), 160/580ms (bass) and 180/380ms (detail), followed by a 120ms smoothing stage. Independent horizontal/vertical stretch, traveling bends and broad radial waves carry the movement; fine detail stays restrained. Movement travels according to accumulated audio energy, never a free-running timer.',motion:'Default radial variation reaches 27.2% at peak input, with up to 12% independent horizontal/vertical stretch and traveling angular bends. The shape alternates between compression and extension inside the full-frame safety margin. Quiet passages relax toward the resting shape; silence settles to rest. Pause, seek and export use identical song-time samples. Stretch depth moves both the contour and the words. The hand recomputes its angle and length from the moving active word each frame; beat selection stays unchanged.'},
    {title:'White clock and word colors',trigger:'The outline, hand, hub and tip stay white (#ffffff) with a thin dark edge and soft shadow.',detail:'Words use a soft multicolor palette by default, or Photo accents, White or Manual. Each word keeps its color for a complete turn; the next turn advances the palette. Photo accents sample a 108 x 192 preview and choose colors using saturation-weighted hue and local luminance contrast. Low-contrast accents fall back to the most legible ink.',motion:'Colors never randomize on individual beats. Photo content does not change clock placement or select a different effect.'},
    {title:'Beat locking and silence',trigger:'The hand follows measured WebAudio onsets, checked against the track beat grid when sufficiently supported.',detail:'Compare four grid phases every 16 beats and favor stronger actual hits. Preserve candidates before onset debounce, so an early quiet transient cannot hide the main hit at fast tempos. Minimum event separation is 52% of a beat, clamped to 140–280ms. Unsupported grids fall back to prominent actual onsets. No hand events are invented during silence.',motion:'Custom words and the hand share each measured event and exact target position. Timed lyric groups snap forward to measured beats and occupy eight persistent slots. Line-only lyric timing is estimated, not forced word alignment. Pausing and seeking reproduce the same frame.'}
  ];
  function hsv(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d)h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;return [h*60,max?d/max:0,max];}
  async function analyzeAudio(buffer){
    const hz=100,step=Math.max(1,Math.round(buffer.sampleRate/hz)),n=Math.ceil(buffer.length/step),rms=new Float32Array(n),bass=new Float32Array(n),flux=new Float32Array(n),values=new Float32Array(n),clock=new Float32Array(n),channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));let lp=0;
    const alpha=1-Math.exp(-2*Math.PI*180/buffer.sampleRate);
    for(let k=0;k<n;k++){let sum=0,low=0;const end=Math.min(buffer.length,(k+1)*step);for(let i=k*step;i<end;i++){let v=0;for(const ch of channels)v+=ch[i]/channels.length;lp+=alpha*(v-lp);sum+=v*v;low+=lp*lp;}const count=end-k*step;rms[k]=Math.sqrt(sum/count);bass[k]=Math.sqrt(low/count);if(k)flux[k]=Math.max(0,rms[k]-rms[k-1])+.9*Math.max(0,bass[k]-bass[k-1]);if(k%2500===0)await new Promise(r=>setTimeout(r,0));}
    const sorted=Array.from(rms).sort((a,b)=>a-b),ref=Math.max(.008,sorted[Math.floor(n*.95)]||0),peak=flux.reduce((a,b)=>Math.max(a,b),0),beats=[],strengths=[],clockCandidates=[];let last=-1,env=0;
    for(let k=0;k<n;k++){const target=rms[k]<.001?0:clamp(rms[k]/ref);env+=(target-env)*(target>env?.18:.045);values[k]=env;clock[k]=(clock[k-1]||0)+env/hz;
      if(k<2||k>=n-2||rms[k]<.003||flux[k]<peak*.065)continue;let mean=0;for(let j=Math.max(0,k-60);j<k;j++)mean+=flux[j];mean/=Math.min(60,k);
      if(flux[k]>Math.max(.001,mean*1.9)&&flux[k]>=flux[k-1]&&flux[k]>flux[k+1]){const time=k/hz,strength=clamp((flux[k]/Math.max(.001,peak))*.7+(bass[k]/ref)*.45,.15,1);clockCandidates.push({time,strength});if(time-last>.22){beats.push(time);strengths.push(strength);last=time;}}
    }
    return {hz,values,clock,beats,strengths,clockCandidates,contour:contourEnvelope(rms,bass,flux,hz,ref,peak),duration:buffer.duration,source:'WebAudio PCM energy / bass-onset DSP'};
  }
  // Two causal smoothing stages make the contour flow without beat-sized snaps.
  // All envelopes are precomputed, so seeking and exporting never depend on FPS.
  function contourEnvelope(rms,bass,flux,hz,ref,peak){
    const n=rms.length,energy=new Float32Array(n),low=new Float32Array(n),detail=new Float32Array(n),travel=new Float32Array(n);
    const sorted=Array.from(bass).sort((a,b)=>a-b),bassRef=Math.max(.004,sorted[Math.floor(n*.95)]||0);
    const raw=[0,0,0],smooth=[0,0,0],attack=[.12,.16,.18],release=[.46,.58,.38],follow=1-Math.exp(-1/(hz*.12));let phase=0;
    for(let k=0;k<n;k++){
      const targets=rms[k]<.001?[0,0,0]:[clamp(rms[k]/ref),clamp(bass[k]/bassRef),clamp(flux[k]/Math.max(.001,peak))];
      for(let j=0;j<3;j++){const tau=targets[j]>raw[j]?attack[j]:release[j];raw[j]+=(targets[j]-raw[j])*(1-Math.exp(-1/(hz*tau)));smooth[j]+=(raw[j]-smooth[j])*follow;}
      energy[k]=smooth[0];low[k]=smooth[1];detail[k]=smooth[2];
      phase+=(smooth[0]*1.8+smooth[1]*.6)/hz;travel[k]=phase;
    }
    return {energy,bass:low,detail,travel};
  }
  function contourAt(a,t){
    if(!a?.contour)return {energy:0,bass:0,detail:0,travel:0};
    const n=a.contour.energy.length;if(!n)return {energy:0,bass:0,detail:0,travel:0};
    const sample=clamp(t*a.hz,0,n-1),lo=Math.floor(sample),hi=Math.min(n-1,lo+1),mix=sample-lo;
    return Object.fromEntries(Object.entries(a.contour).map(([key,v])=>[key,v[lo]+(v[hi]-v[lo])*mix]));
  }
  function at(a,t){
    if(!a)return {pulse:0,strength:0,index:-1,age:Infinity,phase:0,clock:0,level:0};
    let lo=0,hi=a.beats.length;while(lo<hi){const mid=(lo+hi)>>1;if(a.beats[mid]<=t)lo=mid+1;else hi=mid;}
    const index=lo-1,age=index<0?Infinity:Math.max(0,t-a.beats[index]),strength=a.strengths[index]||0,sample=clamp(Math.round(t*a.hz),0,a.values.length-1),pulse=(1-Math.exp(-age/.032))*Math.exp(-age/.26)*strength;
    return {pulse:Number.isFinite(pulse)?pulse:0,strength,index,age,phase:clamp(age/.13),clock:a.clock[sample]||0,level:a.values[sample]||0};
  }
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
  root.MDPRules={rules,appearanceRules,analyzeAudio,contourAt,at,clockAnalysis,clockAt,adaptivePalette,luminance,hsv};
})(typeof window!=='undefined'?window:globalThis);
