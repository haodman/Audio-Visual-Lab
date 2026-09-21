(function(root,factory){if(typeof module==='object')module.exports=factory();else root.PunchShapes=factory();})(globalThis,function(){const TAU=Math.PI*2;
/* Cutter outlines adapted from the user’s MDP textile-core.js, 2026-09-18. */
function motif(c,type,r){c.beginPath();
 if(type==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,k=i%2?.43:1;const x=Math.cos(a)*r*k,y=Math.sin(a)*r*k;i?c.lineTo(x,y):c.moveTo(x,y);}}
 else if(type==='spark'){c.moveTo(0,-r);c.bezierCurveTo(r*.2,-r*.25,r*.3,-r*.16,r,0);c.bezierCurveTo(r*.27,r*.2,r*.17,r*.32,0,r);c.bezierCurveTo(-r*.19,r*.3,-r*.32,r*.14,-r,0);c.bezierCurveTo(-r*.3,-r*.19,-r*.18,-r*.31,0,-r);}
 else if(type==='circle'){c.arc(0,0,r,0,TAU);}
 else if(type==='flower'){for(let k=0;k<5;k++){const a=-Math.PI/2+k*TAU/5,x=Math.cos(a)*r*.56,y=Math.sin(a)*r*.56;c.moveTo(x+r*.44,y);c.arc(x,y,r*.44,0,TAU);}c.moveTo(r*.5,0);c.arc(0,0,r*.5,0,TAU);}
 else if(type==='tear'){c.moveTo(0,-r*1.15);c.bezierCurveTo(r*.22,-r*.43,r*.94,r*.15,r*.68,r*.64);c.bezierCurveTo(r*.35,r*1.18,-r*.57,r*1.02,-r*.7,r*.44);c.bezierCurveTo(-r*.8,r*.05,-r*.15,-r*.5,0,-r*1.15);}
 else if(type==='moon'){c.moveTo(r*.42,-r*.91);c.bezierCurveTo(-r*1.2,-r*.98,-r*1.2,r*.98,r*.42,r*.91);c.bezierCurveTo(-r*.4,r*.48,-r*.4,-r*.48,r*.42,-r*.91);}
 else if(type==='puzzle'){c.moveTo(-r*.7,-r*.7);c.lineTo(-r*.17,-r*.7);c.bezierCurveTo(-r*.45,-r*1.19,r*.45,-r*1.19,r*.17,-r*.7);c.lineTo(r*.7,-r*.7);c.lineTo(r*.7,-r*.17);c.bezierCurveTo(r*.17,-r*.43,r*.17,r*.43,r*.7,r*.17);c.lineTo(r*.7,r*.7);c.lineTo(r*.17,r*.7);c.bezierCurveTo(r*.45,r*1.19,-r*.45,r*1.19,-r*.17,r*.7);c.lineTo(-r*.7,r*.7);c.lineTo(-r*.7,r*.17);c.bezierCurveTo(-r*.17,r*.43,-r*.17,-r*.43,-r*.7,-r*.17);}
 else if(type==='bird'){
  c.moveTo(r*.83,-r*.10);c.lineTo(r*1.02,-r*.03);c.lineTo(r*.81,r*.04);
  c.bezierCurveTo(r*.72,r*.17,r*.45,r*.18,r*.22,r*.10);
  c.bezierCurveTo(r*.12,r*.55,-r*.27,r*.83,-r*.59,r*.84);
  c.bezierCurveTo(-r*.34,r*.5,-r*.20,r*.20,-r*.15,r*.06);
  c.lineTo(-r*.98,r*.38);c.lineTo(-r*.61,-r*.03);c.lineTo(-r*.98,-r*.42);c.lineTo(-r*.17,-r*.16);
  c.bezierCurveTo(-r*.23,-r*.39,-r*.39,-r*.63,-r*.59,-r*.86);
  c.bezierCurveTo(-r*.2,-r*.79,r*.13,-r*.48,r*.3,-r*.18);
  c.bezierCurveTo(r*.55,-r*.24,r*.68,-r*.27,r*.83,-r*.10);
 }
 else if(type==='butterfly'){
  c.moveTo(0,-r*.15);c.bezierCurveTo(-r*.42,-r*.84,-r*1.2,-r*.85,-r*.97,-r*.19);c.bezierCurveTo(-r*.85,r*.03,-r*.67,r*.16,-r*.46,r*.22);c.bezierCurveTo(-r*.92,r*.68,-r*.22,r*.95,-r*.08,r*.31);c.lineTo(0,r*.49);c.lineTo(r*.08,r*.31);c.bezierCurveTo(r*.22,r*.95,r*.92,r*.68,r*.46,r*.22);c.bezierCurveTo(r*.67,r*.16,r*.85,r*.03,r*.97,-r*.19);c.bezierCurveTo(r*1.2,-r*.85,r*.42,-r*.84,0,-r*.15);
 }else c.rect(-r,-r,r*2,r*2);c.closePath();}

return {motif};});
