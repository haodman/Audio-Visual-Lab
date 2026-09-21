/* =====================================================================
   Music × AI 节奏可视化 · Demo Lab
   Pipeline:  audio buffer → offline analysis (BPM / beat grid / sections / drops)
              → live analyser (kick / snare / hat / energy / bands)
              → feature vector per frame → programmatic visual effects on canvas
   ===================================================================== */
'use strict';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const W = 540, H = 960;

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }

/* =====================================================================
   1. SOURCE (photo / video)
   ===================================================================== */
const src = document.createElement('canvas'); src.width = W; src.height = H;
const sctx = src.getContext('2d');
const cv = $('#cv'), ctx = cv.getContext('2d');
const peek = $('#peek'), pctx = peek.getContext('2d');
const S = {
  media: null, isVideo: false, cache: {}, photoIdx: 0,
  fx: 'glitch', params: {}, playing: false, t0: 0, track: null, lyrics: [], buffer: null, analysis: null,
  lastSection: null, dropHold: 0, dropImpulse: 0,
};

function coverDraw(c, img, iw, ih) {
  const ratio = iw / ih;
  if (ratio > .82) { const bg = Math.max(W / iw, H / ih), bw = iw * bg, bh = ih * bg; c.save(); c.filter = 'blur(28px) brightness(.58) saturate(.82)'; c.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh); c.restore(); c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(0, 0, W, H); const fit = Math.min(W / iw, H / ih), fw = iw * fit, fh = ih * fit; c.drawImage(img, (W - fw) / 2, (H - fh) / 2, fw, fh); }
  else { const s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s; c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh); }
}
function setImage(img) {
  S.media = img; S.isVideo = false; S.cache = {}; S.srcKey = (S.srcKey || 0) + 1; S.segRequestedAt = performance.now();
  sctx.clearRect(0, 0, W, H); coverDraw(sctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height);
  $('#storyimg').src = img.src; drawPeek();
  // All still-image effects share the same MODNet matting capability. Each
  // framing stores its own output, but model/version/edge treatment are one.
  setSeg('MODNet 高清抠像 · 启动中…', 'working');
  setTimeout(() => refineSubjectHQ(S.fx === 'subjectSplit' ? 'split' : 'full'), 30);
}
function setVideo(url) {
  const v = document.createElement('video'); v.src = url; v.loop = true; v.muted = true; v.playsInline = true;
  v.addEventListener('loadeddata', () => { S.media = v; S.isVideo = true; S.cache = {}; S.srcKey = (S.srcKey || 0) + 1; S.lastVideoSeg = 0; S.lastVideoCache = 0; v.play();
    if (MP.state === 'idle') mpLoad(); else if (MP.state === 'ready') { setSeg('视频抠像启动中…'); setTimeout(refineSubject, 80); }
    else if (MP.state === 'loading') setSeg('视频抠像 · 加载模型…'); else setSeg('视频抠像 · 本地估算');
    toast('已载入视频，实时主体抠像中'); });
}
function refreshSource() {
  if (!S.isVideo || S.media.readyState < 2) return;
  coverDraw(sctx, S.media, S.media.videoWidth, S.media.videoHeight);
  const now = performance.now();
  // Keep the latest segmentation visible between inference frames. Expensive
  // photo-derived caches are invalidated at a low rate, while the canvas still
  // renders at the display refresh rate.
  if (!S.lastVideoCache || now - S.lastVideoCache > 220) {
    const subj = S.cache.subj, subjAI = S.cache.subjAI;
    S.cache = subj ? { subj, subjAI } : {};
    S.lastVideoCache = now;
  }
  if (MP.state === 'ready' && !S.segBusy && (!S.lastVideoSeg || now - S.lastVideoSeg > 180)) {
    S.lastVideoSeg = now; refineSubject();
  }
}
function drawPeek() { pctx.drawImage(src, 0, 0, peek.width, peek.height); }

// 9:8 source used by the twin split template. It is rendered directly from
// the uploaded media (not from the 9:16 preview), so 3:4 and landscape inputs
// genuinely cover each half without inheriting preview letterboxing/cropping.
function splitFrame() {
  const key = 'splitFrame'; let c = S.cache[key];
  if (!c) { c = document.createElement('canvas'); c.width = W; c.height = H / 2; S.cache[key] = c; }
  if (!S.media) return c;
  if (!S.isVideo && c._ready) return c;
  const iw = S.isVideo ? S.media.videoWidth : (S.media.naturalWidth || S.media.width), ih = S.isVideo ? S.media.videoHeight : (S.media.naturalHeight || S.media.height);
  if (!iw || !ih) return c;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  const scale = Math.max(c.width / iw, c.height / ih), sw = c.width / scale, sh = c.height / scale;
  g.drawImage(S.media, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, c.width, c.height); c._ready = true;
  return c;
}

/* ---------- caches derived from the photo ---------- */
function lumGrid(pitch) {
  const key = 'lum' + pitch; if (S.cache[key]) return S.cache[key];
  const cols = Math.ceil(W / pitch), rows = Math.ceil(H / pitch);
  const tmp = document.createElement('canvas'); tmp.width = cols; tmp.height = rows;
  const tc = tmp.getContext('2d'); tc.drawImage(src, 0, 0, cols, rows);
  const d = tc.getImageData(0, 0, cols, rows).data, g = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) g[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255;
  const sorted = Array.from(g).sort((a, b) => a - b), hi = sorted[Math.floor(sorted.length * 0.92)] || 1;
  return S.cache[key] = { cols, rows, g, pitch, hi };
}
function edgeMap() {
  if (S.cache.edge) return S.cache.edge;
  const w = 270, h = 480, tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const tc = tmp.getContext('2d'); tc.drawImage(src, 0, 0, w, h);
  const d = tc.getImageData(0, 0, w, h).data, gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11);
  const out = tc.createImageData(w, h), o = out.data;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
    const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
    const m = clamp(Math.sqrt(gx * gx + gy * gy) / 1.6, 0, 255);
    o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = 255; o[i * 4 + 3] = m;
  }
  tc.putImageData(out, 0, 0);
  return S.cache.edge = tmp;
}
function halftonePattern() {
  if (S.cache.ht) return S.cache.ht;
  const c = document.createElement('canvas'); c.width = c.height = 8; const t = c.getContext('2d');
  t.fillStyle = 'rgba(0,0,0,.55)'; t.beginPath(); t.arc(4, 4, 2.1, 0, 7); t.fill();
  return S.cache.ht = ctx.createPattern(c, 'repeat');
}

function channel(col) {
  const key = 'ch' + col; if (S.cache[key]) return S.cache[key];
  const c = document.createElement('canvas'); c.width = W; c.height = H; const t = c.getContext('2d', { willReadFrequently: true });
  t.drawImage(src, 0, 0); const im = t.getImageData(0, 0, W, H), d = im.data, keep = col === '#ff0000' ? 0 : col === '#00ff00' ? 1 : 2;
  for (let i = 0; i < d.length; i += 4) { if (keep !== 0) d[i] = 0; if (keep !== 1) d[i + 1] = 0; if (keep !== 2) d[i + 2] = 0; }
  t.putImageData(im, 0, 0);
  return S.cache[key] = c;
}
function rgbSplit(c, off, dy = 0) {
  c.save(); c.globalCompositeOperation = 'source-over'; c.drawImage(channel('#00ff00'), 0, 0);
  c.globalCompositeOperation = 'lighter'; c.drawImage(channel('#ff0000'), -off, dy); c.drawImage(channel('#0000ff'), off, -dy);
  c.restore();
}
/* ---------- AI subject segmentation (MediaPipe, with heuristic fallback) ---------- */
const MPURL = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/';
const MP = { state: 'idle', seg: null, pending: null, queued: false, videoFrames: 0, videoUIAt: 0 };
const HQ = { state: 'idle', model: null, processor: null, mod: null, busy: false, queuedMode: null };
function setSeg(t, state) { const e = $('#segState'); if (!e) return; e.textContent = t; e.dataset.state = state || (/✓|fps/.test(t) ? 'ok' : /估算|失败/.test(t) ? 'fallback' : /加载|识别|启动|排队/.test(t) ? 'working' : 'idle'); }

async function refineSubjectHQ(mode = S.fx === 'subjectSplit' ? 'split' : 'full') {
  if (S.isVideo) return refineSubject();
  const cacheKey = mode === 'split' ? 'splitSub' : 'subj';
  if (S.cache[cacheKey] && (mode !== 'full' || S.cache.subjHQ)) return;
  if (HQ.busy) { HQ.queuedMode = mode; setSeg('高清抠像 · 排队中…', 'working'); return; }
  HQ.busy = true; HQ.queuedMode = null; const key = S.srcKey, started = performance.now();
  try {
    if (!HQ.model) {
      HQ.state = 'loading'; setSeg('高清模型下载 · 首次约 10–40s', 'working');
      HQ.mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm');
      const { env, AutoModel, AutoProcessor } = HQ.mod; env.backends.onnx.wasm.proxy = false;
      const progress_callback = p => { if (p?.status === 'progress' && p.total) setSeg(`高清模型下载 · ${Math.round(p.loaded / p.total * 100)}%`, 'working'); };
      const opts = navigator.gpu ? { device: 'webgpu', progress_callback } : { progress_callback };
      HQ.model = await AutoModel.from_pretrained('Xenova/modnet', opts);
      HQ.processor = await AutoProcessor.from_pretrained('Xenova/modnet', { progress_callback }); HQ.state = 'ready';
    }
    setSeg('MODNet 高清抠像 · 处理中…', 'working');
    const frame = mode === 'split' ? splitFrame() : src, url = frame.toDataURL('image/jpeg', .96), img = await HQ.mod.RawImage.fromURL(url), inputs = await HQ.processor(img), result = await HQ.model({ input: inputs.pixel_values });
    const mask = await HQ.mod.RawImage.fromTensor(result.output[0].mul(255).to('uint8')).resize(frame.width, frame.height), md = mask.data;
    if (key !== S.srcKey) return;
    const c = document.createElement('canvas'); c.width = frame.width; c.height = frame.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(frame, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < md.length; i++) { let a = clamp((md[i] / 255 - .025) / .95, 0, 1); a = a * a * (3 - 2 * a); px.data[i * 4 + 3] = Math.round(a * 255); } g.putImageData(px, 0, 0);
    if (mode === 'split') { S.cache.splitSub = c; S.cache.splitHQ = true; delete S.cache.splitBounds; }
    else { S.cache.subj = c; S.cache.subjHQ = true; S.cache.subjAI = true; delete S.cache.cont; delete S.cache.subjBounds; }
    setSeg(`MODNet 高清抠像 · ${((performance.now() - started) / 1000).toFixed(1)}s ✓`, 'ok');
  } catch (e) {
    console.warn('HQ matting failed', e); HQ.state = 'fail'; setSeg('高清模型失败 · 切换实时抠像', 'fallback'); setTimeout(refineSubject, 20);
  } finally { HQ.busy = false; const next = HQ.queuedMode; HQ.queuedMode = null; if (next) setTimeout(() => refineSubjectHQ(next), 0); }
}
function mpLoad() {
  if (MP.state !== 'idle') return; MP.state = 'loading'; setSeg('加载模型 · 预计 3–8s', 'working');
  const el = document.createElement('script'); el.src = MPURL + 'selfie_segmentation.js'; el.crossOrigin = 'anonymous';
  el.onload = () => { try {
      const seg = new SelfieSegmentation({ locateFile: f => MPURL + f });
      seg.setOptions({ modelSelection: 0 });
      seg.onResults(r => { const p = MP.pending; MP.pending = null; if (p) p(r.segmentationMask); });
      MP.seg = seg; MP.state = 'ready';
      // MediaPipe is the real-time video path only. Never let its softer
      // portrait mask overwrite a finished MODNet still-image matte.
      if (S.isVideo) { setSeg('视频主体识别中…', 'working'); refineSubject(); }
    } catch (e) { MP.state = 'fail'; setSeg('本地估算 · 点击重试', 'fallback'); } };
  el.onerror = () => { MP.state = 'fail'; setSeg('本地估算 · 点击重试', 'fallback'); };
  document.head.appendChild(el);
  setTimeout(() => { if (MP.state === 'loading') { MP.state = 'fail'; setSeg('本地估算 · 点击重试', 'fallback'); } }, 12000);
}
async function refineSubject() {
  if (MP.state !== 'ready') return;
  if (S.segBusy) { MP.queued = true; setSeg(S.isVideo ? '视频抠像 · 排队中…' : 'AI 抠像 · 排队中…'); return; }
  MP.queued = false; setSeg(S.isVideo ? '视频主体识别中…' : '识别主体 · 预计 <1s', 'working');
  S.segBusy = true; const key = S.srcKey, splitMode = S.fx === 'subjectSplit', input = splitMode ? splitFrame() : src, tw = input.width, th = input.height;
  try {
    const mask = await new Promise((res, rej) => { MP.pending = res; setTimeout(() => { if (MP.pending === res) { MP.pending = null; rej(0); } }, 8000); MP.seg.send({ image: input }).catch(rej); });
    if (key === S.srcKey && mask) {
      const m = document.createElement('canvas'); m.width = tw; m.height = th; const mg = m.getContext('2d');
      mg.drawImage(mask, 0, 0, tw, th);
      // MediaPipe's mask is an opaque grayscale image. destination-in reads
      // alpha, not luminance, so using it directly would keep the entire photo.
      // Convert confidence luminance into a clean alpha matte. The old very
      // low threshold retained background islands and produced rough edges.
      const mi = mg.getImageData(0, 0, W, H), md = mi.data;
      for (let i = 0; i < md.length; i += 4) { const v = (md[i] * .3 + md[i + 1] * .59 + md[i + 2] * .11) / 255;
        let a = clamp((v - .12) / .28, 0, 1); a = a * a * (3 - 2 * a); a = a > .48 ? 1 : Math.pow(a / .48, 1.65) * .72;
        md[i] = md[i + 1] = md[i + 2] = 255; md[i + 3] = a * 255; }
      mg.putImageData(mi, 0, 0); const feather = document.createElement('canvas'); feather.width = tw; feather.height = th; const fg = feather.getContext('2d'); fg.filter = 'blur(1.35px)'; fg.drawImage(m, 0, 0); fg.filter = 'none';
      const c = document.createElement('canvas'); c.width = tw; c.height = th; const g = c.getContext('2d');
      g.drawImage(input, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(feather, 0, 0);
      if (splitMode) { S.cache.splitSub = c; delete S.cache.splitBounds; }
      else { S.cache.subj = c; S.cache.subjAI = true; delete S.cache.cont; delete S.cache.subjBounds; }
      if (S.isVideo) { MP.videoFrames++; const now = performance.now(); if (!MP.videoUIAt || now - MP.videoUIAt > 1000) { const fps = MP.videoUIAt ? Math.max(1, Math.round(MP.videoFrames * 1000 / (now - MP.videoUIAt))) : 5; setSeg(`视频抠像 · ${fps}fps ✓`); MP.videoFrames = 0; MP.videoUIAt = now; } }
      else { const took = Math.max(.1, (performance.now() - (S.segRequestedAt || performance.now())) / 1000); setSeg(`AI 抠像 · ${took.toFixed(1)}s ✓`); }
    }
  } catch (e) { setSeg('本地估算 · 点击重试', 'fallback'); } finally { S.segBusy = false; if (MP.queued && MP.state === 'ready') setTimeout(refineSubject, 0); }
}

function imagePalette() {
  if (S.cache.palette) return S.cache.palette;
  const c = document.createElement('canvas'); c.width = 18; c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data; let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx < 28 || mx > 242 || mx - mn < 8) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  if (!n) { r = 150; gg = 168; b = 158; n = 1; }
  const base = [r / n, gg / n, b / n], lift = x => Math.round(lerp(x, 246, .55)), deep = x => Math.round(lerp(x, 25, .58));
  return S.cache.palette = { soft: `rgb(${lift(base[0])},${lift(base[1])},${lift(base[2])})`, deep: `rgb(${deep(base[0])},${deep(base[1])},${deep(base[2])})` };
}

function splitAccent() {
  if (S.cache.splitAccent) return S.cache.splitAccent;
  const c = document.createElement('canvas'); c.width = 20; c.height = 12; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(splitFrame(), 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data; let hx = 0, hy = 0, satSum = 0, lightSum = 0, weightSum = 0;
  for (let i = 0; i < d.length; i += 4) { const rr = d[i] / 255, gr = d[i + 1] / 255, br = d[i + 2] / 255, mx = Math.max(rr, gr, br), mn = Math.min(rr, gr, br), df = mx - mn, l = (mx + mn) / 2; if (mx < .12 || mx > .97 || df < .035) continue; const sat = df / Math.max(.001, 1 - Math.abs(2 * l - 1)); let h = mx === rr ? ((gr - br) / df) % 6 : mx === gr ? (br - rr) / df + 2 : (rr - gr) / df + 4; h = (h * 60 + 360) % 360; const w = (.25 + sat) * (.35 + l); hx += Math.cos(h * Math.PI / 180) * w; hy += Math.sin(h * Math.PI / 180) * w; satSum += sat * w; lightSum += l * w; weightSum += w; }
  const h = weightSum ? (Math.atan2(hy, hx) * 180 / Math.PI + 360) % 360 : 145, sourceSat = weightSum ? satSum / weightSum : .32, sourceLight = weightSum ? lightSum / weightSum : .58, sat = clamp(sourceSat * 1.42 + .08, .3, .68), light = clamp(sourceLight * .72 + .2, .54, .74);
  const hslToHex = (hh, ss, ll) => { const a = ss * Math.min(ll, 1 - ll), fn = n => { const k = (n + hh / 30) % 12, col = ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * col).toString(16).padStart(2, '0'); }; return '#' + fn(0) + fn(8) + fn(4); };
  return S.cache.splitAccent = hslToHex(h, sat, light);
}

function subject() {
  if (S.cache.subj) return S.cache.subj;
  const w = 108, h = 192, N = w * h;
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const tc = tmp.getContext('2d', { willReadFrequently: true }); tc.drawImage(src, 0, 0, w, h);
  const d = tc.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) gray[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
  // gradient magnitude (edges act as walls for the flood)
  const grad = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x;
    grad[i] = Math.abs(gray[i - 1] - gray[i + 1]) + Math.abs(gray[i - w] - gray[i + w]); }
  // flood background inward from the top and the two sides (subjects usually touch the bottom)
  const bg = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  const push = i => { if (!bg[i]) { bg[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < w; x++) push(x);
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  const TOL = 30, WALL = 54;
  while (qh < qt) { const i = q[qh++], x = i % w, y = (i / w) | 0, i4 = i * 4;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) { if (j < 0 || bg[j]) continue;
      const j4 = j * 4, dc = Math.abs(d[i4] - d[j4]) + Math.abs(d[i4 + 1] - d[j4 + 1]) + Math.abs(d[i4 + 2] - d[j4 + 2]);
      if (dc < TOL && grad[j] < WALL) push(j); } }
  let area = 0; for (let i = 0; i < N; i++) if (!bg[i]) area++;
  const useFlood = area > N * 0.08 && area < N * 0.86;
  const sal = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x;
    const cb = Math.exp(-(((x / w - .5) / .46) ** 2 + ((y / h - .58) / .62) ** 2));
    sal[i] = useFlood ? (bg[i] ? 0 : clamp(0.25 + 0.95 * cb, 0, 1)) : clamp(cb * 1.35 - 0.25, 0, 1); }
  // close small holes + feather
  let cur = sal;
  for (let pass = 0; pass < 2; pass++) { const out = new Float32Array(N), rad = pass ? 3 : 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, c = 0;
      for (let j = Math.max(0, y - rad); j <= Math.min(h - 1, y + rad); j++) for (let i2 = Math.max(0, x - rad); i2 <= Math.min(w - 1, x + rad); i2++) { s += cur[j * w + i2]; c++; }
      out[y * w + x] = pass ? s / c : clamp((s / c) * 1.5, 0, 1); }
    cur = out; }
  const out = tc.createImageData(w, h), o = out.data;
  for (let i = 0; i < N; i++) { const v = clamp((cur[i] - 0.42) / 0.26, 0, 1); o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = 255; o[i * 4 + 3] = v * 255; }
  tc.putImageData(out, 0, 0);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'destination-in'; g.imageSmoothingQuality = 'high'; g.drawImage(tmp, 0, 0, W, H);
  return S.cache.subj = c;
}
function subjectBounds() { if (S.cache.subjBounds) return S.cache.subjBounds; const c = document.createElement('canvas'); c.width = 108; c.height = 192; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(subject(), 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 72) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } if (x1 <= x0 || y1 <= y0) return S.cache.subjBounds = { x0: W * .22, y0: H * .08, x1: W * .78, y1: H * .92 }; return S.cache.subjBounds = { x0: x0 / c.width * W, y0: y0 / c.height * H, x1: x1 / c.width * W, y1: y1 / c.height * H }; }
function splitSubjectBounds(sub) { if (S.cache.splitBounds) return S.cache.splitBounds; const w = 108, h = 96, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(sub, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 72) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } if (x1 <= x0 || y1 <= y0) return { x0: W * .2, y0: 12, x1: W * .8, y1: H / 2 - 12 }; return S.cache.splitBounds = { x0: x0 / w * W, y0: y0 / h * H / 2, x1: x1 / w * W, y1: y1 / h * H / 2 }; }
function edgeTint(col) {
  const key = 'et' + col; if (S.cache[key]) return S.cache[key];
  const e = edgeMap(), c = document.createElement('canvas'); c.width = e.width; c.height = e.height; const t = c.getContext('2d');
  t.drawImage(e, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = col; t.fillRect(0, 0, c.width, c.height);
  return S.cache[key] = c;
}


/* ---------- silhouette contour from the segmentation mask ---------- */
function contour() {
  if (S.cache.cont) return S.cache.cont;
  const sub = subject(), w = 108, h = 192;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(sub, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 120) { sx += x; sy += y; n++; }
  const N = 192, rad = new Float32Array(N);
  if (n < 300) { const cx = W / 2, cy = H * .46; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; rad[i] = Math.min(W * .3 / Math.max(.15, Math.abs(Math.cos(a))), H * .3 / Math.max(.15, Math.abs(Math.sin(a)))); } return S.cache.cont = { cx, cy, rad }; }
  const cx = sx / n * (W / w), cy = sy / n * (H / h), maxR = Math.hypot(W, H);
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a); let last = 30;
    for (let r = 16; r < maxR; r += 4) { const px = (cx + dx * r) / (W / w) | 0, py = (cy + dy * r) / (H / h) | 0;
      if (px < 0 || py < 0 || px >= w || py >= h) break;
      if (d[(py * w + px) * 4 + 3] > 110) last = r; }
    rad[i] = last; }
  const sm = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = -5; k <= 5; k++) s += rad[(i + k + N) % N]; sm[i] = s / 11; }
  return S.cache.cont = { cx, cy, rad: sm };
}
const radAt = (ct, a) => { const N = ct.rad.length, f = ((a / (Math.PI * 2) % 1) + 1) % 1 * N, i = f | 0, t = f - i;
  return lerp(ct.rad[i], ct.rad[(i + 1) % N], t); };

/* =====================================================================
   2. AUDIO — synthesized built-in tracks (rendered offline into buffers)
   ===================================================================== */
let AC = null;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noiseBuf = b;
}
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);

