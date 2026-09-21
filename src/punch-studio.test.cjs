const assert=require('node:assert/strict');
// Resolve canvas from the caller's dependency environment (no platform paths in repository tests).
const {createCanvas}=require('@napi-rs/canvas'),P=require('./punch-studio.js');
const beats=[.15,.68,1.18,1.73,2.24,2.77,3.29,3.80,4.33,4.84,5.38,5.9,6.43,6.94,7.49,8.0,8.53,9.06,9.57,10.1,10.64,11.15,11.67,12.2,12.74,13.25,13.77,14.3];
const photo=createCanvas(900,650),g=photo.getContext('2d');g.fillStyle='#246fbe';g.fillRect(0,0,900,650);g.fillStyle='#e9bfa5';g.fillRect(300,120,250,320);
const tests=[];function check(name,fn){fn();tests.push(name);}
check('照片花朵密集时不再选小花',()=>assert.equal(P.choose({scene:{scores:{flowers:.9},repeated:['flowers']},title:'happy spring flower'}).shape,'butterfly'));
check('森林排除树形，单棵树可用树形',()=>{assert.equal(P.choose({scene:{scores:{forest:.9,tree:.8},repeated:['forest']}}).shape,'butterfly');assert.equal(P.choose({scene:{scores:{tree:.9}}}).shape,'tree');});
check('羊群用通用几何，湖海可用水滴',()=>{assert.equal(P.choose({scene:{scores:{sheep:.9},repeated:['sheep']}}).shape,'hexstar');assert.equal(P.choose({scene:{scores:{water:.9}}}).shape,'tear');});
check('开场每次打孔和贴片均使用真实拍点',()=>{const s=P.schedule(beats,{text:'hello'});for(const x of [...s.punch,...s.paste])assert.ok(beats.includes(x));assert.ok(s.paste[0]>s.punchEnd);assert.ok(s.motionStart>s.pasteEnd);assert.equal(s.fallback,false);});
check('截取片段保留原拍点相位',()=>{const s=P.schedule(beats,{offset:1,text:'hello'});for(const x of [...s.punch,...s.paste])assert.ok(beats.some(b=>Math.abs(b-1-x)<1e-9));});
check('空文字跳过文字阶段；静音明确降级',()=>{assert.ok(P.schedule(beats,{text:'hi'}).motionStart-P.schedule(beats,{text:''}).motionStart>1.4);assert.ok(P.schedule([]).fallback);});
check('上下关系、异位布局、全部形状质感与确定性渲染',()=>{for(const shape of Object.keys(P.names))for(const texture of Object.keys(P.materials)){const c=createCanvas(270,480),r=P.makeRenderer(c.getContext('2d'),photo,createCanvas,{shape,texture,beats,text:'Hello 世界'});assert.equal(r.photoTop,['tear','leaf','petal'].includes(shape));assert.ok(r.pieces.every(a=>Math.hypot(a.sx-a.tx,a.sy-(a.ty%(960)))>10));r.render(10.3);const a=Buffer.from(c.data());r.render(1);r.render(10.3);assert.ok(a.equals(Buffer.from(c.data())));}});
check('9:16 输入不拉伸且没有透明空白',()=>{const c=createCanvas(270,480),r=P.makeRenderer(c.getContext('2d'),photo,createCanvas,{shape:'leaf',beats});r.render(0);const d=c.data();for(let i=3;i<d.length;i+=4)assert.equal(d[i],255);});
check('贴片保留孔位原始照片像素而非单色替代',()=>{const c=createCanvas(1080,1920),r=P.makeRenderer(c.getContext('2d'),photo,createCanvas,{shape:'square',beats});const chip=r.pieces.find(p=>{const d=p.chip.getContext('2d').getImageData(p.size/2,p.size/2,1,1).data;return d[0]>100;});assert.ok(chip);assert.ok(chip.chip.getContext('2d').getImageData(chip.size/2,chip.size/2,1,1).data[3]>240);});

