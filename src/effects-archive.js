/* 已从界面移除的 30 个效果存档。
   恢复方法：把需要的条目粘回 app.js 里 `const FX = {` 的对象中，再把它的 id 加进 FX_ORDER。
   它们依赖的工具函数（subject / contour / radAt / lumGrid / rgbSplit / edgeMap / halftonePattern / dropFlash）都还在 app.js 里。*/
const FX_ARCHIVE = {
  zoom: { name: '节拍推近', icon: '⤢', desc: '鼓点推近 · 呼吸暗角', hint: '最基础的「鼓点 = 镜头」映射：Kick 驱动推近，Snare 驱动位移抖动，暗角随低频收缩。',
    params: [R('amt', '推近', 0, 1, .42), R('decay', '回弹', .5, .97, .86), R('shake', '抖动', 0, 1, .28), R('rgb', '三色分离', 0, 1, .22), R('vig', '暗角', 0, 1, .5), D('drv', 'kick')],
    state: { z: 0 },
    draw(f, p) { const s = this.state; s.z = Math.max(s.z * p.decay, f[p.drv]);
      const sc = 1.03 + p.shake * 0.05 + s.z * p.amt * 0.34 + f.dropHold * 0.06;
      const dx = (Math.random() - .5) * f.snare * p.shake * 38, dy = (Math.random() - .5) * f.snare * p.shake * 38;
      ctx.save(); ctx.translate(W / 2 + dx, H / 2 + dy); ctx.scale(sc, sc); ctx.rotate(s.z * p.shake * 0.012);
      ctx.translate(-W / 2, -H / 2); const off = s.z * p.rgb * 20;
      if (off > 0.5) rgbSplit(ctx, off); else ctx.drawImage(src, 0, 0); ctx.restore();
      if (p.vig > 0) { const r = ctx.createRadialGradient(W / 2, H * .46, H * (.26 - s.z * .06), W / 2, H * .5, H * .78);
        r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${p.vig * (.55 + s.z * .3)})`); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); }
      dropFlash(f, p); } },

  blinds: { name: '百叶窗', icon: '≣', desc: '横条交替反相', hint: '画面切成横条，奇偶条交替显示原图与反相／位移版本，条带随节拍上下推移。',
    params: [R('n', '条数', 6, 40, 16, 1), R('shift', '错位', 0, 1, .35), R('inv', '反相强度', 0, 1, .55), R('move', '推移', 0, 1, .5), D('drv', 'beat', ['beat', 'kick', 'snare', 'energy'])],
    state: { o: 0 },
    draw(f, p, t) { const s = this.state; s.o += f[p.drv] * p.move * 6 + f.energy * 1.2;
      const n = Math.round(p.n), bh = H / n; ctx.drawImage(src, 0, 0);
      for (let i = 0; i < n; i++) { const y = i * bh, phase = (i + Math.floor(s.o / bh)) % 2;
        if (!phase) continue; const dx = (i % 4 < 2 ? 1 : -1) * p.shift * 70 * (0.4 + f[p.drv]);
        ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, bh); ctx.clip();
        ctx.filter = `invert(${p.inv * (.5 + f.energy * .5)})`; ctx.drawImage(src, dx, y - (s.o % bh), W, H, dx, y - (s.o % bh), W, H);
        ctx.filter = 'none'; ctx.restore(); }
      dropFlash(f, p); } },

  split: { name: '分屏节奏', icon: '⊞', desc: '小节换分屏版式', hint: '每个小节换一种分屏：竖二分、横三分、四宫格，每格是同一张图的不同裁切与缩放。',
    params: [R('zoom', '格内放大', 1, 2.2, 1.35), R('gap', '缝隙', 0, 14, 4, 1), R('shift', '裁切偏移', 0, 1, .5), D('drv', 'bar', ['bar', 'beat', 'kick', 'snare'])],
    state: { mode: 0, last: 0 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .5 && t - s.last > .4) { s.last = t; s.mode = (s.mode + 1) % 4; }
      const layouts = [[[0, 0, 1, 1]], [[0, 0, .5, 1], [.5, 0, .5, 1]], [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]], [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]]];
      const L = layouts[s.mode]; ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);
      L.forEach((q, i) => { const x = q[0] * W + p.gap / 2, y = q[1] * H + p.gap / 2, w = q[2] * W - p.gap, h = q[3] * H - p.gap;
        const z = p.zoom + (i % 2) * .18 + f.kick * .12, sw = W / z, sh = H / z;
        const ox = clamp(W / 2 - sw / 2 + (i - L.length / 2) * p.shift * 90, 0, W - sw), oy = clamp(H / 2 - sh / 2 + (i % 2 ? 1 : -1) * p.shift * 60, 0, H - sh);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(src, ox, oy, sw, sh, x, y, w, h); ctx.restore(); });
      dropFlash(f, p); } },

  flip: { name: '立体翻转', icon: '◱', desc: '整屏透视翻面', hint: '整幅画面像一张卡片，在重拍上绕 Y 轴翻一下，翻面时压扁并打高光。',
    params: [R('amt', '幅度', 0, 1, .6), R('dur', '时长', .1, .8, .3), R('shine', '高光', 0, 1, .5), D('drv', 'beat', ['beat', 'kick', 'snare', 'bar'])],
    state: { t0: -9 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .55 && t - s.t0 > p.dur * 1.1) s.t0 = t;
      const k = clamp((t - s.t0) / p.dur, 0, 1), a = k < 1 ? Math.sin(k * Math.PI) : 0;
      const sx = 1 - a * p.amt * .95, sh = 1 + a * p.amt * .12;
      ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(Math.max(sx, .02), sh); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(src, 0, 0);
      if (a > 0 && p.shine > 0) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(clamp(k, 0, 1), `rgba(255,255,255,${a * p.shine * .45})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      ctx.restore(); dropFlash(f, p); } },

  mirror: { name: '镜像对称', icon: '◧', desc: '对称轴随拍切换', hint: '把半边画面镜像到另一边，对称轴（左右／上下／四象限）随节拍切换，人脸会变成对称的图腾感。',
    params: [R('blend', '接缝柔化', 0, 1, .25), R('offset', '轴偏移', -.3, .3, 0), D('drv', 'bar', ['bar', 'beat', 'kick', 'snare'])],
    state: { m: 0, last: 0 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .5 && t - s.last > .35) { s.last = t; s.m = (s.m + 1) % 4; }
      const ax = W * (.5 + p.offset), ay = H * (.5 + p.offset);
      ctx.drawImage(src, 0, 0);
      const mirrorH = () => { ctx.save(); ctx.beginPath(); ctx.rect(ax, 0, W - ax, H); ctx.clip(); ctx.translate(ax * 2, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0); ctx.restore(); };
      const mirrorV = () => { ctx.save(); ctx.beginPath(); ctx.rect(0, ay, W, H - ay); ctx.clip(); ctx.translate(0, ay * 2); ctx.scale(1, -1); ctx.drawImage(src, 0, 0); ctx.restore(); };
      if (s.m === 0) mirrorH(); else if (s.m === 1) mirrorV(); else if (s.m === 2) { mirrorH(); mirrorV(); }
      else { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, ax, H); ctx.clip(); ctx.translate(ax * 2, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0); ctx.restore(); }
      if (p.blend > 0) { ctx.fillStyle = `rgba(255,255,255,${p.blend * .12 * (0.4 + f.energy)})`; ctx.fillRect(ax - 2, 0, 4, H); }
      dropFlash(f, p); } },

  tiles: {
    name: '网格切换', icon: '⬚', desc: '格子翻面换画面', hint: '画面切成网格，每个节拍随机几格翻面，翻到背面是放大／镜像／位移过的同一张图，落拍瞬间对齐。Drop 时整屏一起翻。',
    params: [R('cols', '列数', 2, 6, 3, 1), R('rows', '行数', 3, 9, 5, 1), R('n', '每拍翻转数', 1, 8, 3, 1), R('dur', '翻转时长', .1, .8, .26), R('gap', '缝隙', 0, 12, 3, 1), D('drv', 'beat', ['beat', 'kick', 'snare', 'bar'])],
    state: { cells: null, last: 0, key: '' },
    variant(v, x, y, w, h, sx, sy, sw, sh) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      if (v === 0) ctx.drawImage(src, sx, sy, sw, sh, x, y, w, h);
      else if (v === 1) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h); }
      else if (v === 2) { const z = 1.5; ctx.drawImage(src, sx + sw * (1 - 1 / z) / 2, sy + sh * (1 - 1 / z) / 2, sw / z, sh / z, x, y, w, h); }
      else { ctx.drawImage(src, clamp(sx + sw * .8, 0, W - sw), clamp(sy + sh * .6, 0, H - sh), sw, sh, x, y, w, h); }
      ctx.restore(); },
    draw(f, p, t) { const s = this.state, C = Math.round(p.cols), Rw = Math.round(p.rows), key = C + 'x' + Rw;
      if (s.key !== key) { s.key = key; s.cells = Array.from({ length: C * Rw }, () => ({ v: 0, nv: 0, t0: -9 })); }
      if (f[p.drv] > .55 && t - s.last > .1) { s.last = t; const n = Math.round(p.n) * (f.dropHold > .5 ? 3 : 1);
        for (let i = 0; i < n; i++) { const c = s.cells[Math.floor(rnd(s.cells.length))]; c.t0 = t; c.nv = Math.floor(rnd(4)); } }
      ctx.drawImage(src, 0, 0); ctx.fillStyle = 'rgba(6,7,11,.55)'; ctx.fillRect(0, 0, W, H);
      const cw = W / C, ch = H / Rw, g = p.gap;
      for (let ry = 0; ry < Rw; ry++) for (let rx = 0; rx < C; rx++) {
        const c = s.cells[ry * C + rx], prog = clamp((t - c.t0) / p.dur, 0, 1);
        if (prog >= 1 && c.v !== c.nv) c.v = c.nv;
        const half = prog < .5, v = half ? c.v : c.nv, k = Math.abs(Math.cos(prog * Math.PI));
        const x = rx * cw + g / 2, y = ry * ch + g / 2, w = cw - g, h = ch - g;
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(prog < 1 ? Math.max(k, 0.06) : 1, 1); ctx.translate(-w / 2, -h / 2);
        this.variant(v, 0, 0, w, h, rx * cw, ry * ch, cw, ch);
        if (prog < 1) { ctx.fillStyle = `rgba(255,255,255,${(1 - k) * .28})`; ctx.fillRect(0, 0, w, h); }
        ctx.restore(); }
      dropFlash(f, p); } },

  stretch: {
    name: '像素拉伸', icon: '⟿', desc: '主体保留 · 单向拖影', hint: '参考视频 3：抠出主体后只拉伸背景。每个鼓点从上往下依次触发一条，随机左右，内容从一侧滑出、另一侧留下长拖影。',
    params: [R('rows', '条带数', 3, 14, 6, 1), R('span', '滑出距离', .2, 1, .85), R('life', '停留(秒)', .2, 2, 1.1), R('keep', '保留主体', 0, 1, 1), R('blur', '拖影柔化', 0, 1, .4), D('drv', 'kick', ['kick', 'beat', 'snare', 'hat'])],
    state: { act: [], idx: 0, lastBeat: -1 },
    draw(f, p, t) { const s = this.state, n = Math.round(p.rows), bh = H / n;
      const trig = f[p.drv] > (p.drv === 'beat' ? 0.5 : 0.38);
      if (trig && t - (s.lastT || 0) > 0.11) { s.lastT = t; const i = s.idx % n; s.idx++;
        s.act.push({ y: i * bh, h: bh + 1, dir: Math.random() < .5 ? -1 : 1, born: t, until: t + p.life * rnd(.7, 1.3) });
        if (s.idx % n === 0) s.idx = 0; }
      ctx.drawImage(src, 0, 0);
      s.act = s.act.filter(b => b.until > t);
      for (const b of s.act) {
        const age = (t - b.born) / (b.until - b.born), k = 1 - Math.pow(1 - clamp(age, 0, 1), 4);
        const shift = k * W * p.span * b.dir;
        ctx.save(); ctx.beginPath(); ctx.rect(0, b.y, W, b.h); ctx.clip();
        ctx.globalAlpha = age > .8 ? 1 - (age - .8) / .2 : 1;
        // long smear first: the column that is being dragged
        const sxCol = b.dir > 0 ? 1 : W - 3;
        ctx.drawImage(src, sxCol, b.y, 2, b.h, 0, b.y, W, b.h);
        // then the band content, slid toward one side
        ctx.drawImage(src, 0, b.y, W, b.h, shift, b.y, W, b.h);
        // hard bright edge at the leading boundary
        const ex = b.dir > 0 ? shift : W + shift;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .35 + .4 * (1 - k);
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(ex - 1, b.y, 2, b.h);
        ctx.restore(); }
      if (p.keep > .5) { ctx.globalAlpha = clamp(p.keep, 0, 1); ctx.drawImage(subject(), 0, 0); ctx.globalAlpha = 1; }
      dropFlash(f, p); } },

  pixelsort: { name: '像素排序', icon: '⇉', desc: '亮部沿行拉成色带', hint: '鼓点触发时，随机若干行里亮度超过阈值的一段被横向拉成色带，像经典 pixel sorting 故障。',
    params: [R('rows', '行数', 2, 30, 10, 1), R('thr', '亮度阈值', .2, .95, .55), R('len', '长度', .1, 1, .55), R('life', '停留', .1, 1.2, .45), D('drv', 'kick')],
    state: { rows: [], last: 0 },
    draw(f, p, t) { const s = this.state; ctx.drawImage(src, 0, 0);
      const g = lumGrid(8);
      if (f[p.drv] > .45 && t - s.last > .08) { s.last = t;
        for (let i = 0; i < Math.round(p.rows); i++) { const ry = Math.floor(rnd(g.rows));
          let x0 = -1; for (let rx = 0; rx < g.cols; rx++) if (g.g[ry * g.cols + rx] > p.thr * g.hi + (1 - p.thr) * 0.15) { x0 = rx; break; }
          if (x0 < 0) x0 = Math.floor(rnd(g.cols * .7));
          s.rows.push({ y: ry * 8, h: 8 + rnd(0, 14), x: x0 * 8, born: t, until: t + p.life * rnd(.6, 1.5), dir: Math.random() < .5 ? -1 : 1 }); } }
      s.rows = s.rows.filter(r => r.until > t);
      for (const r of s.rows) { const k = clamp((t - r.born) / (r.until - r.born), 0, 1), len = (1 - Math.pow(1 - k, 3)) * W * p.len;
        ctx.globalAlpha = k > .8 ? (1 - k) / .2 : 1;
        if (r.dir > 0) ctx.drawImage(src, r.x, r.y, 2, r.h, r.x, r.y, len, r.h);
        else ctx.drawImage(src, r.x, r.y, 2, r.h, r.x - len, r.y, len, r.h); }
      ctx.globalAlpha = 1; dropFlash(f, p); } },

  crt: { name: 'CRT 显像管', icon: '▤', desc: '扫描线 · 滚动条 · 色散', hint: '老电视质感：细扫描线、随机滚动的亮带、RGB 色散和画面轻微抖动，重拍时整屏失同步。',
    params: [R('line', '扫描线', 0, 1, .5), R('roll', '滚动条', 0, 1, .5), R('rgb', '色散', 0, 1, .4), R('bend', '暗角弧度', 0, 1, .5), D('drv', 'kick')],
    state: { r: 0 },
    draw(f, p, t) { const s = this.state; s.r = (s.r + 2 + f.energy * 9) % (H * 1.6);
      const sep = 3 + f[p.drv] * p.rgb * 18;
      const jy = (Math.random() - .5) * f[p.drv] * 10;
      ctx.save(); ctx.translate(0, jy); if (sep > 1) rgbSplit(ctx, sep, 0); else ctx.drawImage(src, 0, 0); ctx.restore();
      if (p.line > 0) { ctx.fillStyle = `rgba(0,0,0,${p.line * .38})`; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2); }
      if (p.roll > 0) { const y = s.r - H * .3, g = ctx.createLinearGradient(0, y, 0, y + 90);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${p.roll * .12})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y, W, 90); }
      if (p.bend > 0) { const r = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .72);
        r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${p.bend * .8})`); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); }
      dropFlash(f, p); } },

  slit: { name: '时间切片', icon: '⌷', desc: '列按波形错位', hint: 'Slit-scan：每一列画面按一条随节拍传播的波上下错位，像时间被切成条再重新拼起来。',
    params: [R('amp', '错位幅度', 0, 1, .5), R('wave', '波长', .002, .04, .012), R('speed', '速度', 0, 1, .5), R('cols', '列宽', 2, 24, 6, 1), D('drv', 'energy', ['energy', 'bass', 'kick', 'beat'])],
    state: { ph: 0 },
    draw(f, p, t) { const s = this.state; s.ph += .02 + p.speed * .12 * (0.3 + f[p.drv]);
      const step = Math.round(p.cols), A = p.amp * 150 * (0.35 + f[p.drv]);
      ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += step) { const dy = Math.sin(x * p.wave + s.ph) * A;
        ctx.drawImage(src, x, 0, step, H, x, dy, step, H);
        if (dy > 0) ctx.drawImage(src, x, 0, step, 2, x, 0, step, dy + 1);
        else if (dy < 0) ctx.drawImage(src, x, H - 2, step, 2, x, H + dy, step, -dy + 1); }
      dropFlash(f, p); } },

  film: { name: '胶片颗粒', icon: '▨', desc: '颗粒 · 划痕 · 跳帧', hint: '老胶片质感：动态颗粒、竖向划痕、暖色调和轻微跳帧，重拍上闪一下曝光。',
    params: [R('grain', '颗粒', 0, 1, .45), R('scratch', '划痕', 0, 1, .4), R('warm', '暖调', 0, 1, .5), R('jump', '跳帧', 0, 1, .4), D('drv', 'snare', ['snare', 'kick', 'beat', 'hat'])],
    draw(f, p, t) { const jx = (Math.random() - .5) * f[p.drv] * p.jump * 16, jy = (Math.random() - .5) * f[p.drv] * p.jump * 22;
      ctx.filter = `sepia(${p.warm * .5}) contrast(${1.05 + f.energy * .15}) saturate(${1 - p.warm * .25})`;
      ctx.drawImage(src, jx, jy); ctx.filter = 'none';
      if (p.grain > 0) { ctx.save(); ctx.globalAlpha = p.grain * .3; ctx.globalCompositeOperation = 'overlay';
        for (let i = 0; i < 700; i++) { ctx.fillStyle = Math.random() < .5 ? '#fff' : '#000'; ctx.fillRect(rnd(W), rnd(H), 2, 2); } ctx.restore(); }
      if (p.scratch > 0) for (let i = 0; i < 3; i++) { if (Math.random() > p.scratch) continue;
        const x = rnd(W); ctx.fillStyle = `rgba(255,255,255,${rnd(.1, .35)})`; ctx.fillRect(x, rnd(0, H * .4), 1.5, rnd(H * .3, H)); }
      const r = ctx.createRadialGradient(W / 2, H / 2, H * .28, W / 2, H / 2, H * .75);
      r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(20,10,0,.6)'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
      dropFlash(f, p); } },

  echo: {
    name: '频闪重影', icon: '◎', desc: '鼓点留下发光残影', hint: '每个鼓点拍下一张「残影」，随后放大、变淡、加色，叠在实时画面上。快节奏时残影层层叠加，像长曝光的舞池灯光。',
    params: [R('count', '残影数', 2, 10, 5, 1), R('grow', '扩散', 0, 1, .5), R('fade', '衰减', .3, .98, .86), R('tint', '染色', 0, 1, .5), C('col', '主色', '#3fd0ee'), C('col2', '副色', '#ff5d5d'), D('drv', 'kick')],
    state: { echoes: [], last: 0 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .45 && t - s.last > .09) { s.last = t; s.echoes.push({ born: t, r: rnd(-0.03, 0.03), x: rnd(-14, 14), y: rnd(-14, 14), c: Math.random() < .5 ? p.col : p.col2 }); if (s.echoes.length > p.count) s.echoes.shift(); }
      ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < s.echoes.length; i++) { const e = s.echoes[i], age = t - e.born;
        const a = Math.pow(p.fade, age * 11) * (0.3 + 0.7 * ((i + 1) / s.echoes.length));
        if (a < .01) continue;
        const sc = 1 + age * p.grow * 1.6;
        ctx.globalAlpha = a; ctx.save(); ctx.translate(W / 2 + e.x, H / 2 + e.y); ctx.scale(sc, sc); ctx.rotate(e.r * age * 3); ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(src, 0, 0);
        if (p.tint > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a * p.tint * 1.6; ctx.fillStyle = e.c; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; }
        ctx.restore(); }
      ctx.restore();
      ctx.globalAlpha = clamp(0.45 + f.kick * 0.35, 0, 1); ctx.drawImage(src, 0, 0); ctx.globalAlpha = 1;
      dropFlash(f, p); } },

  zoomblur: { name: '径向拖影', icon: '◎', desc: '鼓点炸出速度感', hint: '每个鼓点从中心炸出一层层放大的半透明残影，形成径向模糊的冲击。',
    params: [R('layers', '层数', 3, 20, 9, 1), R('amt', '扩散', 0, 1, .5), R('decay', '回弹', .5, .97, .85), R('bright', '提亮', 0, 1, .4), D('drv', 'kick')],
    state: { z: 0 },
    draw(f, p, t) { const s = this.state; s.z = Math.max(s.z * p.decay, f[p.drv]);
      ctx.drawImage(src, 0, 0);
      const n = Math.round(p.layers), amt = s.z * p.amt * .5;
      if (amt > .004) { ctx.save(); ctx.globalCompositeOperation = p.bright > .5 ? 'lighter' : 'source-over';
        for (let i = 1; i <= n; i++) { const k = i / n, sc = 1 + amt * k;
          ctx.globalAlpha = (1 - k) * .45 * (p.bright > .5 ? .6 : 1);
          ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); ctx.drawImage(src, 0, 0); ctx.restore(); }
        ctx.restore(); ctx.globalAlpha = 1; }
      dropFlash(f, p); } },

  shock: { name: '冲击波', icon: '◌', desc: '环形透镜扭曲', hint: '低频推出一圈环形「透镜」，环上的画面被放大挤压，像一记冲击波穿过画面。',
    params: [R('amt', '强度', 0, 1, .55), R('speed', '速度', .2, 2, 1), R('width', '环宽', .05, .4, .16), R('life', '持续', .3, 2, 1), D('drv', 'kick')],
    state: { rings: [], last: 0 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .5 && t - s.last > .14) { s.last = t; s.rings.push({ x: W / 2 + rnd(-90, 90), y: H * .45 + rnd(-90, 90), born: t }); if (s.rings.length > 4) s.rings.shift(); }
      s.rings = s.rings.filter(r => t - r.born < p.life);
      ctx.drawImage(src, 0, 0);
      const bandH = 5;
      for (const r of s.rings) { const age = (t - r.born) / p.life, rad = age * p.speed * 620, wdt = p.width * 320, k = (1 - age) * p.amt;
        if (k <= 0) continue;
        for (let y = Math.max(0, r.y - rad - wdt); y < Math.min(H, r.y + rad + wdt); y += bandH) {
          const dy = Math.abs(y - r.y + bandH / 2), d = Math.abs(dy - rad); if (d > wdt) continue;
          const m = Math.cos(d / wdt * Math.PI / 2) * k * 46;
          ctx.drawImage(src, 0, y - m / 2, W, bandH + m, 0, y, W, bandH + 1); }
        ctx.strokeStyle = `rgba(255,255,255,${k * .25})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 7); ctx.stroke(); }
      dropFlash(f, p); } },

  ripple: {
    name: '声波涟漪', icon: '◉', desc: '低频推出液态波纹', hint: '每个 Kick 从画面中一点推出一圈波纹，横向切片按径向位移变形，像水面被声音敲了一下。低频越重波越深。',
    params: [R('amp', '波幅', 0, 1, .45), R('speed', '扩散速度', .2, 2, .9), R('freq', '波密度', .01, .12, .045), R('ring', '光环', 0, 1, .45), R('life', '持续', .4, 2.5, 1.2), D('drv', 'kick')],
    state: { rings: [], last: 0 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .5 && t - s.last > .12) { s.last = t; s.rings.push({ x: rnd(W * .25, W * .75), y: rnd(H * .3, H * .7), born: t, a: 0.6 + f[p.drv] * .6 }); if (s.rings.length > 6) s.rings.shift(); }
      s.rings = s.rings.filter(r => t - r.born < p.life);
      const step = 3, A = p.amp * 80 * (0.45 + f.bass);
      for (let y = 0; y < H; y += step) {
        let dx = 0;
        for (const r of s.rings) { const age = t - r.born, rad = age * p.speed * 700, dy = y - r.y, d = Math.abs(dy);
          if (d > rad || rad - d > 300) continue;
          const fall = (1 - age / p.life) * (1 - (rad - d) / 300);
          dx += Math.sin((rad - d) * p.freq) * A * fall * r.a; }
        ctx.drawImage(src, 0, y, W, step, dx, y, W, step);
        if (Math.abs(dx) > 1) { ctx.drawImage(src, dx > 0 ? 0 : W - 2, y, 2, step, dx > 0 ? 0 : W + dx, y, Math.abs(dx) + 1, step); } }
      if (p.ring > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const r of s.rings) { const age = t - r.born, rad = age * p.speed * 700, a = (1 - age / p.life) * p.ring * r.a;
          if (a <= 0) continue; ctx.strokeStyle = `rgba(190,235,255,${a * .5})`; ctx.lineWidth = 2 + a * 4;
          ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 7); ctx.stroke(); }
        ctx.restore(); }
      dropFlash(f, p); } },
  words: {
    name: '环绕文字', icon: '◠', desc: '文字沿人物轮廓环绕', hint: '用分割模型抠出人物，沿轮廓外扩一圈排文字，文字贴着身体走并绕到身后（人物盖在文字之上）。每个节拍前进一个词，当前词放大加亮。文案请自己填，我不能内置受版权保护的歌词。',
    params: [T('text', '文案', 'FEEL THE BEAT / 一整晚 / DON\'T STOP / 心跳 / ON REPEAT / 再一次'), R('size', '字号', .4, 2, .95), R('margin', '离身体', 0, 1, .16), R('spin', '旋转', 0, 1, .28), R('tilt', '贴合角度', 0, 1, .8), C('col', '颜色', '#ffffff'), R('pop', '重音放大', 0, 1, .7), D('drv', 'beat', ['beat', 'kick', 'snare', 'bar'])],
    state: { a: 0, idx: 0, hit: 0, last: 0 },
    draw(f, p, t) { const s = this.state;
      const words = (p.text || '').split(/[\/\n|,，]+/).map(x => x.trim()).filter(Boolean);
      if (!words.length) { ctx.drawImage(src, 0, 0); return; }
      if (f[p.drv] > .6 && t - s.last > .12) { s.last = t; s.idx = (s.idx + 1) % words.length; s.hit = 1; }
      s.hit *= 0.88; s.a += 0.0012 + p.spin * 0.011 * (0.3 + f.energy);
      const ct = contour();
      ctx.drawImage(src, 0, 0);
      ctx.fillStyle = `rgba(8,10,14,${0.14 + 0.2 * f.energy})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < words.length; i++) {
        const ang = s.a + i / words.length * Math.PI * 2;
        const r = radAt(ct, ang) + 16 + p.margin * 150;
        const x = clamp(ct.cx + Math.cos(ang) * r, 44, W - 44), y = clamp(ct.cy + Math.sin(ang) * r * 0.96, 48, H - 48);
        const cur = i === s.idx;
        const base = 32 * p.size * (1 + f.energy * 0.12);
        const sz = base * (cur ? 1 + p.pop * (0.55 + s.hit * 0.9) : 1);
        let tg = Math.atan2(Math.sin(ang + Math.PI / 2), Math.cos(ang + Math.PI / 2));
        if (tg > Math.PI / 2) tg -= Math.PI; if (tg < -Math.PI / 2) tg += Math.PI;
        const rot = clamp(tg, -1.05, 1.05) * p.tilt;
        ctx.font = `800 ${sz}px Manrope, "PingFang SC", sans-serif`;
        ctx.globalAlpha = cur ? 1 : 0.68 + 0.22 * Math.sin(ang);
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        if (cur) { ctx.shadowColor = p.col; ctx.shadowBlur = 26 * (0.4 + s.hit); }
        ctx.lineWidth = sz * 0.11; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(words[i], 0, 0);
        ctx.fillStyle = p.col; ctx.fillText(words[i], 0, 0);
        ctx.restore(); }
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.drawImage(subject(), 0, 0);
      dropFlash(f, p); } },

  outline: { name: '轮廓心跳', icon: '◍', desc: '人物轮廓跟着低频扩张', hint: '用分割模型抠出人物，在他身后叠几圈放大的轮廓光，低频越重光圈越大，像心跳一样扩散。',
    params: [R('rings', '圈数', 1, 8, 4, 1), R('amt', '扩张', 0, 1, .5), C('col', '光色', '#4ad4f0'), C('col2', '副色', '#ff6b5e'), R('dark', '压暗底图', 0, 1, .4), D('drv', 'bass', ['bass', 'kick', 'energy', 'beat'])],
    draw(f, p, t) { ctx.drawImage(src, 0, 0);
      ctx.fillStyle = `rgba(6,8,12,${p.dark})`; ctx.fillRect(0, 0, W, H);
      const sub = subject(), d = clamp(f[p.drv] * 1.3, 0, 1), n = Math.round(p.rings);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = n; i >= 1; i--) { const k = i / n, sc = 1 + (0.03 + d * p.amt * 0.22) * k;
        ctx.globalAlpha = (1 - k * .7) * (.25 + d * .5);
        const tint = document.createElement('canvas'); tint.width = W; tint.height = H; const g = tint.getContext('2d');
        g.drawImage(sub, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = i % 2 ? p.col : p.col2; g.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); ctx.drawImage(tint, 0, 0); ctx.restore(); }
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.drawImage(sub, 0, 0); dropFlash(f, p); } },

  ghost: { name: '主体残影', icon: '◉', desc: '人物拖出重影', hint: '只对抠出来的人物做残影：每个鼓点留下一层位移过的半透明人像，背景保持干净。',
    params: [R('count', '残影数', 2, 10, 5, 1), R('dist', '位移', 0, 1, .45), R('fade', '衰减', .3, .97, .78), C('col', '染色', '#4ad4f0'), R('tint', '染色强度', 0, 1, .5), D('drv', 'kick')],
    state: { g: [], last: 0 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .45 && t - s.last > .09) { s.last = t; s.g.push({ born: t, dx: rnd(-1, 1), dy: rnd(-1, 1) }); if (s.g.length > p.count) s.g.shift(); }
      ctx.drawImage(src, 0, 0);
      const sub = subject();
      const tint = document.createElement('canvas'); tint.width = W; tint.height = H; const tg = tint.getContext('2d');
      tg.drawImage(sub, 0, 0); if (p.tint > 0) { tg.globalCompositeOperation = 'source-in'; tg.globalAlpha = p.tint; tg.fillStyle = p.col; tg.fillRect(0, 0, W, H); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < s.g.length; i++) { const e = s.g[i], age = t - e.born, a = Math.pow(p.fade, age * 12) * (.2 + .6 * (i + 1) / s.g.length);
        if (a < .02) continue; ctx.globalAlpha = a;
        ctx.drawImage(tint, e.dx * p.dist * 120 * age * 3, e.dy * p.dist * 90 * age * 3); }
      ctx.restore(); ctx.globalAlpha = 1; ctx.drawImage(sub, 0, 0); dropFlash(f, p); } },

  neon: { name: '霓虹描边', icon: '◈', desc: '人物边缘彩色描边', hint: '用抠像做一圈厚描边，红蓝错开形成彩色霓虹，随重拍闪烁，人物本体保持清晰。',
    params: [R('w', '描边粗细', 1, 20, 7, 1), C('c1', '颜色 A', '#ff3d8b'), C('c2', '颜色 B', '#4ad4f0'), R('glow', '辉光', 0, 1, .6), R('dark', '压暗底图', 0, 1, .5), D('drv', 'kick')],
    draw(f, p, t) { ctx.drawImage(src, 0, 0);
      ctx.fillStyle = `rgba(4,6,10,${p.dark})`; ctx.fillRect(0, 0, W, H);
      const sub = subject(), d = 1 + f[p.drv] * .8, w = p.w * d;
      const mk = col => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
        g.drawImage(sub, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, W, H); return c; };
      const A = mk(p.c1), B = mk(p.c2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + f[p.drv] * .3;
      if (p.glow > 0) { ctx.shadowBlur = p.glow * 26 * d; }
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, dx = Math.cos(a) * w, dy = Math.sin(a) * w;
        ctx.shadowColor = p.c1; ctx.drawImage(A, dx, dy); ctx.shadowColor = p.c2; ctx.drawImage(B, -dx, -dy); }
      ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.drawImage(sub, 0, 0); dropFlash(f, p); } },

  particles: { name: '粒子消散', icon: '⁘', desc: '人物碎成粒子飞散', hint: '把抠出的人物切成小方块，Drop 或重拍时整体向外飞散再吸回来，像被音浪打碎。',
    params: [R('pitch', '粒子大小', 6, 26, 12, 1), R('blast', '飞散强度', 0, 1, .55), R('decay', '吸回速度', .5, .97, .88), R('spin', '旋转', 0, 1, .4), D('drv', 'kick')],
    state: { z: 0, cache: null, key: '' },
    draw(f, p, t) { const s = this.state; s.z = Math.max(s.z * p.decay, f[p.drv] * .8 + f.dropHold);
      ctx.drawImage(src, 0, 0); ctx.fillStyle = 'rgba(6,8,12,.35)'; ctx.fillRect(0, 0, W, H);
      const sub = subject(), pitch = Math.round(p.pitch), key = pitch + ':' + (S.srcKey || 0) + ':' + (S.cache.subjAI ? 1 : 0);
      if (s.key !== key) { s.key = key; const c = document.createElement('canvas'); c.width = Math.ceil(W / pitch); c.height = Math.ceil(H / pitch);
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(sub, 0, 0, c.width, c.height); s.cache = { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; }
      const { d, w, h } = s.cache, z = s.z;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] < 60) continue;
        const cx = x * pitch + pitch / 2, cy = y * pitch + pitch / 2;
        const ang = Math.atan2(cy - H * .45, cx - W / 2), dist = z * p.blast * (60 + ((x * 7 + y * 13) % 90));
        const px = cx + Math.cos(ang) * dist, py = cy + Math.sin(ang) * dist - z * 20;
        ctx.save(); ctx.translate(px, py); if (p.spin) ctx.rotate(z * p.spin * ((x + y) % 5 - 2));
        ctx.globalAlpha = clamp(1 - z * .45, .15, 1);
        ctx.drawImage(sub, x * pitch, y * pitch, pitch, pitch, -pitch / 2, -pitch / 2, pitch, pitch); ctx.restore(); }
      ctx.globalAlpha = 1; dropFlash(f, p); } },

  melt: { name: '融化下坠', icon: '⇣', desc: '画面像被拉融', hint: '列按不同速度向下「融」，重拍加速，形成蜡油般拉长的下坠感，可选只融背景保留人物。',
    params: [R('cols', '列宽', 3, 24, 8, 1), R('speed', '速度', 0, 1, .45), R('reset', '回弹', 0, 1, .5), R('keep', '保留主体', 0, 1, 1), D('drv', 'kick')],
    state: { off: null, key: 0 },
    draw(f, p, t) { const s = this.state, step = Math.round(p.cols), n = Math.ceil(W / step);
      if (!s.off || s.off.length !== n) s.off = new Float32Array(n).map(() => 0);
      ctx.drawImage(src, 0, 0);
      for (let i = 0; i < n; i++) {
        s.off[i] += (0.4 + (i * 37 % 11) / 9) * p.speed * (1 + f[p.drv] * 5 + f.dropHold * 6);
        s.off[i] *= (1 - p.reset * .02);
        if (s.off[i] > H) s.off[i] = 0;
        const x = i * step, dy = s.off[i];
        if (dy < 1) continue;
        ctx.drawImage(src, x, 0, step, H - dy, x, dy, step, H - dy);
        ctx.drawImage(src, x, 0, step, 2, x, 0, step, dy + 1); }
      if (p.keep > .5) ctx.drawImage(subject(), 0, 0);
      dropFlash(f, p); } },
  collage: { name: '拼图落位', icon: '⊡', desc: '格子逐拍拼成整图', hint: '参考「组图」玩法：画面切成网格，每个节拍落下一格，带旋转和位移，几个小节后拼成完整画面；Drop 时整屏重洗。',
    params: [R('cols', '列数', 2, 8, 4, 1), R('rows', '行数', 3, 12, 6, 1), R('gap', '白边', 0, 10, 3, 1), R('fly', '入场距离', 0, 1, .5), R('spin', '入场旋转', 0, 1, .5), R('dur', '入场时长', .1, 1, .38), D('drv', 'beat', ['beat', 'kick', 'snare', 'bar'])],
    state: { key: '', at: null, idx: 0, last: 0 },
    draw(f, p, t) { const s = this.state, C = Math.round(p.cols), Rw = Math.round(p.rows), n = C * Rw, key = C + 'x' + Rw;
      if (s.key !== key) { s.key = key; s.at = new Float32Array(n).fill(-5); s.ord = [...Array(n).keys()].sort(() => Math.random() - .5); s.idx = 0; }
      if (f[p.drv] > .5 && t - s.last > .1) { s.last = t; const k = f.dropHold > .5 ? 5 : 2;
        for (let j = 0; j < k; j++) { if (s.idx >= n) { s.idx = 0; s.ord.sort(() => Math.random() - .5); } s.at[s.ord[s.idx++]] = t; } }
      ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, W, H);
      const cw = W / C, ch = H / Rw;
      for (let i = 0; i < n; i++) { const a = s.at[i];
        const k = clamp((t - a) / p.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
        const cx = (i % C) * cw, cy = ((i / C) | 0) * ch;
        const dx = (1 - e) * (((i * 37) % 7) - 3) * p.fly * 90, dy = (1 - e) * (-1 - ((i * 13) % 5)) * p.fly * 70;
        ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.translate(cx + cw / 2 + dx, cy + ch / 2 + dy); ctx.rotate((1 - e) * p.spin * (((i % 3) - 1) * .5)); ctx.scale(.8 + e * .2, .8 + e * .2);
        ctx.drawImage(src, cx, cy, cw, ch, -cw / 2 + p.gap / 2, -ch / 2 + p.gap / 2, cw - p.gap, ch - p.gap);
        ctx.restore(); }
      dropFlash(f, p); } },

  poster: { name: '组图海报', icon: '▥', desc: '白边网格 · 随拍错位', hint: '参考「Cut Moment」组图：画面切成带白边的方格贴在底色上，每个节拍随机几格轻微旋转错位，像手贴的拍立得组图。',
    params: [R('cols', '列数', 2, 7, 4, 1), R('rows', '行数', 2, 10, 5, 1), R('pad', '白边', 2, 16, 6, 1), C('bg', '底色', '#f2f0ea'), R('jit', '错位', 0, 1, .4), D('drv', 'beat', ['beat', 'kick', 'snare', 'bar'])],
    state: { j: null, key: '', last: 0 },
    draw(f, p, t) { const s = this.state, C = Math.round(p.cols), Rw = Math.round(p.rows), n = C * Rw, key = C + 'x' + Rw;
      if (s.key !== key) { s.key = key; s.j = Array.from({ length: n }, () => ({ r: 0, x: 0, y: 0 })); }
      if (f[p.drv] > .5 && t - s.last > .1) { s.last = t; for (let i = 0; i < 3; i++) { const c = s.j[Math.floor(rnd(n))]; c.r = rnd(-.09, .09); c.x = rnd(-9, 9); c.y = rnd(-9, 9); } }
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const cw = W / C, ch = H / Rw;
      for (let i = 0; i < n; i++) { const c = s.j[i], cx = (i % C) * cw, cy = ((i / C) | 0) * ch;
        ctx.save(); ctx.translate(cx + cw / 2 + c.x * p.jit, cy + ch / 2 + c.y * p.jit); ctx.rotate(c.r * p.jit);
        ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
        ctx.fillRect(-cw / 2 + 2, -ch / 2 + 2, cw - 4, ch - 4); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.drawImage(src, cx, cy, cw, ch, -cw / 2 + p.pad, -ch / 2 + p.pad, cw - p.pad * 2, ch - p.pad * 2);
        ctx.restore(); }
      dropFlash(f, p); } },

  shape: { name: '形状蒙版', icon: '❍', desc: '画面裁进形状里', hint: '画面被裁进一个形状（水滴 / 心 / 星 / 圆 / 拱门），背景是同一张图的放大虚化版，形状随鼓点呼吸、随小节切换。',
    params: [Sel('kind', '形状', ['水滴', '心形', '星形', '圆形', '拱门', '随拍切换'], '水滴'), R('scale', '大小', .3, 1, .68), R('pulse', '鼓点呼吸', 0, 1, .4), R('bg', '背景虚化', 0, 1, .6), R('ring', '描边', 0, 1, .4), C('col', '描边色', '#ffffff'), D('drv', 'kick')],
    state: { k: 0, last: 0 },
    path(ctx, kind, cx, cy, r) {
      ctx.beginPath();
      if (kind === '水滴') { ctx.moveTo(cx, cy - r * 1.25); ctx.bezierCurveTo(cx + r * .95, cy - r * .2, cx + r * .82, cy + r * .85, cx, cy + r * .95); ctx.bezierCurveTo(cx - r * .82, cy + r * .85, cx - r * .95, cy - r * .2, cx, cy - r * 1.25); }
      else if (kind === '心形') { ctx.moveTo(cx, cy + r * .85); ctx.bezierCurveTo(cx - r * 1.5, cy - r * .2, cx - r * .55, cy - r * 1.15, cx, cy - r * .42); ctx.bezierCurveTo(cx + r * .55, cy - r * 1.15, cx + r * 1.5, cy - r * .2, cx, cy + r * .85); }
      else if (kind === '星形') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .46 : r * 1.12; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }
      else if (kind === '拱门') { ctx.moveTo(cx - r * .72, cy + r * 1.1); ctx.lineTo(cx - r * .72, cy - r * .1); ctx.arc(cx, cy - r * .1, r * .72, Math.PI, 0); ctx.lineTo(cx + r * .72, cy + r * 1.1); ctx.closePath(); }
      else ctx.arc(cx, cy, r, 0, 7);
    },
    draw(f, p, t) { const s = this.state;
      const kinds = ['水滴', '心形', '星形', '圆形', '拱门'];
      if (p.kind === '随拍切换' && f.bar > .5 && t - s.last > .4) { s.last = t; s.k = (s.k + 1) % kinds.length; }
      const kind = p.kind === '随拍切换' ? kinds[s.k] : p.kind;
      const z = 1.35 + p.bg * .5;
      ctx.save(); ctx.filter = `blur(${p.bg * 12}px) brightness(${1 - p.bg * .35})`;
      ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); ctx.drawImage(src, 0, 0); ctx.restore(); ctx.filter = 'none';
      const r = H * .3 * p.scale * (1 + f[p.drv] * p.pulse * .18 + f.dropHold * .1), cx = W / 2, cy = H * .46;
      ctx.save(); this.path(ctx, kind, cx, cy, r); ctx.clip(); ctx.drawImage(src, 0, 0); ctx.restore();
      if (p.ring > 0) { ctx.save(); this.path(ctx, kind, cx, cy, r); ctx.strokeStyle = p.col; ctx.globalAlpha = p.ring * (.6 + f[p.drv] * .4);
        ctx.lineWidth = 2 + p.ring * 4; ctx.shadowColor = p.col; ctx.shadowBlur = 16 * p.ring; ctx.stroke(); ctx.restore(); }
      dropFlash(f, p); } },

  vinyl: { name: '唱片旋转', icon: '◉', desc: '画面裁成唱片随 BPM 转', hint: '画面裁成圆形唱片，按真实 BPM 匀速旋转（每小节一圈），外圈有刻度环和播放进度环，鼓点时轻微跳针。',
    params: [R('size', '唱片大小', .3, .95, .62), R('rings', '纹路', 0, 1, .55), R('bgdark', '背景压暗', 0, 1, .55), R('jump', '跳针', 0, 1, .35), C('col', '环色', '#4ad4f0'), D('drv', 'kick')],
    state: { a: 0 },
    draw(f, p, t) { const s = this.state; const bpm = f.bpm || 120; s.a += (Math.PI * 2) / (240 / bpm) / 60;
      ctx.save(); ctx.filter = 'blur(14px) brightness(.5)'; ctx.translate(W / 2, H / 2); ctx.scale(1.5, 1.5); ctx.translate(-W / 2, -H / 2); ctx.drawImage(src, 0, 0); ctx.restore(); ctx.filter = 'none';
      ctx.fillStyle = `rgba(6,6,10,${p.bgdark})`; ctx.fillRect(0, 0, W, H);
      const r = H * .34 * p.size * (1 + f.kick * .03), cx = W / 2, cy = H * .46 + (Math.random() - .5) * f[p.drv] * p.jump * 8;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.a); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
      ctx.drawImage(src, -W / 2, -H / 2); ctx.restore();
      ctx.save(); ctx.translate(cx, cy);
      if (p.rings > 0) { ctx.globalAlpha = p.rings * .3; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        for (let rr = r * .3; rr < r; rr += 5) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1; }
      ctx.fillStyle = '#0a0a0c'; ctx.beginPath(); ctx.arc(0, 0, r * .16, 0, 7); ctx.fill();
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(0, 0, r * .045, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, 7); ctx.stroke();
      const prog = S.buffer ? (f.t / S.buffer.duration) : 0;
      ctx.strokeStyle = p.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
      ctx.restore(); dropFlash(f, p); } },
  confetti: { name: '碎片飘落', icon: '❖', desc: '小方块随鼓点洒落', hint: '参考截图那种「生活碎片」：白色或取自画面的小方块从上方飘落并翻转，Kick 时爆发一批，能量越高落得越密。',
    params: [R('rate', '密度', 0, 1, .5), R('size', '大小', 6, 46, 20, 1), R('speed', '下落速度', .2, 2, 1), R('sway', '摆动', 0, 1, .5), R('photo', '用画面填充', 0, 1, 0), C('col', '颜色', '#ffffff'), D('drv', 'kick')],
    state: { ps: [], last: 0 },
    draw(f, p, t) { const s = this.state; ctx.drawImage(src, 0, 0);
      const add = n => { for (let i = 0; i < n; i++) s.ps.push({ x: rnd(W), y: -30, vy: rnd(.6, 1.8), r: rnd(0, 7), vr: rnd(-.05, .05), ph: rnd(0, 7), sz: p.size * rnd(.6, 1.4), sx: rnd(W - 60), sy: rnd(H - 60) }); };
      if (Math.random() < p.rate * .55) add(1);
      if (f[p.drv] > .5 && t - s.last > .12) { s.last = t; add(Math.round(4 + p.rate * 14)); }
      for (const q of s.ps) { q.y += q.vy * p.speed * (2.2 + f.energy * 3); q.r += q.vr; q.ph += .05;
        q.x += Math.sin(q.ph) * p.sway * 1.6;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.scale(Math.cos(q.ph * .7) * .5 + .8, 1);
        if (p.photo > .5) ctx.drawImage(src, q.sx, q.sy, q.sz * 2, q.sz * 2, -q.sz / 2, -q.sz / 2, q.sz, q.sz);
        else { ctx.fillStyle = p.col; ctx.globalAlpha = .88; ctx.fillRect(-q.sz / 2, -q.sz / 2, q.sz, q.sz); }
        ctx.restore(); }
      ctx.globalAlpha = 1; s.ps = s.ps.filter(q => q.y < H + 60); if (s.ps.length > 260) s.ps.splice(0, s.ps.length - 260);
      dropFlash(f, p); } },

  bubbles: { name: '彩虹气泡', icon: '○', desc: '气泡上浮 · 鼓点生成', hint: '参考夏日气泡玩法：带彩虹边的气泡从下往上飘，Kick 时成批生成，Drop 时集体涨大爆开。',
    params: [R('rate', '密度', 0, 1, .5), R('size', '大小', 10, 90, 38, 1), R('speed', '上浮速度', .2, 2, .8), R('rain', '彩虹强度', 0, 1, .7), D('drv', 'kick')],
    state: { bs: [], last: 0 },
    draw(f, p, t) { const s = this.state; ctx.drawImage(src, 0, 0);
      const add = n => { for (let i = 0; i < n; i++) s.bs.push({ x: rnd(W), y: H + 40, r: p.size * rnd(.4, 1.3), vy: rnd(.5, 1.6), ph: rnd(0, 7), hue: rnd(0, 360) }); };
      if (Math.random() < p.rate * .4) add(1);
      if (f[p.drv] > .5 && t - s.last > .14) { s.last = t; add(Math.round(2 + p.rate * 7)); }
      for (const b of s.bs) { b.y -= b.vy * p.speed * (1.6 + f.energy * 2.4); b.ph += .04; b.x += Math.sin(b.ph) * 1.1;
        const rr = b.r * (1 + f.dropHold * .6);
        const g = ctx.createRadialGradient(b.x - rr * .3, b.y - rr * .3, rr * .1, b.x, b.y, rr);
        g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.75, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,255,255,.14)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, 7); ctx.fill();
        ctx.lineWidth = 2 + p.rain * 2;
        for (let k = 0; k < 4; k++) { ctx.strokeStyle = `hsla(${(b.hue + k * 70 + t * 40) % 360},95%,68%,${p.rain * .55})`;
          ctx.beginPath(); ctx.arc(b.x, b.y, rr, k * 1.6 + b.ph * .4, k * 1.6 + b.ph * .4 + 1.1); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(b.x - rr * .35, b.y - rr * .38, rr * .13, 0, 7); ctx.fill(); }
      s.bs = s.bs.filter(b => b.y > -80); if (s.bs.length > 90) s.bs.splice(0, s.bs.length - 90);
      dropFlash(f, p); } },

  staff: { name: '五线谱', icon: '♫', desc: '波浪线随频谱起伏', hint: '参考音乐贴纸玩法：几条五线谱式的波浪线横穿画面，波形由实时频谱驱动，音符沿线漂浮。',
    params: [R('lines', '线数', 3, 7, 5, 1), R('amp', '起伏', 0, 1, .5), R('speed', '流动', 0, 1, .5), R('notes', '音符', 0, 1, .6), C('col', '颜色', '#ffffff'), R('y', '位置', .1, .9, .55), D('drv', 'energy', ['energy', 'bass', 'mid', 'high'])],
    state: { ph: 0, ns: [] },
    draw(f, p, t) { const s = this.state; s.ph += .01 + p.speed * .05;
      ctx.drawImage(src, 0, 0);
      const n = Math.round(p.lines), y0 = H * p.y, gap = 13, A = p.amp * 70 * (.3 + f[p.drv]);
      ctx.save(); ctx.strokeStyle = p.col; ctx.lineWidth = 1.6; ctx.globalAlpha = .8;
      for (let l = 0; l < n; l++) { ctx.beginPath();
        for (let x = 0; x <= W; x += 8) { const y = y0 + (l - (n - 1) / 2) * gap + Math.sin(x * .008 + s.ph + l * .25) * A * (1 - Math.abs(l - (n - 1) / 2) / n * .4);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      ctx.restore();
      if (p.notes > 0) { if (Math.random() < p.notes * .25) s.ns.push({ x: W + 20, y: y0 + rnd(-60, 60), vy: rnd(-.4, .4), ph: rnd(0, 7), c: '♪♫♩♬'[Math.floor(rnd(4))] });
        ctx.save(); ctx.fillStyle = p.col; ctx.font = '600 24px Manrope'; ctx.globalAlpha = .9;
        for (const q of s.ns) { q.x -= 1.6 + f.energy * 4; q.ph += .05; ctx.fillText(q.c, q.x, q.y + Math.sin(q.ph) * 10); }
        ctx.restore(); s.ns = s.ns.filter(q => q.x > -30); }
      dropFlash(f, p); } },

  arctext: { name: '曲线文字', icon: '↝', desc: '文字沿弧线放射', hint: '参考手写贴纸玩法：几条弧线从一点放射出去，文字沿弧线排布，节拍时整体流动、逐条点亮。',
    params: [T('text', '文案', 'so many people are also waiting for a spring and love spring / one thousand beautiful springs / life is coming the green'), R('lines', '线条数', 2, 8, 4, 1), R('size', '字号', .4, 1.6, .72), R('spread', '张开角度', .2, 1.6, .8), R('flow', '流动', 0, 1, .5), C('col', '颜色', '#ffffff'), R('ox', '起点 X', 0, 1, .62), R('oy', '起点 Y', 0, 1, .2), D('drv', 'beat', ['beat', 'kick', 'hat', 'energy'])],
    state: { ph: 0, lit: 0, last: 0 },
    draw(f, p, t) { const s = this.state; s.ph += .002 + p.flow * .02 * (.3 + f.energy);
      if (f[p.drv] > .55 && t - s.last > .12) { s.last = t; s.lit = (s.lit + 1) % Math.round(p.lines); }
      ctx.drawImage(src, 0, 0);
      const txt = (p.text || '').replace(/\s+/g, ' ').trim() || 'music';
      const n = Math.round(p.lines), ox = W * p.ox, oy = H * p.oy, fs = 17 * p.size;
      ctx.save(); ctx.textBaseline = 'middle'; ctx.font = `500 ${fs}px Manrope, "PingFang SC", sans-serif`;
      for (let l = 0; l < n; l++) {
        const a0 = Math.PI * .28 + (l / Math.max(1, n - 1) - .5) * p.spread + Math.sin(s.ph + l) * .05;
        const curve = .0016 + l * .0004;
        const lit = l === s.lit;
        ctx.globalAlpha = lit ? .95 : .5;
        let d = 20 + (s.ph * 60 + l * 37) % 26;
        for (let i = 0; i < txt.length; i++) { const chw = ctx.measureText(txt[i]).width;
          const ang = a0 + d * curve, x = ox + Math.cos(ang) * d, y = oy + Math.sin(ang) * d;
          if (x < -40 || x > W + 40 || y > H + 40) { d += chw + 1; continue; }
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2 - Math.PI / 2);
          ctx.fillStyle = p.col; ctx.fillText(txt[i], 0, 0); ctx.restore();
          d += chw + 1; if (d > Math.hypot(W, H)) break; } }
      ctx.restore(); ctx.globalAlpha = 1; dropFlash(f, p); } },

  wordfall: { name: '逐字歌词', icon: '⌁', desc: '单字散落再汇聚', hint: '参考歌词玩法：一个字一个字随节拍出现，先在画面里随机漂浮，再慢慢落到底部汇聚成整句。',
    params: [T('text', '文案', '没有牢笼的风 原野迎着马群奔跑 毛发被吹得翻卷'), R('size', '字号', .5, 2.2, 1.25), R('spread', '散落范围', 0, 1, .7), R('gather', '汇聚速度', 0, 1, .45), C('col', '颜色', '#ffffff'), R('hold', '整句停留', 1, 10, 5), D('drv', 'beat', ['beat', 'kick', 'snare', 'hat'])],
    state: { chars: [], key: '', i: 0, last: 0, done: 0 },
    draw(f, p, t) { const s = this.state; const txt = (p.text || '').replace(/\s+/g, '');
      if (s.key !== txt) { s.key = txt; s.chars = [...txt].map((c, i) => ({ c, x: rnd(W * .1, W * .9), y: rnd(H * .1, H * .8), born: -99 })); s.i = 0; s.done = 0; }
      if (f[p.drv] > .5 && t - s.last > .1) { s.last = t;
        if (s.i < s.chars.length) { s.chars[s.i].born = t; s.chars[s.i].x = W / 2 + rnd(-1, 1) * W * .45 * p.spread; s.chars[s.i].y = H * .5 + rnd(-1, 1) * H * .38 * p.spread; s.i++; if (s.i === s.chars.length) s.done = t; }
        else if (t - s.done > p.hold) { s.chars.forEach(c => c.born = -99); s.i = 0; } }
      ctx.drawImage(src, 0, 0);
      const fs = 26 * p.size, total = s.chars.length, lineY = H * .82, lineW = Math.min(W - 40, total * fs * .92), x0 = (W - lineW) / 2;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${fs}px Manrope, "PingFang SC", sans-serif`;
      for (let i = 0; i < total; i++) { const c = s.chars[i]; if (c.born < -1) continue;
        const age = t - c.born, gk = clamp((age - .35) * p.gather * 1.4, 0, 1), e = 1 - Math.pow(1 - gk, 3);
        const tx = x0 + (i + .5) * (lineW / total), ty = lineY;
        const x = lerp(c.x, tx, e), y = lerp(c.y, ty, e) + Math.sin(t * 2 + i) * (1 - e) * 6;
        ctx.globalAlpha = clamp(age * 3, 0, 1) * (0.7 + 0.3 * e);
        ctx.font = `600 ${fs * (1 + (1 - e) * .25)}px Manrope, "PingFang SC", sans-serif`;
        ctx.lineWidth = fs * .12; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeText(c.c, x, y);
        ctx.fillStyle = p.col; ctx.fillText(c.c, x, y); }
      ctx.restore(); ctx.globalAlpha = 1; dropFlash(f, p); } },

};