class Synth {
  constructor(ctx, master) { this.c = ctx; this.m = master; }
  env(g, t, a, d, peak = 1, s = 0, r = 0.05, hold = 0) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(s, 0.0001), t + a + d);
    if (hold) g.gain.setValueAtTime(Math.max(s, 0.0001), t + a + d + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + hold + r);
  }
  kick(t, v = 1, tone = 1) {
    const o = this.c.createOscillator(), g = this.c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(160 * tone, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    this.env(g, t, 0.002, 0.28 * tone, 1.1 * v, 0, 0.05); o.connect(g).connect(this.m); o.start(t); o.stop(t + 0.5);
    const n = this.c.createBufferSource(); n.buffer = noise(this.c); const ng = this.c.createGain(), f = this.c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2500; this.env(ng, t, 0.001, 0.02, 0.25 * v); n.connect(f).connect(ng).connect(this.m); n.start(t); n.stop(t + 0.1);
  }
  sub808(t, note, dur, v = 1) {
    const o = this.c.createOscillator(), g = this.c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(NOTE(note) * 3, t); o.frequency.exponentialRampToValueAtTime(NOTE(note), t + 0.06);
    this.env(g, t, 0.005, dur * 0.8, 0.9 * v, 0.001, 0.08); o.connect(g).connect(this.m); o.start(t); o.stop(t + dur + 0.2);
  }
  snare(t, v = 1, bright = 1) {
    const n = this.c.createBufferSource(); n.buffer = noise(this.c); const f = this.c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 * bright; f.Q.value = 0.8;
    const g = this.c.createGain(); this.env(g, t, 0.001, 0.16, 0.7 * v); n.connect(f).connect(g).connect(this.m); n.start(t); n.stop(t + 0.3);
    const o = this.c.createOscillator(), og = this.c.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.05);
    this.env(og, t, 0.001, 0.07, 0.5 * v); o.connect(og).connect(this.m); o.start(t); o.stop(t + 0.2);
  }
  clap(t, v = 1) { for (let i = 0; i < 3; i++) this.snare(t + i * 0.012, v * 0.6, 1.4); }
  hat(t, v = 1, open = false) {
    const n = this.c.createBufferSource(); n.buffer = noise(this.c); const f = this.c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.c.createGain(); this.env(g, t, 0.001, open ? 0.22 : 0.035, 0.3 * v); n.connect(f).connect(g).connect(this.m); n.start(t); n.stop(t + 0.4);
  }
  bass(t, note, dur, v = 1, type = 'sawtooth', cutoff = 420) {
    const o = this.c.createOscillator(), f = this.c.createBiquadFilter(), g = this.c.createGain(); o.type = type; o.frequency.value = NOTE(note);
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff * 2.2, t); f.frequency.exponentialRampToValueAtTime(cutoff, t + 0.12); f.Q.value = 3;
    this.env(g, t, 0.005, dur * 0.7, 0.42 * v, 0.001, 0.05); o.connect(f).connect(g).connect(this.m); o.start(t); o.stop(t + dur + 0.1);
  }
  chord(t, notes, dur, v = 1, cutoff = 1800, type = 'sawtooth') {
    const g = this.c.createGain(), f = this.c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    this.env(g, t, 0.01, dur * 0.9, 0.12 * v, 0.001, 0.08); f.connect(g).connect(this.m);
    notes.forEach(n => [-6, 6].forEach(det => { const o = this.c.createOscillator(); o.type = type; o.frequency.value = NOTE(n); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.2); }));
  }
  pluck(t, note, dur, v = 1) { this.chord(t, [note], dur, v * 2.2, 3200, 'triangle'); }
  riser(t, dur, v = 1) {
    const n = this.c.createBufferSource(); n.buffer = noise(this.c); n.loop = true; const f = this.c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = this.c.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.28 * v, t + dur); g.gain.setValueAtTime(0.0001, t + dur + 0.01);
    n.connect(f).connect(g).connect(this.m); n.start(t); n.stop(t + dur + 0.05);
  }
  cowbell(t, v = 1) { const g = this.c.createGain(), f = this.c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 820; f.Q.value = 2;
    this.env(g, t, 0.001, 0.09, 0.3 * v); f.connect(g).connect(this.m);
    [540, 800].forEach(fr => { const o = this.c.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 0.2); }); }
  gtr(t, notes, dur, v = 1) { const g = this.c.createGain(), f = this.c.createBiquadFilter(), sh = this.c.createWaveShaper();
    const cur = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cur[i] = Math.tanh(x * 4); } sh.curve = cur;
    f.type = 'lowpass'; f.frequency.value = 2600; this.env(g, t, 0.004, dur * 0.85, 0.16 * v, 0.001, 0.06);
    sh.connect(f).connect(g).connect(this.m);
    notes.forEach(n => [-8, 8].forEach(det => { const o = this.c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det; o.connect(sh); o.start(t); o.stop(t + dur + 0.1); })); }
  brush(t, v = 1) { const n = this.c.createBufferSource(); n.buffer = noise(this.c); const f = this.c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 0.6;
    const g = this.c.createGain(); this.env(g, t, 0.01, 0.13, 0.16 * v); n.connect(f).connect(g).connect(this.m); n.start(t); n.stop(t + 0.3); }
  piano(t, note, dur, v = 1) { const g = this.c.createGain(), f = this.c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    this.env(g, t, 0.004, dur * 0.7, 0.2 * v, 0.001, 0.25); f.connect(g).connect(this.m);
    [[1, 1], [2, .35], [3, .15]].forEach(([h, a]) => { const o = this.c.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(note) * h; const og = this.c.createGain(); og.gain.value = a; o.connect(og).connect(f); o.start(t); o.stop(t + dur + 0.3); }); }
  impact(t, v = 1) { this.kick(t, 1.3 * v, 1.6); const n = this.c.createBufferSource(); n.buffer = noise(this.c); const g = this.c.createGain(); this.env(g, t, 0.002, 0.9, 0.5 * v); n.connect(g).connect(this.m); n.start(t); n.stop(t + 1.2); }
}

/* --- pattern helpers: 16 steps per bar, 'x' hit, 'X' accent, '-' rest --- */
function seq(pat, bar, spb, fn) { for (let i = 0; i < 16; i++) { const ch = pat[i % pat.length]; if (ch !== '-') fn(bar * 4 * spb + i * spb / 4, ch === 'X' ? 1 : 0.7, i); } }

// Lightweight audition pack. These tracks are rendered only when selected, so
// expanding the library does not increase the initial HTML download or startup
// memory. Each preset has a distinct tempo, groove family and tonal palette.
const EXTRA_TRACK_SPECS = [
  ['ukg','Silver Steps','UK Garage',132,43,1,50], ['afro','Palm Radio','Afrobeats',108,46,2,45],
  ['jersey','Club Bounce','Jersey Club',138,42,3,41], ['hyper','Sugar Crash','Hyperpop',156,40,4,48],
  ['disco','Mirror Fever','Nu Disco',118,48,0,45], ['rnb','Velvet Room','Alt R&B',92,48,2,43],
  ['breaks','Concrete Bloom','Breakbeat',128,44,1,38], ['garage2','Night Bus','2-Step Garage',130,46,1,46],
  ['afrohouse','Coastal Heat','Afro House',122,48,0,43], ['jersey2','Flash Frame','Jersey Pop',144,42,3,45],
  ['electro','Chrome Signal','Electro',126,46,4,40], ['indie','Polaroid Summer','Indie Dance',116,48,0,47],
  ['jazzhop','Blue Window','Jazz-hop',88,48,2,41], ['futurebass','Glass Hearts','Future Bass',150,44,4,45],
  ['baile','Rua Neon','Baile Funk',130,43,3,40], ['amapiano','Soft Current','Amapiano',112,48,2,38],
  ['breakcore','Pixel Sprint','Breakcore',184,38,1,36], ['darkpop','After Midnight','Dark Pop',110,48,4,42],
  ['minimal','Soft Machinery','Minimal House',124,48,0,39], ['cinematic','Open Horizon','Cinematic Pulse',82,48,2,45]
];
const EXTRA_TRACKS = EXTRA_TRACK_SPECS.map(([id,name,genre,bpm,dur,mode,root]) => ({
  id:'extra-'+id,name,genre,bpm,dur,hint:'新增测试曲 · '+genre+' · '+bpm+' BPM',
  gen(s,spb){
    const kick=['X---X---X---X---','X-----x-X--x----','X---x-----X--x--','X--X--X-X--X--X-','X---x-X---X-x---'][mode];
    const snare=['----X-------X---','----X------xX---','------X-------X-','---X-------X----','----X-------X---'][mode];
    const hats=['--x---x---x---x-','x-xx-x-xx-xx-x-x','x-x---x-x-x---x-','xxxxxxxxxxxxxxxx','x-x-x-x-xxxxxxxx'][mode];
    const prog=[[root,root+3,root+7,root+10],[root-2,root+2,root+5,root+9],[root-4,root,root+3,root+7],[root-5,root-1,root+2,root+6]];
    const bars=Math.ceil(dur/(spb*4));
    for(let bar=0;bar<bars;bar++){
      const T=bar*4*spb,build=bar%16>=6&&bar%16<8,hot=bar%16>=8&&bar%16<15,ch=prog[bar%4],bn=ch[0]-12;
      if(!build) seq(kick,bar,spb,(t,v)=>s.kick(t,v*(hot?1:.66),mode===3?1.15:.92));
      seq(snare,bar,spb,(t,v)=>mode===0?s.clap(t,v*(hot?1:.58)):s.snare(t,v*(hot?1:.62),mode===4?1.45:1));
      seq(hats,bar,spb,(t,v,i)=>s.hat(t,v*(hot?.5:.28),mode===1&&i%4===3));
      if(mode===3){s.sub808(T,bn-5,spb*1.55,hot?1:.55);s.sub808(T+spb*2.5,bn+(bar%2?3:0)-5,spb*1.1,hot?.9:.45);}
      else if(mode===2){s.sub808(T,bn,spb*1.7,hot?.8:.45);if(hot)seq('------x-------x-',bar,spb,t=>s.cowbell(t,.42));}
      else {for(let i=0;i<(hot?8:4);i++)s.bass(T+i*spb*(hot?.5:1),bn+(i%4===3?7:0),spb*(hot?.38:.72),hot?.82:.48,mode===4?'square':mode===1?'triangle':'sawtooth',mode===0?520:360);}
      if(mode===2){s.chord(T,ch,spb*3.8,hot?.72:.48,hot?1800:900,'triangle');if(bar%2===0)s.piano(T+spb*1.5,ch[2]+12,spb*.8,.38);}
      else if(mode===4){for(let i=0;i<4;i++)s.pluck(T+i*spb,ch[(i+bar)%4]+12,spb*.55,hot?.34:.2);}
      else if(bar%2===0)s.chord(T,ch,spb*3.8,hot?.72:.42,hot?2300:950,mode===1?'triangle':'sawtooth');
      if(build){s.riser(T,spb*4,.72);seq('----x-x-xxxxxxxx',bar,spb,(t,v,i)=>s.snare(t,.25+i/25,1.25));}
      if(bar%16===8)s.impact(T,1);
    }
  }
}));

const TRACKS = [
  { id: 'house', name: 'Sunset House', genre: 'House', bpm: 124, dur: 48, hint: '四四拍 · 8s 后铺垫 · 16s Drop', gen(s, spb) {
    const prog = [[57, 60, 64, 67], [55, 59, 62, 67], [53, 57, 60, 64], [55, 59, 62, 65]], bassN = [45, 43, 41, 43];
    for (let bar = 0; bar < 24; bar++) {
      const sec = bar < 4 ? 'intro' : bar < 8 ? 'build' : bar < 16 ? 'drop' : bar < 20 ? 'break' : 'drop';
      const T = bar * 4 * spb, ch = prog[bar % 4], bn = bassN[bar % 4];
      if (sec !== 'break' && bar !== 6 && bar !== 7) seq('X---x---X---x---', bar, spb, (t, v) => s.kick(t, v));
      seq('--x---x---x---x-', bar, spb, (t, v) => s.hat(t, sec === 'intro' ? 0.5 : 0.9, true));
      if (sec !== 'intro') seq('x-x-x-x-x-x-x-x-', bar, spb, (t, v) => s.hat(t, 0.45));
      if (sec !== 'intro') seq('----X-------X---', bar, spb, (t, v) => s.clap(t, 0.9));
      if (sec === 'drop') seq('x--x--x-x--x--x-', bar, spb, (t, v) => s.bass(t, bn, spb * 0.5, 1, 'sawtooth', 380));
      if (sec !== 'intro') for (let i = 0; i < 4; i++) s.chord(T + i * spb + spb * 0.5, ch, spb * 0.45, sec === 'drop' ? 1 : 0.6, sec === 'build' ? 600 + (bar - 4) * 500 : 2600);
      if (sec === 'break') { s.chord(T, ch, spb * 4, 1.2, 900); if (bar === 19) s.riser(T, spb * 4, 1); }
      if (sec === 'build') { if (bar === 7) { seq('xxxxxxxxxxxxxxxx', bar, spb, (t, v, i) => s.snare(t, 0.3 + i / 24)); s.riser(T - spb * 4, spb * 8, 0.9); } }
      if (bar === 8 || bar === 20) s.impact(T, 1);
    } } },
  { id: 'trap', name: 'Midnight Trap', genre: 'Trap / Hip-hop', bpm: 140, dur: 48, hint: '半拍律动 · 808 · 13.7s Drop', gen(s, spb) {
    const bn = [41, 41, 44, 39];
    for (let bar = 0; bar < 28; bar++) {
      const sec = bar < 8 ? 'intro' : bar < 20 ? 'drop' : bar < 24 ? 'break' : 'drop', T = bar * 4 * spb, n = bn[bar % 4];
      if (sec !== 'break' && bar !== 7 && bar !== 23) { seq('X-----x---X--x--', bar, spb, (t, v) => s.kick(t, v, 1.2)); seq('X-----x---X--x--', bar, spb, (t, v) => s.sub808(t, n - 12, spb * 1.5, sec === 'drop' ? 1 : 0.25)); }
      seq('--------X-------', bar, spb, (t, v) => s.snare(t, 1, 0.9));
      if (sec === 'drop') { for (let i = 0; i < 32; i++) s.hat(T + i * spb / 8, i % 4 === 0 ? 0.8 : 0.35); if (bar % 2 === 1) for (let i = 0; i < 12; i++) s.hat(T + spb * 3 + i * spb / 12, 0.5); }
      else seq('x-x-x-x-x-x-x-x-', bar, spb, (t) => s.hat(t, 0.5));
      if (bar % 4 === 0 || sec === 'break') { s.chord(T, [n + 24, n + 27, n + 31, n + 34], spb * 4, sec === 'break' ? 1.2 : 0.7, 1200); }
      if (sec === 'drop' && bar % 2 === 0) [0, 3, 6].forEach((k, i) => s.pluck(T + spb * (0.5 + i * 0.75), n + 36 + (i === 1 ? 3 : i === 2 ? 7 : 0), spb * 0.5, 0.35));
      if (bar === 7 || bar === 23) s.riser(T, spb * 4, 0.9);
      if (bar === 8 || bar === 24) s.impact(T, 1.1);
    } } },
  { id: 'lofi', name: 'Rainy Lo-fi', genre: 'Lo-fi', bpm: 84, dur: 46, hint: '摇摆节奏 · 能量平稳 · 适合柔和效果', gen(s, spb) {
    const prog = [[53, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]];
    for (let bar = 0; bar < 16; bar++) {
      const T = bar * 4 * spb, ch = prog[bar % 4], sw = spb / 4 * 0.18;
      seq('X------x--x-----', bar, spb, (t, v, i) => s.kick(t + (i % 2 ? sw : 0), v * 0.8, 0.9));
      seq('----x-------x---', bar, spb, (t, v) => s.snare(t, 0.7, 0.6));
      seq('x-x-x-x-x-x-x-x-', bar, spb, (t, v, i) => s.hat(t + (i % 4 === 2 ? sw : 0), 0.3));
      s.chord(T, ch, spb * 3.6, 1.3, 900, 'triangle');
      s.bass(T, ch[0] - 24, spb * 1.8, 0.8, 'triangle', 300); s.bass(T + spb * 2.5, ch[0] - 24 + 7, spb * 1.2, 0.7, 'triangle', 300);
      if (bar >= 8 && bar % 2 === 0) [0.5, 1.5, 2.25, 3].forEach((b, i) => s.pluck(T + spb * b, ch[(i + 2) % 4] + 12, spb * 0.8, 0.25));
    } } },
  { id: 'techno', name: 'Warehouse Techno', genre: 'Techno', bpm: 134, dur: 48, hint: '硬四拍 · 长铺垫 · 14s Drop', gen(s, spb) {
    for (let bar = 0; bar < 26; bar++) {
      const sec = bar < 8 ? 'build' : bar < 18 ? 'drop' : bar < 22 ? 'break' : 'drop', T = bar * 4 * spb;
      if (sec !== 'break' && bar !== 6 && bar !== 7) seq('X---X---X---X---', bar, spb, (t, v) => s.kick(t, 1, 0.8));
      seq('--x---x---x---x-', bar, spb, (t) => s.hat(t, sec === 'drop' ? 1 : 0.6, true));
      if (sec !== 'build' || bar > 3) seq('x-x-x-x-x-x-x-x-', bar, spb, (t) => s.hat(t, 0.4));
      if (sec === 'drop') { seq('x--x--x--x--x--x', bar, spb, (t, v, i) => s.bass(t, 40 + (i % 6 === 3 ? 3 : 0), spb * 0.3, 1, 'square', 300 + ((bar * 16 + i) % 32) * 40)); if (bar % 2 === 0) s.snare(T + spb * 3.75, 0.5, 1.5); }
      if (sec === 'build') { s.chord(T, [52, 55, 59], spb * 4, 0.8, 300 + bar * 350); s.bass(T, 40, spb * 4, 0.6, 'sawtooth', 200); }
      if (sec === 'break') { s.chord(T, [52, 55, 59, 62], spb * 4, 1.3, 1500); if (bar >= 20) s.riser(T, spb * 4, 0.7); }
      if (bar === 7) { s.riser(T, spb * 4, 1); seq('xxxxxxxxxxxxxxxx', bar, spb, (t, v, i) => s.snare(t, 0.25 + i / 20, 1.3)); }
      if (bar === 8 || bar === 22) s.impact(T, 1.2);
    } } },
  { id: 'pop', name: 'Neon Pop', genre: 'Pop', bpm: 112, dur: 48, hint: '主歌→副歌 · 明亮合成器', gen(s, spb) {
    const prog = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], bn = [48, 45, 41, 43];
    for (let bar = 0; bar < 22; bar++) {
      const sec = bar < 8 ? 'verse' : bar < 16 ? 'chorus' : bar < 18 ? 'bridge' : 'chorus', T = bar * 4 * spb, ch = prog[bar % 4], n = bn[bar % 4];
      const q = sec === 'chorus' ? 1 : 0.55;
      if (bar !== 7 && bar !== 17) seq(sec === 'chorus' ? 'X---x-x-X---x---' : 'X-------X-----x-', bar, spb, (t, v) => s.kick(t, v * q));
      seq('----X-------X---', bar, spb, (t, v) => s.snare(t, q, 1.1));
      seq(sec === 'chorus' ? 'xxxxxxxxxxxxxxxx' : 'x-x-x-x-x-x-x-x-', bar, spb, (t, v, i) => s.hat(t, (i % 2 ? 0.25 : 0.45) * q));
      if (sec === 'chorus') { seq('x-x-x-x-x-x-x-x-', bar, spb, (t) => s.bass(t, n, spb * 0.4, 0.9, 'sawtooth', 500)); for (let i = 0; i < 4; i++) s.chord(T + i * spb, ch.map(x => x + 12), spb * 0.45, 0.9, 3500); }
      else { s.bass(T, n, spb * 2, 0.5, 'triangle', 350); s.bass(T + spb * 2.5, n, spb * 1.4, 0.45, 'triangle', 350); s.chord(T, ch, spb * 4, 0.6, 1200); }
      if (sec === 'bridge') s.riser(T, spb * 4, 0.6);
      if (bar === 7 || bar === 17) seq('----x---x-x-xxxx', bar, spb, (t, v, i) => s.snare(t, 0.5 + i / 30));
      if (bar === 8 || bar === 18) s.impact(T, 0.9);
    } } },
  { id: 'ambient', name: 'Aurora Drift', genre: 'Ambient / Cinematic', bpm: 72, dur: 48, hint: '氛围 · 极慢 · 适合环绕文字 / 涟漪', gen(s, spb) {
    const prog = [[45, 52, 57, 64], [43, 50, 55, 62], [41, 48, 53, 60], [46, 53, 58, 65]];
    for (let bar = 0; bar < 12; bar++) { const T = bar * 4 * spb, ch = prog[bar % 4];
      s.chord(T, ch, spb * 4.4, 1.6, 700 + (bar % 4) * 180, 'triangle');
      s.chord(T + spb * 0.5, ch.map(n => n + 12), spb * 3.6, 0.7, 1800);
      if (bar >= 2) { s.kick(T, 0.55, 0.8); s.kick(T + spb * 2.5, 0.35, 0.8); }
      if (bar >= 4) [0.75, 2.25, 3.5].forEach((b, i) => s.pluck(T + spb * b, ch[(i + 1) % 4] + 24, spb * 1.2, 0.18));
      if (bar >= 6) seq('--x-----x-----x-', bar, spb, t => s.hat(t, 0.18, true));
      if (bar === 5 || bar === 9) s.riser(T, spb * 4, 0.45); }
    } },
  { id: 'synthwave', name: 'Neon Drive', genre: 'Synthwave / Retro', bpm: 102, dur: 48, hint: '80s 复古 · 门混响军鼓 · 琶音贝斯', gen(s, spb) {
    const bn = [40, 40, 43, 38], prog = [[52, 55, 59, 64], [52, 55, 59, 64], [55, 59, 62, 67], [50, 53, 57, 62]];
    for (let bar = 0; bar < 20; bar++) { const T = bar * 4 * spb, n = bn[bar % 4], ch = prog[bar % 4], big = bar >= 8 && bar < 16;
      seq('X-------X-------', bar, spb, (t, v) => s.kick(t, 1, 0.95));
      seq('----X-------X---', bar, spb, t => s.snare(t, big ? 1.1 : 0.7, 0.85));
      seq('x-x-x-x-x-x-x-x-', bar, spb, (t, v, i) => s.hat(t, i % 2 ? 0.2 : 0.4));
      for (let i = 0; i < 8; i++) s.bass(T + i * spb / 2, n + (i % 4 === 3 ? 12 : 0), spb * 0.42, 0.9, 'sawtooth', 460);
      if (bar >= 4) for (let i = 0; i < 8; i++) s.pluck(T + i * spb / 2, ch[i % 4] + 12, spb * 0.4, big ? 0.3 : 0.18);
      s.chord(T, ch, spb * 4, big ? 1.1 : 0.6, 2200);
      if (bar === 7 || bar === 15) s.riser(T, spb * 4, 0.7);
      if (bar === 8 || bar === 16) s.impact(T, 0.9); }
    } },
  { id: 'latin', name: 'Dembow Noche', genre: 'Reggaeton / Latin', bpm: 96, dur: 48, hint: '拉丁 dembow · 切分律动', gen(s, spb) {
    const bn = [45, 43, 41, 40];
    for (let bar = 0; bar < 20; bar++) { const T = bar * 4 * spb, n = bn[bar % 4], hot = bar >= 6 && bar < 14 || bar >= 17;
      seq('X--X--X-X--X--X-', bar, spb, (t, v) => s.kick(t, hot ? 1 : 0.65, 1.05));
      seq('---x--x----x--x-', bar, spb, t => s.snare(t, hot ? 0.85 : 0.5, 1.2));
      seq('x-x-x-x-x-x-x-x-', bar, spb, (t, v, i) => s.hat(t, i % 4 === 2 ? 0.45 : 0.22));
      if (hot) seq('--------x-------', bar, spb, t => s.cowbell(t, 0.7));
      s.sub808(T, n - 12, spb * 1.6, hot ? 0.95 : 0.5); s.sub808(T + spb * 2.5, n - 12, spb * 1.2, hot ? 0.8 : 0.4);
      if (bar % 2 === 0) s.chord(T, [n + 12, n + 15, n + 19, n + 22], spb * 4, hot ? 0.9 : 0.5, 1700);
      if (bar === 5 || bar === 16) s.riser(T, spb * 4, 0.7); if (bar === 6 || bar === 17) s.impact(T, 0.9); }
    } },
  { id: 'kpop', name: 'Candy Bounce', genre: 'K-pop / Dance', bpm: 128, dur: 48, hint: '明亮甜系 · 主歌副歌反差大', gen(s, spb) {
    const prog = [[60, 64, 67, 72], [57, 60, 64, 69], [55, 59, 62, 67], [58, 62, 65, 70]], bn = [48, 45, 43, 46];
    for (let bar = 0; bar < 24; bar++) { const T = bar * 4 * spb, ch = prog[bar % 4], n = bn[bar % 4];
      const sec = bar < 6 ? 'verse' : bar < 14 ? 'chorus' : bar < 17 ? 'bridge' : 'chorus', q = sec === 'chorus' ? 1 : 0.5;
      if (bar !== 5 && bar !== 16) seq(sec === 'chorus' ? 'X--xX-x-X--xX-x-' : 'X-------X-------', bar, spb, (t, v) => s.kick(t, v * q));
      seq('----X-------X---', bar, spb, t => s.clap(t, q * 1.1));
      seq(sec === 'chorus' ? 'xxxxxxxxxxxxxxxx' : 'x-x-x-x-x-x-x-x-', bar, spb, (t, v, i) => s.hat(t, (i % 2 ? .2 : .42) * q));
      if (sec === 'chorus') { for (let i = 0; i < 8; i++) s.bass(T + i * spb / 2, n, spb * .4, 1, 'square', 560);
        for (let i = 0; i < 8; i++) s.pluck(T + i * spb / 2, ch[(i * 3) % 4] + 12, spb * .35, 0.34); }
      else { s.bass(T, n, spb * 2, .6, 'triangle', 380); s.chord(T, ch, spb * 4, .55, 1400); }
      if (sec === 'bridge') s.riser(T, spb * 4, .6);
      if (bar === 5 || bar === 16) seq('--x-x-x-xxxxxxxx', bar, spb, (t, v, i) => s.snare(t, .3 + i / 24, 1.2));
      if (bar === 6 || bar === 17) s.impact(T, 1); }
    } },
  { id: 'rock', name: 'Garage Rush', genre: 'Rock / Punk', bpm: 152, dur: 44, hint: '真鼓感 · 失真吉他 · 高能量', gen(s, spb) {
    const prog = [[40, 47, 52], [45, 52, 57], [43, 50, 55], [38, 45, 50]];
    for (let bar = 0; bar < 26; bar++) { const T = bar * 4 * spb, ch = prog[bar % 4], loud = bar >= 6 && bar < 18 || bar >= 21;
      if (bar !== 5 && bar !== 20) { seq('X---x---X-x-x---', bar, spb, (t, v) => s.kick(t, loud ? 1 : .6, .95));
        seq('----X-------X---', bar, spb, t => s.snare(t, loud ? 1.1 : .6, 1.1)); }
      seq(loud ? 'x-x-x-x-x-x-x-x-' : '--x---x---x---x-', bar, spb, (t, v, i) => s.hat(t, loud ? .45 : .3, !loud));
      if (loud) { for (let i = 0; i < 4; i++) s.gtr(T + i * spb, ch, spb * .9, 1); s.bass(T, ch[0] - 12, spb * 4, .9, 'sawtooth', 420); }
      else { s.gtr(T, ch, spb * 3.6, .45); s.bass(T, ch[0] - 12, spb * 3.6, .5, 'triangle', 300); }
      if (bar === 5 || bar === 20) { for (let i = 0; i < 12; i++) s.snare(T + spb * 4 * i / 12, .35 + i / 18, 1.1); }
      if (bar === 6 || bar === 21) s.impact(T, 1.1); }
    } },
  { id: 'phonk', name: 'Phonk Drift', genre: 'Phonk', bpm: 146, dur: 48, hint: '牛铃 · 808 滑音 · 暗黑', gen(s, spb) {
    const bn = [38, 38, 41, 36];
    for (let bar = 0; bar < 26; bar++) { const T = bar * 4 * spb, n = bn[bar % 4], hot = bar >= 6 && bar < 16 || bar >= 20;
      if (bar !== 5 && bar !== 19) seq('X---x--X--x-X---', bar, spb, (t, v) => s.kick(t, hot ? 1 : .6, 1.1));
      seq('--------X-------', bar, spb, t => s.snare(t, hot ? 1 : .6, .8));
      if (hot) { for (let i = 0; i < 16; i++) s.cowbell(T + i * spb / 4, i % 4 === 0 ? .75 : .35);
        s.sub808(T, n - 12, spb * 2.2, 1); s.sub808(T + spb * 2.5, n - 12 + (bar % 2 ? 3 : -2), spb * 1.4, .9); }
      else { seq('x---x---x---x---', bar, spb, t => s.hat(t, .3)); s.sub808(T, n - 12, spb * 3, .5); }
      if (bar % 4 === 0) s.chord(T, [n + 12, n + 15, n + 19], spb * 4, hot ? .8 : .5, 1100, 'triangle');
      if (bar === 5 || bar === 19) s.riser(T, spb * 4, .8); if (bar === 6 || bar === 20) s.impact(T, 1.15); }
    } },
  { id: 'dnb', name: 'Liquid DnB', genre: 'Drum & Bass', bpm: 174, dur: 44, hint: '碎拍 · 快节奏 · 11s Drop', gen(s, spb) {
    const bn = [38, 41, 43, 36];
    for (let bar = 0; bar < 32; bar++) {
      const sec = bar < 8 ? 'intro' : bar < 24 ? 'drop' : 'break', T = bar * 4 * spb, n = bn[bar % 4];
      if (sec === 'drop') { seq('X-------x-X-----', bar, spb, (t, v) => s.kick(t, v, 0.9)); seq('----X-------X---', bar, spb, (t) => s.snare(t, 1, 1.2)); seq('x-x-x-x-x-x-x-x-', bar, spb, (t, v, i) => s.hat(t, i % 4 === 2 ? 0.7 : 0.35, i % 4 === 2)); s.sub808(T, n - 12, spb * 2.5, 1); s.sub808(T + spb * 2.5, n - 12 + 3, spb * 1.4, 0.9); }
      else { seq('x-x-x-x-x-x-x-x-', bar, spb, (t) => s.hat(t, 0.3)); if (sec === 'intro' && bar >= 4) seq('X-------x-X-----', bar, spb, (t, v) => s.kick(t, v * 0.6)); }
      if (bar % 2 === 0) s.chord(T, [n + 24, n + 27, n + 31, n + 34], spb * 8, sec === 'break' ? 1.3 : 0.7, sec === 'intro' ? 700 + bar * 200 : 2000);
      if (bar === 7 || bar === 31) s.riser(T, spb * 4, 0.9);
      if (bar === 8) s.impact(T, 1.1);
    } } },
];

