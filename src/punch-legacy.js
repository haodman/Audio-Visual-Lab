function createLegacyPunchEffect(){return ({
// Previous renderer retained as reference; inactive.
  punchSymbols: { name:'图形镂空',icon:'🔘',desc:'照片剪纸 · 上下正负形',hint:'上下图形位置与取样一一对应，一次只显示一种字符。重音到来时随机选 2–4 个图形同步放大、柔和回落；重音放大设为 0 可关闭。暂停时定格。',
    params:[Sel('shape','字符预设',['✦','★','●','♥','✳','自定义'],'★'),T('glyph','自定义字符','✦'),R('count','图形数量',6,24,16,1),R('size','图形大小',18,64,25,1),R('pulse','节奏幅度',0,1,1),R('accent','重音放大',0,2,1),Sel('paper','底纸质感',['细织纹','纯色'],'细织纹'),Sel('tone','底纸深浅',['深色','浅色'],'深色'),Sel('ground','底色来源',['照片取色','自选颜色'],'照片取色'),C('col','自选底色','#dbe2e7'),D('drv','beat',['beat','kick','snare'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t),half=H/2,photo=splitFrame();
      const raw=(p.shape==='自定义'?p.glyph:p.shape).trim()||'✦';
      const glyph=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(raw)][0].segment:Array.from(raw)[0];
      if(s.groundSource!==S.srcKey){
        const sample=document.createElement('canvas');sample.width=sample.height=20;
        const sg=sample.getContext('2d',{willReadFrequently:true});sg.drawImage(photo,0,0,20,20);
        const pixels=sg.getImageData(0,0,20,20).data,bins=Array.from({length:24},()=>({w:0,x:0,y:0,s:0}));
        // Find a representative chromatic family; averaging all RGB washes it gray.
        for(let i=0;i<pixels.length;i+=4){
          const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;
          if(d<.06||l<.08||l>.94)continue;
          const sat=d/(1-Math.abs(2*l-1)),h=((hi===r?(g-b)/d:hi===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;
          const px=(i/4)%20,py=Math.floor(i/80),center=1+3*Math.exp(-((px-10)**2+(py-11)**2)/35);
          const w=sat*sat*(.4+Math.sin(l*Math.PI))*center,bin=bins[Math.floor(h/15)];
          bin.w+=w;bin.x+=Math.cos(h*Math.PI/180)*w;bin.y+=Math.sin(h*Math.PI/180)*w;bin.s+=sat*w;
        }
        const families=bins.map((bin,i)=>[bins[(i+23)%24],bin,bins[(i+1)%24]].reduce((a,b)=>({w:a.w+b.w,x:a.x+b.x,y:a.y+b.y,s:a.s+b.s}),{w:0,x:0,y:0,s:0}));
        const best=families.reduce((a,b)=>a.w>b.w?a:b);
        s.paperHue=best.w?(Math.atan2(best.y,best.x)*180/Math.PI+360)%360:35;
        s.paperSat=best.w?clamp(best.s/best.w*65,24,62):8;
        s.groundSource=S.srcKey;
      }
      const bg=p.ground==='自选颜色'?p.col:`hsl(${s.paperHue} ${s.paperSat}% ${p.tone==='浅色'?76:27}%)`;
      if(!s.weaveImage){s.weaveImage=new Image();s.weaveImage.src='src/textures/punch-weave-reference.png';}
      if(!s.weave&&s.weaveImage.complete&&s.weaveImage.naturalWidth){
        s.weave=document.createElement('canvas');s.weave.width=s.weave.height=120;
        const wg=s.weave.getContext('2d',{willReadFrequently:true});
        // Real textile from the reference's empty top-left region, no silhouettes/text.
        wg.drawImage(s.weaveImage,24,24,240,240,0,0,120,120);
        const data=wg.getImageData(0,0,120,120);
        for(let i=0;i<data.data.length;i+=4){const v=data.data[i]*.2126+data.data[i+1]*.7152+data.data[i+2]*.0722;data.data[i]=data.data[i+1]=data.data[i+2]=v>90?255:0;data.data[i+3]=Math.min(38,Math.abs(v-90)*.65);}
        wg.putImageData(data,0,0);
      }
      if(!s.paper){s.paper=document.createElement('canvas');s.paper.width=W;s.paper.height=half;}
      const pg=s.paper.getContext('2d');pg.fillStyle=bg;pg.fillRect(0,0,W,half);
      if(p.paper==='细织纹'&&s.weave){pg.fillStyle=pg.createPattern(s.weave,'repeat');pg.fillRect(0,0,W,half);}
      ctx.drawImage(s.paper,0,0);ctx.drawImage(photo,0,half);
      if(!s.tile){s.tile=document.createElement('canvas');s.tile.width=s.tile.height=384;}
      const g=s.tile.getContext('2d'),n=p.count;
      if(s.points?.length!==n||s.pointSource!==S.srcKey){
        s.pointSource=S.srcKey;s.points=[];
        // Generate once per photo/count change, never once per animation frame.
        for(let i=0;i<n;i++){
          let best=null,bestDistance=-1;
          for(let k=0;k<80;k++){
            const q={x:W*(.10+.80*Math.random()),y:half*(.12+.76*Math.random())};
            const distance=s.points.reduce((d,a)=>Math.min(d,Math.hypot(a.x-q.x,a.y-q.y)),Infinity);
            if(distance>bestDistance){best=q;bestDistance=distance;}
          }
          s.points.push({...best,seed:Math.random()});
        }
      }
      // Pick a stable random subset only on a real accent edge, never every frame.
      const accent=Math.max(f.kick||0,f.snare||0,f.drop||0);
      if(S.playing&&accent>.58&&(s.previousAccent||0)<=.58&&s.clock-(s.accentBorn??-99)>.22){
        s.accentBorn=s.clock;
        const pool=Array.from({length:n},(_,i)=>i),selected=new Set();
        const count=Math.min(n,2+Math.floor(Math.random()*3));
        for(let k=0;k<count;k++){const j=Math.floor(Math.random()*pool.length);selected.add(pool.splice(j,1)[0]);}
        for(let i=0;i<n;i++)s.points[i].accent=selected.has(i)?accent:0;
      }
      if(S.playing)s.previousAccent=accent;
      const accentEnvelope=Math.exp(-Math.max(0,s.clock-(s.accentBorn??-99))*6);
      // Stable, spaced positions: one cutout has exactly one matching paper piece.
      s.layout??=0;const target=Math.floor(s.step/4);
      if(S.playing)s.layout+=(target-s.layout)*.035;
      for(let i=0;i<n;i++){
        const seed=s.points[i].seed,angle=(seed-.5)*.3;
        const {x,y}=s.points[i];
        const active=i%4===s.step%4,beat=e.pulse*p.pulse*(active?1:.2);
        const boost=(s.points[i].accent||0)*accentEnvelope*(p.accent??1)*p.pulse;
        const size=p.size*(.88+seed*.24)*(1+beat*.15+boost*1.5);
        const drift=Math.sin(s.layout*.9+i*2.4)*12*p.pulse;
        const tx=x+drift,ty=y-beat*9;
        g.clearRect(0,0,384,384);g.save();g.translate(192,192);g.rotate(angle);g.font=`600 ${size}px Georgia, "PingFang SC", serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';g.fillText(glyph,0,0);g.restore();
        g.globalCompositeOperation='source-in';g.drawImage(photo,192-tx,192-ty);g.globalCompositeOperation='source-over';
        ctx.save();ctx.shadowColor='#18202b22';ctx.shadowBlur=1;ctx.shadowOffsetY=.6;ctx.drawImage(s.tile,tx-192,ty-192);ctx.restore();
        g.clearRect(0,0,384,384);g.save();g.translate(192,192);g.rotate(angle);g.font=`600 ${size}px Georgia, "PingFang SC", serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';g.fillText(glyph,0,0);g.restore();
        g.globalCompositeOperation='source-in';g.drawImage(s.paper,192-tx,192-ty);g.globalCompositeOperation='source-over';
        ctx.drawImage(s.tile,tx-192,half+ty-192);
      }
    } },

}).punchSymbols;}
