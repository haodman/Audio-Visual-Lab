/* Adapted from MDP color-motion-effects 1.0.0: photo palette and platform trip.
   Canvas adapter for the existing Audio Visual Lab renderer and WebAudio DSP. */
function createColorBarsEffect(){
const hex=rgb=>'#'+rgb.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
function lab(r,g,b){const lin=v=>(v/=255)<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);r=lin(r);g=lin(g);b=lin(b);const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
function distance(a,b){return (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;}
function brighten(rgb,amount=.2){return rgb.map(v=>Math.round(v+(255-v)*amount));}
function palette(image,crop){
 const c=document.createElement('canvas');c.width=80;c.height=120;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,...crop,0,0,80,120);const data=x.getImageData(0,0,80,120).data,points=[];
 for(let i=0;i<data.length;i+=12){const rgb=[data[i],data[i+1],data[i+2]];points.push({rgb,lab:lab(...rgb),y:Math.floor(i/4/80)/120});}
 const mean=[0,0,0];for(const p of points)for(let j=0;j<3;j++)mean[j]+=p.lab[j]/points.length;
 const centers=[points.reduce((a,b)=>distance(a.lab,mean)<distance(b.lab,mean)?a:b).lab.slice()];
 for(let k=1;k<9;k++){let best=null,bestScore=0;for(const p of points){let d=Math.min(...centers.map(c=>distance(c,p.lab)));if(d>bestScore){bestScore=d;best=p;}}if(bestScore<.0004)break;centers.push(best.lab.slice());}
 let clusters=[];
 for(let step=0;step<9;step++){
 clusters=centers.map(c=>({lab:[0,0,0],rgb:[0,0,0],ys:[],count:0}));
 for(const p of points){let ci=0,bd=Infinity;centers.forEach((c,i)=>{let d=distance(c,p.lab);if(d<bd){bd=d;ci=i;}});const q=clusters[ci];q.count++;q.ys.push(p.y);for(let j=0;j<3;j++){q.lab[j]+=p.lab[j];q.rgb[j]+=p.rgb[j];}}
 clusters=clusters.filter(c=>c.count>0);for(const c of clusters){c.lab=c.lab.map(v=>v/c.count);c.rgb=c.rgb.map(v=>Math.round(v/c.count));}centers.splice(0,centers.length,...clusters.map(c=>c.lab));
 }
 const pool=clusters.filter(c=>c.count/points.length>.015).sort((a,b)=>b.count-a.count),chosen=pool.splice(0,1);
 // Preserve a visible accent even when it occupies less area than neutral surfaces.
 let accent=-1,accentScore=0;pool.forEach((p,i)=>{const chroma=Math.hypot(p.lab[1],p.lab[2]),score=chroma*(.35+Math.sqrt(p.count/points.length));if(chroma>.065&&score>accentScore&&distance(p.lab,chosen[0].lab)>.0025){accent=i;accentScore=score;}});if(accent>=0)chosen.push(pool.splice(accent,1)[0]);
 while(chosen.length<4&&pool.length){let best=-1,score=0;pool.forEach((p,i)=>{let d=Math.min(...chosen.map(c=>distance(p.lab,c.lab)));let s=d*Math.sqrt(p.count/points.length)*(1+Math.hypot(p.lab[1],p.lab[2])*2);if(d>.0025&&s>score){best=i;score=s;}});if(best<0)break;chosen.push(pool.splice(best,1)[0]);}
 return chosen.map(c=>({color:hex(c.rgb),rgb:c.rgb,weight:c.count/points.length,y:c.ys.sort((a,b)=>a-b)[Math.floor(c.ys.length/2)]}));
}
  const state = { images: new Map(), scene: null, analysis: null, events: [], textBounds: [] };
  const ease = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  // One complete extension / hold / retraction, inherited from the MDP platform.
  function trip(age, period, release) {
    const extend = Math.min(.12, period * .23), hold = period * .58;
    const retract = period * (.38 + release * .55);
    if (age < 0 || age >= extend + hold + retract) return 0;
    if (age < extend) return ease(age / extend);
    if (age < extend + hold) return 1;
    return 1 - ease((age - extend - hold) / retract);
  }
  function shortWords(text) {
    // Every entered character is retained; long words become readable short units.
    return String(text || '').slice(0, 500).split(/[\s/，,]+/u).filter(Boolean)
      .flatMap(word => { const letters = Array.from(word); const units = [];
        for (let i = 0; i < letters.length; i += 6) units.push(letters.slice(i, i + 6).join(''));
        return units;
      });
  }
  function sourceFor(value) {
    if(value==='current')return {name:'当前照片',src:$('#storyimg').src};
    if (value.startsWith('sample:')) return COLOR_BAR_SAMPLES[+value.slice(7)];
    if (value.startsWith('preset:')) return PRESETS[+value.slice(7)];
    const rec = LIB.photos.find(r => r.id === value && !r.isVideo);
    if (!rec) return null;
    if (!rec.colorBarsUrl) rec.colorBarsUrl = URL.createObjectURL(rec.blob);
    return { name: rec.name, src: rec.colorBarsUrl };
  }
  function imageFor(value) {
    const descriptor = sourceFor(value);
    if (!descriptor) return null;
    if (!state.images.has(descriptor.src)) {
      const img = new Image(); const entry = { image: img, ready: false, error: false };
      state.images.set(descriptor.src, entry);
      img.crossOrigin = 'anonymous';
      img.onload = () => { entry.ready = true; state.scene = null; };
      img.onerror = () => { entry.error = true; toast('有一张照片无法读取，请重新选择'); };
      img.src = descriptor.src;
    }
    return state.images.get(descriptor.src);
  }
  function geometry(p) {
    const count = clamp(Math.round(p.count),1,3), width = Math.round(W * clamp(p.width, .44, .68));
    const height = Math.round(H * (count===1?.72:.91));
    return { count, x: Math.round((W - width) / 2), y: Math.round((H - height) / 2), w: width, h: height };
  }
  function buildScene(p) {
    const g = geometry(p), key = [S.srcKey,p.count,p.width,p.photo0,p.photo1,p.photo2,p.crop0,p.crop1,p.crop2].join('|');
    if (state.scene?.key === key) return state.scene;
    const photos = [], bars = []; let complete = true;
    for (let i = 0; i < g.count; i++) {
      const entry = p['photo'+i]==='current'?{image:src,ready:true}:imageFor(p['photo'+i]);
      const y = Math.round(g.y + i * g.h / g.count), h = Math.round(g.y + (i + 1) * g.h / g.count) - y;
      if (!entry?.ready) { complete = false; photos.push({ x: g.x, y, w: g.w, h }); continue; }
      const image = entry.image, iw = image.naturalWidth||image.width, ih = image.naturalHeight||image.height;
      const ratio = g.w / h, cw = Math.min(iw, ih * ratio), ch = Math.min(ih, iw / ratio);
      const crop = [(iw - cw) / 2, (ih - ch) * clamp(p['crop'+i]??.5,0,1), cw, ch];
      const photo = { image, x: g.x, y, w: g.w, h, crop }; photos.push(photo);
      let colors;
      try { colors = palette(image, crop).sort((a, b) => a.y - b.y).map(c=>({...c,rgb:brighten(c.rgb,.18),color:hex(brighten(c.rgb,.18))})); }
      catch (error) { colors = [{ color: '#677970', y: .3 }, { color: '#c6b88f', y: .7 }]; }
      // Monochrome images still get six possible platforms, without inventing new hues.
      for (let ci = 0; ci < 6; ci++) {
        const color = colors[ci % colors.length].color, n = i * 6 + ci;
        const space = g.x - 14;
        bars.push({ color, pi: i, side: ci % 2 === 0 ? 1 : -1, lane: n,
          y: y + h * [.20, .34, .48, .62, .76, .90][ci], thickness: [12, 18, 10, 15, 13, 17][(ci + i) % 6],
          length: space * [.93, .75, .84, 1][(ci + i) % 4] });
      }
    }
    const all=bars.map(b=>hex2rgb(b.color)),mean=all.length?all.reduce((a,c)=>(a[0]+=c[0],a[1]+=c[1],a[2]+=c[2],a),[0,0,0]).map(v=>v/all.length):[220,220,214];
    const scene = { key, geometry: g, photos, bars, background:hex(brighten(mean,.72)) };
    if (complete) state.scene = scene;
    return scene;
  }
  function beatEvents() {
    if (state.analysis === S.analysis && state.buffer === S.buffer) return state.events;
    state.analysis = S.analysis; state.buffer = S.buffer; state.events = [];
    const A = S.analysis, buffer = S.buffer;
    if (!A?.beats?.length || !buffer) return state.events;
    const data = buffer.getChannelData(0), sr = buffer.sampleRate;
    // Use only the site's existing WebAudio DSP beat timestamps. Silence cannot
    // produce platform triggers even if a beat grid extends through that silence.
    state.events = A.beats.map((time, step) => {
      const start = Math.max(0, Math.floor((time - .025) * sr));
      const end = Math.min(data.length, Math.floor((time + .09) * sr));
      let power = 0, n = 0;
      for (let i = start; i < end; i += 4) { power += data[i] * data[i]; n++; }
      const rms = Math.sqrt(power / Math.max(1, n));
      return { time, step, period: A.beats[step + 1] - time || A.lag, rms, strength: clamp(rms * 6, 0, 1), audible: rms > .003 };
    });
    const levels = state.events.filter(e => e.audible).map(e => e.rms).sort((a, b) => a - b);
    const medium = levels[Math.floor(levels.length * .40)] ?? Infinity;
    const strong = levels[Math.floor(levels.length * .80)] ?? Infinity;
    let wordBase = 0;
    for (const e of state.events) {
      e.amount = 1 + Number(e.rms >= medium) + Number(e.rms >= strong);
      e.wordBase = wordBase;
      if (e.audible) wordBase += e.amount;
    }
    return state.events;
  }
  function recentEvents(time, count, batch) {
    const all = beatEvents(); let lo = 0, hi = all.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (all[mid].time <= time) lo = mid + 1; else hi = mid; }
    const out = [];
    for (let i = lo - 1; i >= 0 && time - all[i].time < 3; i--) {
      const event = all[i]; if (!event.audible) continue;
      // Each beat launches 1–3 distinct platforms together. Spread them across
      // photos first; a single photo has three lanes per side. The opposite side
      // takes the next beat, so every platform has time to fully retract.
      const pair = Math.floor(event.step / 2), pi = pair % count, band = Math.floor(pair / count) % 3;
      const amount = batch === '随重音 1–3 条' ? event.amount : Number(batch.slice(2, 3));
      const wordBase = batch === '随重音 1–3 条' ? event.wordBase : event.step * amount;
      for (let j = 0; j < amount; j++) {
        const photo = (pi + j) % count, ci = event.step % 2 + 2 * ((band + Math.floor(j / count)) % 3);
        out.push({ ...event, lane: photo * 6 + ci, word: wordBase + j, amount });
      }
    }
    return out;
  }
  function draw(f, p) {
    const scene = buildScene(p), g = scene.geometry, time = f.t;
    const events = recentEvents(time, g.count, p.batch || '随重音 1–3 条'), words = shortWords(p.copy==='自动歌词'?activeLyricAt(time):p.text);
    state.textBounds = []; state.visibleBars = [];
    ctx.fillStyle = scene.background; ctx.fillRect(0, 0, W, H);
    if (!state.paper) {
      const paper = document.createElement('canvas'); paper.width = W; paper.height = H;
      const c = paper.getContext('2d'); c.fillStyle = 'rgba(67,65,47,.035)';
      for (let i = 0; i < 6200; i++) c.fillRect((i * 173 + 37) % W, (i * 397 + 19) % H, 1, 1);
      state.paper = paper;
    }
    ctx.drawImage(state.paper, 0, 0);
    for (const bar of scene.bars) {
      const event = events.find(e => e.lane === bar.lane);
      const bandIndex=bar.lane%3,level=[f.bass,f.mid,f.high][bandIndex]*(p.audioDrive??1.15)*(S.playing?1:0);
      const selected=p.motion==='多频接力'||(p.motion==='低频推进'&&bandIndex===0)||(p.motion==='旋律横移'&&bandIndex===1)||(p.motion==='高频跳闪'&&bandIndex===2);
      const laneGate=(bar.lane+Math.floor(time*(bandIndex===2?10:bandIndex===1?4:2)))%6===0?1:.12;
      const traveling=bandIndex===1?.55+.45*Math.sin(time*3.2+bar.y/H*Math.PI*4):1;
      const live=selected?clamp((level-.06)*1.45*laneGate*traveling,0,1):0;
      const age=event?time-event.time:Infinity,beatProgress=event?trip(age,event.period,p.release):0,progress=Math.max(beatProgress,live);
      if(progress<=.005)continue;
      const length = Math.round(bar.length * p.reach * progress), edge = bar.side < 0 ? g.x : g.x + g.w;
      if (length > 0) {
        ctx.fillStyle = bar.color;
        const highKick=bandIndex===2?1+live*.32:1,thickness=Math.round(bar.thickness*(p.thickness??1)*highKick);
        ctx.fillRect(bar.side < 0 ? edge - length : edge - 1, Math.round(bar.y-thickness/2), length + 1, thickness);
        state.visibleBars.push({ lane: bar.lane, time: event?.time??time, progress, length, side: bar.side, amount: event?.amount??1, thickness });
      }
      if (!event||!words.length) continue;
      const duration = event.period * (1.35 + p.release * .4), phase = age / duration;
      if (phase < 0 || phase >= 1) continue;
      const word = words[event.word % words.length], available = g.x - 23;
      let size = p.textSize;
      const font = () => `400 ${size}px "Silkscreen", "Courier New", monospace`;
      ctx.font = font();
      while (ctx.measureText(word).width > available && size > 9) { size -= .5; ctx.font = font(); }
      const m = ctx.measureText(word), width = m.width;
      const ascent = m.actualBoundingBoxAscent || size, descent = m.actualBoundingBoxDescent || size * .2;
      const launch = clamp((phase - .03) / .79, 0, 1);
      const lift = 4 * launch * (1 - launch) * p.jump * (0.72 + event.strength * .28);
      const home = bar.y - 7;
      const y = clamp(home - lift, 16 + ascent, H - 16 - descent);
      const x = bar.side < 0 ? clamp(g.x - 10 - width, 14, W - 14 - width) : clamp(g.x + g.w + 10, 14, W - 14 - width);
      ctx.save();
      ctx.globalAlpha = ease(phase / .1) * (1 - ease((phase - .84) / .16));
      ctx.fillStyle = '#2b362f'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.fillText(word, x, y); ctx.restore();
      state.textBounds.push({ word, x, y, width, ascent, descent, home, lift, lane: bar.lane });
    }
    // Deliberately rectangular: the collage should read as hard-edged editorial
    // strips, independent of the rounded preview device frame.
    ctx.save(); ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
    // Original photographs cover inner platform edges, matching the MDP layering.
    for (const photo of scene.photos) {
      if (photo.image) ctx.drawImage(photo.image, ...photo.crop, photo.x, photo.y, photo.w, photo.h);
      else { ctx.fillStyle = '#dbdcd4'; ctx.fillRect(photo.x, photo.y, photo.w, photo.h); }
    }
    ctx.restore();
  }
  function setCount(count, vals) {
    vals.count = clamp(count, 1, 3); state.slot = Math.min(state.slot || 0, vals.count - 1);
    state.scene = null; buildParams();
  }
  function countControl(row, vals) {
    const group = document.createElement('div'); group.className = 'color-count';
    for (let n = 1; n <= 3; n++) {
      const button = document.createElement('button'); button.className = 'chip' + (vals.count === n ? ' on' : '');
      button.textContent = n + ' 张'; button.setAttribute('aria-label', '使用 ' + n + ' 张照片');
      button.setAttribute('aria-pressed', String(vals.count === n)); button.onclick = () => setCount(n, vals); group.append(button);
    }
    row.append(group);
  }
  function updatePicker() {
    const box=$('#colorBarPhotos');box.replaceChildren();box.hidden=S.fx!=='colorBars';const active=!box.hidden;
    document.body.classList.toggle('color-bars-active',active);document.querySelectorAll('#photos .color-slot-badge').forEach(b=>b.remove());
    const uploadButton=document.querySelector('#photos button.up:not(.more)');if(uploadButton)uploadButton.textContent=active?'上传\n1–3 张图片':'上传\n照片/视频';$('#photoFile').accept=active?'image/*':'image/*,video/*';if(!active)return;
    const vals=S.params.colorBars;state.slot=clamp(state.slot||0,0,vals.count-1);
    const layout=document.createElement('div');layout.className='color-picker-layout';
    const countPane=document.createElement('div');countPane.className='color-picker-count';const countLabel=document.createElement('span');countLabel.className='color-picker-label';countLabel.textContent='图片张数';countPane.append(countLabel);countControl(countPane,vals);layout.append(countPane);
    const orderPane=document.createElement('div');orderPane.className='color-picker-order';const orderHead=document.createElement('div');orderHead.className='color-picker-order-head';const orderLabel=document.createElement('span');orderLabel.className='color-picker-label';orderLabel.textContent='图片顺序';const orderHint=document.createElement('span');orderHint.className='color-picker-hint';orderHint.textContent='选择位置后点下方素材替换';orderHead.append(orderLabel,orderHint);orderPane.append(orderHead);
    const slots=document.createElement('div');slots.className='color-photo-slots';for(let i=0;i<vals.count;i++){const descriptor=sourceFor(vals['photo'+i]),button=document.createElement('button');button.className='color-photo-slot'+(state.slot===i?' on':'');button.setAttribute('aria-label','选择第 '+(i+1)+' 张照片进行替换');button.title='第 '+(i+1)+' 张 · '+(descriptor?.name||'选择图片');const index=document.createElement('strong');index.textContent=i+1;const img=new Image();img.src=descriptor?.src||'';img.alt='';button.append(index,img);button.onclick=()=>{state.slot=i;updatePicker();};slots.append(button);}orderPane.append(slots);layout.append(orderPane);box.append(layout);
    document.querySelectorAll('#photos button[data-i],#photos button[data-lib]').forEach(button=>{const value=button.dataset.lib||'preset:'+button.dataset.i,positions=Array.from({length:vals.count},(_,i)=>i).filter(i=>vals['photo'+i]===value);button.classList.toggle('on',positions.length>0);if(positions.length){const badge=document.createElement('span');badge.className='color-slot-badge';badge.textContent=positions.map(i=>i+1).join(' / ');button.append(badge);}});
  }
  function choosePhoto(value, vals) {
    const slot = clamp(state.slot || 0, 0, vals.count - 1);
    vals['photo' + slot] = value; vals['crop' + slot] = .5; state.scene = null;
    state.slot = slot; buildParams(); toast('已替换第 ' + (slot + 1) + ' 张照片，可继续对比');
  }
  function rulesControl(row) {
    const note = document.createElement('div'); note.className = 'color-rules';
    note.textContent = '画面、色条与背景全部来自当前用户照片。色条保留主色和小面积强调色，并统一提亮；背景使用综合色板混合后大幅提亮，保持明亮但不抢主体。换图后自动重新取色。';
    row.append(note);
  }
  function photoControl(row, d, vals) {
    row.hidden = +d.key.slice(-1) >= vals.count;
    const wrap = document.createElement('div'); wrap.className = 'color-photo-control';
    const thumb = new Image(); thumb.alt = d.label; thumb.src = sourceFor(vals[d.key])?.src || '';
    const select = document.createElement('select'); select.setAttribute('aria-label', d.label);
    const add = (value, name) => { const op = new Option(name, value, false, vals[d.key] === value); select.add(op); };
    add('current','当前照片');
    COLOR_BAR_SAMPLES.forEach((v, i) => add('sample:' + i, v.name));
    PRESETS.forEach((v, i) => { if (!v.isVideo) add('preset:' + i, v.name); });
    LIB.photos.forEach(v => { if (!v.isVideo) add(v.id, '本地 · ' + v.name); });
    select.onfocus = () => { state.slot = +d.key.slice(-1); updatePicker(); };
    thumb.onclick = () => { state.slot = +d.key.slice(-1); updatePicker(); };
    select.onchange = () => { vals[d.key] = select.value; thumb.src = sourceFor(select.value)?.src || ''; state.scene = null; updatePicker(); };
    const crop = document.createElement('input'); crop.type = 'range'; crop.min = 0; crop.max = 1; crop.step = .01;
    const cropKey = 'crop' + d.key.slice(-1); crop.value = vals[cropKey] ?? .5;
    crop.setAttribute('aria-label', d.label + '裁切位置'); crop.title = '上下移动裁切位置';
    crop.oninput = () => { state.slot = +d.key.slice(-1); vals[cropKey] = +crop.value; state.scene = null; };
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    file.setAttribute('aria-label', '上传替换照片 ' + (+d.key.slice(-1) + 1));
    const replace = document.createElement('button'); replace.className = 'chip color-replace'; replace.textContent = '上传替换这张';
    replace.onclick = () => file.click(); file.onchange = async () => { await upload(file.files, vals, +d.key.slice(-1)); file.value = ''; };
    wrap.append(thumb, select, crop, replace, file); row.append(wrap);
  }
  async function upload(files, vals, targetSlot = null) {
    const list = [...files];
    if (!list.length) return;
    if (list.length > (targetSlot === null ? 3 : 1) || list.some(f => !f.type.startsWith('image/'))) { toast(targetSlot === null ? '请选择 1–3 张图片' : '请选择一张图片替换此位置'); return; }
    await importFiles(list, 'photo');
    const records = list.map(f => LIB.photos.find(r => r.id === 'photo:' + f.name + ':' + f.size)).filter(Boolean);
    if (records.length !== list.length) { toast('有图片无法读取，请重新选择'); return; }
    if (targetSlot === null) vals.count = records.length;
    records.forEach((r, i) => { const slot = targetSlot === null ? i : targetSlot; vals['photo' + slot] = r.id; vals['crop' + slot] = .5; });
    state.slot = targetSlot === null ? 0 : targetSlot;
    state.scene = null; buildParams();
  }
  return {
    name: '交错色条', icon: '🎨', desc: '多图拼接 · 明亮取色 · 向上弹字',
    hint: '保留 1–3 张照片的多图模板，但不再内置陌生示例图：初始三个位置都复用当前照片，再从素材区依次替换。背景综合色与每组色条综合取自所选照片并适度提亮。',
    params: [{key:'count',label:'照片数量',type:'colorCount',def:3},{key:'photo0',label:'照片 1',type:'colorPhoto',def:'current'},{key:'photo1',label:'照片 2',type:'colorPhoto',def:'current'},{key:'photo2',label:'照片 3',type:'colorPhoto',def:'current'},{key:'upload',label:'自己的照片',type:'colorUpload',def:''},Sel('copy','文字来源',['自定义文字','自动歌词'],'自定义文字'),T('text', '弹跳文字', 'GO / WITH / THE / FLOW / STAY / GOLD'),
      R('width', '照片宽度', .44, .68, .58), R('reach', '色条长度', .45, 1, 1),
      Sel('motion', '声场方式', ['多频接力','低频推进','旋律横移','高频跳闪'], '多频接力'), R('audioDrive', '多频律动', 0, 2, 1.15, .05),
      Sel('batch', '每拍同时伸出', ['随重音 1–3 条', '每拍1条', '每拍2条', '每拍3条'], '随重音 1–3 条'),
      R('thickness', '色条粗细', .7, 1.6, 1), R('release', '收回时长', 0, 1, .55), R('jump', '文字跳高', 10, 86, 52, 1), R('textSize', '文字大小', 12, 23, 19, 1),
      { key: 'rules', label: '取色与背景规则', type: 'colorRules', def: '' }],
    state, draw, photoControl, countControl, rulesControl, updatePicker, choosePhoto, upload, shortWords, trip, geometry,
  };
}