// Real test music embedded by build.py from music/library.json.
// Each entry can provide a waveform cover and an LRC timeline for visual effects.
const PACK_TRACKS = /*__PACK_TRACKS__*/[];

async function renderTrack(def) {
  const sr = 32000, off = new OfflineAudioContext(2, sr * def.dur, sr);
  const master = off.createGain(); master.gain.value = 0.55;
  const comp = off.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  master.connect(comp).connect(off.destination);
  const s = new Synth(off, master); def.gen(s, 60 / def.bpm);
  return off.startRendering();
}

/* =====================================================================
   3. OFFLINE ANALYSIS — bands → onset envelope → BPM / beat grid / sections / drops
   ===================================================================== */
async function bandRender(buffer, type, freq) {
  const off = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const s = off.createBufferSource(); s.buffer = buffer; const f = off.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.7;
  s.connect(f).connect(off.destination); s.start(0); return (await off.startRendering()).getChannelData(0);
}
function envelope(data, hop) { const n = Math.floor(data.length / hop), e = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop, k = 0; k < hop; k++, j++) s += data[j] * data[j]; e[i] = Math.sqrt(s / hop); } return e; }
function smooth(a, r) { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - r); j <= Math.min(a.length - 1, i + r); j++) { s += a[j]; c++; } o[i] = s / c; } return o; }
function onset(e) { const o = new Float32Array(e.length); for (let i = 1; i < e.length; i++) o[i] = Math.max(0, Math.log(e[i] + 1e-4) - Math.log(e[i - 1] + 1e-4)); return o; }
function percentile(a, p) { const s = Array.from(a).sort((x, y) => x - y); return s[Math.floor((s.length - 1) * p)] || 0; }

async function analyze(buffer) {
  const sr = buffer.sampleRate, hop = 1024, fps = sr / hop;
  const mono = new Float32Array(buffer.length); for (let c = 0; c < buffer.numberOfChannels; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / buffer.numberOfChannels; }
  const low = await bandRender(buffer, 'lowpass', 150), high = await bandRender(buffer, 'highpass', 4000);
  const eF = envelope(mono, hop), eL = envelope(low, hop), eH = envelope(high, hop);
  const oF = onset(smooth(eF, 1)), oL = onset(smooth(eL, 1)), oH = onset(smooth(eH, 1));
  const on = new Float32Array(eF.length); for (let i = 0; i < on.length; i++) on[i] = oL[i] * 1.6 + oF[i] + oH[i] * 0.5;
  const mean = on.reduce((a, b) => a + b, 0) / on.length; for (let i = 0; i < on.length; i++) on[i] -= mean;
  // BPM via comb-filtered autocorrelation of the onset envelope (lags 1..4 beats), 60..190 BPM
  const ac1 = li => { let s = 0; for (let i = li; i < on.length; i++) s += on[i] * on[i - li]; return s / (on.length - li); };
  let best = { bpm: 120, score: -1, lag: fps * 0.5 };
  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const lag = 60 / bpm * fps; const s = ac1(Math.round(lag)) + ac1(Math.round(lag * 2)) + 0.8 * ac1(Math.round(lag * 3)) + 1.2 * ac1(Math.round(lag * 4)) - 0.6 * ac1(Math.round(lag * 1.5));
    const score = s * (1 + 0.2 * Math.exp(-Math.pow((bpm - 125) / 40, 2)));
    if (score > best.score) best = { bpm, score, lag };
  }
  if (best.bpm < 100) { const l2 = best.lag / 2, s2 = ac1(Math.round(l2)) + ac1(Math.round(l2 * 2)) + 0.8 * ac1(Math.round(l2 * 3)) + 1.2 * ac1(Math.round(l2 * 4)) - 0.6 * ac1(Math.round(l2 * 1.5)); if (s2 > best.score * 0.8) best = { bpm: best.bpm * 2, score: s2, lag: l2 }; }
  const lag = best.lag; let bestPh = 0, bestS = -1;
  for (let ph = 0; ph < lag; ph += 0.5) { let s = 0; for (let i = ph; i < on.length; i += lag) s += on[Math.round(i)] + 0.5 * (oL[Math.round(i)] || 0); if (s > bestS) { bestS = s; bestPh = ph; } }
  const beats = []; for (let i = bestPh; i < on.length; i += lag) beats.push(i / fps);
  // downbeat: which of the 4 phases has the strongest low-band onsets
  let db = 0, dbS = -1; for (let k = 0; k < 4; k++) { let s = 0; for (let i = k; i < beats.length; i += 4) s += oL[Math.round(beats[i] * fps)] || 0; if (s > dbS) { dbS = s; db = k; } }
  // sections from smoothed energy
  const E = smooth(eF, Math.round(fps * 1.2)), p95 = percentile(E, 0.95) || 1, p10 = percentile(E, 0.1), dur = buffer.duration;
  const flat = p95 / (p10 + 1e-6) < 1.6, lvl = i => E[i] / p95;
  const raw = []; for (let i = 0; i < E.length; i++) raw.push(flat ? 1 : lvl(i) < 0.45 ? 0 : lvl(i) < 0.76 ? 1 : 2);
  // median-ish cleanup + merge short runs (< 1.5 s)
  const segs = []; let st = 0; for (let i = 1; i <= raw.length; i++) if (i === raw.length || raw[i] !== raw[st]) { segs.push({ a: st / fps, b: i / fps, lvl: raw[st] }); st = i; }
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < segs.length; i++) if (segs[i].b - segs[i].a < 1.5 && segs.length > 1) { const j = i > 0 ? i - 1 : i + 1; segs[j].a = Math.min(segs[j].a, segs[i].a); segs[j].b = Math.max(segs[j].b, segs[i].b); segs.splice(i, 1); i--; }
  // drops: downbeats where low-band energy jumps hard (and full energy goes up), strongest first, ≥ 6 s apart
  const downbeats = beats.filter((_, i) => i % 4 === db), EL = smooth(eL, Math.round(fps * 0.5)), lp95 = percentile(EL, 0.95) || 1;
  const cands = [];
  for (const d of downbeats) { if (d < 1.5 || d > dur - 2) continue;
    const jl = (avgE(EL, d, d + 1, fps) - avgE(EL, d - 1.5, d, fps)) / lp95, jf = (avgE(E, d, d + 1.5, fps) - avgE(E, d - 3, d, fps)) / p95;
    const score = jl * 1.2 + jf; if (!flat && jl > 0.1 && jf > 0.03 && avgE(E, d, d + 2, fps) / p95 > 0.55) cands.push({ d, score }); }
  for (let i = 1; i < segs.length; i++) if (segs[i].lvl === 2 && segs[i - 1].lvl < 2) { const t = segs[i].a, d = downbeats.reduce((p, c) => Math.abs(c - t) < Math.abs(p - t) ? c : p, t); if (Math.abs(d - t) < 1.2 && !cands.some(c => Math.abs(c.d - d) < 3)) cands.push({ d, score: 0.3 }); }
  cands.sort((a, b) => b.score - a.score); const drops = [];
  for (const c of cands) { if (drops.every(x => Math.abs(x - c.d) > 6) && drops.length < 4) drops.push(c.d); } drops.sort((a, b) => a - b);
  const bassRatio = eL.reduce((a, b) => a + b, 0) / (eF.reduce((a, b) => a + b, 0) + 1e-6), highRatio = eH.reduce((a, b) => a + b, 0) / (eF.reduce((a, b) => a + b, 0) + 1e-6);
  const bpm = Math.round(best.bpm), genre = guessGenre(bpm, bassRatio, highRatio, segs);
  // energy curve for timeline (200 pts)
  const curve = []; for (let i = 0; i < 200; i++) curve.push(clamp(lvl(Math.floor(i / 200 * E.length)), 0, 1));
  return { bpm, lag: lag / fps, beats, downbeats, segs, drops, dur, genre, curve, bassRatio, highRatio };
}
function avgE(E, a, b, fps) { let s = 0, c = 0; for (let i = Math.max(0, Math.floor(a * fps)); i < Math.min(E.length, Math.floor(b * fps)); i++) { s += E[i]; c++; } return c ? s / c : 0; }
function guessGenre(bpm, bass, high, segs) {
  const dyn = new Set(segs.map(s => s.lvl)).size;
  if (bpm >= 165) return 'Drum & Bass';
  if (bpm >= 128 && bpm <= 145 && bass > 0.62) return 'Techno';
  if (bpm >= 118 && bpm < 132) return bass > 0.5 ? 'House' : 'Dance / Pop';
  if (bpm >= 132 && bpm <= 160) return high > 0.12 ? 'Trap / Hip-hop' : 'Hardstyle / EDM';
  if (bpm >= 80 && bpm < 95 && high > 0.1 && dyn >= 2) return 'Drum & Bass';
  if (bpm >= 60 && bpm < 80 && bass > 0.9) return 'Trap / Hip-hop';
  if (bpm >= 60 && bpm < 95) return dyn <= 2 ? 'Lo-fi / Chill' : 'Hip-hop / R&B';
  if (bpm >= 95 && bpm < 118) return 'Pop / R&B';
  return '电子';
}

/* =====================================================================
   4. PLAYBACK + LIVE FEATURES
   ===================================================================== */
let srcNode = null, analyser = null, gainNode = null, recordDest = null, freq = null, prevSpec = null;
const live = { kick: 0, snare: 0, hat: 0, energy: 0, bass: 0, mid: 0, high: 0, hist: { l: [], m: [], h: [] } };

function setupGraph() { const c = ac(); if (!gainNode) { gainNode = c.createGain(); analyser = c.createAnalyser(); recordDest = c.createMediaStreamDestination(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.35; gainNode.connect(analyser).connect(c.destination); gainNode.connect(recordDest); freq = new Uint8Array(analyser.frequencyBinCount); } gainNode.gain.value = +$('#vol').value; }
function play(at = 0) {
  if (!S.buffer) { toast('先选一首音乐'); return; }
  setupGraph(); ac().resume(); stopSource();
  srcNode = ac().createBufferSource(); srcNode.buffer = S.buffer; srcNode.loop = true; srcNode.connect(gainNode); srcNode.start(0, at);
  S.t0 = ac().currentTime - at; S.playing = true; setPlayIcon(true); $('#discBtn').classList.add('spin'); if (S.isVideo) S.media.play();
}
function stopSource() { if (srcNode) { try { srcNode.stop(); } catch (e) { } srcNode.disconnect(); srcNode = null; } }
function pause() { if (!S.playing) return; S.pausedAt = songTime(); stopSource(); S.playing = false; setPlayIcon(false); $('#discBtn').classList.remove('spin'); }
function setPlayIcon(on) { $('#playIco').innerHTML = on ? '<path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z"/>' : '<path d="M4 2l10 6-10 6z"/>';  }
function songTime() { if (!S.playing || !S.buffer) return S.pausedAt || 0; return (ac().currentTime - S.t0) % S.buffer.duration; }

function bandAvg(lo, hi) { const c = ac(), nyq = c.sampleRate / 2, a = Math.floor(lo / nyq * freq.length), b = Math.min(freq.length - 1, Math.ceil(hi / nyq * freq.length)); let s = 0; for (let i = a; i <= b; i++) s += freq[i]; return s / (b - a + 1) / 255; }
function transient(band, val, decay) {
  const h = live.hist[band]; h.push(val); if (h.length > 40) h.shift();
  const m = h.reduce((a, b) => a + b, 0) / h.length; const flux = val - (live['p' + band] ?? val); live['p' + band] = val;
  const thr = m * 0.12 + 0.02; return flux > thr ? 1 : 0;
}
let lastBeatIdx = -1, lastBarIdx = -1;
function computeFeatures(now) {
  const f = { kick: 0, snare: 0, hat: 0, energy: 0, bass: 0, mid: 0, high: 0, beat: 0, bar: 0, beatPhase: 0, drop: 0, dropHold: 0, section: '–', t: songTime(), bpm: S.analysis?.bpm || 0 };
  if (S.playing && analyser) {
    analyser.getByteFrequencyData(freq);
    const b = bandAvg(30, 160), m = bandAvg(160, 2000), h = bandAvg(4000, 12000), e = bandAvg(30, 8000);
    live.bass = lerp(live.bass, b, 0.5); live.mid = lerp(live.mid, m, 0.4); live.high = lerp(live.high, h, 0.5); live.energy = lerp(live.energy, e * 1.6, 0.25);
    live.kick = Math.max(live.kick * 0.82, transient('l', b, 0) * clamp(b * 2.2, 0.5, 1));
    live.hat = Math.max(live.hat * 0.7, transient('h', h, 0) * clamp(h * 3, 0.4, 1));
    live.snare = Math.max(live.snare * 0.8, (transient('m', m, 0) && h > 0.12 && b < 0.9) ? clamp((m + h) * 1.6, 0.5, 1) : 0);
  } else { for (const k of ['kick', 'snare', 'hat', 'energy', 'bass', 'mid', 'high']) live[k] *= 0.9; }
  Object.assign(f, { kick: live.kick, snare: live.snare, hat: live.hat, energy: clamp(live.energy, 0, 1), bass: live.bass, mid: live.mid, high: live.high });
  const A = S.analysis;
  if (A && S.playing) {
    const t = f.t, lag = A.lag, i = Math.floor((t - A.beats[0]) / lag);
    f.beatPhase = ((t - A.beats[0]) / lag) % 1; if (f.beatPhase < 0) f.beatPhase += 1;
    if (i !== lastBeatIdx) { lastBeatIdx = i; S.beatImp = 1; const bi = ((i - A.beats.findIndex(x => x >= A.downbeats[0] - 1e-3)) % 4 + 4) % 4; if (bi === 0) S.barImp = 1; }
    S.beatImp = (S.beatImp || 0) * 0.8; S.barImp = (S.barImp || 0) * 0.85; f.beat = S.beatImp; f.bar = S.barImp;
    const seg = A.segs.find(s => t >= s.a && t < s.b); f.section = seg ? ['铺垫', '推进', '高潮'][seg.lvl] : '–';
    const d = A.drops.find(x => t >= x && t < x + 2.2); if (d !== undefined) { const dt = t - d; f.dropHold = clamp(1 - dt / 2.2, 0, 1); f.drop = dt < 0.25 ? 1 - dt / 0.25 : 0; }
    const next = A.drops.find(x => x > t); f.nextDrop = next !== undefined ? next - t : null;
  }
  return f;
}

/* =====================================================================
   5. EFFECTS — each: { name, icon, desc, hint, params[], draw(ctx, f, p, t) }
   ===================================================================== */
const DRIVERS = { kick: 'Kick', snare: 'Snare', hat: 'Hi-hat', beat: '节拍', bar: '小节', bass: '低频', energy: '能量', high: '高频' };
const R = (key, label, min, max, def, step = 0.01) => ({ key, label, type: 'range', min, max, def, step });
const C = (key, label, def) => ({ key, label, type: 'color', def });
const Sel = (key, label, opts, def) => ({ key, label, type: 'select', opts, def });
const T = (key, label, def) => ({ key, label, type: 'text', def });
const D = (key, def, only) => ({ key, label: '驱动', type: 'driver', def, only });
function dropFlash(f, p) { const a = ($('#autoDrop').checked ? f.drop : 0) * 0.85; if (a > 0.01) { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, W, H); } }

function contourFont(name, size) {
  if (name === '窄体海报') return `900 ${size}px Impact, "Arial Narrow", sans-serif`;
  if (name === '衬线编辑') return `italic 700 ${size}px Georgia, "Songti SC", serif`;
  if (name === '等宽科技') return `700 ${size}px "SFMono-Regular", Menlo, Consolas, monospace`;
  return `800 ${size}px Manrope, "PingFang SC", sans-serif`;
}
function contourInk(p) {
  if (p.colorMode === '手动颜色') return p.col || '#ffffff';
  if (p.colorMode === '图片取色') return splitAccent();
  if (p.colorMode === '反差取色') { const c = splitAccent(), n = parseInt(c.slice(1), 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(lerp(255 - v, 255, .18))); return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''); }
  return '#ffffff';
}

function wrapTextInk(p) {
  if (p.colorMode === '手动颜色') return p.col || '#ff4fa3';
  if (p.colorMode === '图片取色') return splitAccent();
  if (p.colorMode === '反差取色') { const c = splitAccent(), n = parseInt(c.slice(1), 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(lerp(255 - v, 255, .14))); return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''); }
  return '#ff4fa3';
}

function wrapTokens(raw) {
  const clean = (raw || '').replace(/[\/|,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return ['just', 'another', 'day', 'caught', 'in', 'the', 'moment'];
  if (/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(clean)) {
    return typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clean)].map(x => x.segment).filter(x => x.trim()) : Array.from(clean).filter(x => x.trim());
  }
  return clean.split(/\s+/).filter(Boolean);
}

