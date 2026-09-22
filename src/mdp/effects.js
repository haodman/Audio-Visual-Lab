/* One dynamic clock on the shared canvas and audio transport. */
function createDynamicClockEffects({S,src,ctx,W,H,R,C,Sel,T}) {
  const layer=document.createElement('canvas');layer.width=W;layer.height=H;
  const g=layer.getContext('2d'),sketch={width:W,height:H,drawingContext:g,clear(){g.clearRect(0,0,W,H);}};
  MDPComposition.init({S,src,W,H});
  let lyricSource=null,lyricCues=[];
  const rule=MDPRules.rules[0];
  return {mdpClock:{
    name:'动态时钟',icon:'◷',desc:'多向拉伸 · 文字随波形流动',
    hint:`${rule.trigger}\n${rule.detail}\n${rule.motion}`,state:{},
    params:[Sel('copy','Text source',['自定义文字','自动歌词'],'自定义文字'),T('text','Your words','Keep a little wonder with you'),
      Sel('textStyle','Word colors',['Soft colors','Photo accents','White','Manual'],'Soft colors'),C('textInk','Manual word color','#ffe28a'),
      Sel('wordPace','Beats per word',['1','2','4'],'1'),R('outlineDepth','拉伸幅度',0,1.5,1),R('intensity','Word emphasis',0,1.5,.75),R('stroke','White line weight',.8,2,1.15)],
    draw(f,p){
      ctx.drawImage(src,0,0);
      const t=f.t||0,a=S.analysis?.mdp,composition=MDPComposition.prepare();if(!composition)return;
      const pal=MDPComposition.palette(composition),words=String(p.text||'').trim().split(/[\s/]+/u).filter(Boolean);
      if(lyricSource!==S.lyrics){lyricSource=S.lyrics;lyricCues=S.lyrics.map((l,i)=>({time:l.t,end:S.lyrics[i+1]?.t??l.t+4,text:l.text}));}
      const config={stroke:p.stroke,intensity:p.intensity,outlineDepth:p.outlineDepth,contour:MDPRules.contourAt(a,t),
        words,textMode:p.copy==='自动歌词'?'auto':'words',rhythmAt:time=>MDPRules.clockAt(a,time,S.analysis),
        beatTimes:MDPRules.clockAnalysis(a,S.analysis)?.beats||[],beatsPerWord:Number(p.wordPace)||1,
        textStyle:p.textStyle||'Soft colors',textInk:p.textInk,palette:pal.palette,color:'#ffffff',halo:'rgba(7,14,24,.64)'};
      const state=LyricClock.render(sketch,t,config,p.copy==='自动歌词'?lyricCues:[]);
      MDPClockUI.state.clockState=state;
      MDPClockUI.state.appearance={color:'#ffffff',palette:LyricClock.textColors(config),mode:'White clock with soft shadow; '+config.textStyle.toLowerCase()+' words'};
      ctx.drawImage(layer,0,0);
    }
  }};
}
