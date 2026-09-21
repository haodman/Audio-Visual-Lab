/* Scene classification is lazy and local to the browser/device; no photograph is uploaded to a public inference service. */
window.PunchScene=(()=>{
 let classifier=null;
 const labels=['a sky with clouds','an ocean or lake with water','a forest with many trees','a single tree','a garden full of flowers','a night sky with stars and moon','a flock of sheep','many birds','many butterflies','many leaves','snow','a city street','a portrait of a person','an indoor room','abstract objects','an autumn scene with golden trees','a sparse cherry blossom branch in spring'];
 async function classify(canvas,{browserOnly=false}={}){
  const colorCues=PunchStudio.photoCues(canvas,(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}));
  if(!browserOnly&&['127.0.0.1','localhost'].includes(location.hostname)){
   const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const response=await fetch('/api/vision',{method:'POST',body:blob});if(response.ok)return {...await response.json(),colorCues};
  }
  if(!classifier){const{pipeline}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm');classifier=await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{dtype:'q8',device:'wasm'});}
  const regions=[];
  for(let i=0;i<10;i++){const c=document.createElement('canvas');c.width=c.height=224;const g=c.getContext('2d'),w=canvas.width,h=canvas.height;if(i===0)g.drawImage(canvas,0,0,224,224);else{const x=(i-1)%3,y=Math.floor((i-1)/3);g.drawImage(canvas,x*w/3,y*h/3,w/3,h/3,0,0,224,224);}regions.push({index:i,labels:await classifier(c.toDataURL(),labels)});}
  return {engine:'CLIP ViT-B/32 · browser',regions,colorCues};
 }
 return{classify};
})();