function buildWrapPath(offset = 28) {
  const w = 135, h = 240, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(subject(), 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, left = new Float32Array(h), right = new Float32Array(h); left.fill(-1); right.fill(-1);
  let y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) { let lo = w, hi = -1; for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 78) { lo = Math.min(lo, x); hi = x; }
    if (hi >= lo) { left[y] = lo; right[y] = hi; y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  if (y1 <= y0) { y0 = 20; y1 = h - 12; for (let y = y0; y <= y1; y++) { const q = (y - y0) / Math.max(1, y1 - y0), half = w * (.19 + q * .18); left[y] = w / 2 - half; right[y] = w / 2 + half; } }
  for (let y = y0; y <= y1; y++) if (left[y] < 0) { let a = y - 1, b = y + 1; while (a >= y0 && left[a] < 0) a--; while (b <= y1 && left[b] < 0) b++; const q = a >= y0 && b <= y1 ? (y - a) / (b - a) : 0; left[y] = a >= y0 ? (b <= y1 ? lerp(left[a], left[b], q) : left[a]) : left[b]; right[y] = a >= y0 ? (b <= y1 ? lerp(right[a], right[b], q) : right[a]) : right[b]; }
  const sx = W / w, sy = H / h, step = 3, pts = [];
  for (let y = y1; y >= y0; y -= step) pts.push({ x: left[y] * sx - offset, y: y * sy + (y < y0 + 8 ? -offset * .55 : 0) });
  for (let y = y0; y <= y1; y += step) pts.push({ x: right[y] * sx + offset, y: y * sy + (y < y0 + 8 ? -offset * .55 : 0) });
  pts.push({ x: right[y1] * sx + offset, y: H + 72 }, { x: left[y1] * sx - offset, y: H + 72 });
  let smooth = pts;
  for (let pass = 0; pass < 4; pass++) { const out = []; for (let i = 0; i < smooth.length; i++) { const a = smooth[(i - 1 + smooth.length) % smooth.length], b = smooth[i], z = smooth[(i + 1) % smooth.length]; out.push({ x: a.x * .22 + b.x * .56 + z.x * .22, y: a.y * .22 + b.y * .56 + z.y * .22 }); } smooth = out; }
  const cum = [0]; let total = 0; for (let i = 1; i <= smooth.length; i++) { const a = smooth[i - 1], b = smooth[i % smooth.length]; total += Math.hypot(b.x - a.x, b.y - a.y); cum.push(total); }
  return { pts: smooth, cum, total };
}

function wrapPathPoint(path, distance) {
  const d = ((distance % path.total) + path.total) % path.total, c = path.cum; let lo = 0, hi = c.length - 1;
  while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
  const a = path.pts[lo % path.pts.length], b = path.pts[(lo + 1) % path.pts.length], q = (d - c[lo]) / Math.max(.001, c[lo + 1] - c[lo]);
  return { x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q), angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

function initContourGL(s) {
  if (s.glCanvas) return !!s.gl;
  const c = document.createElement('canvas'); c.width = W; c.height = H; s.glCanvas = c;
  const gl = c.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return false;
  const compile = (type, source) => { const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  try {
    const vs = compile(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*.5;gl_Position=vec4(p,0.,1.);}');
    const fs = compile(gl.FRAGMENT_SHADER, `precision highp float;
      varying vec2 uv; uniform sampler2D sdf; uniform vec2 texSize; uniform vec3 lineColor; uniform float scalePx,time,gapPx,widthPx,rings,beat,cycle,style,feather,accentSeed,accentRing,accentPower;
      float unpackD(vec2 q){vec4 v=texture2D(sdf,q);return (floor(v.r*255.0+.5)*256.0+floor(v.g*255.0+.5))*scalePx;}
      float field(vec2 q){vec2 p=q*texSize-.5,i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);vec2 a=(i+.5)/texSize,b=(i+vec2(1.5,.5))/texSize,c=(i+vec2(.5,1.5))/texSize,d=(i+1.5)/texSize;return mix(mix(unpackD(a),unpackD(b),f.x),mix(unpackD(c),unpackD(d),f.x),f.y);}
      void main(){vec2 maskUV=vec2(uv.x,1.0-uv.y);float base=field(maskUV);if(base<.5){gl_FragColor=vec4(0.);return;}float qd=clamp(base/(gapPx*9.0),0.,1.);float n=(sin(maskUV.x*31.0+maskUV.y*19.0+time*.58)+.55*sin(maskUV.x*13.0-maskUV.y*37.0-time*.43))/1.55;float isSoft=step(.5,style)*(1.0-step(1.5,style)),isMinimal=step(1.5,style)*(1.0-step(2.5,style)),isRibbon=step(2.5,style);float rough=1.0-isSoft*.9-isMinimal*.88-isRibbon*.18;float gapMul=1.0+isSoft*.06+isMinimal*.28-isRibbon*.04;float widthMul=1.0-isSoft*.2-isMinimal*.6+isRibbon*.12;float d=base+n*gapPx*(.045+qd*.105)*rough*(1.0+beat*.16);float alpha=0.;
        for(int k=0;k<10;k++){float layer=float(k);if(layer>rings)break;float u=layer+cycle;float q=clamp(u/max(1.,rings),0.,1.);float gp=gapPx*gapMul;float uneven=gp*.028*sin(layer*2.37);float brushWave=.5+.5*sin(maskUV.x*8.3+maskUV.y*5.7+layer*1.91);float brushLobe=.5+.5*sin(maskUV.x*3.1-maskUV.y*7.2+layer*2.43+1.2);float ringDistance=abs(layer-accentRing);float chosenRing=exp(-ringDistance*.72);float patchWave=.5+.5*sin(maskUV.x*5.1+maskUV.y*3.7+accentSeed-ringDistance*.28);float chosenPatch=patchWave*patchWave*(3.0-2.0*patchWave);float localTurb=beat*gp*(.012+q*.007)*sin(maskUV.x*17.0+maskUV.y*11.0+time*1.85+layer*1.7)+accentPower*chosenRing*chosenPatch*gp*.025;float r=gp*(u+.065*u*u)+uneven+localTurb;float localGap=gp*(1.0+u*.13);float profile=.42+q*(.72+isRibbon*.28);float pressure=.48+brushWave*.72+brushLobe*.34+accentPower*chosenRing*chosenPatch*.78;float thick=min(localGap*.7,widthPx*widthMul*profile*pressure);float edge=abs(d-r);float aa=.45+(1.05+q*.3)*feather*(1.0+isSoft*.7+isMinimal*.08);alpha=max(alpha,1.0-smoothstep(thick*.5-aa,thick*.5+aa,edge));}
        gl_FragColor=vec4(lineColor*alpha,alpha);}`);
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW); const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    s.gl = gl; s.glProgram = pr; s.glTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, s.glTexture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.viewport(0, 0, W, H); return true;
  } catch (e) { console.warn('Contour WebGL fallback', e); s.gl = null; return false; }
}

function uploadContourSDF(s, dist, w, h) {
  if (!initContourGL(s)) return;
  const packed = new Uint8Array(w * h * 4);
  for (let i = 0; i < dist.length; i++) { const v = Math.min(65535, Math.round(dist[i])); packed[i * 4] = v >> 8; packed[i * 4 + 1] = v & 255; packed[i * 4 + 3] = 255; }
  const gl = s.gl; gl.bindTexture(gl.TEXTURE_2D, s.glTexture); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, packed); s.glTexW = w; s.glTexH = h;
}

function renderContourGL(s, f, p, t) {
  const gl = s.gl, pr = s.glProgram; if (!gl || !s.glTexW) return false; gl.useProgram(pr); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  const u = (name, value, pair) => { const l = gl.getUniformLocation(pr, name); pair ? gl.uniform2f(l, value[0], value[1]) : gl.uniform1f(l, value); };
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.glTexture); gl.uniform1i(gl.getUniformLocation(pr, 'sdf'), 0); u('texSize', [s.glTexW, s.glTexH], true); u('scalePx', W / s.glTexW); u('time', t); u('gapPx', p.gap); u('widthPx', p.width); u('rings', Math.round(p.rings)); u('style', ['手绘粉笔','柔光描边','极简细线','律动丝带'].indexOf(p.style)); u('feather', p.feather == null ? 0 : p.feather); const ink = hex2rgb(contourInk(p)); gl.uniform3f(gl.getUniformLocation(pr, 'lineColor'), ink[0] / 255, ink[1] / 255, ink[2] / 255);
  const drive = clamp(f[p.drv], 0, 1), beat = clamp(drive * .7 + f.kick * 1.08 + f.beat * .52 + f.snare * .34, 0, 2.15), dt = clamp(t - (s.glLastT == null ? t : s.glLastT), 0, .08); s.glLastT = t;
  // Discrete beat impulses, not a BPM metronome. A clear transient advances
  // the target by exactly one ring. The current phase catches up with a strong
  // ease-out curve, then rests; weak passages and pause states remain still.
  const hit = Math.max(f.beat || 0, (f.kick || 0) * .95, (f.snare || 0) * .72), audible = (f.energy || 0) > .105 || (f.bass || 0) > .14;
  if (S.playing && audible && hit > .46 && s.glBeatWas <= .46 && t - s.glLastBeatAt > .18) { s.glTarget = Math.floor(Math.max(s.glTarget, s.glPhase)) + 1; s.glVelocity = Math.max(s.glVelocity || 0, .95 + hit * 1.35); s.glAccentRing = Math.floor(Math.random() * Math.max(1, Math.round(p.rings))); s.glAccentSeed = Math.random() * 18; s.glAccentStrength = .72 + hit * .48; s.glAccentAt = t; s.glLastBeatAt = t; }
  s.glBeatWas = hit;
  if (S.playing && (Math.abs(s.glTarget - s.glPhase) > .001 || Math.abs(s.glVelocity || 0) > .002)) { const stiffness = 30 + p.speed * 14, damping = 7.4; s.glVelocity = (s.glVelocity || 0) + (s.glTarget - s.glPhase) * stiffness * dt; s.glVelocity *= Math.exp(-damping * dt); s.glPhase += s.glVelocity * dt; if (Math.abs(s.glTarget - s.glPhase) < .0015 && Math.abs(s.glVelocity) < .006) { s.glPhase = s.glTarget; s.glVelocity = 0; } }
  const accentAge = t - (s.glAccentAt || -9), accentAttack = clamp(accentAge / .075, 0, 1), accentRelease = accentAge < .075 ? 1 : Math.exp(-(accentAge - .075) * 6.2), accentPower = S.playing ? accentAttack * accentAttack * (3 - 2 * accentAttack) * accentRelease * (s.glAccentStrength || 0) * p.pulse * .72 : 0;
  u('beat', (S.playing && audible ? beat : 0) * p.pulse); u('accentSeed', s.glAccentSeed || 0); u('accentRing', s.glAccentRing || 0); u('accentPower', accentPower); u('cycle', ((s.glPhase % 1) + 1) % 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return true;
}

// Shared editorial sampling is cached; pause freezes each effect's animation clock.
function editorialNoise(n) { const v=Math.sin(n*12.9898+78.233)*43758.5453; return v-Math.floor(v); }
function editorialBeat(s,f,p,t) {
  const dt=Math.min(.08,Math.max(0,t-(s.lastTime??t)));
  s.lastTime=t;s.clock=(s.clock||0)+(S.playing?dt:0);s.step||=0;
  const drive=f[p.drv||'beat']||0;
  if(S.playing&&drive>.4&&(s.previous||0)<=.4&&s.clock-(s.born??-99)>(p.duration?p.duration*.85:.16)){s.step++;s.born=s.clock;}
  s.previous=drive;return {pulse:Math.exp(-Math.max(0,s.clock-(s.born??-99))*5)};
}
function editorialGround() {
  ctx.fillStyle=splitAccent();ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#f4ecda';ctx.globalAlpha=.76;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
}
function editorialSamples(s,pitch,cutout,t) {
  const key=S.srcKey+'|'+pitch+'|'+cutout+'|'+!!S.cache.subjHQ+'|'+(S.isVideo?Math.floor(t*12):'');
  if(s.sampleKey===key)return s.samples;
  const canvas=s.samples?.canvas||document.createElement('canvas');
  canvas.width=Math.ceil(W/pitch);canvas.height=Math.ceil(H/pitch);
  const g=canvas.getContext('2d',{willReadFrequently:true});
  g.drawImage(cutout?subject():src,0,0,canvas.width,canvas.height);
  const data=g.getImageData(0,0,canvas.width,canvas.height).data,points=[];
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const k=(y*canvas.width+x)*4;if(data[k+3]<80)continue;
    const r=data[k],green=data[k+1],b=data[k+2];
    points.push({x:(x+.5)*W/canvas.width,y:(y+.5)*H/canvas.height,l:(r*.2126+green*.7152+b*.0722)/255,color:'rgb('+r+','+green+','+b+')',light:'rgb('+Math.min(255,r*1.55+22)+','+Math.min(255,green*1.55+22)+','+Math.min(255,b*1.55+22)+')'});
  }
  s.sampleKey=key;return s.samples={canvas,points};
}
function editorialCopy(p,t){return ((p.copy==='自动歌词'?activeLyricAt(songTime()):p.text)||'ON / REPEAT').trim();}
function editorialHeadline(raw,size,x,y,pulse){
  const lines=raw.split(/[\/\n]+/).filter(Boolean).slice(0,3);
  ctx.save();ctx.textAlign='left';ctx.textBaseline='top';ctx.font='900 '+size+'px Manrope, "PingFang SC", sans-serif';
  lines.forEach((line,i)=>{const w=Math.min(W-x*2,ctx.measureText(line).width+20);ctx.fillStyle=i===0?splitAccent():'#f3ecdc';ctx.fillRect(x,y+i*(size+8),w+Math.min(12,pulse*12),size+5);ctx.fillStyle='#19211b';ctx.fillText(line,x+8,y+i*(size+8)+2,W-x*2-16);});
  ctx.restore();
}

