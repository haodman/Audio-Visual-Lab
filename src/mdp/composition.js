/* Cached whole-photo word palette. Clock placement never uses subjects or masks. */
window.MDPComposition=(()=>{
  let env,cache=null;
  function init(e){env=e;}
  function invalidate(){cache=null;}
  function prepare(){
    if(!env?.S.media)return null;
    if(cache?.key===env.S.srcKey)return cache;
    const w=108,h=192,c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(env.src,0,0,w,h);
    const pixels=g.getImageData(0,0,w,h).data,samples=[];
    for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const i=(y*w+x)*4;samples.push([pixels[i],pixels[i+1],pixels[i+2]]);}
    cache={key:env.S.srcKey,palette:MDPRules.adaptivePalette(samples)};return cache;
  }
  return {init,invalidate,prepare,palette:c=>c.palette};
})();
