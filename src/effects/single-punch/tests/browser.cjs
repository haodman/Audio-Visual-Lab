// Browser regression for square-only punch, palette provenance and beat states.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.PUNCH_OUTPUT||'work/square-punch-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[],failed=[],report={checks:[]};
 const base=process.env.PUNCH_URL||'http://127.0.0.1:8891/music-fx-lab.html';
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes('Effect render failed'))errors.push(m.text());});
 page.on('response',r=>{if(r.url().startsWith(new URL(base).origin)&&r.status()>=400)failed.push([r.url(),r.status()]);});
 const check=s=>{report.checks.push(s);console.log('PASS',s);};
 const capture=async name=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await page.locator('#cv').evaluate(c=>c.toDataURL())).split(',')[1],'base64'));
 await page.goto(base+'?effect=singlePunch&photo='+encodeURIComponent('海边粉衣双人'));
 await page.waitForFunction(()=>S.analysis&&FX.singlePunch.state.scene&&AC.state==='running');
 assert.equal(await page.evaluate(()=>FX.singlePunch.name),'单图方块打孔');
 await page.locator('#paramBtn').click();assert.equal(await page.getByLabel('配色来源').inputValue(),'照片取色');assert.equal(await page.getByLabel('形状',{exact:true}).count(),0);assert.equal(await page.getByLabel('撞色方案').isVisible(),false);check('renamed effect, squares only, two separate palette modes');
 const photoColors=await page.evaluate(()=>{
  const s=FX.singlePunch.state,source=src.getContext('2d');return {count:s.scene.colorSet.length,exact:s.analysis.samples.every(a=>JSON.stringify(a.color)===JSON.stringify(Array.from(source.getImageData(a.x,a.y,1,1).data).slice(0,3))),nodes:s.scene.nodes.every(n=>s.scene.colorSet.some(c=>JSON.stringify(c)===JSON.stringify(n.color))),sprites:s.scene.nodes.every(n=>{const c=n.sprite.getContext('2d'),d=Array.from(c.getImageData(Math.floor(n.sprite.width/2),Math.floor(n.sprite.height/2),1,1).data);return JSON.stringify(d.slice(0,3))===JSON.stringify(n.color)&&d[3]===255;})};
 });assert(photoColors.count>=5&&photoColors.exact&&photoColors.nodes&&photoColors.sprites);report.photoColors=photoColors;check('all photo-mode square colors are exact source pixels, with no tints');
 await page.getByRole('button',{name:'看铺满效果',exact:true}).click();await page.waitForTimeout(100);await capture('照片取色-方块');
 await page.getByLabel('配色来源').selectOption('和谐撞色');await page.waitForFunction(()=>FX.singlePunch.state.scene.paletteSource==='clash');assert(await page.getByLabel('撞色方案').isVisible());
 const palette=await page.evaluate(()=>FX.singlePunch.state.scene.colorSet);assert.equal(palette.length,8);
 await page.waitForTimeout(120);await capture('和谐撞色-方块');await page.screenshot({path:path.join(out,'配色参数.png')});
 await page.getByRole('button',{name:'关闭',exact:true}).click();const old=await page.evaluate(()=>S.srcKey);await page.evaluate(()=>selectPhoto(PRESETS.findIndex(p=>p.name==='海边撑伞')));await page.waitForFunction(old=>S.srcKey>old&&FX.singlePunch.state.sourceKey===S.srcKey,old);assert.deepEqual(await page.evaluate(()=>FX.singlePunch.state.scene.colorSet),palette);check('clash palette remains independent when photograph changes');
 // Deterministic decoded-audio fixture: attacks 25ms after the supplied beat grid.
 const fixture=await page.evaluate(()=>{
  const photo=document.createElement('canvas');photo.width=W;photo.height=H;const g=photo.getContext('2d');g.fillStyle='#365b87';g.fillRect(0,0,W,H);
  const output=document.createElement('canvas');output.width=W;output.height=H;
  const buffer=new AudioBuffer({length:32000*40,sampleRate:32000}),audio=buffer.getChannelData(0),beats=Array.from({length:70},(_,i)=>i*.5);
  for(const beat of beats)for(let i=Math.round((beat+.025)*32000);i<Math.round((beat+.065)*32000);i++)audio[i]=Math.sin(i*.27)*.65*Math.exp(-(i/32000-beat-.025)*25);
  const fake={srcKey:1,media:photo,cache:{},params:{},buffer,analysis:{beats}};
  const fx=createSinglePunchEffect({W,H,src:photo,ctx:output.getContext('2d'),S:fake,R,Sel,songTime:()=>0}),p=Object.fromEntries(fx.params.map(d=>[d.key,d.def]));p.density=.55;fake.params.singlePunch=p;
  fx.draw({t:0},p);const births=fx.state.births.slice(),events=fx.state.events.slice(),counts=[];
  for(let i=0;i<births.length;i++){fx.draw({t:births[i]+.001},p);counts.push(fx.state.count);}
  const full=JSON.stringify(fx.state.layout),colors=JSON.stringify(fx.state.scene.nodes.map(n=>n.color)),next=fx.state.reflows[0];
  fx.draw({t:next.t-.001},p);const before=JSON.stringify(fx.state.layout);fx.draw({t:next.t+.001},p);const first=JSON.stringify(fx.state.layout),step1=fx.state.layoutStep;
  const second=fx.state.reflows[1];fx.draw({t:second.t-.001},p);const skipped=JSON.stringify(fx.state.layout);fx.draw({t:second.t+.001},p);const step2=fx.state.layoutStep,after=JSON.stringify(fx.state.layout),sameColors=colors===JSON.stringify(fx.state.scene.nodes.map(n=>n.color));
  const snapshot=output.toDataURL();fx.draw({t:second.t+.001},p);const frozen=snapshot===output.toDataURL();
  const reflowGaps=fx.state.reflows.slice(1).map((e,i)=>e.beatIndex-fx.state.reflows[i].beatIndex),count=fx.state.count,total=fx.state.scene.count;
  fake.buffer=new AudioBuffer({length:32000*40,sampleRate:32000});fx.draw({t:0},p);fx.draw({t:30},p);const silence={count:fx.state.count,reflows:fx.state.reflows.length};
  return {counts,births,events,fullEqualsBefore:full===before,changed:first!==full,skippedSame:first===skipped,changedAgain:after!==first,step1,step2,sameColors,frozen,reflowGaps,count,total,silence};
 });
 assert(fixture.counts.every((c,i)=>c===i+1));assert.equal(new Set(fixture.births).size,fixture.births.length);assert(fixture.events.every(e=>Math.abs(e.t-(e.gridTime+.025))<=.016));check('one square per beat, PCM attacks aligned within 16ms of fixture');
 assert(fixture.fullEqualsBefore&&fixture.changed&&fixture.skippedSame&&fixture.changedAgain);assert.equal(fixture.step1,1);assert.equal(fixture.step2,2);assert(fixture.reflowGaps.every(x=>x===2));assert(fixture.sameColors&&fixture.frozen);assert.equal(fixture.count,fixture.total);assert.deepEqual(fixture.silence,{count:0,reflows:0});report.timing={births:fixture.births,reflowGaps:fixture.reflowGaps,beatCount:fixture.counts.length};check('after fill, reshuffle only every second beat; colors/count stable; silence and pause rest');
 await page.locator('#paramBtn').click();await page.getByRole('button',{name:'看铺满效果',exact:true}).click();await page.waitForFunction(()=>FX.singlePunch.state.count===FX.singlePunch.state.scene.count);
 await page.evaluate(()=>pause());await page.waitForTimeout(150);const frozen=await page.locator('#cv').evaluate(c=>c.toDataURL());await page.waitForTimeout(300);assert.equal(await page.locator('#cv').evaluate(c=>c.toDataURL()),frozen);check('real playback pause is pixel-identical');
 await page.getByRole('button',{name:'恢复默认参数',exact:true}).click();await page.waitForFunction(()=>FX.singlePunch.state.scene.paletteSource==='photo');assert.equal(await page.getByLabel('撞色方案').isVisible(),false);
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.setViewportSize({width:900,height:900});await page.locator('#paramBtn').click();const preview=await page.locator('#cv').boundingBox(),drawer=await page.locator('.sheetbox').boundingBox();assert(preview.x+preview.width<=drawer.x+2);await page.getByRole('button',{name:'关闭',exact:true}).click();await page.setViewportSize({width:1440,height:1000});check('reset and narrow drawer');
 const uploadBefore=await page.evaluate(()=>S.srcKey);await page.locator('#photoFile').setInputFiles(path.resolve(__dirname,'../../../models/eagle-pack/MT9VRDIQFS0I6.jpg'));await page.waitForFunction(i=>S.srcKey>i&&FX.singlePunch.state.sourceKey===S.srcKey,uploadBefore);assert.equal(await page.evaluate(()=>FX.singlePunch.state.scene.shape),'正方形');check('uploaded photo stays square-only');
 await page.evaluate(()=>selectFx('punchSymbols'));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>FX.punchSymbols.lastError||null),null);await page.evaluate(()=>selectFx('singlePunch'));check('existing split punch preserved');
 // A 24s local review clip includes initial fill and multiple rearrangements.
 await page.evaluate(()=>loadTrack(TRACKS.find(t=>t.id==='house')||TRACKS[0]));await page.waitForFunction(()=>S.analysis&&S.playing);
 await page.evaluate(()=>{S.params.singlePunch.palette='和谐撞色';S.params.singlePunch.density=.8;play(0);FX.singlePunch.enter();});
 const dp=page.waitForEvent('download',{timeout:45000});await page.evaluate(()=>window.MFX_EXPORT(24));const dl=await dp;const video=path.join(out,'单图方块打孔-24秒原始.mp4');await dl.saveAs(video);assert(fs.statSync(video).size>10000);report.video=video;check('24s export includes fill and repeated beat rearrangements');
 await page.evaluate(()=>pause());await page.waitForTimeout(100);await capture('最终撞色构图');await page.screenshot({path:path.join(out,'本地工作台.png')});assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);report.errors=errors;report.failed=failed;check('no runtime failures or missing local resources');fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