const FX = {
  none: { name: '原图', icon: '🖼️', desc: '无效果，仅对照', params: [], draw() { ctx.drawImage(src, 0, 0); } },

  glitch: { name: '碎块位移', icon: '🧩', desc: '块错位 · RGB · 网点', hint: '复刻线上发布版：Kick 触发方块采样错位与 RGB 分离，能量叠加半调网点，Hi-hat 瞬态点亮星光。',
    params: [R('size','块大小',30,200,90,1),R('shift','位移强度',0,1,.5),R('rgb','RGB 分离',0,1,.4),R('ht','网点覆盖',0,1,.5),R('spark','星光',0,1,.5),D('drv','kick',['kick','snare','beat'])],
    state: { blocks: [], sparks: [], last: 0 },
    draw(f,p,t) { const s=this.state,sep=f.bass*p.rgb*16+f.dropHold*10;
      ctx.drawImage(src,0,0);if(sep>1)rgbSplit(ctx,sep,sep*.3);
      if(f[p.drv]>.5&&t-s.last>.1){s.last=t;const n=4+Math.floor(f[p.drv]*8+f.dropHold*10);
        for(let i=0;i<n;i++){const w=p.size*rnd(.5,1.6),h=p.size*rnd(.3,1.2);s.blocks.push({x:rnd(W-w),y:rnd(H-h),w,h,dx:(Math.random()-.5)*p.shift*260,dy:(Math.random()-.5)*p.shift*60,until:t+rnd(.08,.3),inv:Math.random()<.25});}}
      s.blocks=s.blocks.filter(b=>b.until>t);
      for(const b of s.blocks){ctx.drawImage(src,b.x,b.y,b.w,b.h,b.x+b.dx,b.y+b.dy,b.w,b.h);if(b.inv){ctx.fillStyle='rgba(180,255,240,.18)';ctx.fillRect(b.x+b.dx,b.y+b.dy,b.w,b.h);}ctx.strokeStyle='rgba(255,255,255,.35)';ctx.strokeRect(b.x+b.dx+.5,b.y+b.dy+.5,b.w,b.h);}
      if(p.ht>0){ctx.save();ctx.globalAlpha=p.ht*(.35+.65*f.energy);ctx.globalCompositeOperation='overlay';ctx.fillStyle=halftonePattern();ctx.fillRect(0,0,W,H);ctx.restore();}
      if(f.hat>.6&&Math.random()<p.spark)s.sparks.push({x:rnd(W),y:rnd(H),r:rnd(6,22),until:t+rnd(.15,.5),born:t});
      s.sparks=s.sparks.filter(k=>k.until>t);
      for(const k of s.sparks){const a=clamp((k.until-t)/(k.until-k.born),0,1);ctx.strokeStyle=`rgba(255,255,255,${a})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(k.x-k.r,k.y);ctx.lineTo(k.x+k.r,k.y);ctx.moveTo(k.x,k.y-k.r);ctx.lineTo(k.x,k.y+k.r);ctx.stroke();}
      dropFlash(f,p);
    } },

  contourField: {
    name: '轮廓波纹', icon: '🌀', desc: '主体同心轮廓 × 音频扩散',
    hint: '真实人物轮廓随音乐向外扩散；重音推动一处局部笔触时，相邻轮廓也会按距离产生更弱的连锁波动，像柔软介质受力后弹性回落。',
    params: [Sel('copy', '文字来源', ['自定义文字', '自动歌词'], '自定义文字'), T('text', '中心文案', ''), Sel('font', '字体风格', ['无衬线粗体', '窄体海报', '衬线编辑', '等宽科技'], '窄体海报'), Sel('style', '轮廓样式', ['柔光描边', '手绘粉笔', '极简细线', '律动丝带'], '柔光描边'), Sel('quality', '渲染精度', ['流畅', '高清', '超清'], '超清'), Sel('colorMode', '声场取色', ['图片取色', '反差取色', '经典白色', '手动颜色'], '手动颜色'), C('col', '手动颜色', '#E7E192'), R('textSize', '文字大小', .55, 1.6, 1), R('rings', '轮廓层数', 3, 8, 6, 1),
      R('gap', '扩散间距', 14, 52, 35, 1), R('width', '线条粗细', 8, 40, 20, 1), R('feather', '边缘羽化', 0, 4, 0, .1), R('speed', '释放速度', .25, 2.5, 2.5), R('pulse', '律动强度', 0, 2, 2), R('dark', '背景压暗', 0, .8, .26), D('drv', 'kick', ['bass', 'kick', 'beat', 'energy'])],
    state: { mask: null, field: null, warpA: null, warpB: null, fieldImage: null, fieldCanvas: null, key: '', lastPaint: -1, glCanvas: null, gl: null, glPhase: 0, glTarget: 0, glVelocity: 0, glLastT: null, glBeatWas: 0, glLastBeatAt: -9 },
    draw(f, p, t) { const s = this.state, sub = subject(), sb = subjectBounds(), cy = (sb.y0 + sb.y1) / 2;
      ctx.drawImage(src, 0, 0); if (p.dark > 0) { ctx.fillStyle = `rgba(0,0,0,${p.dark})`; ctx.fillRect(0, 0, W, H); }
      const selectedText = p.copy === '自动歌词' ? activeLyricAt(t) : p.text;
      const raw = (selectedText || '').trim().slice(0, 32), qualityScale = p.quality === '流畅' ? .5 : p.quality === '高清' ? .75 : 1, maskKey = S.srcKey + '|' + raw + '|' + (p.font || '') + '|' + (p.quality || '') + '|' + Math.round(p.textSize * 100) + '|' + !!S.cache.subjHQ;
      if (!s.mask) { s.mask = document.createElement('canvas'); s.mask.width = W; s.mask.height = H; s.fieldCanvas = document.createElement('canvas'); }
      const targetFW = Math.round(W * qualityScale), targetFH = Math.round(H * qualityScale); if (s.fieldCanvas.width !== targetFW || s.fieldCanvas.height !== targetFH) { s.fieldCanvas.width = targetFW; s.fieldCanvas.height = targetFH; s.key = ''; }
      if (s.key !== maskKey) { s.key = maskKey; const mg = s.mask.getContext('2d'); mg.clearRect(0, 0, W, H); mg.drawImage(sub, 0, 0); mg.globalCompositeOperation = 'source-in'; mg.fillStyle = '#fff'; mg.fillRect(0, 0, W, H); mg.globalCompositeOperation = 'source-over';
        if (raw) { const maxW = W * .82, base = 66 * p.textSize; mg.font = contourFont(p.font, base); const tw = Math.max(1, mg.measureText(raw).width), fs = base * Math.min(1, maxW / tw); mg.font = contourFont(p.font, fs); mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillStyle = '#fff'; mg.fillText(raw, W / 2, cy); }
        // A two-pass chamfer distance transform approximates Euclidean distance
        // from every exterior pixel to the previous mask edge. Contours sampled
        // from this field are true equal-distance offsets, unlike center scaling.
        const fc = s.fieldCanvas, fg = fc.getContext('2d', { willReadFrequently: true }), fw = fc.width, fh = fc.height; fg.clearRect(0, 0, fw, fh); fg.save(); fg.filter = qualityScale < .7 ? 'blur(.8px)' : qualityScale < .9 ? 'blur(.45px)' : 'blur(.18px)'; fg.drawImage(s.mask, 0, 0, fw, fh); fg.restore(); const px = fg.getImageData(0, 0, fw, fh), N = fw * fh, dist = new Float32Array(N), INF = 1e4, rt2 = Math.SQRT2, rt5 = Math.sqrt(5);
        for (let i = 0; i < N; i++) dist[i] = px.data[i * 4 + 3] > 72 ? 0 : INF;
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const i = y * fw + x; if (!dist[i]) continue; let d = dist[i]; if (x) d = Math.min(d, dist[i - 1] + 1); if (x > 1) d = Math.min(d, dist[i - 2] + 2); if (y) d = Math.min(d, dist[i - fw] + 1); if (y > 1) d = Math.min(d, dist[i - fw * 2] + 2); if (x && y) d = Math.min(d, dist[i - fw - 1] + rt2); if (x < fw - 1 && y) d = Math.min(d, dist[i - fw + 1] + rt2); if (y > 1 && x) d = Math.min(d, dist[i - fw * 2 - 1] + rt5); if (y > 1 && x < fw - 1) d = Math.min(d, dist[i - fw * 2 + 1] + rt5); if (y && x > 1) d = Math.min(d, dist[i - fw - 2] + rt5); if (y && x < fw - 2) d = Math.min(d, dist[i - fw + 2] + rt5); dist[i] = d; }
        for (let y = fh - 1; y >= 0; y--) for (let x = fw - 1; x >= 0; x--) { const i = y * fw + x; if (!dist[i]) continue; let d = dist[i]; if (x < fw - 1) d = Math.min(d, dist[i + 1] + 1); if (x < fw - 2) d = Math.min(d, dist[i + 2] + 2); if (y < fh - 1) d = Math.min(d, dist[i + fw] + 1); if (y < fh - 2) d = Math.min(d, dist[i + fw * 2] + 2); if (x < fw - 1 && y < fh - 1) d = Math.min(d, dist[i + fw + 1] + rt2); if (x && y < fh - 1) d = Math.min(d, dist[i + fw - 1] + rt2); if (y < fh - 2 && x) d = Math.min(d, dist[i + fw * 2 - 1] + rt5); if (y < fh - 2 && x < fw - 1) d = Math.min(d, dist[i + fw * 2 + 1] + rt5); if (y < fh - 1 && x > 1) d = Math.min(d, dist[i + fw - 2] + rt5); if (y < fh - 1 && x < fw - 2) d = Math.min(d, dist[i + fw + 2] + rt5); dist[i] = d; }
        // Two broad, deterministic noise fields are cached with the distance map.
        // Blending them over time gives every ring a slow hand-drawn undulation
        // without recalculating noise (or the expensive distance field) per frame.
        const warpA = new Float32Array(N), warpB = new Float32Array(N);
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const i = y * fw + x;
          warpA[i] = (Math.sin(x * .071 + y * .043) + Math.sin(x * .027 - y * .061 + 1.8) * .55) / 1.55;
          warpB[i] = (Math.cos(x * .052 - y * .033 + .7) + Math.sin(x * .019 + y * .082) * .5) / 1.5; }
        s.field = dist; s.warpA = warpA; s.warpB = warpB; s.fieldImage = fg.createImageData(fw, fh); s.lastPaint = -1; uploadContourSDF(s, dist, fw, fh); }
      const fc = s.fieldCanvas, fg = fc.getContext('2d'), n = Math.round(p.rings), drive = clamp(f[p.drv], 0, 1), beatDrive = clamp(drive * .55 + f.kick * .85 + f.beat * .28, 0, 1.8);
      if (!s.gl && S.playing && beatDrive > .48 && (s.cpuBeatWas || 0) <= .48 && t - (s.cpuAccentAt || -9) > .18) { s.cpuAccentRing = Math.floor(Math.random() * Math.max(1, n)); s.cpuAccentSeed = Math.random() * 18; s.cpuAccentStrength = .72 + beatDrive * .48; s.cpuAccentAt = t; } s.cpuBeatWas = beatDrive;
      if (renderContourGL(s, f, p, t)) { ctx.drawImage(s.glCanvas, 0, 0); }
      // Cap the procedural texture at 24 fps. The main canvas remains 60 fps,
      // but the costly pixel pass is reused between frames for a large speed-up.
      else if (t - s.lastPaint > 1 / 24) { s.lastPaint = t; const out = s.fieldImage.data, scale = W / fc.width;
        const cycle = (t * p.speed * (.2 + f.energy * .05)) % 1, shift = cycle * p.gap, radii = []; let r = shift;
        for (let layer = 0; layer <= n + 1; layer++) { radii.push({ r: r + p.gap * .028 * Math.sin(layer * 2.37), a: Math.sin(layer * 1.7), b: Math.cos(layer * 1.3) }); r += p.gap * (1 + layer * .13); }
        const maxR = radii[Math.min(n, radii.length - 1)]?.r || p.gap, ca = Math.cos(t * .62), sa = Math.sin(t * .62);
        for (let i = 0; i < s.field.length; i++) { const baseD = s.field[i] * scale; let a = 0;
          if (baseD > .5) { const qd = clamp(baseD / Math.max(1, maxR), 0, 1), wave = (s.warpA[i] * ca + s.warpB[i] * sa) * p.gap * (.07 + qd * .12) * (1 + beatDrive * .22), d = baseD + wave;
            for (let layer = 0; layer < radii.length; layer++) { const ring = radii[layer], q = layer / Math.max(1, n), px = (i % fc.width) / fc.width, py = Math.floor(i / fc.width) / fc.height, localGap = p.gap * (1 + layer * .13), ringDistance = Math.abs(layer - (s.cpuAccentRing || 0)), chosenRing = Math.exp(-ringDistance * .72), patchWave = .5 + .5 * Math.sin(px * 5.1 + py * 3.7 + (s.cpuAccentSeed || 0) - ringDistance * .28), chosenPatch = patchWave * patchWave * (3 - 2 * patchWave), accentAge = t - (s.cpuAccentAt || -9), accentAttack = clamp(accentAge / .075, 0, 1), accentRelease = accentAge < .075 ? 1 : Math.exp(-(accentAge - .075) * 6.2), accentPower = accentAttack * accentAttack * (3 - 2 * accentAttack) * accentRelease * (s.cpuAccentStrength || 0) * p.pulse * .72, localTurb = beatDrive * p.gap * (.012 + q * .007) * (s.warpA[i] * ring.a + s.warpB[i] * ring.b) + accentPower * chosenRing * chosenPatch * p.gap * .025, rr = ring.r + localTurb, brushWave = .5 + .5 * Math.sin(px * 8.3 + py * 5.7 + layer * 1.91), brushLobe = .5 + .5 * Math.sin(px * 3.1 - py * 7.2 + layer * 2.43 + 1.2), pressure = .48 + brushWave * .72 + brushLobe * .34 + accentPower * chosenRing * chosenPatch * .78, thick = Math.min(localGap * .7, p.width * (.42 + q * .72) * pressure), edge = Math.abs(d - rr);
              if (edge <= thick * .62) { const feather = 1 - edge / (thick * .62 + .001), aa = feather * feather * (3 - 2 * feather); a = Math.max(a, .72 + aa * .28); } } }
          const j = i * 4; out[j] = out[j + 1] = out[j + 2] = 255; out[j + 3] = Math.round(a * 255); }
        fg.putImageData(s.fieldImage, 0, 0); }
      if (!s.gl) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.filter = 'blur(.65px)'; ctx.drawImage(fc, 0, 0, W, H); ctx.restore(); }
      ctx.drawImage(sub, 0, 0); if (raw) { const maxW = W * .82, base = 66 * p.textSize; ctx.font = contourFont(p.font, base); const tw = Math.max(1, ctx.measureText(raw).width), fs = base * Math.min(1, maxW / tw); ctx.font = contourFont(p.font, fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = contourInk(p); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = Math.max(1, fs * .025); ctx.strokeText(raw, W / 2, cy); ctx.fillText(raw, W / 2, cy); }
      dropFlash(f, p); }
  },

  textWrap: {
    name: '文字环绕', icon: '🪐', desc: '文字沿主体外轮廓滚动',
    hint: '共用 MODNet 主体蒙版生成人物最外轮廓路径。文字按实际字宽占用弧长，逐字贴合曲线且不重叠；鼓点推进滚动并放大当前重点词，高频和旋律控制轻微呼吸。',
    params: [Sel('copy', '文字来源', ['自定义文字', '自动歌词'], '自动歌词'), T('text', '自定义文字', 'just another day / caught in the moment / let me stay here a little longer'), Sel('font', '字体风格', ['窄体海报', '无衬线粗体', '衬线编辑', '等宽科技'], '窄体海报'), Sel('colorMode', '文字取色', ['参考粉色', '图片取色', '反差取色', '手动颜色'], '参考粉色'), C('col', '手动颜色', '#ff4fa3'), Sel('background', '画面风格', ['参考黑白', '保留原色'], '参考黑白'),
      R('size', '基础字号', .65, 1.65, .86), R('emphasis', '局部大词', 1.5, 4.8, 3.35), R('offset', '轮廓距离', 8, 72, 30, 1), R('gap', '词间距', 2, 22, 8, 1), R('speed', '滚动速度', .05, 1.5, .5), R('lyricOffset', '歌词校准', -1.5, 1.5, 0, .05), R('pulse', '律动强度', 0, 2, .5), D('drv', 'beat', ['beat', 'kick', 'high', 'energy'])],
    state: { path: null, key: '', offset: 0, pulse: 0, focus: 0, was: 0, lastHit: -9, lastT: null, lyric: '', travel: 0, travelTarget: 0, lyricAbs: -1 },
    draw(f, p, t) { const s = this.state, dt = clamp(t - (s.lastT == null ? t : s.lastT), 0, .06); s.lastT = t;
      ctx.save(); if (p.background === '参考黑白') ctx.filter = 'grayscale(1) contrast(1.05)'; ctx.drawImage(src, 0, 0); ctx.restore();
      const lyricState = p.copy === '自动歌词' ? timedLyricAt(t + (p.lyricOffset || 0)) : null, selected = p.copy === '自动歌词' ? (lyricState?.text || '暂无歌词') : p.text, raw = (selected || '').trim(), tokens = wrapTokens(raw), pathKey = S.srcKey + '|' + Math.round(p.offset) + '|' + !!S.cache.subjHQ;
      if (s.key !== pathKey || !s.path) { s.key = pathKey; s.path = buildWrapPath(p.offset); }
      if (lyricState && raw) { s.lyric = raw; s.focus = Math.min(tokens.length - 1, Math.max(0, lyricState.word)); }
      const hit = Math.max(f[p.drv] || 0, f.kick * .96, f.beat * .8, f.snare * .55), audible = S.playing && (f.energy > .045 || f.bass > .06 || f.high > .05);
      if (audible && hit > .46 && s.was <= .46 && t - s.lastHit > .18) { s.lastHit = t; s.pulse = Math.max(s.pulse, .94 + hit * .42); if (!lyricState) { s.focus = (s.focus + 1) % Math.max(1, tokens.length); s.travelTarget += 88 + 30 * p.speed; } s.offset += 2.5 + hit * 6.5 * p.speed; }
      s.was = hit; s.pulse *= Math.pow(.925, dt * 60);
      if (audible) s.offset += dt * (2.2 + p.speed * 8.5) * (.45 + f.energy * .72 + f.high * .28);
      const lyricHold = lyricState ? .84 + .16 * Math.sin(Math.PI * lyricState.wordPhase) : 0, emphasisDrive = lyricState ? clamp(lyricHold + s.pulse * .16 * p.pulse, 0, 1.2) : clamp(.78 + s.pulse * .28 * p.pulse, 0, 1.25);
      const base = 19 + 17 * p.size, focusScale = 1 + (p.emphasis - 1) * emphasisDrive, breathe = 1 + (audible ? Math.sin(t * 3.2) * f.high * .025 * p.pulse : 0), ink = wrapTextInk(p), fontName = p.font || '窄体海报', path = s.path;
      const makeMetric = (word, scale = 1) => { const fs = base * scale * breathe; ctx.font = contourFont(fontName, fs); const glyphs = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)].map(x => x.segment) : Array.from(word); const widths = glyphs.map(ch => Math.max(fs * .22, ctx.measureText(ch).width)); return { glyphs, widths, fs, advance: widths.reduce((a, b) => a + b, 0) + p.gap + fs * .16 }; };
      const regular = tokens.map(word => makeMetric(word, 1 + clamp(f.high * p.pulse * .045, 0, .07))), cycle = regular.reduce((a, m) => a + m.advance, 0) || 1, focusMetric = makeMetric(tokens[s.focus] || tokens[0], focusScale), focusWidth = focusMetric.widths.reduce((a, b) => a + b, 0), visibleStart = path.total * .035, visibleSpan = path.total * .69;
      if (lyricState) { const target = lyricState.absoluteWord * (102 + p.speed * 22); if (s.lyricAbs < 0 || target < s.travelTarget - visibleSpan * .5) s.travel = target; s.travelTarget = target; s.lyricAbs = lyricState.absoluteWord; }
      const follow = 1 - Math.exp(-dt * (lyricState ? 5.6 : 7.2)); s.travel += (s.travelTarget - s.travel) * follow; const focusAt = visibleStart + ((s.travel % visibleSpan) + visibleSpan) % visibleSpan, focusReserve = focusWidth * .62 + p.gap * 1.5, flowOffset = s.offset + s.travel * .34, start = -((flowOffset % cycle) + cycle) % cycle;
      ctx.save(); ctx.fillStyle = ink; ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      let cursor = start - cycle, lap = -1; while (cursor < path.total + cycle && lap < Math.ceil(path.total / cycle) + 3) { for (let wi = 0; wi < tokens.length; wi++) { const m = regular[wi]; cursor += p.gap * .5; ctx.font = contourFont(fontName, m.fs); ctx.lineWidth = Math.max(.45, m.fs * .018); for (let gi = 0; gi < m.glyphs.length; gi++) { const gw = m.widths[gi], at = cursor + gw * .5, arcGap = Math.min(Math.abs(at - focusAt), path.total - Math.abs(at - focusAt)); if (at >= -80 && at <= path.total + 80 && arcGap > focusReserve) { const q = wrapPathPoint(path, at); let angle = q.angle; if (Math.cos(angle) < -.15) angle += Math.PI; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(angle); ctx.strokeText(m.glyphs[gi], 0, 0); ctx.fillText(m.glyphs[gi], 0, 0); ctx.restore(); } cursor += gw; } cursor += p.gap * .5 + m.fs * .16; } lap++; }
      // Keep the inner edge of enlarged glyphs outside the silhouette. The path
      // runs clockwise in canvas coordinates; its left normal points outward.
      // Never clamp to the viewport: offscreen letters should be clipped, not
      // pushed back onto the subject.
      let focusCursor = focusAt - focusWidth * .5;
      ctx.font = contourFont(fontName, focusMetric.fs); ctx.lineWidth = Math.max(.6, focusMetric.fs * .018);
      const outward = Math.max(0, focusMetric.fs - base * breathe) * .58;
      for (let gi = 0; gi < focusMetric.glyphs.length; gi++) {
        const gw = focusMetric.widths[gi], q = wrapPathPoint(path, focusCursor + gw * .5);
        const x = q.x + Math.sin(q.angle) * outward, y = q.y - Math.cos(q.angle) * outward;
        let angle = q.angle; if (Math.cos(angle) < -.15) angle += Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.strokeText(focusMetric.glyphs[gi], 0, 0); ctx.fillText(focusMetric.glyphs[gi], 0, 0); ctx.restore(); focusCursor += gw;
      }
      ctx.restore(); dropFlash(f, p); }
  },

  punchSymbols: createPunchStudioEffect(),

  rhythmPuzzle: createRhythmPuzzleEffect(),

  signalPoster: {name:'失真海报',icon:'📺',desc:'图文叠排 · 重音信号撕裂',hint:'同一张照片在三种海报构图间切换。轻扫描线常驻，重音触发短促横带错位，随后恢复清晰；每 4 或 8 拍换景。支持短句和当前歌词，暂停定格。',
    params:[Sel('copy','文字来源',['自定义文字','自动歌词'],'自定义文字'),T('text','文案','MAKE / SOME / NOISE'),R('tear','失真强度',0,1,.65),R('lines','扫描线',0,1,.35),Sel('pace','构图切换',['每4拍','每8拍','固定'],'每8拍'),C('ink','强调色','#e42b48')],state:{},
    draw(f,p,t){const s=this.state;editorialBeat(s,f,{drv:'beat'},t);
      if(!s.poster){s.poster=document.createElement('canvas');s.poster.width=W;s.poster.height=H;}
      const g=s.poster.getContext('2d'),mode=p.pace==='固定'?0:Math.floor(s.step/(p.pace==='每4拍'?4:8))%3;
      const accent=Math.max(f.kick||0,f.snare||0,f.drop||0);
      if(S.playing&&accent>.55&&(s.prevAccent||0)<=.55&&s.clock-(s.hit??-99)>.18){s.hit=s.clock;s.strength=accent;s.bands=Array.from({length:5},()=>({y:225+Math.random()*475,h:3+Math.random()*22,dx:(Math.random()-.5)*140}));}
      if(S.playing)s.prevAccent=accent;
      if(s.mode!==mode){s.cut=s.mode===undefined?-99:s.clock;s.mode=mode;}
      const hit=Math.exp(-Math.max(0,s.clock-(s.hit??-99))*10)*(s.strength||0)*p.tear;
      const cut=Math.exp(-Math.max(0,s.clock-(s.cut??-99))*12)*p.tear;
      g.clearRect(0,0,W,H);g.fillStyle='#f6f5f1';g.fillRect(0,0,W,H);g.textAlign='left';g.textBaseline='alphabetic';
      const raw=editorialCopy(p,t),words=raw.split(/[\/\n]+/).map(x=>x.trim()).filter(Boolean);
      const lines=[];
      for(const phrase of words){
        let line='';g.font='900 64px Arial, "PingFang SC", sans-serif';
        const tokens=phrase.match(/[\p{Script=Latin}\p{N}]+(?:['’][\p{Script=Latin}]+)?|\s+|./gu)||[];
        for(const token of tokens){if(g.measureText(line+token).width>430&&line){lines.push(line.trim());line='';}if(line||token.trim())line+=token;}
        if(line)lines.push(line);
      }
      const title=lines.slice(0,3);if(lines.length>3)title[2]=title[2].replace(/[\s,.!?]+$/,'')+'…';if(!title.length)title.push('ON REPEAT');
      const headline=(x,y,width,outline=false)=>{g.font='900 64px Arial, "PingFang SC", sans-serif';g.lineWidth=1;g.fillStyle='#171717';g.strokeStyle='#171717';
        title.forEach((line,i)=>{if(outline)g.strokeText(line,x,y+i*59,width);else g.fillText(line,x,y+i*59,width);});};
      g.font='11px monospace';g.fillStyle='#555';g.fillText('SIGNAL / '+String(mode+1).padStart(2,'0'),48,183);
      g.fillStyle=p.ink;g.fillRect(448,174,40,7);
      if(mode===1)headline(45,288,440,true);else if(mode===2)headline(51,301,433);
      const boxes=[[104,260,332,305],[65,333,410,260],[163,363,310,300]], [x,y,w,h]=boxes[mode];
      const zoom=mode===1?1.4:1,scale=Math.max(w/W,h/H)*zoom,sw=w/scale,sh=h/scale;
      // Small echo is a second print of the real image, not a decorative timer.
      g.save();g.globalAlpha=.10;g.filter='grayscale(1)';g.drawImage(src,(W-sw)/2,(H-sh)*.38,sw,sh,x+12,y-14,w,h);g.restore();
      g.fillStyle='#191919';g.fillRect(x,y-16,w,16);g.font='8px monospace';g.fillStyle='#f6f5f1';g.fillText('PHOTO SIGNAL                         REC',x+8,y-5);
      g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.filter='grayscale(1) contrast(1.18)';
      g.drawImage(src,(W-sw)/2,(H-sh)*.38,sw,sh,x,y,w,h);g.filter='none';
      g.fillStyle=`rgba(15,15,15,${p.lines*.4})`;for(let ly=y;ly<y+h;ly+=3)g.fillRect(x,ly,w,1);
      if(hit>.05){g.globalAlpha=hit*.55;g.globalCompositeOperation='screen';g.fillStyle=p.ink;g.fillRect(x,y+h*.42,w,9+hit*12);}
      g.restore();
      if(mode===0){headline(49,600,438);g.fillStyle=p.ink;g.fillRect(57,726,48,5);}else if(mode===1)headline(47,617,440);else {g.save();g.translate(56,650);g.rotate(-Math.PI/2);g.font='900 44px Arial';g.fillStyle='#171717';g.fillText(title[0],0,0,265);g.restore();}
      g.strokeStyle='#aaa';g.lineWidth=.6;g.beginPath();g.moveTo(48,744);g.lineTo(488,744);g.stroke();
      g.font='10px monospace';g.fillStyle='#666';g.fillText('AUDIO / '+Math.round(f.bpm||0)+' BPM',48,765);g.textAlign='right';g.fillText('LIVE TRANSMISSION',488,765);g.textAlign='left';
      ctx.drawImage(s.poster,0,0);
      // Distort the composed print so photo and typography tear together.
      for(const b of s.bands||[]){const amount=Math.max(hit,cut),dx=b.dx*amount;if(amount<.008)continue;ctx.fillStyle='#f6f5f1';ctx.fillRect(25,b.y,W-50,b.h);ctx.drawImage(s.poster,25,b.y,W-50,b.h,25+dx,b.y,W-50,b.h);}
      if(cut>.02){const sy=410;ctx.drawImage(s.poster,35,sy,W-70,3,35,sy,W-70,cut*95);}
    } },

  scan: {name:'像素扫描',icon:'🔍',desc:'横向拉丝 · 扫描刷新',hint:'扫描线从上向下刷新照片；未扫区域被六段宽幅横向曝光叠化，形成柔和长拖影。固定少量绘制，不使用逐行滤镜。',
    params:[R('bands','拉丝段数',3,9,6,1),R('band','拉丝长度',30,220,132,1),R('speed','推进速度',.4,2,1),R('mix','模糊浓度',.2,1,.78)],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,{drv:'beat'},t),target=((s.clock||0)*.105*p.speed)%1;if(target<(s.scan||0)-.45)s.scan=0;s.scan=S.playing?lerp(s.scan||0,target,1-Math.exp(-.22*p.speed)):(s.scan||0);const y=s.scan*H,remain=Math.max(1,H-y),bands=Math.round(p.bands),bh=remain/bands,clock=s.clock||0;
      ctx.drawImage(src,0,0);ctx.save();ctx.beginPath();ctx.rect(0,y,W,remain);ctx.clip();ctx.fillStyle=`rgba(12,15,14,${.025+p.mix*.05})`;ctx.fillRect(0,y,W,remain);ctx.imageSmoothingEnabled=true;
      for(let i=0;i<bands;i++){const sy=y+i*bh,hh=Math.min(bh+1,H-sy),seed=editorialNoise(i*31+7),dir=i%2?1:-1,flow=Math.sin(clock*.7+i*1.37),reach=p.band*(.58+seed*.58+e.pulse*.12),center=dir*flow*reach*.18;
        for(let tap=-4;tap<=4;tap++){const q=tap/4;ctx.globalAlpha=(.055+p.mix*.026)*(1-Math.abs(q)*.22);ctx.drawImage(src,0,sy,W,hh,center+q*reach,sy,W,hh);}
        ctx.globalAlpha=.18+p.mix*.16;ctx.drawImage(src,0,sy,W,hh,center-reach*.34,sy,W+reach*.68,hh);
      }
      ctx.restore();ctx.globalAlpha=1;ctx.drawImage(src,0,0,W,Math.max(1,y),0,0,W,Math.max(1,y));ctx.fillStyle='#f4eedf';ctx.fillRect(0,y,W,2);
      ctx.fillStyle='#171b18';ctx.fillRect(W-76,clamp(y-25,0,H-24),76,22);ctx.fillStyle='#fff';ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText('SCAN '+String(Math.floor(target*8)+1).padStart(2,'0'),W-38,clamp(y-10,14,H-9));
    } },

  dots: {name:'发光点阵',icon:'💡',desc:'灯珠成像 · 声浪点亮',hint:'照片本身由彩色灯珠组成。亮度决定灯珠尺寸，音乐在点阵中形成横向光浪，暗部仍能辨认，不叠加随机坏点。',
    params:[R('pitch','灯珠间距',5,20,9,1),R('glow','光晕',0,1,.55),R('pulse','光浪强度',0,1,.7),D('drv','beat',['beat','kick','hat'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t),g=editorialSamples(s,p.pitch,false,t);ctx.fillStyle='#101311';ctx.fillRect(0,0,W,H);
      const wave=(1-e.pulse)*H;
      for(let i=0;i<g.points.length;i++){const q=g.points[i],v=Math.max(.1,q.l),a=Math.max(0,1-Math.abs(q.y-wave)/130)*e.pulse*p.pulse,r=p.pitch*(.15+v*.29+a*.07);
        ctx.fillStyle=q.light;ctx.globalAlpha=.6+v*.4;ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();
        if(p.glow>0){ctx.globalAlpha=(.035+a*.13)*p.glow;ctx.beginPath();ctx.arc(q.x,q.y,r*2.1,0,Math.PI*2);ctx.fill();}
      }ctx.globalAlpha=1;
    } },

  hud: {
    name: '文字随风', icon: '🌬️', desc: '文字成网 · 随风成浪 · 跟拍起伏', hint: '按参考视频复刻：大号文字标记之间用弯曲点阵连成一张网，网面像风中的薄布一样连续起伏。英文按完整单词拆分，中文、韩文、日文等文字按单字拆分，[风] 类标记保持整体。音乐能量经过平滑包络后控制湍流强度。',
    params: [Sel('copy', '文字来源', ['自定义文字', '自动歌词'], '自定义文字'), T('text', '文案', '[风]'), R('size', '字号', .7, 1.6, 1), R('wind', '湍流', 0, 1, .68), R('wave', '起伏', 0, 1, .62), C('col', '颜色', '#d9fff0')],
    state: { nodes: [], edges: [], key: '', smoothE: 0, smoothH: 0, pulse: 0, phase: 0, dash: 0, lastBeat: 0 },
    draw(f, p, t) { const s = this.state;
      const selectedText = p.copy === '自动歌词' ? activeLyricAt(t) : p.text;
      const raw = (selectedText || '').trim() || '[风]';
      let words = raw.match(/\[[^\]]+\]|[A-Za-z0-9][A-Za-z0-9'\u2019+\-]*|[\p{L}\p{N}]|\p{Extended_Pictographic}/gu) || [];
      if (!words.length) words = ['[风]'];
      const n = 15, key = words.join('|');
      if (s.key !== key) { s.key = key; s.nodes = []; const cols = 3, rows = 5;
        for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols), bx = ((c + (r % 2 ? .18 : -.08)) / (cols - 1)) * W + rnd(-28, 28), by = (r + .55) / rows * H + rnd(-34, 34);
          s.nodes.push({ w: words[i % words.length], bx, by, x: bx, y: by, ph: rnd(0, 7), sz: rnd(.88, 1.12), ch: String(i + 1).padStart(2, '0'), q: String(Math.floor(rnd(1000, 9999))) }); }
        s.edges = []; for (let i = 0; i < n; i++) { const candidates = []; for (let j = i + 1; j < n; j++) { const d = Math.hypot(s.nodes[i].bx - s.nodes[j].bx, s.nodes[i].by - s.nodes[j].by); if (d < H * .32) candidates.push([d, j]); } candidates.sort((a, b) => a[0] - b[0]); for (let k = 0; k < Math.min(2, candidates.length); k++) if (Math.random() < .78) s.edges.push([i, candidates[k][1], rnd(-1, 1)]); }
      }
      if ((f.kick > .58 || f.beat > .78) && t - s.lastBeat > .18) { s.lastBeat = t; s.pulse = Math.max(s.pulse, .7 + f.energy * .3); }
      s.smoothE += (f.energy - s.smoothE) * .035; s.smoothH += (f.high - s.smoothH) * .045; s.pulse *= .955;
      s.phase += (.010 + p.wind * .009) * (.7 + s.smoothE * .65); s.dash += .28 + p.wind * .7 + s.smoothH * .9; ctx.drawImage(src, 0, 0);
      ctx.fillStyle = `rgba(20,68,76,${.025 + s.smoothE * .018})`; ctx.fillRect(0, 0, W, H);
      const fs = 26 * p.size, force = .58 + s.smoothE * .8, ampX = (8 + p.wind * 27) * force, ampY = (7 + p.wave * 24) * force;
      for (const g of s.nodes) { const u = s.phase * 2.2 + g.by * .009, v = s.phase * 2.75 + g.bx * .012;
        const travel = Math.sin(g.by / H * Math.PI * 2 - s.phase * 8.5) * s.pulse;
        g.x = g.bx + Math.sin(u + g.ph) * ampX + Math.cos(v * .63 - g.ph) * ampX * .38 + travel * (5 + p.wind * 9);
        g.y = g.by + Math.sin(v + g.ph * .7) * ampY + Math.cos(u * .8 + g.ph) * ampY * .42 + travel * (10 + p.wave * 22); }
      ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([1.6, 7]); ctx.lineDashOffset = -s.dash;
      for (let k = 0; k < s.edges.length; k++) { const [ia, ib, bend] = s.edges[k], a = s.nodes[ia], b = s.nodes[ib], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const mx = (a.x + b.x) / 2 - dy / len * bend * (18 + p.wind * 32), my = (a.y + b.y) / 2 + dx / len * bend * (18 + p.wave * 32);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.strokeStyle = rgba(p.col, .4 + s.smoothE * .24); ctx.lineWidth = 1.15 + s.smoothH * .5; ctx.stroke();
        const q = (s.phase * (.35 + s.smoothH * .35) + k * .137) % 1, xa = lerp(a.x, mx, q), ya = lerp(a.y, my, q), xb = lerp(mx, b.x, q), yb = lerp(my, b.y, q), px = lerp(xa, xb, q), py = lerp(ya, yb, q);
        ctx.fillStyle = rgba(p.col, .55 + s.smoothH * .4); ctx.fillRect(px - 1.4, py - 1.4, 2.8, 2.8); }
      ctx.restore(); ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      for (let i = 0; i < s.nodes.length; i++) { const g = s.nodes[i], lean = Math.sin(s.phase * 2 + g.ph) * (.018 + p.wind * .035), pulse = 1 + s.pulse * .035 * Math.sin(g.by / H * Math.PI * 2 - s.phase * 8.5) + Math.sin(s.phase * 2.5 + g.ph) * .018;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(lean); ctx.scale(g.sz * pulse, g.sz * pulse); ctx.font = `500 ${fs}px Manrope, "PingFang SC", monospace`;
        ctx.globalAlpha = .96; ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.lineWidth = fs * .1; ctx.strokeText(g.w, 0, 0); ctx.fillStyle = p.col; ctx.fillText(g.w, 0, 0);
        const tw = ctx.measureText(g.w).width; ctx.globalAlpha = .58; ctx.textAlign = 'left'; ctx.font = `500 ${Math.max(6, fs * .23)}px Manrope, monospace`; ctx.fillText(`CH${g.ch}  ${Math.round(g.x)},${Math.round(g.y)}`, tw / 2 + 5, -fs * .05); ctx.fillText(`QUERY_${g.ch} / ${g.q}`, -tw * .05, fs * .76); ctx.restore();
      }
      ctx.restore(); ctx.globalAlpha = 1; dropFlash(f, p); } },

  pixelReveal: {name:'粒子显影',icon:'✨',desc:'照片砂粒 · 局部扬起',hint:'整张照片由细密原色砂粒组成，鼓点让一片砂粒扬起再落回原位。粒子不是方块描边，静止时重新组成完整照片。',
    params:[R('pitch','砂粒大小',4,10,4,1),R('reach','扬起距离',20,180,78,1),R('radius','作用范围',80,400,225,1),R('duration','回落时间',.35,1.6,.95),D('drv','kick',['kick','beat','snare'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t),g=editorialSamples(s,p.pitch,false,t);ctx.fillStyle='#e7dfce';ctx.fillRect(0,0,W,H);
      const phase=clamp((s.clock-(s.born??-99))/p.duration,0,1),motion=Math.sin(phase*Math.PI),cx=W*(.25+editorialNoise(s.step*7)*.5),cy=H*(.3+editorialNoise(s.step*13)*.5);
      g.points.forEach((q,i)=>{const d=Math.hypot(q.x-cx,q.y-cy),local=Math.max(0,1-d/p.radius),seed=editorialNoise(i*19),a=seed*Math.PI*2,dist=local*motion*p.reach;ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x+Math.cos(a)*dist,q.y-Math.abs(Math.sin(a))*dist,p.pitch*.66*(1-local*motion*.3),0,Math.PI*2);ctx.fill();});
    } },

  stretchBands: {name:'横向拉丝',icon:'🪡',desc:'照片织带 · 前后穿插',hint:'从照片取样出宽窄相间的横向织带。大部分织带在人像后方，少量从下半身前方穿过；鼓点伸展、随后收回，不再自动循环。',
    params:[R('count','织带数量',5,18,10,1),R('reach','延展距离',20,250,150,1),R('thick','织带厚度',5,55,25,1),R('front','前景织带',0,1,.35),D('drv','snare',['snare','beat','kick'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t);ctx.drawImage(src,0,0);ctx.fillStyle='#e8e1d0';ctx.globalAlpha=.68;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
      const drawBand=i=>{const y=H*(.14+i/(p.count-1)*.77),sign=i%2?1:-1,x=W*(sign>0?.08:.92),h=p.thick*(.3+editorialNoise(i*11)*.9),len=W*.65+p.reach*e.pulse*(.4+editorialNoise(i)),left=sign>0?x:x-len;
        ctx.save();ctx.shadowColor='#18211755';ctx.shadowBlur=9;ctx.shadowOffsetY=5;ctx.drawImage(src,clamp(x,0,W-3),y,3,h,left,y,len,h);ctx.shadowBlur=0;ctx.globalAlpha=.22;ctx.fillStyle='#fff';ctx.fillRect(left,y,len,1);ctx.restore();};
      for(let i=0;i<p.count;i++)drawBand(i);ctx.drawImage(subject(),0,0);
      for(let i=0;i<p.count;i++)if(i>p.count*.6&&i%3===0){ctx.save();ctx.globalAlpha=p.front;drawBand(i);ctx.restore();}
    } },

  subjectSplit: {
    name: '上下分屏', icon: '✂️', desc: '文字剪影 × 抠图主体 × 歌词掉落',
    hint: '适配横图/宽幅人物图：上半保留环境并把主体变成由歌词填满的纯色剪影；下半为取色纸张背景和真实抠图主体。上下使用完全相同的裁切与比例。素材仅做筛选提示，仍由你手动选择。',
    params: [Sel('copy', '文字来源', ['自定义文字', '自动歌词'], '自定义文字'), T('text', '自定义文案', "don't you want to / be the one / when you go / nowhere else to go"),
      Sel('bg', '背景', ['图片取色', '手动纯色', '深色取色'], '图片取色'), C('col', '手动颜色', '#efefa9'),
      R('type', '字体/符号大小', .6, 2, 1.1), R('motion', '律动幅度', 0, 2, 1), R('fall', '掉落速度', .35, 1.8, .7), R('stars', '星点数量', 0, 1, .38), R('move', '主体律动', 0, 1, .18), D('drv', 'bass', ['bass', 'kick', 'beat', 'energy'])],
    state: { hit: 0, last: -9, lastDrop: -9, word: 0, drops: [], sparks: [], inside: [], nodes: [], insideKey: '', tm: null, plate: null, topSub: null, bottomSub: null },
    draw(f, p, t) { const s = this.state, cut = Math.round(H * .5), pal = imagePalette(), frame = splitFrame(), sub = S.cache.splitSub, sb = sub ? splitSubjectBounds(sub) : { x0: W * .2, y0: 12, x1: W * .8, y1: cut - 12 };
      const topSub = s.topSub || (s.topSub = document.createElement('canvas')), bottomSub = s.bottomSub || (s.bottomSub = document.createElement('canvas')); topSub.width = bottomSub.width = W; topSub.height = bottomSub.height = H;
      const ta = topSub.getContext('2d'), ba = bottomSub.getContext('2d'); ta.clearRect(0, 0, W, H); ba.clearRect(0, 0, W, H);
      if (sub) { ta.drawImage(sub, 0, 0, W, cut); const edge = ta.getImageData(0, 0, W, cut); for (let i = 3; i < edge.data.length; i += 4) { let a = clamp((edge.data[i] / 255 - .045) / .72, 0, 1); a = a * a * (3 - 2 * a); edge.data[i] = Math.round(a * 255); } ta.putImageData(edge, 0, 0); ba.drawImage(sub, 0, cut, W, H - cut); }
      const custom = (p.text || '').split(/[\/\n|,，]+/).map(x => x.trim()).filter(Boolean), liveLyric = activeLyricAt(t).trim();
      const phrases = p.copy === '自动歌词' ? [liveLyric || '暂无歌词'] : custom.length ? custom : ['ON LOOP'];
      const active = phrases[s.word % phrases.length] || phrases[0], pulse = Math.max(f.beat, f.kick);
      if ((pulse > .55 || (!S.playing && t - s.last > 1.25)) && t - s.last > .28) { s.last = t; s.word++; s.hit = 1; }
      if ((pulse > .62 || (!S.playing && t - s.lastDrop > 2.8)) && t - s.lastDrop > 2.8) { s.lastDrop = t;
        const line = p.copy === '自动歌词' ? (liveLyric || '暂无歌词') : phrases[s.word % phrases.length];
        const side = Math.random() < .5;
        s.drops.push({ text: line, x: side ? rnd(22, W * .24) : rnd(W * .62, W * .76), y: cut + rnd(-8, 12), vy: rnd(22, 34), rot: rnd(-.035, .035), born: t, life: rnd(4.5, 5.8), sizeScale: rnd(.88, 1.14), side }); s.drops = s.drops.slice(-2);
        const count = Math.round(1 + p.stars * 4); for (let i = 0; i < count; i++) s.sparks.push({ x: rnd(18, W - 18), y: cut + rnd(-20, 12), vy: rnd(34, 74), vx: rnd(-8, 8), born: t, life: rnd(2.5, 4.2), zScale: rnd(.78, 1.18), ph: rnd(0, 7) }); s.sparks = s.sparks.slice(-14); }
      s.hit *= .86;
      const bg = p.bg === '手动纯色' ? p.col : p.bg === '深色取色' ? pal.deep : splitAccent(), ink = p.bg === '深色取色' ? '#f5f3ee' : pal.deep;

      // Upper half: untouched location plus an opaque typographic silhouette.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cut); ctx.clip(); ctx.filter = 'saturate(.78) contrast(.96) brightness(.88)';
      ctx.drawImage(frame, 0, 0, W, cut); ctx.filter = 'none';
      const plate = s.plate || (s.plate = document.createElement('canvas')); plate.width = W; plate.height = H; const pg = plate.getContext('2d'); pg.globalCompositeOperation = 'source-over'; pg.clearRect(0, 0, W, H); pg.drawImage(topSub, 0, 0); pg.globalCompositeOperation = 'source-in'; pg.fillStyle = bg; pg.fillRect(0, 0, W, H); pg.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.shadowColor = bg; ctx.shadowBlur = 1 + f.high * 2; ctx.drawImage(plate, 0, 0); ctx.restore();
      const tm = s.tm || (s.tm = document.createElement('canvas')); tm.width = W; tm.height = H; const tg = tm.getContext('2d'); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H);
      const copyPool = (p.copy === '自动歌词' ? [liveLyric || '暂无歌词'] : custom.length ? custom : ['ON LOOP']).flatMap(q => { const ws = q.split(/\s+/).filter(Boolean); return ws.length > 1 ? ws : [q]; });
      const bx0 = clamp(sb.x0, 12, W - 40), bx1 = clamp(sb.x1, bx0 + 30, W - 12), by0 = clamp(sb.y0, 12, cut - 30), by1 = clamp(sb.y1, by0 + 24, cut - 10);
      const insideArea = Math.max(1, (bx1 - bx0) * (by1 - by0)), insideN = clamp(Math.round(insideArea / (1900 - p.type * 280)), 72, 112), insideKey = S.srcKey + '|' + copyPool.join('|') + '|' + Math.round(p.type * 10) + '|' + Math.round(bx0) + '|' + insideN;
      if (s.insideKey !== insideKey || s.inside.length !== insideN) { const cols = Math.max(7, Math.round(Math.sqrt(insideN * (bx1 - bx0) / Math.max(1, by1 - by0)))), rows = Math.ceil(insideN / cols); s.insideKey = insideKey; s.inside = Array.from({ length: insideN }, (_, i) => { const row = Math.floor(i / cols), col = i % cols, targetX = bx0 + (col + .5) * (bx1 - bx0) / cols, targetY = by0 + (row + .5) * (by1 - by0) / rows; return { text: copyPool[i % copyPool.length], x: targetX + rnd(-4, 4), y: by0 - 12 - row * rnd(5, 9), targetX, targetY, vx: rnd(-.2, .2), vy: rnd(5.4, 8.2), z: rnd(.72, 1), ph: rnd(0, 7), angle: rnd(-.025, .025), va: 0, pulse: 0, delay: rnd(0, .05), entered: false, born: t, hw: 20 }; }); const spots = [[.22,.2],[.72,.22],[.48,.45],[.22,.68],[.74,.7]]; s.nodes = spots.map((v, i) => ({ x: bx0 + v[0] * (bx1 - bx0), y: by0 + v[1] * (by1 - by0), band: i % 4, ph: i * 1.27 })); }
      const amp = p.motion == null ? 1 : p.motion, fs = 13 + p.type * 8, mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2, flow = amp * (.012 + f.bass * .075), beatWave = Math.sin(f.beatPhase * Math.PI * 2);
      tg.fillStyle = ink; tg.font = `700 ${fs}px Manrope, "PingFang SC", sans-serif`; tg.textBaseline = 'middle'; tg.textAlign = 'center';
      const nodeBands = [f.kick, f.bass, f.energy, f.high];
      for (const q of s.inside) { if (t - q.born < q.delay) continue; q.hw = Math.min((bx1 - bx0) * .14, 46, Math.max(10, tg.measureText(q.text).width * q.z * .5)); q.hh = fs * q.z * .48; const rx = q.x - mx, ry = q.y - my, rl = Math.max(30, Math.hypot(rx, ry)), landing = q.entered && t - q.enterAt < .72; let localPulse = 0; if (q.entered) for (const n of s.nodes) { const dxn = q.x - n.x, dyn = q.y - n.y, dn = Math.max(8, Math.hypot(dxn, dyn)), level = clamp(nodeBands[n.band] * .78 + f.beat * .34 + Math.max(0, Math.sin(f.beatPhase * Math.PI * 2 + n.ph)) * f.energy * .18, 0, 1), radius = 62 + level * 78, influence = dn < radius ? (1 - dn / radius) * level : 0; if (influence > 0) { localPulse = Math.max(localPulse, influence); q.vx += dxn / dn * influence * amp * .34; q.vy += dyn / dn * influence * amp * .26 + influence * amp * .035; q.va += (dxn >= 0 ? 1 : -1) * influence * amp * .014; } }
        q.pulse = Math.max(q.pulse * .82, localPulse); const sizeHit = 1 + amp * (f.energy * .12 + f.kick * .26 + f.beat * .1 + q.pulse * .58); q.hw *= sizeHit; q.hh *= sizeHit; q.renderScale = sizeHit; q.vx += (-ry / rl) * flow + amp * Math.sin(t * .9 + q.ph) * (.006 + f.high * .035) + amp * beatWave * .018; q.vy += (q.entered ? .05 : .2) + amp * ((rx / rl) * flow + Math.cos(t * .75 + q.ph) * (.004 + f.high * .025)); q.vx = clamp(q.vx * (q.entered ? .975 : .994), -4.2, 4.2); q.vy = clamp(q.vy * (q.entered ? .982 : .996), -1.4, 6.5); q.va *= .94; q.angle = clamp(q.angle + q.va, -.22, .22); q.x += q.vx; q.y += q.vy * (.92 + p.fall * .1); if (!q.entered && q.y >= by0 + q.hh) { q.entered = true; q.enterAt = t; } }
      for (let pass = 0; pass < 5; pass++) { for (let i = 0; i < s.inside.length; i++) for (let j = i + 1; j < s.inside.length; j++) { const a = s.inside[i], b = s.inside[j]; if (!a.entered || !b.entered) continue; const ox = a.hw + b.hw + 3 - Math.abs(a.x - b.x), oy = a.hh + b.hh + 3 - Math.abs(a.y - b.y); if (ox > 0 && oy > 0) { const kickOut = .14 + amp * (f.kick * .42 + f.beat * .18); if (ox < oy) { const dir = a.x < b.x ? -1 : 1; a.x += dir * ox * .54; b.x -= dir * ox * .54; const av = a.vx; a.vx = b.vx * .42 + dir * kickOut; b.vx = av * .42 - dir * kickOut; } else { const dir = a.y < b.y ? -1 : 1; a.y += dir * oy * .54; b.y -= dir * oy * .54; const av = a.vy; a.vy = b.vy * .38 + dir * kickOut; b.vy = av * .38 - dir * kickOut; } const spin = (a.vx - b.vx) * .009; a.va += spin; b.va -= spin; } } for (const q of s.inside) { if (!q.entered) continue; if (q.x - q.hw < bx0 || q.x + q.hw > bx1) { q.x = clamp(q.x, bx0 + q.hw, bx1 - q.hw); q.vx *= -.52; q.va += q.vy * .004; } if (q.y + q.hh > by1) { q.y = by1 - q.hh; q.vy = 0; q.va += q.vx * .004; } if (q.y - q.hh < by0) { q.y = by0 + q.hh; q.vy = Math.max(.35, q.vy); } } }
      for (const q of s.inside) { const breathe = q.z * (q.renderScale || 1); tg.save(); tg.translate(q.x, q.y); tg.rotate(q.angle); tg.scale(breathe, breathe); tg.fillText(q.text, 0, 0); tg.restore(); }
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(topSub, 0, 0); tg.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .94; const shake = amp * f.kick * 1.25; ctx.drawImage(tm, rnd(-shake, shake), rnd(-shake, shake)); ctx.globalAlpha = 1; ctx.restore();

      // Lower half: picked paper colour, enlarged live cutout, open space for falling lyrics.
      ctx.fillStyle = bg; ctx.fillRect(0, cut, W, H - cut); ctx.save(); ctx.globalAlpha = .045; ctx.fillStyle = ink; for (let i = 0; i < 240; i++) { const x = (i * 83) % W, y = cut + ((i * 137) % (H - cut)); ctx.fillRect(x, y, 1, 1); } ctx.restore();
      const drive = clamp(f[p.drv], 0, 1), subjectScale = 1 + p.move * (drive * .055 + f.kick * .025), subjectLift = p.move * (drive * 12 + f.beat * 5); ctx.save(); ctx.beginPath(); ctx.rect(0, cut, W, H - cut); ctx.clip(); ctx.globalAlpha = 1; ctx.translate(W / 2, cut + (H - cut) / 2 - subjectLift); ctx.scale(subjectScale, subjectScale); ctx.drawImage(bottomSub, -W / 2, -(cut + (H - cut) / 2)); ctx.restore();

      s.drops = s.drops.filter(d => t - d.born < d.life && d.y < H + 150); for (const d of s.drops) { const age = t - d.born, dSize = (13 + p.type * 8) * (d.sizeScale || 1); d.y += d.vy / 60 * p.fall * (1 + f.kick * 2.2); d.x += Math.sin(t * 1.4 + d.born * 3) * .18; const fade = Math.min(1, age * 3) * Math.min(1, (d.life - age) * 1.5); ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot + Math.sin(t + d.born) * .018); ctx.globalAlpha = fade * .9; ctx.fillStyle = ink; ctx.strokeStyle = bg; ctx.lineWidth = Math.max(1.5, dSize * .09); ctx.font = `700 ${dSize}px Manrope, "PingFang SC", sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const ws = d.text.split(/\s+/).filter(Boolean), maxW = 170 + p.type * 18; let yy = 0, line = ''; for (const w of ws) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.strokeText(line, 0, yy); ctx.fillText(line, 0, yy); line = w; yy += dSize * .94; } else line = test; } if (line) { ctx.strokeText(line, 0, yy); ctx.fillText(line, 0, yy); } ctx.restore(); }
      s.sparks = s.sparks.filter(q => t - q.born < q.life && q.y < H + 20); for (const q of s.sparks) { const age = t - q.born, z = (2.2 + p.type * 2.7) * (q.zScale || 1); q.y += q.vy / 60 * p.fall * (1 + f.kick * 1.8); q.x += q.vx / 60 + Math.sin(t * 2 + q.ph) * .12; const a = Math.min(1, age * 5) * Math.min(1, (q.life - age) * 2); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(t * .35 + q.ph); ctx.globalAlpha = a * (.55 + f.high * .4); ctx.fillStyle = p.bg === '深色取色' ? '#fff' : ink; ctx.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? z * .42 : z, an = -Math.PI / 2 + j * Math.PI / 5; if (!j) ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); else ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.globalAlpha = .18 + f.high * .35; ctx.fillRect(0, cut - 1, W, 1 + f.high * 2); ctx.globalAlpha = 1; dropFlash(f, p); } },

  mosaic: {name:'马赛克',icon:'🟦',desc:'大块拼贴 · 重音错位',hint:'改为杂志感大块取景：平时与原图对齐，重音到来时少量宽幅切片横向错位，随后快速回弹，不再出现方格网页马赛克。',
    params:[R('pieces','拼贴块数',3,10,6,1),R('shift','错位距离',8,90,38,1),R('height','切片高度',.05,.2,.1),R('tint','取色浓度',0,.65,.2),D('drv','beat',['beat','kick','snare'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t),pal=imagePalette(),accent=splitAccent(),age=Math.max(0,s.clock-(s.born??-99)),attack=clamp(age/.055,0,1),release=age<.055?1:Math.exp(-(age-.055)*7.5),hit=attack*release;ctx.drawImage(src,0,0);const n=Math.round(p.pieces);
      for(let i=0;i<n;i++){const seed=s.step*101+i*37,y=H*(.08+editorialNoise(seed+1)*.82),h=H*p.height*(.62+editorialNoise(seed+2)*.72),w=W*(.34+editorialNoise(seed+3)*.48),x=(W-w)*editorialNoise(seed+4),dir=editorialNoise(seed+5)>.5?1:-1,dx=dir*(2.5+p.shift*hit*(.55+editorialNoise(seed+6)*.6));ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(dx,0);ctx.drawImage(src,0,0);ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=p.tint*(.6+hit*.4);ctx.fillStyle=i%2?accent:pal.soft;ctx.fillRect(x-dx,y,w,h);ctx.restore();ctx.globalAlpha=.08+hit*.2;ctx.fillStyle=pal.deep;ctx.fillRect(clamp(x+dx-dir*3,0,W-1),y,1.2,h);}
      ctx.globalAlpha=1;
    } },

  warhol: {name:'波普四格',icon:'🎨',desc:'音乐分镜 · 大小景接力',hint:'每四拍切换全幅、双栏、不对称三格与四格。每格使用不同取景和印刷处理，保留自然比例；不是固定四张同图一起缩放。',
    params:[R('gap','分镜留白',2,24,10,1),R('crop','特写幅度',0,.6,.28),R('tone','印刷色浓度',0,.8,.3),D('drv','beat',['beat','kick','bar'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t),layouts=[[[0,0,1,1]],[[0,0,.5,1],[.5,0,.5,1]],[[0,0,1,.57],[0,.57,.5,.43],[.5,.57,.5,.43]],[[0,0,.5,.5],[.5,0,.5,.5],[0,.5,.5,.5],[.5,.5,.5,.5]]],cells=layouts[Math.floor(s.step/4)%4];editorialGround();
      cells.forEach(([x,y,w,h],i)=>{x=x*W+p.gap;y=y*H+p.gap;w=w*W-p.gap*2;h=h*H-p.gap*2;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
        const z=Math.max(w/W,h/H)*(1+p.crop*(i%3)+e.pulse*.025),sw=w/z,sh=h/z,sx=(W-sw)*(.35+(i%2)*.3),sy=(H-sh)*(.25+i*.12);
        ctx.filter=i%3===1?'grayscale(1) contrast(1.25)':'none';ctx.drawImage(src,sx,sy,sw,sh,x,y,w,h);ctx.filter='none';
        if(i%3===2){ctx.globalCompositeOperation='multiply';ctx.globalAlpha=p.tone;ctx.fillStyle=splitAccent();ctx.fillRect(x,y,w,h);}
        ctx.restore();ctx.fillStyle='#f5efdf';ctx.fillRect(x+9,y+9,29,24);ctx.fillStyle='#242722';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('0'+(i+1),x+23,y+26);
      });
    } },

  bars: {name:'音乐频谱',icon:'🎚️',desc:'流线声浪 · 人物在前',hint:'连续平滑的闭合声浪；频谱可见度统一控制视觉强度，不再提供作用重复的透明度参数。',
    params:[R('n','频带数量',24,72,51,1),R('height','声浪高度',.05,.4,.09),R('visibility','频谱可见度',.5,5,5),R('photo','背景清晰度',.45,1,.45),R('width','填充浓度',.1,1,.1)],state:{sm:new Float32Array(72)},
    draw(f,p,t){const s=this.state,pal=imagePalette(),accent=splitAccent(),n=Math.round(p.n),pad=14,span=W-pad*2,center=H*.52;
      ctx.save();ctx.filter=`saturate(.9) brightness(${.66+p.photo*.34})`;ctx.drawImage(src,0,0);ctx.restore();
      for(let i=0;i<n;i++){let v=0;if(freq&&S.playing){const lo=Math.floor(Math.pow(i/n,1.62)*430)+1,hi=Math.max(lo+1,Math.floor(Math.pow((i+1)/n,1.62)*430));for(let k=lo;k<hi;k++)v+=(freq[k]||0);v=clamp(v/(hi-lo)/215,0,1);}s.sm[i]=lerp(s.sm[i]||0,v,.2);}
      const vis=p.visibility??5,smooth=(pts,move=true)=>{move?ctx.moveTo(pts[0][0],pts[0][1]):ctx.lineTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length-1;i++){const mx=(pts[i][0]+pts[i+1][0])/2,my=(pts[i][1]+pts[i+1][1])/2;ctx.quadraticCurveTo(pts[i][0],pts[i][1],mx,my);}const last=pts[pts.length-1];ctx.lineTo(last[0],last[1]);},trace=(scale,fill,stroke,alpha,line)=>{const top=[],bottom=[];for(let i=0;i<n;i++){const x=pad+i*span/(n-1),amp=(10+f.energy*12+s.sm[i]*H*p.height*(.72+vis*.18))*scale;top.push([x,center-amp]);bottom.unshift([x,center+amp]);}ctx.beginPath();smooth(top,true);smooth(bottom,false);ctx.closePath();ctx.globalAlpha=clamp(alpha*(.62+vis*.16),0,1);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.lineJoin='round';ctx.stroke();}};
      const grad=ctx.createLinearGradient(0,center-H*.2,0,center+H*.2);grad.addColorStop(0,accent+'a8');grad.addColorStop(.5,accent+'ff');grad.addColorStop(1,accent+'a8');
      trace(1,grad,pal.soft,.78+p.width*.16,1.35);trace(.72,accent+'78',accent,.5+p.width*.12,.9);trace(.43,null,pal.deep,.38+p.width*.1,.68);ctx.globalAlpha=1;
      ctx.drawImage(subject(),0,0);
    } },

  ascii: {name:'字符画',icon:'🔤',desc:'文字肖像 · 歌词排印',hint:'照片以原色文字重新排印；当前歌词成为大标题。鼓点让局部字符加粗点亮，文字来源可直接在效果面板切换。',
    params:[Sel('copy','文字来源',['自定义文字','自动歌词'],'自定义文字'),T('text','文案','MAKE / SOME / NOISE'),R('pitch','字符间距',6,20,9,1),R('headline','标题大小',28,94,62,1),R('color','原图色彩',0,1,.75),D('drv','beat',['beat','kick','hat'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t),g=editorialSamples(s,p.pitch,false,t),raw=editorialCopy(p,t),chars=Array.from(raw.replace(/\s/g,''))||['+'];ctx.fillStyle='#171b18';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 '+p.pitch+'px monospace';
      for(const q of g.points){if(q.l<.06)continue;ctx.globalAlpha=.4+q.l*.6;ctx.fillStyle='#ede6d1';ctx.fillText(chars[Math.floor(q.l*(chars.length-1))]||'+',q.x,q.y);ctx.fillStyle=q.light;ctx.globalAlpha*=p.color;ctx.fillText(chars[Math.floor(q.l*(chars.length-1))]||'+',q.x,q.y);}
      ctx.globalAlpha=1;editorialHeadline(raw,p.headline,28,Math.min(H*.74,H-3*(p.headline+8)-24),e.pulse);
    } },

  rain: {name:'字符雨',icon:'🌧️',desc:'扁平字阵 · 鼓点换列',hint:'无描边、无混合叠色的纯色字符雨。默认使用照片代表色，也可切换自动反差、深浅色、经典黑白或手动颜色。',
    params:[Sel('copy','文字来源',['自定义文字','自动歌词'],'自定义文字'),T('text','文案','SOFT / RAIN'),Sel('font','字体样式',['粗体无衬线','窄体海报','等宽字体','衬线编辑'],'粗体无衬线'),Sel('unit','排版样式',['单字雨','双字组','短词组'],'单字雨'),Sel('colorMode','颜色模式',['自动反差','图片深色','图片亮色','图片代表色','经典黑色','经典白色','手动颜色'],'图片代表色'),C('col','手动颜色','#F4F0E6'),R('pitch','文字间距',16,42,27,1),R('density','字符覆盖',.04,.42,.1),R('fall','落字距离',30,240,110,1),R('photo','底图清晰度',.55,1,.92),D('drv','beat',['beat','kick','snare'])],state:{},
    draw(f,p,t){const s=this.state,e=editorialBeat(s,f,p,t),g=editorialSamples(s,p.pitch,false,t),raw=editorialCopy(p,t),compact=Array.from(raw.replace(/[\s/]+/g,'')),words=raw.split(/[\s/]+/).filter(Boolean),pal=imagePalette(),fontSize=Math.max(14,p.pitch*(p.unit==='单字雨'?.78:p.unit==='双字组'?.62:.52));ctx.save();ctx.filter=`saturate(.9) brightness(${.72+p.photo*.28})`;ctx.drawImage(src,0,0);ctx.restore();
      const weight=p.font==='衬线编辑'?'600':p.font==='窄体海报'?'900':'800',family=p.font==='窄体海报'?'Impact, "Arial Narrow", "PingFang SC", sans-serif':p.font==='等宽字体'?'"SFMono-Regular", Menlo, Consolas, "PingFang SC", monospace':p.font==='衬线编辑'?'Georgia, "Songti SC", serif':'Manrope, "PingFang SC", sans-serif';ctx.font=`${weight} ${fontSize}px ${family}`;ctx.textAlign='center';ctx.textBaseline='middle';
      const units=p.unit==='双字组'?Array.from({length:Math.max(1,Math.ceil(compact.length/2))},(_,i)=>(compact[i*2]||'')+(compact[i*2+1]||'')):p.unit==='短词组'?(words.length?words:['RAIN']):(compact.length?compact:['·']),age=Math.max(0,s.clock-(s.born??-99)),cycle=clamp(age/.5,0,1),drop=1-Math.pow(1-cycle,3),flatInk=q=>{if(p.colorMode==='图片深色')return pal.deep;if(p.colorMode==='图片亮色')return pal.soft;if(p.colorMode==='图片代表色')return splitAccent();if(p.colorMode==='经典黑色')return '#161616';if(p.colorMode==='经典白色')return '#F7F4EC';if(p.colorMode==='手动颜色')return p.col||'#F4F0E6';return q.l>.53?'#171717':'#F7F4EC';};
      g.points.forEach((q,i)=>{const col=Math.floor(q.x/p.pitch),row=Math.floor(q.y/p.pitch),columnOn=editorialNoise(col*41+s.step*97)<.38;if(!columnOn||editorialNoise(i*23+s.step*53)>p.density)return;const delay=editorialNoise(row*17+col*31)*.16,progress=clamp((drop-delay)/(1-delay),0,1),off=(1-progress)*p.fall,glyph=units[(i+s.step)%units.length];ctx.globalAlpha=.96;ctx.fillStyle=flatInk(q);ctx.fillText(glyph,q.x,q.y-off);});ctx.globalAlpha=1;
    } },

};
const FX_ORDER = ['hud', 'subjectSplit', 'contourField', 'textWrap', 'punchSymbols', 'rhythmPuzzle', 'bars', 'rain', 'signalPoster', 'glitch', 'scan', 'dots', 'warhol', 'ascii', 'pixelReveal', 'stretchBands'];

