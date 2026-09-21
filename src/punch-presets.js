/* Photo-based examples share the existing page, music player and parameter drawer. */
const PUNCH_EXAMPLES=/*__PUNCH_EXAMPLES__*/[];
let punchExampleRequest=0,punchLocalCatalog=null;
function localPunchAudio(){
 if(!['127.0.0.1','localhost'].includes(location.hostname))return Promise.resolve(false);
 return punchLocalCatalog??=fetch('/api/demos').then(r=>r.ok?r.json():null).then(d=>Array.isArray(d)&&d.some(x=>x.id==='reality')).catch(()=>false);
}
async function loadPunchExample(value){
 const d=PUNCH_EXAMPLES.find(x=>x.id===value||x.label===value);if(!d)return;
 const token=++punchExampleRequest;
 try{
  const im=new Image();im.src=d.src;await im.decode();if(token!==punchExampleRequest)return;
  if(S.fx!=='punchSymbols')selectFx('punchSymbols');
  const p=S.params.punchSymbols;Object.assign(p,{example:d.label,shape:PunchStudio.names[d.shape]||'自动搭配',paper:'自动搭配',tone:'自动',copy:'自定义文字',text:d.text,mood:d.mood,crop:'自动取景',focusX:.5,focusY:.5,zoom:1});
  S.photoIdx=PRESETS.findIndex(x=>x.src===d.src);setImage(im);renderGallery();applyFilter();buildParams();
  if(await localPunchAudio()){
   const tr=d.song==='unhappy'?PACK_TRACKS.find(x=>x.id==='netease-s0rrow-unhappy'):{id:'local-punch-'+d.song,name:d.title,genre:'Local preview',kind:'remote',url:'/api/demo/'+d.song+'/audio'};
   await loadTrack(tr);
  }else if(!S.buffer){await loadTrack(PACK_TRACKS.find(x=>x.id==='netease-s0rrow-unhappy')||PACK_TRACKS[0]);}
  if(token!==punchExampleRequest)return;
  pause();S.pausedAt=0;FX.punchSymbols.state.origin=0;FX.punchSymbols.state.key=null;
  $('#status').textContent=d.mode+' · '+d.label;closeSheet();
 }catch(e){console.warn('Punch example could not load',e);toast('示例暂时无法加载，请选择素材或上传照片');}
}
