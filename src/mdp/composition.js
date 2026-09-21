/* Photo-stable layout, contrast and shared subject exclusion. */
window.MDPComposition=(()=>{
  let env,cache=null;
  function init(e){env=e;}
  function invalidate(){cache=null;}
  function prepare(detections=[]){
    if(!env?.S.media)return null;
    const {S,src,W,H}=env,hq=S.cache.subjHQ?S.cache.subj:null;
    if(cache?.key===S.srcKey&&cache.hq===hq&&cache.detections===detections)return cache;
    const w=108,h=192,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(src,0,0,w,h);const pixels=g.getImageData(0,0,w,h).data;
    const people=detections.filter(d=>d.label==='a person'&&d.score>=.055).map(d=>d.box),mask=new Uint8Array(w*h);
    if(hq){g.clearRect(0,0,w,h);g.drawImage(hq,0,0,w,h);const data=g.getImageData(0,0,w,h).data;for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>38?1:0;}
    else for(let y=0;y<h;y++)for(let x=0;x<w;x++)mask[y*w+x]=people.some(b=>x/w>=b.xmin&&x/w<=b.xmax&&y/h>=b.ymin&&y/h<=b.ymax)?1:0;
    // A 15px safety margin also protects hair and hat boundaries from fine lines.
    const expanded=new Uint8Array(mask.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x])for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)expanded[(y+dy)*w+x+dx]=1;
    const cut=document.createElement('canvas');cut.width=w;cut.height=h;const cg=cut.getContext('2d'),image=cg.createImageData(w,h);for(let i=0;i<expanded.length;i++)image.data[i*4+3]=expanded[i]?255:0;cg.putImageData(image,0,0);
    let sx=0,n=0,top=h;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(expanded[y*w+x]){sx+=x;n++;top=Math.min(top,y);}
    cache={key:S.srcKey,hq,detections,w,h,pixels,mask:expanded,cut,hasPerson:!!n,personX:n?sx/n/w:.5,top:top/h,ready:!!hq||window.MDPMatch?.state.photoKey===S.srcKey&&!window.MDPMatch?.state.photoBusy,palettes:new Map()};return cache;
  }
  function occupied(c,b){let count=0,total=0;for(let y=Math.max(0,Math.floor(b.ymin*c.h));y<Math.min(c.h,Math.ceil(b.ymax*c.h));y++)for(let x=Math.max(0,Math.floor(b.xmin*c.w));x<Math.min(c.w,Math.ceil(b.xmax*c.w));x++){count+=c.mask[y*c.w+x];total++;}return total?count/total:1;}
  function palette(c,box){const key=JSON.stringify(box);if(c.palettes.has(key))return c.palettes.get(key);const samples=[];for(let y=Math.max(0,Math.floor(box.ymin*c.h));y<Math.min(c.h,Math.ceil(box.ymax*c.h));y+=2)for(let x=Math.max(0,Math.floor(box.xmin*c.w));x<Math.min(c.w,Math.ceil(box.xmax*c.w));x+=2){const i=(y*c.w+x)*4;samples.push(Array.from(c.pixels.slice(i,i+3)));}const result=MDPRules.adaptivePalette(samples);c.palettes.set(key,result);return result;}
  return{init,invalidate,prepare,palette,occupied};
})();