const FX_CAPS = {
  signalPoster: ['单图三构图', '自定义文字 / 当前歌词', '扫描线', '重音横带撕裂', '节拍换景'],
  none: ['9:16 素材适配'], glitch: ['方块采样错位', 'RGB 通道分离', 'Kick / Hi-hat 瞬态检测'], scan: ['照片降采样', '节拍推进', '局部拉伸扫描'],
  dots: ['原色灯珠', '亮度尺寸映射', '节拍光浪'], mosaic: ['大块取景', '重音错位回弹', '照片自适应取色'], warhol: ['四种分镜布局', '等比例特写', '四拍换景'],
  ascii: ['原色字符成像', '歌词标题排印'], rain: ['无描边纯色字粒', '四种字体风格', '七种取色模式', '按列落位', '鼓点重组'], bars: ['实时 FFT', '连续曲线插值', '前后景声波海报'],
  hud: ['短标记自动分组', '曲线点阵网格', '流动高亮点', '双层湍流场', 'CH/QUERY 数据标注', '音乐位移波'], pixelReveal: ['细密原色采样', '局部砂粒位移', '鼓点扬起与回落'],
  contourField: ['MODNet 主体蒙版', '蒙版膨胀/差集', '文字轮廓合并', '低频/节拍扩散'], textWrap: ['MODNet 主体外轮廓', '曲线字形排版', '弧长防重叠', '歌词时间轴', '鼓点重点词推进'], punchSymbols: ['画面与歌曲选形', '照片主色取色', '十种背景质感', '实测拍点分批打孔', '异位聚集', '自然下落'], rhythmPuzzle: ['九宫格裁切', '整行整列滑轨', '重音触发', '自动拼回完整图', '图片取色文案'], stretchBands: ['局部色彩采样', '横向像素延展', '主体分割保护', '节拍状态机'],
  subjectSplit: ['实时主体分割', '前景/背景分层', '图片取色', '轮廓文字填充', '高低频/节拍驱动']
};

