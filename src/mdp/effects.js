/* Two photo-aware MDP stickers on the existing canvas/audio transport. */
function createMDPStickerEffects({S,src,ctx,W,H,R,C,Sel,T}) {
  const layer=document.createElement('canvas');layer.width=W;layer.height=H;
  const composite=document.createElement('canvas');composite.width=W;composite.height=H;
  const g=layer.getContext('2d'),cg=composite.getContext('2d'),sketch={width:W,height:H,drawingContext:g,clear(){g.clearRect(0,0,W,H);}};
  MDPComposition.init({S,src,W,H});
  let lyricSource=null,lyricCues=[];
  const names={sunshine:'Rotating sunshine',clock:'Rotating text clock'};
  const copy=[Sel('copy','Text source',['自定义文字','自动歌词'],'自定义文字'),T('text','Your words','Keep a little wonder with you')];
  const common=[Sel('colorMode','Color',['Image adaptive','Manual'],'Image adaptive'),R('scale','Size',.45,1.5,.85),R('x','Horizontal offset',-.4,.4,0),R('y','Vertical offset',-.35,.35,0),R('intensity','Motion depth',0,1.5,.75),R('stroke','Line weight',.8,2.8,1.75),C('col','Manual ink','#fff5d6')];
  function render(type,f,p){
    ctx.drawImage(src,0,0);const t=f.t||0,a=S.analysis?.mdp,q=type==='clock'?MDPRules.clockAt(a,t,S.analysis):MDPRules.gentleAt(a,t),result=window.MDPMatch?.state;
    const composition=MDPComposition.prepare(result?.detections),match=result?.matches?.find(m=>m.id===type);if(!composition)return;
    const placement=type==='clock'?{x:.5,y:.5,scale:1,box:{xmin:0,ymin:0,xmax:1,ymax:1}}:null;
    const anchor=match?.anchor||{x:.5,y:.32};
    const tokens=String(p.text||'').trim().split(/[\s/]+/u).filter(Boolean),words=type==='clock'?tokens:tokens.slice(0,16);
    if(lyricSource!==S.lyrics){lyricSource=S.lyrics;lyricCues=S.lyrics.map((l,i)=>({time:l.t,end:S.lyrics[i+1]?.t??l.t+4,text:l.text}));}
    const cues=p.copy==='自动歌词'?lyricCues:[];
    const items=type==='sunshine'&&match?.object==='candle'?result.matches.filter(m=>m.id==='sunshine'&&m.object==='candle').slice(0,4):[match];
    cg.clearRect(0,0,W,H);
    for(const item of items){
      const xy=item?.anchor||anchor;const config={x:type==='clock'?.5:Math.max(.02,Math.min(.98,xy.x+p.x)),y:type==='clock'?.5:Math.max(.02,Math.min(.98,xy.y+p.y)),scale:placement?.scale??p.scale,stroke:p.stroke,intensity:p.intensity,speed:.75,words,textMode:p.copy==='自动歌词'?'auto':'words',center:'none',rhythm:q,rhythmAt:time=>MDPRules.clockAt(a,time,S.analysis),beatTimes:MDPRules.clockAnalysis(a,S.analysis)?.beats||[],beatsPerWord:Number(p.wordPace)||1,textStyle:p.textStyle||'Soft colors',textInk:p.textInk,type,candle:item?.object==='candle'};
      if(type==='sunshine'&&item?.box){const bw=(item.box.xmax-item.box.xmin)*W,bh=(item.box.ymax-item.box.ymin)*H;config.radius=config.candle?110:Math.max(110,Math.min(230,Math.max(bw,bh)*.72/(W/900)));}
      const radius=((config.radius||162)+70)*W/900*config.scale,box=type==='sunshine'?{xmin:config.x-radius/W,ymin:config.y-radius/H,xmax:config.x+radius/W,ymax:config.y+radius/H}:placement.box;
      const pal=MDPComposition.palette(composition,box);Object.assign(config,p.colorMode==='Manual'?{color:p.col,accent:p.col,palette:[p.col],halo:pal.halo}:pal);
      if(result){result.layoutNote=type==='sunshine'?'Centered on the detected object; every spoke is filled.':'Full-frame white clock; the hand points to the highlighted word.';result.appearance={...pal,type,box,placement};}
      if(type==='clock'){config.color='#ffffff';config.halo='rgba(7,14,24,.64)';const clockState=LyricClock.render(sketch,t,config,cues);if(result){result.clockState=clockState;result.appearance={...result.appearance,color:'#ffffff',palette:LyricClock.textColors(config),mode:'White clock with soft shadow; '+config.textStyle.toLowerCase()+' words',placement};}}
      else LightStickers.render(sketch,t,config,a||{hz:100,values:[0],beats:[]},cues);
      cg.drawImage(layer,0,0);
    }
    ctx.drawImage(composite,0,0);
  }
  const out={};for(const [id,type] of [['mdpSunshine','sunshine'],['mdpClock','clock']]){const rule=MDPRules.rules.find(r=>r.id===type);out[id]={name:names[type],icon:type==='clock'?'◷':type==='sunshine'?'☼':'☂',desc:rule.motion,hint:`${rule.trigger}\n${rule.detail}\n${rule.motion}`,state:{},params:[...copy,...(type==='clock'?[Sel('textStyle','Word colors',['Soft colors','Photo accents','White','Manual'],'Soft colors'),C('textInk','Manual word color','#ffe28a'),Sel('wordPace','Beats per word',['1','2','4'],'1'),R('intensity','Word emphasis',0,1.5,.75),R('stroke','White line weight',.8,2,1.15)]:common)],draw(f,p){render(type,f,p);}};}return out;
}