check('All crop modes cover every edge without padding or distortion',()=>{
 for(const [iw,ih]of [[1000,2400],[2400,700],[1200,1000]])for(const fit of ['auto','cover','contain']){const p=P.photoLayout(iw,ih,1080,960,{fit});assert.equal(p.mode,'cover');assert.ok(p.dx<=0&&p.dy<=0&&p.dx+p.dw>=1080-1e-8&&p.dy+p.dh>=960-1e-8);assert.ok(Math.abs(p.dw/iw-p.dh/ih)<1e-8);}
 const faces=[{x:.35,y:.1,w:.2,h:.15}],p=P.photoLayout(1000,2400,1080,960,{faces});const y=p.dy+.175*p.dh;assert.ok(Math.abs(y-960*.34)<1e-6);
 const left=P.photoLayout(2000,1000,1080,960,{fit:'cover',focusX:0}),right=P.photoLayout(2000,1000,1080,960,{fit:'cover',focusX:1});assert.ok(Math.abs(left.dx)<1e-9);assert.equal(right.dx,1080-right.dw);
});
check('Bird and butterfly formations change relative distances while retaining their center',()=>{
 for(const shape of ['bird','butterfly']){const f=P.makeFormations(shape,22,{x:90,y:75,w:900,h:695});assert.equal(f.length,5);if(shape==='butterfly')assert.ok(f.every(v=>!v.name.toLowerCase().includes('chevron')));
 const center=f.map(v=>v.points.reduce((a,p)=>({x:a.x+p.x/22,y:a.y+p.y/22}),{x:0,y:0}));assert.ok(center.every(c=>Math.hypot(c.x-center[0].x,c.y-center[0].y)<1e-6));
 for(let k=1;k<f.length;k++){let changed=0;for(let i=0;i<21;i++)for(let j=i+1;j<22;j++){const distance=v=>Math.hypot(v.points[i].x-v.points[j].x,v.points[i].y-v.points[j].y);if(Math.abs(distance(f[k])-distance(f[0]))>30)changed++;}assert.ok(changed>50,'Formation must change many pairwise distances');}
 }
});
check('Caption band remains by the central seam in both orientations',()=>{
 for(const shape of Object.keys(P.names)){const c=createCanvas(270,480),r=P.makeRenderer(c.getContext('2d'),photo,createCanvas,{shape,beats,text:'Near the seam'});const b=r.captionBounds,center=b.y+b.h/2;assert.equal(Math.abs(center-960),82);assert.ok(r.photoTop?b.y+b.h<r.contentBounds.y:b.y>r.contentBounds.y+r.contentBounds.h);}
});
check('All twelve automatic shapes are reachable with distinct supported cues',()=>{
 const cases=[['bird',{sky:1},''],['butterfly',{flowers:1},''],['tear',{water:1},''],['tree',{tree:1},''],['leaf',{},'autumn'],['petal',{},'spring'],['star',{},'wish'],['moon',{},'moon'],['square',{},'youth'],['flower',{},'playful'],['hexstar',{sheep:1},''],['spark',{},'']];for(const[id,scores,mood]of cases)assert.equal(P.choose({scene:{scores},mood}).shape,id);
});
check('Every second beat starts a continuous formation transition',()=>{
 for(const shape of ['bird','butterfly']){const c=createCanvas(270,480),r=P.makeRenderer(c.getContext('2d'),photo,createCanvas,{shape,beats,text:'Hello'}),b=r.plan.beats.filter(x=>x>=r.plan.motionStart),a=r.pieces[0];
 for(let k=0;k<Math.min(4,b.length);k+=2){const before=r.pose(a,b[k]-1e-5),after=r.pose(a,b[k]+1e-5);assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<.01);}
 const middle=r.pose(a,b[0]+(b[2]-b[0])*.4),target=r.formations[1].points[0];assert.ok(Math.hypot(middle.x-target.x,middle.y-target.y)>1);const hold=r.pose(a,b[2]-.01);assert.ok(Math.hypot(hold.x-target.x,hold.y-target.y)<1e-6);
 }
});
check('Rain, petals and leaves fall from the upper photo across the seam',()=>{
 for(const shape of ['tear','petal','leaf']){const c=createCanvas(270,480),r=P.makeRenderer(c.getContext('2d'),photo,createCanvas,{shape,beats,text:'Gravity'}),a=r.pieces[0];const samples=[];for(let t=r.plan.motionStart;t<15;t+=.01){const q=r.fallingPose(a,t);if(q.kind==='fall'&&q.alpha>.05)samples.push(q);}
 assert.ok(samples.some(q=>q.y<950),shape+' starts in photograph');assert.ok(samples.some(q=>q.y>1000),shape+' reaches paper');
 if(shape==='tear'){const hits=[];for(let t=r.plan.motionStart;t<15;t+=.01){const q=r.fallingPose(a,t);if(q.kind==='impact')hits.push(q.event);}assert.ok(hits.length&&hits.every(t=>beats.includes(t)));assert.ok(samples.every(q=>Math.abs(q.x-a.sx)<1e-8));}
 }
});
check('All later gestures share the same alternating-beat clock, including rain impacts and natural fall launches',()=>{
 for(const shape of Object.keys(P.names)){
  const r=P.makeRenderer(createCanvas(270,480).getContext('2d'),photo,createCanvas,{shape,beats,text:'Slow motion'}),all=r.plan.beats.filter(t=>t>=r.plan.motionStart),cues=r.plan.motionCues;
  assert.deepEqual(cues,all.filter((_,i)=>i%2===0));
  if(['tear','leaf','petal'].includes(shape)){
   const events=new Set();for(let t=r.plan.motionStart;t<15;t+=.013)for(const a of r.pieces){const q=r.fallingPose(a,t);if(q.event!==undefined)events.add(q.event);}
   assert.ok(events.size>0);assert.ok([...events].every(t=>cues.includes(t)));
  }else for(const t of all.filter((_,i)=>i%2===1))for(const a of r.pieces){const before=r.pose(a,t-1e-6),after=r.pose(a,t+1e-6);assert.ok(Math.abs(before.alpha-after.alpha)<1e-4);assert.ok(Math.abs(before.sy-after.sy)<1e-4);}
 }
});
check('Color styling selects leaves and petals without requiring a tree or flower',()=>{
 for(const [color,shape]of [['#62412b','leaf'],['#e4a3be','petal']]){const c=createCanvas(200,200),g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,200,200);const scene=P.semantic({},'',P.photoCues(c,createCanvas));assert.equal(P.choose({scene,title:'Reality'}).shape,shape);}
 const c=createCanvas(200,200),g=c.getContext('2d');g.fillStyle='#929cbb';g.fillRect(0,0,200,200);g.fillStyle='#e4a3be';g.fillRect(94,95,5,5);assert.equal(P.photoCues(c,createCanvas).pink,0,'A tiny pink accent is insufficient');
 assert.notEqual(P.choose({scene:{scores:{pink:1,flowers:1},repeated:['flowers']}}).shape,'petal');
 assert.notEqual(P.choose({scene:{scores:{maillard:1,leaf:1},repeated:['leaf']}}).shape,'leaf');
});
check('Existing wardrobe photos run automatic color rules; rejected images are absent',()=>{
 const rows=require('./models/mdp-pack/manifest.json'),eagle=require('./models/eagle-pack/manifest.json'),examples=require('./models/mdp-pack/examples.json');
 for(const [name,shape]of [['窗边咖啡','leaf'],['粉衣咖啡侧坐','petal'],['粉衣咖啡正坐','petal'],['海边粉衣双人','petal']]){const row=eagle.find(d=>d.name===name);for(const title of ['Reality','Touch','unhappy'])assert.equal(P.choose({scene:row.scene,title}).shape,shape);}
 for(const id of ['leaves','petals','pink-cafe','pink-coast']){const d=examples.find(e=>e.id===id);assert.equal(d.shape,'auto');assert.equal(d.mood,'');}
 assert.ok(!rows.some(d=>['photo-9b972e003862d6','photo-8fe901c444dc72','autumn-cafe','autumn-bench','spring-vase','spring-canal'].includes(d.id)));
});
console.log(JSON.stringify({passed:tests.length,revision:4},null,2));