for (const id in FX) { S.params[id] = {}; FX[id].params.forEach(pp => S.params[id][pp.key] = pp.def); }

/* =====================================================================
   6. RENDER LOOP
   ===================================================================== */
let lastT = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), t = now / 1000; lastT = now;
  refreshSource();
  const f = computeFeatures(t);
  const fx = FX[S.fx];
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  try { fx.draw(f, S.params[S.fx], t); } catch (e) { if (fx.lastError !== e.message) { console.error('Effect render failed:', S.fx, e); fx.lastError = e.message; } ctx.drawImage(src, 0, 0); }
  ctx.restore();
  if ($('#showMask').checked) { ctx.save(); ctx.fillStyle = 'rgba(14,16,22,.92)'; ctx.fillRect(0, 0, W, H); ctx.drawImage(subject(), 0, 0);
    ctx.fillStyle = '#4ad4f0'; ctx.font = '500 22px Manrope'; ctx.fillText(S.cache.subjAI ? 'AI 抠像' : '快速估算', 18, 34); ctx.restore(); }
  if (S.isVideo) drawPeek();
  // meters
  setMeter('#mk', '#bk', f.kick); setMeter('#ms', '#bs', f.snare); setMeter('#mh', '#bh', f.hat); setMeter('#me', '#be', f.energy);
  $('#bb').style.width = ((1 - f.beatPhase) * 100) + '%'; $('#mb').textContent = f.bpm ? f.bpm : '–';
  const nd = f.nextDrop == null ? (S.analysis?.drops.length ? 'Drop 已过' : '无 Drop') : 'Drop ' + f.nextDrop.toFixed(1) + 's'; $('#aSec').textContent = f.section; $('#aDrop').textContent = nd;
  if (S.buffer) $('#tpos').textContent = fmtT(f.t);
  drawSpectrum(f);
  $('#bigbtn').classList.toggle('hit', f.kick > 0.6);
  if (S.playing) drawTimeline(f.t);
}
const fmtT = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const spec = $('#spec'), spctx = spec.getContext('2d');
const specSm = new Float32Array(56);
function drawSpectrum(f) {
  const w = spec.width, h = spec.height, n = specSm.length, gap = 5, bw = (w - gap * (n - 1)) / n;
  spctx.clearRect(0, 0, w, h);
  spctx.strokeStyle = 'rgba(255,255,255,.055)'; spctx.lineWidth = 2; spctx.beginPath(); spctx.moveTo(0, h - 5); spctx.lineTo(w, h - 5); spctx.stroke();
  for (let i = 0; i < n; i++) {
    let v = 0;
    if (freq && S.playing) { const lo = Math.floor(Math.pow(i / n, 1.75) * 480) + 1, hi = Math.max(lo + 2, Math.floor(Math.pow((i + 1) / n, 1.75) * 480));
      let s = 0; for (let k = lo; k < hi; k++) s += freq[k]; v = clamp(s / (hi - lo) / 175 * (0.6 + i / n * 1.0), 0, 1); }
    specSm[i] = Math.max(Math.max(v * 1.08, 0.018 + 0.01 * Math.sin(i * 0.7 + performance.now() / 900)), specSm[i] * 0.9);
    const bh = Math.max(4, specSm[i] * (h - 12)), x = i * (bw + gap), y = h - 5 - bh;
    const g = spctx.createLinearGradient(0, h - bh, 0, h);
    g.addColorStop(0, 'rgba(240,240,234,.9)'); g.addColorStop(.5, 'rgba(190,201,194,.62)'); g.addColorStop(1, 'rgba(148,160,153,.12)');
    spctx.fillStyle = g; spctx.beginPath(); spctx.roundRect(x, y, bw, bh, Math.min(bw / 2, 6)); spctx.fill();
  }
}
function setMeter(a, b, v) { $(a).textContent = v.toFixed(2); $(b).style.width = clamp(v, 0, 1) * 100 + '%'; }

/* ---------- timeline ---------- */
const tlc = $('#tlc'), tctx = tlc.getContext('2d');
function drawTimeline(t = 0) {
  const A = S.analysis, w = tlc.width, h = tlc.height; tctx.clearRect(0, 0, w, h);
  if (!A) { tctx.fillStyle = '#555650'; tctx.font = '600 27px Manrope'; tctx.fillText('选择音乐后开始', 26, h / 2 + 10); return; }
  const X = s => s / A.dur * w;
  const cy = h * .52, amp = h * .39, px = X(t);
  for (const s of A.segs) { tctx.fillStyle = ['rgba(255,255,255,.012)','rgba(121,242,166,.022)','rgba(255,176,74,.035)'][s.lvl]; tctx.fillRect(X(s.a), 0, X(s.b) - X(s.a), h); }
  const wave = () => { tctx.beginPath(); A.curve.forEach((v, i) => { const x = i / 199 * w, y = cy - (5 + v * amp); i ? tctx.lineTo(x, y) : tctx.moveTo(x, y); }); for (let i = A.curve.length - 1; i >= 0; i--) { const v = A.curve[i], x = i / 199 * w; tctx.lineTo(x, cy + (5 + v * amp)); } tctx.closePath(); };
  wave(); const idle = tctx.createLinearGradient(0, 0, 0, h); idle.addColorStop(0, 'rgba(214,216,211,.36)'); idle.addColorStop(.5, 'rgba(214,216,211,.15)'); idle.addColorStop(1, 'rgba(214,216,211,.3)'); tctx.fillStyle = idle; tctx.fill();
  tctx.save(); tctx.beginPath(); tctx.rect(0, 0, Math.max(0, px), h); tctx.clip(); wave(); const played = tctx.createLinearGradient(0, 0, w, 0); played.addColorStop(0, 'rgba(222,225,228,.78)'); played.addColorStop(1, 'rgba(121,242,166,.72)'); tctx.fillStyle = played; tctx.fill(); tctx.restore();
  tctx.fillStyle = 'rgba(255,255,255,.12)'; for (const b of A.downbeats) { const x = X(b); tctx.beginPath(); tctx.arc(x, h - 7, 1.4, 0, Math.PI * 2); tctx.fill(); }
  for (const d of A.drops) { const x = X(d); tctx.fillStyle = 'rgba(255,112,91,.72)'; tctx.fillRect(x - 1, 7, 2, h - 14); tctx.beginPath(); tctx.arc(x, 7, 3.2, 0, Math.PI * 2); tctx.fill(); }
  tctx.fillStyle = '#f6f5f1'; tctx.fillRect(px - 1.3, 4, 2.6, h - 8); tctx.beginPath(); tctx.arc(px, 5, 3.4, 0, Math.PI * 2); tctx.fill();
}
$('#tl').addEventListener('click', e => { if (!S.buffer) return; const r = e.currentTarget.getBoundingClientRect(); const at = (e.clientX - r.left) / r.width * S.buffer.duration; play(at); });

/* =====================================================================
   7. UI
   ===================================================================== */
function selectFx(id) { S.fx = id; $('#punchExampleBtn').hidden=id!=='punchSymbols'; if(id === 'punchSymbols'){FX[id].state.origin=songTime();FX[id].state.key=null;} document.querySelectorAll('#fxlist button, #originalCompare button').forEach(b => b.classList.toggle('on', b.dataset.id === id)); $('#fxname').textContent = FX[id].name + ' · ' + FX[id].desc; const caps = FX_CAPS[id] || []; $('#fxhint').textContent = (FX[id].hint || '') + (caps.length ? '\n技术能力：' + caps.join(' · ') : ''); buildParams();
  if (id === 'subjectSplit') { setSeg(S.isVideo ? '实时视频抠像 · 启动中…' : 'MODNet 高清抠像 · 启动中…', 'working'); setTimeout(() => S.isVideo ? refineSubject() : refineSubjectHQ('split'), 20); }
  else if (!S.isVideo && !S.cache.subjHQ && ['punchSymbols', 'bars', 'stretchBands', 'contourField', 'textWrap'].includes(id)) { setSeg('MODNet 高清抠像 · 启动中…', 'working'); setTimeout(() => refineSubjectHQ('full'), 20); }
}
function buildFxList() { const list = $('#fxlist'); list.innerHTML = '';
  for (const id of ['none', ...FX_ORDER]) { const e = FX[id]; if (!e) continue; const b = document.createElement('button'); b.dataset.id = id;
    b.innerHTML = `<span class="ico">${e.icon}</span>${e.name}`; b.title = e.desc; b.classList.toggle('on', id === S.fx);
    b.onclick = () => selectFx(id); if (id === 'none') { $('#originalCompare').replaceChildren(b); } else list.appendChild(b); }
}
function buildEffectCopy() {
  const box = $('#effectCopy'), id = S.fx, defs = FX[id].params, vals = S.params[id];
  box.replaceChildren(); box.hidden = !defs.some(d => d.key === 'copy');
  if (box.hidden) return;
  const source = document.createElement('div'); source.className = 'copy-source';
  for (const [value, title] of [['自动歌词', '歌曲歌词'], ['自定义文字', '自定义文字']]) {
    const button = document.createElement('button'); button.className = 'chip' + (vals.copy === value ? ' on' : '');
    button.textContent = title; button.setAttribute('aria-pressed', String(vals.copy === value));
    button.onclick = () => { vals.copy = value; invalidateTextEffect(id); buildEffectCopy(); }; source.appendChild(button);
  }
  box.appendChild(source);
  if (vals.copy === '自定义文字') {
    const input = document.createElement('input'); input.type = 'text'; input.value = vals.text;
    input.setAttribute('aria-label', '效果自定义文字'); input.placeholder = id==='punchSymbols'?'Add a line, or leave it empty.':'输入文字，用 / 分隔短句';
    input.oninput = () => { vals.text = input.value; invalidateTextEffect(id); }; box.appendChild(input);
  } else {
    const status = document.createElement('div'); status.className = 'copy-status';
    status.textContent = S.lyrics.length ? `「${S.track?.name || '未命名'}」· ${S.lyrics.length} 条歌词，随播放自动切换` : '当前歌曲暂无歌词，请切换「自定义文字」';
    box.appendChild(status);
  }
}
function buildParams() {
  buildEffectCopy();
  const box = $('#params'); box.innerHTML = ''; const defs = FX[S.fx].params, vals = S.params[S.fx];
  if (!defs.length) { box.innerHTML = '<div class="hint">该效果没有可调参数。</div>'; return; }
  for (const d of defs) { if (defs.some(p => p.key === 'copy') && ['copy', 'text'].includes(d.key)) continue;
    const row = document.createElement('div'); row.className = `p p-${d.type} p-${d.key}`; const lab = document.createElement('label'); lab.textContent = d.label; row.appendChild(lab);
    if (d.type === 'range') { const inp = document.createElement('input'); inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.step; inp.value = vals[d.key]; const v = document.createElement('div'); v.className = 'v'; v.textContent = fmt(vals[d.key], d.step); inp.oninput = () => { vals[d.key] = +inp.value; v.textContent = fmt(+inp.value, d.step); if (d.key === 'pitch') delete S.cache['lum' + vals.pitch]; }; row.appendChild(inp); row.appendChild(v); }
    else if (d.type === 'text') { const inp = document.createElement('input'); inp.type = 'text'; inp.value = vals[d.key]; inp.placeholder = '用 / 或逗号分隔'; inp.style.gridColumn = '2/4'; inp.className = 'txt'; inp.oninput = () => vals[d.key] = inp.value; row.appendChild(inp); }
    else if (d.type === 'color') { const inp = document.createElement('input'); inp.type = 'color'; inp.value = vals[d.key]; inp.oninput = () => vals[d.key] = inp.value; row.appendChild(inp); row.appendChild(document.createElement('div')); }
    else if (d.type === 'select') { const sel = document.createElement('select'); d.opts.forEach(o => { const op = document.createElement('option'); op.textContent = o; op.value = o; op.selected = vals[d.key] === o; sel.appendChild(op); }); sel.onchange = () => { vals[d.key] = sel.value; if(S.fx==='punchSymbols'&&d.key==='example'){loadPunchExample(sel.value);return;} if (d.key === 'copy') invalidateTextEffect(S.fx); }; row.appendChild(sel); row.appendChild(document.createElement('div')); }
    else if (d.type === 'driver') { const wrap = document.createElement('div'); wrap.className = 'drv'; (d.only || Object.keys(DRIVERS)).forEach(k => { const c = document.createElement('button'); c.className = 'chip' + (vals[d.key] === k ? ' on' : ''); c.textContent = DRIVERS[k]; c.onclick = () => { vals[d.key] = k; wrap.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); }; wrap.appendChild(c); }); row.appendChild(wrap); }
    box.appendChild(row); }
  const reset = document.createElement('button'); reset.className = 'chip param-reset'; reset.textContent = '恢复默认参数'; reset.onclick = () => { defs.forEach(d => vals[d.key] = d.def); buildParams(); }; box.appendChild(reset);
}
const fmt = (v, step) => step >= 1 ? String(Math.round(v)) : v.toFixed(2);

/* ---------- tracks ---------- */
const trackCache = {};
function parseLRC(raw = '') { if (/MDP timed cue placeholder/i.test(raw)) return []; const out = []; for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/), text = m?.[3]?.trim(); if (m && text) out.push({ t: +m[1] * 60 + +m[2], text }); } return out.sort((a, b) => a.t - b.t); }
function lyricAt(t = songTime()) { let hit = null; for (const q of S.lyrics) { if (q.t > t) break; hit = q; } return hit ? hit.text : ''; }
function activeLyricAt(t = songTime()) { return lyricAt(t) || S.lyrics[0]?.text || ''; }
function timedLyricAt(t = songTime()) {
  if (!S.lyrics.length) return null;
  let index = 0; for (let i = 0; i < S.lyrics.length; i++) { if (S.lyrics[i].t > t) break; index = i; }
  const line = S.lyrics[index], next = S.lyrics[index + 1], text = line?.text || '', words = wrapTokens(text), duration = Math.max(.8, (next?.t ?? (line.t + 3.4)) - line.t), rawProgress = clamp((t - line.t) / duration, 0, .9999);
  // LRC normally provides line-level rather than word-level timestamps. Weight
  // each word by its spoken length and reserve the final 9% for held notes and
  // breathing, which tracks real singing more closely than equal subdivisions.
  const progress = clamp((rawProgress - .015) / .895, 0, .9999), weights = words.map(w => .68 + Math.min(2.15, Array.from(w.replace(/[^\p{L}\p{N}]/gu, '')).length * .19) + (/[,.!?;:]$/.test(w) ? .22 : 0)), total = weights.reduce((a, b) => a + b, 0) || 1, target = progress * total; let word = 0, before = 0;
  for (let i = 0; i < weights.length; i++) { if (target < before + weights[i]) { word = i; break; } before += weights[i]; word = i; }
  const wordPhase = clamp((target - before) / Math.max(.001, weights[word]), 0, 1); let priorWords = 0; for (let i = 0; i < index; i++) priorWords += wrapTokens(S.lyrics[i].text).length;
  return { text, word, wordPhase, progress: rawProgress, absoluteWord: priorWords + word + wordPhase };
}
function invalidateTextEffect(id = S.fx) { const state = FX[id]?.state; if (!state) return;
  if (id === 'hud') { state.key = ''; state.nodes = []; state.edges = []; }
  else if (id === 'subjectSplit') { state.insideKey = ''; state.inside = []; state.drops = []; state.word = 0; }
  else if (id === 'contourField') { state.key = ''; state.mask = null; state.field = null; state.fieldImage = null; }
  else if (id === 'textWrap') { state.key = ''; state.path = null; state.lyric = ''; state.focus = 0; state.travel = 0; state.travelTarget = 0; state.lyricAbs = -1; }
}
window.MFX_MUSIC = { currentTrack: () => S.track, lyricAt, lyrics: () => S.lyrics };
function buildTracks() { const box = $('#tracks');
  if (PACK_TRACKS.length) { const pg = document.createElement('div'); pg.className = 'grp'; pg.textContent = '测试音乐 · ' + PACK_TRACKS.length + ' 首'; box.appendChild(pg);
    for (const tr of PACK_TRACKS) { const b = document.createElement('button'); b.className = 'pack'; b.dataset.id = tr.id;
      b.innerHTML = `<img class="cover" src="${tr.cover}" alt=""><div class="t">${tr.name}</div><div class="d">${tr.artist || tr.genre}</div>`; b.onclick = () => { loadTrack(tr); closeSheet(); }; box.appendChild(b); } }
  const g = document.createElement('div'); g.className = 'grp'; g.textContent = '内置曲目'; box.appendChild(g);
  for (const tr of TRACKS) { const b = document.createElement('button'); b.dataset.id = tr.id;
    b.innerHTML = `<div class="t">${tr.name}</div><div class="d">${tr.genre} · ${tr.bpm}</div>`; b.onclick = () => { loadTrack(tr); closeSheet(); }; box.appendChild(b); } }
function openSheet(kind) { if (kind === 'params') buildParams(); $('#sheet').classList.add('on'); $('#sheetTracks').hidden = kind !== 'tracks'; $('#sheetParams').hidden = kind !== 'params';
  $('#sheetTitle').textContent = kind === 'tracks' ? '选择音乐' : '参数 · ' + FX[S.fx].name; }
function closeSheet() { $('#sheet').classList.remove('on'); }
$('#discBtn').onclick = () => openSheet('tracks');
$('#paramBtn').onclick = () => openSheet('params');
$('#sheetClose').onclick = $('#sheetbg').onclick = closeSheet;
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$('#urlAdd').onclick = () => { const u = $('#urlIn').value.trim(); if (!/^https?:\/\//.test(u)) { toast('请填 http(s) 链接'); return; }
  const name = decodeURIComponent(u.split('/').pop().split('?')[0]).replace(/\.[^.]+$/, '') || '在线音乐';
  REMOTE_TRACKS.push({ id: 'r:' + u, name, genre: '在线', bpm: 0, kind: 'remote', url: u }); renderRemoteTracks(); $('#urlIn').value = ''; loadTrack(REMOTE_TRACKS[REMOTE_TRACKS.length - 1]); closeSheet(); };
$('#urlIn').onkeydown = e => { if (e.key === 'Enter') $('#urlAdd').click(); };
$('#musicUp2').onclick = () => $('#musicFile').click();
$('#musicDirBtn2').onclick = () => $('#musicDir').click();
async function loadTrack(tr) { S.trackId = tr.id;
  document.querySelectorAll('#tracks button').forEach(b => b.classList.toggle('on', b.dataset.id === tr.id));
  S.track = tr; S.lyrics = parseLRC(tr.lrc || ''); invalidateTextEffect(); buildEffectCopy(); if ($('#sheet').classList.contains('on') && !$('#sheetParams').hidden) buildParams(); $('#nowT').textContent = tr.name; if (S.playing) pause(); S.pausedAt = 0;
  const disc = $('#discBtn'); disc.style.backgroundImage = tr.cover ? `url("${tr.cover}")` : ''; disc.classList.toggle('has-cover', !!tr.cover);
  try {
    if (tr.kind === 'pack') { $('#status').textContent = '解码并分析中…'; $('#nowD').textContent = (tr.artist || tr.genre) + ' · 内置测试音乐'; if (!trackCache[tr.id]) trackCache[tr.id] = await ac().decodeAudioData(await (await fetch(tr.url)).arrayBuffer()); }
    else if (tr.kind === 'remote') { $('#status').textContent = '下载并分析中…'; $('#nowD').textContent = tr.genre + ' · 云端加载中…'; if (!trackCache[tr.id]) trackCache[tr.id] = await ac().decodeAudioData(await (await fetch(tr.url)).arrayBuffer()); }
    else if (tr.kind === 'music') { $('#status').textContent = '解码并分析中…'; $('#nowD').textContent = '本地音乐 · 解码分析中…'; if (!trackCache[tr.id]) trackCache[tr.id] = await ac().decodeAudioData(await tr.blob.arrayBuffer()); }
    else { $('#status').textContent = trackCache[tr.id] ? '分析中…' : '首次合成这首曲目（几秒）…'; $('#nowD').textContent = tr.genre + ' · 合成并分析中…'; ac(); if (!trackCache[tr.id]) trackCache[tr.id] = await renderTrack(tr); }
    if (S.trackId !== tr.id) return;
    await setBuffer(trackCache[tr.id], tr.name, tr); play(0);
  } catch (err) { toast('无法解码这个音频'); $('#status').textContent = '解码失败'; }
}
async function setBuffer(buf, name, tr = {}) {
  S.buffer = buf; S.analysis = null; lastBeatIdx = -1; S.lastSection = null;
  const A = await analyze(buf); S.analysis = A;
  const displayGenre = tr.genre || A.genre, displayBpm = tr.bpm || A.bpm;
  $('#aBpm').textContent = displayBpm; $('#aGenre').textContent = displayGenre; drawTimeline(0);
  $('#nowD').textContent = `${displayGenre} · ${displayBpm} bpm · ${fmtT(A.dur)}`;
  $('#status').textContent = '正在播放'; $('#anaSub').textContent = `${A.segs.length} 段 · ${A.drops.length} 个 Drop`;
}
$('#musicUp').onclick = () => $('#musicFile').click();
$('#musicFile').onchange = async e => { const files = [...e.target.files]; if (!files.length) return; await importFiles(files, 'music'); const rec = LIB.music.find(x => x.name === files[0].name.replace(/\.[^.]+$/, '')); if (rec) loadTrack(rec); };
$('#play').onclick = () => { if (!S.buffer) return openSheet('tracks'); S.playing ? pause() : play(S.pausedAt || 0); };

/* ---------- right panel space sharing ---------- */
function setPanelFocus(panel) {
  const effectsOpen = panel === 'effects';
  const effectCard = $('#effectCard'), materialCard = $('#materialCard');
  effectCard.classList.toggle('expanded', effectsOpen);
  effectCard.classList.toggle('compact', !effectsOpen);
  materialCard.classList.toggle('collapsed', effectsOpen);
  materialCard.classList.toggle('expanded', !effectsOpen);
  $('#effectFold').textContent = effectsOpen ? '收起' : '展开';
  $('#effectFold').setAttribute('aria-expanded', String(effectsOpen));
  $('#materialFold').textContent = effectsOpen ? '展开' : '收起';
  $('#materialFold').setAttribute('aria-expanded', String(!effectsOpen));
}
$('#punchExampleBtn').onclick=()=>{openSheet('params');$('#params .p-example select')?.focus();};
$('#effectFold').onclick = () => setPanelFocus($('#effectCard').classList.contains('expanded') ? 'material' : 'effects');
$('#materialFold').onclick = () => setPanelFocus($('#materialCard').classList.contains('expanded') ? 'effects' : 'material');

let exporting = false;
function drawPhoneExport(out) {
  const d = out.getContext('2d');
  const sx = out.width / 390, sy = out.height / 844;
  d.setTransform(sx, 0, 0, sy, 0, 0);
  d.clearRect(0, 0, 390, 844);
  d.fillStyle = '#000'; d.fillRect(0, 0, 390, 844);

  d.fillStyle = '#fff'; d.font = '700 17px -apple-system, BlinkMacSystemFont, sans-serif'; d.fillText('8:00', 46, 31);
  d.font = '700 16px -apple-system, sans-serif'; d.textAlign = 'right'; d.fillText('▮▮▮  )))  ▰', 365, 31);
  d.textAlign = 'left'; d.font = '32px -apple-system, sans-serif'; d.fillText('‹', 18, 81);
  d.fillStyle = '#fff'; d.beginPath(); d.roundRect(177, 65, 17, 7, 4); d.fill();
  d.fillStyle = '#66666a'; d.beginPath(); d.arc(202, 68.5, 3.5, 0, Math.PI * 2); d.arc(214, 68.5, 3.5, 0, Math.PI * 2); d.fill();
  d.font = '22px sans-serif'; d.fillStyle = '#fff'; d.fillText('♫', 306, 78); d.fillText('⚙', 344, 78);

  d.save(); d.beginPath(); d.roundRect(37, 117, 315, 561, 21); d.clip(); d.drawImage(cv, 37, 117, 315, 561); d.restore();
  d.strokeStyle = 'rgba(255,255,255,.2)'; d.lineWidth = 1; d.beginPath(); d.roundRect(37.5, 117.5, 314, 560, 20.5); d.stroke();
  d.save(); d.beginPath(); d.roundRect(376, 136, 14, 526, [14, 0, 0, 14]); d.clip(); d.globalAlpha = .5; d.drawImage(cv, 0, 0, 540, 960, 376, 136, 100, 526); d.restore();

  d.fillStyle = '#2c2c2e'; d.beginPath(); d.arc(90.5, 750.5, 23.5, 0, Math.PI * 2); d.fill();
  d.fillStyle = '#fff'; d.font = '22px sans-serif'; d.textAlign = 'center'; d.fillText('✎', 90.5, 758);
  d.font = '600 15px -apple-system, sans-serif'; d.fillText('Edit', 90.5, 790);
  d.beginPath(); d.arc(195.5, 753.5, 36.5, 0, Math.PI * 2); d.fill();
  d.strokeStyle = '#000'; d.lineWidth = 2.7; d.beginPath(); d.moveTo(195.5, 745); d.lineTo(195.5, 770); d.moveTo(187, 753.5); d.lineTo(195.5, 745); d.lineTo(204, 753.5); d.stroke();
  d.save(); d.beginPath(); d.arc(282.5, 750.5, 20.5, 0, Math.PI * 2); d.clip(); d.drawImage(cv, 262, 730, 41, 41); d.restore();
  d.strokeStyle = '#fff'; d.lineWidth = 5; d.beginPath(); d.arc(282.5, 750.5, 23.5, 0, Math.PI * 2); d.stroke();
  d.fillStyle = '#fff'; d.font = '600 15px -apple-system, sans-serif'; d.fillText('Your Story', 282.5, 790);
  d.beginPath(); d.roundRect(126.5, 829, 137, 5, 3); d.fill();
  d.setTransform(1, 0, 0, 1, 0, 0);
}

async function exportPreviewVideo(seconds = 15) {
  if (exporting) { toast('视频正在导出'); return; }
  if (!S.buffer) { openSheet('tracks'); toast('先选择一首音乐'); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('当前浏览器不支持视频导出'); return; }
  setupGraph(); await ac().resume();
  const startAt = songTime(),punchExport=S.fx==='punchSymbols';
  if(punchExport){FX.punchSymbols.state.origin=startAt;FX.punchSymbols.state.key=null;}
  if(!punchExport)play(startAt);
  const out = document.createElement('canvas'); out.width = punchExport?1080:780; out.height = punchExport?1920:1688;
  const punchCopy=punchExport?S.params.punchSymbols.copy:null,punchText=punchExport?S.params.punchSymbols.text:'';
  const punchRenderer=punchExport?PunchStudio.makeRenderer(out.getContext('2d'),S.media||splitFrame(),(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}),{...FX.punchSymbols.state.renderer.config,offset:startAt,duration:seconds}):null;
  if(punchRenderer)punchRenderer.render(0,punchCopy==='自动歌词'?lyricAt(startAt):punchText);
  const stream = out.captureStream(30);
  const audioTrack = recordDest?.stream.getAudioTracks()[0]; if (audioTrack) stream.addTrack(audioTrack);
  const choices = [...(punchExport?['video/mp4;codecs=avc1.42001f,mp4a.40.2']:[]),'video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = choices.find(x => MediaRecorder.isTypeSupported(x)) || '';
  let recorder;
  try { recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6000000 } : { videoBitsPerSecond: 6000000 }); }
  catch (err) { toast('无法启动视频编码'); return; }
  const chunks = [], button = $('#bigbtn'), status = $('#status'), started = performance.now();
  exporting = true; button.classList.add('recording'); button.title = '正在导出视频';
  recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
  recorder.onerror = () => { exporting = false; button.classList.remove('recording'); status.textContent = '导出失败'; toast('视频导出失败'); };
  recorder.onstop = () => {
    exporting = false; button.classList.remove('recording'); button.title = '导出 15 秒视频';
    stream.getVideoTracks().forEach(t => t.stop());
    const actualType = recorder.mimeType || mimeType || 'video/webm';
    const blob = new Blob(chunks, { type: actualType });
    const ext = actualType.includes('mp4') ? 'mp4' : 'webm';
    const safe = `${S.track?.name || 'music'}-${FX[S.fx].name}-15s`.replace(/[\\/:*?"<>|]+/g, '-');
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${safe}.${ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = '导出完成'; toast(`已导出 15 秒 ${ext.toUpperCase()} 视频`);
  };
  recorder.start(500);
  if(punchExport)play(startAt);
  (function paint() {
    if (!exporting) return;
    if(punchRenderer)punchRenderer.render(Math.max(0,songTime()-startAt),punchCopy==='自动歌词'?lyricAt(songTime()):punchText);else drawPhoneExport(out);
    const left = Math.max(0, seconds - (performance.now() - started) / 1000);
    status.textContent = `正在导出 · ${left.toFixed(1)}s`;
    requestAnimationFrame(paint);
  })();
  setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, seconds * 1000);
}
$('#bigbtn').onclick = () => exportPreviewVideo(15);
window.MFX_EXPORT = exportPreviewVideo;
function playlist() { return [...PACK_TRACKS, ...TRACKS, ...REMOTE_TRACKS, ...LIB.music]; }
function step(d) { const L = playlist(), i = L.findIndex(t => t.id === S.trackId); loadTrack(L[((i < 0 ? 0 : i + d) + L.length) % L.length]); }
$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.code === 'ArrowRight') step(1); if (e.code === 'ArrowLeft') step(-1); });
$('#vol').oninput = e => { if (gainNode) gainNode.gain.value = +e.target.value; };
document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); S.playing ? pause() : play(S.pausedAt || 0); } });

/* ---------- photos ---------- */
const TAGS = ['全部', 'MDP 照片', 'MDP 示例', '横图', '竖图', '本地', '自拍', '半身', '全身', '双人', '多人', '户外', '室内', '夜景'];
let curTag = '全部', galleryLimit = 24;
function presetMatches(d) { return curTag === '全部' || d.tags.includes(curTag); }
function presetButton(d, i) { const b = document.createElement('button'); b.classList.toggle('on',i===S.photoIdx); b.dataset.i = i; b.dataset.tags = d.tags.join(','); const img = new Image(); img.loading = 'lazy'; img.decoding = 'async'; img.src = d.thumb || d.src; img.alt = d.name; b.appendChild(img);
  if (d.isVideo) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = '视频'; b.appendChild(tag); }
  const n = document.createElement('div'); n.className = 'n'; n.innerHTML = d.name + '<small>' + d.tags.join(' · ') + '</small>'; b.appendChild(n); b.onclick = () => selectPhoto(i); return b; }
function renderGallery(reset = false) { const box = $('#photos'); if (reset) { galleryLimit = 24; box.scrollTop = 0; }
  box.querySelectorAll('button[data-i],button.more').forEach(x => x.remove());
  const matches = PRESETS.map((d, i) => [d, i]).filter(([d]) => presetMatches(d));
  for (const [d, i] of matches.slice(0, galleryLimit)) box.appendChild(presetButton(d, i));
  const pinned = box.querySelector('button[data-i="0"]');
  if (pinned) box.insertBefore(pinned, box.children[1]);
  if (galleryLimit < matches.length) { const more = document.createElement('button'); more.className = 'up more'; more.textContent = `加载更多\n${Math.min(galleryLimit, matches.length)} / ${matches.length}`; more.style.whiteSpace = 'pre-line'; more.onclick = () => { galleryLimit += 24; renderGallery(); applyFilter(); }; box.appendChild(more); }
}
function buildPhotos() { const box = $('#photos'), fl = $('#filters');
  TAGS.forEach(t => { const c = document.createElement('button'); c.className = 'chip' + (t === curTag ? ' on' : ''); c.textContent = t; c.onclick = () => { curTag = t; fl.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); renderGallery(true); applyFilter(); }; fl.appendChild(c); });
  const up = document.createElement('button'); up.className = 'up'; up.textContent = '上传\n照片/视频'; up.style.whiteSpace = 'pre-line'; up.onclick = () => $('#photoFile').click(); box.appendChild(up);
  renderGallery();
  applyFilter(); }
function applyFilter() { let n = PRESETS.filter(presetMatches).length; document.querySelectorAll('#photos button[data-lib]').forEach(b => { const show = curTag === '全部' || b.dataset.tags.split(',').includes(curTag); b.classList.toggle('hide', !show); if (show) n++; }); const label = (PRESETS[S.photoIdx]?.name || '本地素材') + ' · ' + n + '/' + (PRESETS.length + LIB.photos.length) + ' 个', el = $('#photoCount'); el.textContent = label; el.title = label; }
function selectPhoto(i) { const d = PRESETS[i]; document.querySelectorAll('#photos button').forEach(b => b.classList.toggle('on', +b.dataset.i === i)); if (d.isVideo) setVideo(d.src); else { const img = new Image(); img.onload = () => setImage(img); img.src = d.src; } S.photoIdx = i; applyFilter(); }
$('#photoFile').onchange = async e => { const files = [...e.target.files]; if (!files.length) return; await importFiles(files, 'photo'); const rec = LIB.photos[LIB.photos.length - 1]; if (rec) selectLib(rec); };

/* =====================================================================
   8. LOCAL LIBRARY — folder import, persisted in IndexedDB (this browser only)
   ===================================================================== */
const LIB = { photos: [], music: [] };
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('mfx-lab', 1); r.onupgradeneeded = () => r.result.createObjectStore('assets', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbAll() { try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction('assets').objectStore('assets').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return []; } }
async function idbPut(rec) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('assets', 'readwrite'); t.objectStore('assets').put(rec); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { } }
async function idbDel(id) { try { const db = await idb(); await new Promise((res) => { const t = db.transaction('assets', 'readwrite'); t.objectStore('assets').delete(id); t.oncomplete = res; }); } catch (e) { } }
async function makeThumb(blob, isVideo) {
  const c = document.createElement('canvas'); c.width = 108; c.height = 192; const t = c.getContext('2d'); let iw = 1, ih = 1;
  if (isVideo) { const v = document.createElement('video'); v.src = URL.createObjectURL(blob); v.muted = true; v.playsInline = true; await new Promise(r => { v.onloadeddata = r; v.onerror = r; }); try { v.currentTime = 0.1; await new Promise(r => { v.onseeked = r; setTimeout(r, 500); }); } catch (e) { } iw = v.videoWidth; ih = v.videoHeight; const s = Math.max(108 / iw, 192 / ih); t.drawImage(v, (108 - iw * s) / 2, (192 - ih * s) / 2, iw * s, ih * s); URL.revokeObjectURL(v.src); }
  else { const bm = await createImageBitmap(blob); iw = bm.width; ih = bm.height; const s = Math.max(108 / iw, 192 / ih); t.drawImage(bm, (108 - iw * s) / 2, (192 - ih * s) / 2, iw * s, ih * s); bm.close(); }
  return { thumb: c.toDataURL('image/jpeg', 0.7), orientation: iw >= ih ? '横图' : '竖图' };
}
async function importFiles(files, kind) {
  const list = [...files].filter(f => kind === 'photo' ? (f.type.startsWith('image') || f.type.startsWith('video')) : (f.type.startsWith('audio') || /\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(f.name)));
  if (!list.length) { toast('没有找到可导入的文件'); return; }
  toast(`导入 ${list.length} 个文件…`); let n = 0;
  for (const f of list) {
    const id = kind + ':' + f.name + ':' + f.size; if (LIB[kind === 'photo' ? 'photos' : 'music'].some(x => x.id === id)) continue;
    const rec = { id, kind, name: f.name.replace(/\.[^.]+$/, ''), blob: f, isVideo: f.type.startsWith('video'), added: Date.now() };
    if (kind === 'photo') { try { const info = await makeThumb(f, rec.isVideo); rec.thumb = info.thumb; rec.orientation = info.orientation; } catch (e) { continue; } }
    await idbPut(rec); addLibItem(rec); n++;
  }
  toast(`已导入 ${n} 个，保存在本机浏览器`);
}
function addLibItem(rec) {
  if (rec.kind === 'photo') { LIB.photos.push(rec); const box = $('#photos'), b = document.createElement('button'); b.dataset.lib = rec.id; b.dataset.tags = ['本地', rec.orientation || '竖图'].join(','); b.innerHTML = `<img src="${rec.thumb}" alt=""><span class="tag">${rec.isVideo ? '视频' : (rec.orientation || '本地')}</span><div class="n">${rec.name}</div>`; b.onclick = () => selectLib(rec); b.oncontextmenu = e => { e.preventDefault(); if (confirm('从本机素材库移除「' + rec.name + '」？')) { idbDel(rec.id); LIB.photos = LIB.photos.filter(x => x !== rec); b.remove(); applyFilter(); } }; box.insertBefore(b, box.children[1]); applyFilter(); }
  else { LIB.music.push(rec); renderLocalTracks(); }
}
function selectLib(rec) { document.querySelectorAll('#photos button').forEach(b => b.classList.toggle('on', b.dataset.lib === rec.id)); const url = URL.createObjectURL(rec.blob); if (rec.isVideo) setVideo(url); else { const img = new Image(); img.onload = () => setImage(img); img.src = url; } S.photoIdx = -1; const label = rec.name + ' · 本地', el = $('#photoCount'); el.textContent = label; el.title = label; }
function renderLocalTracks() { const box = $('#tracks'); box.querySelectorAll('.local, .lgrp').forEach(x => x.remove()); if (!LIB.music.length) return;
  const g = document.createElement('div'); g.className = 'grp lgrp'; g.textContent = '本机音乐 · ' + LIB.music.length + ' 首（右键移除）'; box.insertBefore(g, box.firstChild);
  let ref = g.nextSibling;
  for (const rec of LIB.music) { const b = document.createElement('button'); b.className = 'local'; b.dataset.id = rec.id;
    b.innerHTML = `<div class="t">${rec.name}</div><div class="d">${(rec.blob.size / 1e6).toFixed(1)} MB</div>`;
    b.onclick = () => { loadTrack(rec); closeSheet(); };
    b.oncontextmenu = e => { e.preventDefault(); if (confirm('移除「' + rec.name + '」？')) { idbDel(rec.id); LIB.music = LIB.music.filter(x => x !== rec); renderLocalTracks(); } };
    box.insertBefore(b, ref); } }
async function restoreLibrary() { const all = await idbAll(); all.sort((a, b) => a.added - b.added); for (const r of all) addLibItem(r); if (all.length) $('#status').textContent = `已恢复 ${all.length} 个本地素材`; }
$('#photoDirBtn').onclick = e => { e.preventDefault(); e.stopPropagation(); $('#photoDir').click(); };
$('#photoDir').onchange = e => importFiles(e.target.files, 'photo');
$('#musicDirBtn').onclick = () => $('#musicDir').click();
$('#musicDir').onchange = e => importFiles(e.target.files, 'music');

['dragenter','dragover'].forEach(k => addEventListener(k, e => { if (!e.dataTransfer?.types.includes('Files')) return; e.preventDefault(); $('#dropHint').classList.add('on'); }));
['dragleave','drop'].forEach(k => addEventListener(k, e => { if (k === 'drop') e.preventDefault(); if (k === 'dragleave' && e.relatedTarget) return; $('#dropHint').classList.remove('on'); }));
addEventListener('drop', async e => { const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
  const audio = files.filter(f => f.type.startsWith('audio') || /\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(f.name));
  const vis = files.filter(f => f.type.startsWith('image') || f.type.startsWith('video'));
  if (vis.length) { await importFiles(vis, 'photo'); const r = LIB.photos[LIB.photos.length - 1]; if (r) selectLib(r); }
  if (audio.length) { await importFiles(audio, 'music'); const r = LIB.music[LIB.music.length - audio.length]; if (r) loadTrack(r); } });


/* =====================================================================
   9. REMOTE MANIFEST — for self-hosting: point the page at a JSON index
      ?manifest=https://your-cdn/assets.json   (or set window.MFX_MANIFEST)
      { "photos":[{"name":"...","tags":["自拍"],"url":"https://.../a.jpg"}],
        "tracks":[{"id":"t1","name":"...","genre":"House","url":"https://.../a.mp3"}] }
   ===================================================================== */
async function loadManifest(url) {
  try {
    const m = await (await fetch(url, { mode: 'cors' })).json();
    (m.photos || []).forEach(pRec => PRESETS.push({ name: pRec.name || '素材', tags: (pRec.tags || []).concat('云端'), src: pRec.url }));
    (m.tracks || []).forEach(t => REMOTE_TRACKS.push({ id: 'r:' + (t.id || t.url), name: t.name || '云端曲目', genre: t.genre || '云端', bpm: t.bpm || 0, hint: '云端', kind: 'remote', url: t.url }));
    if (REMOTE_TRACKS.length) renderRemoteTracks();
    renderGallery(true); applyFilter(); toast(`已载入云端素材 ${(m.photos || []).length} 图 / ${(m.tracks || []).length} 曲`);
  } catch (e) { console.warn('manifest failed', e); }
}
const REMOTE_TRACKS = [];
function renderRemoteTracks() { const box = $('#tracks'); box.querySelectorAll('.remote, .rgrp').forEach(x => x.remove());
  if (!REMOTE_TRACKS.length) return;
  const g = document.createElement('div'); g.className = 'grp rgrp'; g.textContent = '在线曲目 · ' + REMOTE_TRACKS.length + ' 首'; box.insertBefore(g, box.firstChild);
  let ref = g.nextSibling;
  for (const tr of REMOTE_TRACKS) { const b = document.createElement('button'); b.className = 'remote'; b.dataset.id = tr.id;
    b.innerHTML = `<div class="t">${tr.name}</div><div class="d">${tr.genre}</div>`; b.onclick = () => { loadTrack(tr); closeSheet(); }; box.insertBefore(b, ref); } }

/* ---------- fit phone ---------- */
function fitPhone() {
  // Keep the creative preview and controls side by side on normal desktop
  // windows. Only true mobile widths fall back to the vertical layout.
  const narrow = innerWidth < 681;
  document.body.classList.toggle('stack', narrow);
  const heightFit = (innerHeight - 30) / 844;
  const widthFit = (innerWidth - 384) / 390;
  const s = narrow ? Math.min(1, (innerWidth - 40) / 390) : clamp(Math.min(heightFit, widthFit), .62, .96);
  document.documentElement.style.setProperty('--s', s.toFixed(3));
}
addEventListener('resize', fitPhone); fitPhone();
/* ---------- boot ---------- */
buildFxList(); buildTracks(); buildPhotos(); selectPhoto(0); selectFx(new URLSearchParams(location.search).get('effect')==='punchSymbols'?'punchSymbols':'subjectSplit'); drawTimeline(0); frame(); addEventListener('load', async () => { try { await restoreLibrary(); } catch (e) { }
  const mf = new URLSearchParams(location.search).get('manifest') || window.MFX_MANIFEST; if (mf) await loadManifest(mf);
  const testPool = [...PACK_TRACKS, ...REMOTE_TRACKS, ...LIB.music], pool = testPool.length ? testPool : TRACKS;
  const requestedExample=new URLSearchParams(location.search).get('demo');
  if(requestedExample&&PUNCH_EXAMPLES.some(d=>d.id===requestedExample)){await loadPunchExample(requestedExample);}else{const initialTrack=pool[Math.floor(Math.random()*pool.length)];if(initialTrack)setTimeout(()=>loadTrack(initialTrack),180);}
});
// Chrome may suspend audible autoplay until the first user gesture. The source
// is already prepared, so the first pointer/key interaction resumes it instantly.
const unlockAudio = () => { if (AC?.state === 'suspended' && S.playing) AC.resume(); };
addEventListener('pointerdown', unlockAudio, { passive: true }); addEventListener('keydown', unlockAudio);
