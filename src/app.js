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
  if (S.fx === 'subjectSplit') setTimeout(refineSubjectHQ, 30);
  else if (MP.state === 'idle') mpLoad(); else if (MP.state === 'ready') { setSeg('识别主体 · 预计 <1s', 'working'); setTimeout(refineSubject, 30); }
  else if (MP.state === 'loading') setSeg('加载模型 · 预计 3–8s', 'working'); else setSeg('本地估算 · 点击重试', 'fallback');
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
const HQ = { state: 'idle', model: null, processor: null, mod: null, busy: false, queued: false };
function setSeg(t, state) { const e = $('#segState'); if (!e) return; e.textContent = t; e.dataset.state = state || (/✓|fps/.test(t) ? 'ok' : /估算|失败/.test(t) ? 'fallback' : /加载|识别|启动|排队/.test(t) ? 'working' : 'idle'); }

async function refineSubjectHQ() {
  if (S.isVideo) return refineSubject();
  if (HQ.busy) { HQ.queued = true; setSeg('高清抠像 · 排队中…', 'working'); return; }
  HQ.busy = true; HQ.queued = false; const key = S.srcKey, started = performance.now();
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
    const frame = splitFrame(), url = frame.toDataURL('image/jpeg', .96), img = await HQ.mod.RawImage.fromURL(url), inputs = await HQ.processor(img), result = await HQ.model({ input: inputs.pixel_values });
    const mask = await HQ.mod.RawImage.fromTensor(result.output[0].mul(255).to('uint8')).resize(frame.width, frame.height), md = mask.data;
    if (key !== S.srcKey) return;
    const c = document.createElement('canvas'); c.width = frame.width; c.height = frame.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(frame, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < md.length; i++) { let a = clamp((md[i] / 255 - .025) / .95, 0, 1); a = a * a * (3 - 2 * a); px.data[i * 4 + 3] = Math.round(a * 255); } g.putImageData(px, 0, 0);
    S.cache.splitSub = c; S.cache.splitHQ = true; delete S.cache.splitBounds;
    setSeg(`MODNet 高清抠像 · ${((performance.now() - started) / 1000).toFixed(1)}s ✓`, 'ok');
  } catch (e) {
    console.warn('HQ matting failed', e); HQ.state = 'fail'; setSeg('高清模型失败 · 切换实时抠像', 'fallback'); setTimeout(refineSubject, 20);
  } finally { HQ.busy = false; if (HQ.queued) setTimeout(refineSubjectHQ, 0); }
}
function mpLoad() {
  if (MP.state !== 'idle') return; MP.state = 'loading'; setSeg('加载模型 · 预计 3–8s', 'working');
  const el = document.createElement('script'); el.src = MPURL + 'selfie_segmentation.js'; el.crossOrigin = 'anonymous';
  el.onload = () => { try {
      const seg = new SelfieSegmentation({ locateFile: f => MPURL + f });
      seg.setOptions({ modelSelection: 0 });
      seg.onResults(r => { const p = MP.pending; MP.pending = null; if (p) p(r.segmentationMask); });
      MP.seg = seg; MP.state = 'ready'; setSeg('识别主体 · 预计 <1s', 'working'); refineSubject();
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
const DRIVERS = { kick: 'Kick', snare: 'Snare', hat: 'Hi-hat', beat: '节拍', bass: '低频', energy: '能量', high: '高频' };
const R = (key, label, min, max, def, step = 0.01) => ({ key, label, type: 'range', min, max, def, step });
const C = (key, label, def) => ({ key, label, type: 'color', def });
const Sel = (key, label, opts, def) => ({ key, label, type: 'select', opts, def });
const T = (key, label, def) => ({ key, label, type: 'text', def });
const D = (key, def, only) => ({ key, label: '驱动', type: 'driver', def, only });
function dropFlash(f, p) { const a = ($('#autoDrop').checked ? f.drop : 0) * 0.85; if (a > 0.01) { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, W, H); } }

const FX = {
  none: { name: '原图', icon: '🖼️', desc: '无效果，仅对照', params: [], draw() { ctx.drawImage(src, 0, 0); } },

  glitch: { name: '碎块位移', icon: '🧩', desc: '块错位 · RGB · 网点', hint: '参考视频 2：Kick 时画面被切成方块并错位，配合 RGB 通道分离与半调网点，Hi-hat 时飘出星光。',
    params: [R('size', '块大小', 30, 200, 90, 1), R('shift', '位移强度', 0, 1, .5), R('rgb', 'RGB 分离', 0, 1, .4), R('ht', '网点覆盖', 0, 1, .5), R('spark', '星光', 0, 1, .5), D('drv', 'kick')],
    state: { blocks: [], sparks: [], last: 0 },
    draw(f, p, t) { const s = this.state;
      const sep = f.bass * p.rgb * 16 + f.dropHold * 10;
      ctx.drawImage(src, 0, 0); if (sep > 1) rgbSplit(ctx, sep, sep * 0.3);
      if (f[p.drv] > 0.5 && t - s.last > 0.1) { s.last = t; const n = 4 + Math.floor(f[p.drv] * 8 + f.dropHold * 10);
        for (let i = 0; i < n; i++) { const w = p.size * rnd(.5, 1.6), h = p.size * rnd(.3, 1.2);
          s.blocks.push({ x: rnd(W - w), y: rnd(H - h), w, h, dx: (Math.random() - .5) * p.shift * 260, dy: (Math.random() - .5) * p.shift * 60, until: t + rnd(.08, .3), inv: Math.random() < .25 }); } }
      s.blocks = s.blocks.filter(b => b.until > t);
      for (const b of s.blocks) { ctx.drawImage(src, b.x, b.y, b.w, b.h, b.x + b.dx, b.y + b.dy, b.w, b.h);
        if (b.inv) { ctx.fillStyle = 'rgba(180,255,240,.18)'; ctx.fillRect(b.x + b.dx, b.y + b.dy, b.w, b.h); }
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(b.x + b.dx + .5, b.y + b.dy + .5, b.w, b.h); }
      if (p.ht > 0) { ctx.save(); ctx.globalAlpha = p.ht * (0.35 + 0.65 * f.energy); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = halftonePattern(); ctx.fillRect(0, 0, W, H); ctx.restore(); }
      if (f.hat > .6 && Math.random() < p.spark) s.sparks.push({ x: rnd(W), y: rnd(H), r: rnd(6, 22), until: t + rnd(.15, .5), born: t });
      s.sparks = s.sparks.filter(k => k.until > t);
      for (const k of s.sparks) { const a = clamp((k.until - t) / (k.until - k.born), 0, 1); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(k.x - k.r, k.y); ctx.lineTo(k.x + k.r, k.y); ctx.moveTo(k.x, k.y - k.r); ctx.lineTo(k.x, k.y + k.r); ctx.stroke(); }
      dropFlash(f, p); } },

  scan: {
    name: '像素扫描', icon: '🔍', desc: '高光方块逐行显影', hint: '参考视频 4：一条扫描带从上往下走，带内亮部被量化成发光小方块，走过的地方留下渐隐余辉。扫描一圈的时间跟小节对齐。',
    params: [R('pitch', '像素大小', 8, 30, 14, 1), R('band', '扫描带高', .05, .5, .18), R('trail', '余辉', 0, 1, .55), R('cov', '显影密度', .1, 1, .6), C('col', '高光色', '#ffffff'), R('chroma', '彩色杂点', 0, 1, .35), D('drv', 'energy', ['energy', 'high', 'hat', 'bass'])],
    state: { pos: 0 },
    draw(f, p, t) { const s = this.state, bpm = f.bpm || 120, barSec = 240 / bpm;
      s.pos = (s.pos + (1 / 60) / barSec) % 1; if (f.bar > .8) s.pos = 0;
      const y = s.pos * (H + H * p.band) - H * p.band, band = H * p.band;
      ctx.drawImage(src, 0, 0);
      ctx.fillStyle = `rgba(6,8,12,${0.3 + 0.2 * (1 - f.energy)})`; ctx.fillRect(0, 0, W, H);
      const g = lumGrid(p.pitch), thr = g.hi * (1 - p.cov * (0.55 + 0.45 * clamp(f[p.drv] * 1.4, 0, 1)));
      const trailLen = H * (0.12 + p.trail * 0.75);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let ry = 0; ry < g.rows; ry++) {
        const py = ry * p.pitch + p.pitch / 2, d = y - py;
        let a = 0;
        if (d >= -band * .25 && d <= 0) a = 1;                       // leading edge
        else if (d > 0 && d < trailLen) a = Math.pow(1 - d / trailLen, 1.8) * (0.15 + p.trail * 0.85);
        else if (d > -band && d < 0) a = 1;
        if (a < .02) continue;
        for (let rx = 0; rx < g.cols; rx++) { const l = g.g[ry * g.cols + rx]; if (l < thr) continue;
          const px = rx * p.pitch, q = clamp((l - thr) / (1 - thr + 1e-3), 0, 1);
          const size = p.pitch * (0.45 + 0.5 * q) * (1 + f.kick * 0.3);
          ctx.globalAlpha = a * (0.35 + 0.65 * q);
          ctx.fillStyle = (p.chroma > 0 && Math.random() < p.chroma * 0.08) ? ['#ff5d5d', '#3fd0ee', '#ffb24a', '#c6a4ff'][Math.floor(rnd(4))] : p.col;
          ctx.fillRect(px + (p.pitch - size) / 2, py - size / 2, size, size); } }
      ctx.restore();
      // leading line
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createLinearGradient(0, y - band * .5, 0, y + 3);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, rgba(p.col, .18 + f.energy * .2));
      ctx.fillStyle = lg; ctx.fillRect(0, y - band * .5, W, band * .5 + 3); ctx.restore();
      dropFlash(f, p); } },

  dots: { name: 'LED 点阵', icon: '💡', desc: '亮部点阵显影', hint: '把画面亮部变成 LED 点阵，高频能量越强显影越多，随 Hi-hat 闪烁；节拍时打出彩色坏点。',
    params: [R('pitch', '点距', 8, 28, 12, 1), R('cov', '覆盖率', .1, 1, .7), C('col', '点色', '#ffffff'), R('flick', '闪烁', 0, 1, .4), R('dark', '压暗底图', 0, 1, .35), D('drv', 'high', ['high', 'hat', 'energy', 'bass'])],
    draw(f, p, t) { ctx.drawImage(src, 0, 0); ctx.fillStyle = `rgba(0,0,0,${p.dark * (0.4 + 0.6 * f.energy)})`; ctx.fillRect(0, 0, W, H);
      const g = lumGrid(p.pitch), drive = clamp(f[p.drv] * 1.5 + f.dropHold, 0, 1), thr = g.hi * (1 - p.cov * (0.5 + 0.5 * drive));
      ctx.fillStyle = p.col; const sz = p.pitch * 0.42;
      for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) { const l = g.g[y * g.cols + x]; if (l < thr) continue;
        if (p.flick > 0 && Math.random() < p.flick * 0.25 * (1 - f.hat)) continue;
        const px = x * p.pitch + p.pitch / 2, py = y * p.pitch + p.pitch / 2;
        const r = sz * (0.6 + 0.6 * (l - thr) / (1 - thr + 1e-3)) * (1 + f.kick * 0.4); ctx.fillRect(px - r / 2, py - r / 2, r, r); }
      if (f.beat > 0.5) for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#ff5d5d', '#3fd0ee', '#ffb24a', '#c6a4ff'][i % 4]; const q = p.pitch;
        ctx.fillRect(Math.floor(rnd(W / q)) * q, Math.floor(rnd(H / q)) * q, q, q); }
      dropFlash(f, p); } },

  hud: {
    name: '风迹', icon: '🌬️', desc: '文字成网 · 随风成浪 · 跟拍起伏', hint: '按参考视频复刻：大号文字标记之间用弯曲点阵连成一张网，网面像风中的薄布一样连续起伏。英文按完整单词拆分，中文、韩文、日文等文字按单字拆分，[风] 类标记保持整体。音乐能量经过平滑包络后控制湍流强度。',
    params: [T('text', '文案', '[风]'), R('size', '字号', .7, 1.6, 1), R('wind', '湍流', 0, 1, .68), R('wave', '起伏', 0, 1, .62), C('col', '颜色', '#d9fff0')],
    state: { nodes: [], edges: [], key: '', smoothE: 0, smoothH: 0, pulse: 0, phase: 0, dash: 0, lastBeat: 0 },
    draw(f, p, t) { const s = this.state;
      const raw = (p.text || '').trim() || '[风]';
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

  pixelReveal: {
    name: '局部像素显影', icon: '✨', desc: '目标点阵 · 扫描显影 · 粒子溢出',
    hint: '参考「音乐 x AI 节奏可视化-副本(4)」：画面先被轻微压暗，局部高亮区域被像素格重新显影，扫描带通过时从轮廓向外溢出小方块。可选亮部、主体或全图作为显影目标。',
    params: [Sel('target', '显影区域', ['亮部', '主体', '全图'], '亮部'), R('pitch', '像素尺寸', 5, 20, 9, 1), R('cov', '显影密度', .2, 1, .7),
      R('trail', '扫描余辉', .05, 1, .62), R('spark', '溢出粒子', 0, 1, .55), R('dark', '底图压暗', 0, 1, .42), C('col', '发光色', '#e8f3ff'), D('drv', 'high', ['high', 'hat', 'energy', 'kick'])],
    state: { sparks: [], pos: 0 },
    draw(f, p, t) { const s = this.state, bpm = f.bpm || 112, speed = (.22 + f[p.drv] * .55) * (bpm / 112);
      s.pos = (s.pos + speed / 60) % 1; if (f.bar > .7) s.pos = 0;
      ctx.drawImage(src, 0, 0); ctx.fillStyle = `rgba(4,7,12,${p.dark * (.72 + f.energy * .2)})`; ctx.fillRect(0, 0, W, H);
      const g = lumGrid(p.pitch), sub = p.target === '主体' ? subject() : null, bandY = s.pos * (H + 160) - 80, band = 150 + f.energy * 80;
      let ad = null, acv = null; if (sub) { acv = document.createElement('canvas'); acv.width = g.cols; acv.height = g.rows; const ag = acv.getContext('2d'); ag.drawImage(sub, 0, 0, g.cols, g.rows); ad = ag.getImageData(0, 0, g.cols, g.rows).data; }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) { const i = y * g.cols + x, l = g.g[i], py = y * p.pitch + p.pitch / 2, dist = bandY - py;
        if (dist < -band * .22 || dist > band * (0.5 + p.trail)) continue;
        const mask = p.target === '全图' ? 1 : p.target === '主体' ? ((ad?.[i * 4 + 3] || 0) / 255) : clamp((l - .34) / .5, 0, 1);
        if (mask < 1 - p.cov) continue; const fade = dist < 0 ? 1 : Math.pow(1 - dist / (band * (0.5 + p.trail)), 1.8), q = clamp(mask * fade, 0, 1);
        const px = x * p.pitch, sz = p.pitch * (.45 + q * .62) * (1 + f.kick * .18); ctx.globalAlpha = .28 + q * .72;
        ctx.drawImage(src, px, y * p.pitch, p.pitch, p.pitch, px + (p.pitch - sz) / 2, py - sz / 2, sz, sz);
        ctx.strokeStyle = rgba(p.col, .25 + q * .65); ctx.lineWidth = 1; ctx.strokeRect(px + (p.pitch - sz) / 2, py - sz / 2, sz, sz);
        if (p.spark > 0 && Math.abs(dist) < p.pitch * 1.5 && Math.random() < p.spark * .025) s.sparks.push({ x: px, y: py, vx: rnd(-1.8, 1.8), vy: rnd(-2.4, .6), born: t, life: rnd(.35, .85), z: rnd(2, 7) }); }
      ctx.restore();
      s.sparks = s.sparks.filter(k => t - k.born < k.life); ctx.fillStyle = p.col;
      for (const k of s.sparks) { const age = t - k.born, q = 1 - age / k.life; k.x += k.vx * (1 + f.high); k.y += k.vy; ctx.globalAlpha = q * .85; ctx.fillRect(k.x, k.y, k.z * q, k.z * q); }
      ctx.globalAlpha = 1; dropFlash(f, p); } },

  stretchBands: {
    name: '局部横向拉丝', icon: '🧵', desc: '保留主体 · 色带伸缩 · 卡点加速',
    hint: '参考「音乐 x AI 节奏可视化-副本(3)」与「色彩移动」：每轮从画面局部抽取 2–4 条不同粗细的颜色横带，向左或向右完整伸出、短暂保持后收回。人像主体保持清晰，色带在主体后方经过，重拍瞬间加速。',
    params: [R('count', '每轮横带', 2, 6, 5, 1), R('thick', '横带粗细', .45, 1.8, 1.22), R('length', '拉伸长度', .25, 1, .94),
      R('hold', '保持时间', .05, 1.2, .52), R('soft', '边缘柔化', 0, 1, .18), R('base', '常驻细丝', 0, 1, .22),
      R('subject', '主体清晰', 0, 1, 1), D('drv', 'beat', ['beat', 'kick', 'snare', 'hat', 'bar', 'energy'])],
    state: { bands: [], last: -9, seed: 0 },
    draw(f, p, t) { const s = this.state, drive = clamp(f[p.drv], 0, 1);
      ctx.drawImage(src, 0, 0);
      // A restrained bed of one-pixel streaks keeps the frame alive between hits.
      if (p.base > 0) { ctx.save(); ctx.globalAlpha = p.base * (.12 + f.energy * .18);
        for (let i = 0; i < 14; i++) { const y = (i * 71 + Math.floor(t * (4 + f.high * 13))) % H, sy = Math.floor(y);
          const sx = (i * 83 + Math.floor(t * 9)) % (W - 8), dir = i % 2 ? 1 : -1, w = 45 + (i % 5) * 31;
          ctx.drawImage(src, sx, sy, 7, 1, dir > 0 ? sx : sx - w, sy, w, 1); }
        ctx.restore(); }
      const autoPulse = !S.playing && t - s.last > 1.75;
      if ((drive > .48 || autoPulse) && t - s.last > .28) { s.last = t; s.seed++;
        const n = Math.round(p.count), used = [];
        for (let i = 0; i < n; i++) { let y = rnd(H * .08, H * .92); for (let guard = 0; guard < 8 && used.some(v => Math.abs(v - y) < 48); guard++) y = rnd(H * .08, H * .92); used.push(y);
          const h = rnd(8, 54) * p.thick, dir = (i + s.seed) % 2 ? 1 : -1, sx = clamp(rnd(W * .18, W * .82), 4, W - 5);
          s.bands.push({ y, h, sx, sw: rnd(2, 11), dir, len: rnd(.55, 1) * p.length * W, born: t, attack: rnd(.16, .34), hold: p.hold * rnd(.72, 1.25), release: rnd(.42, .8), echo: Math.random() < .55 }); } }
      s.bands = s.bands.filter(b => t < b.born + b.attack + b.hold + b.release);
      ctx.save();
      for (const b of s.bands) { const age = t - b.born, endHold = b.attack + b.hold; let q;
        if (age < b.attack) q = 1 - Math.pow(1 - clamp(age / b.attack, 0, 1), 3);
        else if (age < endHold) q = 1;
        else q = Math.pow(1 - clamp((age - endHold) / b.release, 0, 1), 2);
        const punch = 1 + drive * .14, dw = Math.max(2, b.len * q * punch), dx = b.dir > 0 ? b.sx : b.sx - dw;
        if (p.soft > .02) ctx.filter = `blur(${(p.soft * 1.4).toFixed(2)}px)`;
        ctx.globalAlpha = .92; ctx.drawImage(src, b.sx, b.y, b.sw, b.h, dx, b.y, dw, b.h);
        ctx.filter = 'none';
        // A crisp sampled spine and a faint displaced echo create the layered
        // silkscreen edge visible in the reference instead of a generic blur.
        ctx.globalAlpha = .55 + drive * .25; ctx.drawImage(src, b.sx, b.y, Math.max(1, b.sw * .45), b.h, dx, b.y, dw, Math.max(1, b.h * .16));
        if (b.echo && q > .08) { ctx.globalAlpha = .16 * q; const ey = b.y + b.h + 2 + Math.sin(b.born * 7) * 6; ctx.drawImage(src, b.sx, b.y, b.sw, b.h, dx - b.dir * 18, ey, dw * .82, Math.max(2, b.h * .28)); }
      }
      ctx.restore(); ctx.globalAlpha = 1;
      if (p.subject > 0) { ctx.save(); ctx.globalAlpha = p.subject; ctx.drawImage(subject(), 0, 0); ctx.restore(); }
      dropFlash(f, p); } },

  subjectSplit: {
    name: '歌词双生分屏', icon: '✂️', desc: '文字剪影 × 抠图主体 × 歌词掉落',
    hint: '适配横图/宽幅人物图：上半保留环境并把主体变成由歌词填满的纯色剪影；下半为取色纸张背景和真实抠图主体。上下使用完全相同的裁切与比例。素材仅做筛选提示，仍由你手动选择。',
    params: [Sel('copy', '文字来源', ['自定义文字', '自动歌词'], '自定义文字'), T('text', '自定义文案', "DON'T YOU WANT TO / BE THE ONE / WHEN YOU GO / NOWHERE ELSE TO GO"),
      Sel('bg', '背景', ['图片取色', '手动纯色', '深色取色'], '图片取色'), C('col', '手动颜色', '#efefa9'),
      R('type', '歌词字号', .7, 1.5, 1), R('motion', '律动幅度', 0, 2, 1), R('fall', '掉落速度', .35, 1.8, .78), R('stars', '星点数量', 0, 1, .38), R('move', '主体律动', 0, 1, .18), D('drv', 'bass', ['bass', 'kick', 'beat', 'energy'])],
    state: { hit: 0, last: -9, lastDrop: -9, word: 0, drops: [], sparks: [], inside: [], nodes: [], insideKey: '', tm: null, plate: null, topSub: null, bottomSub: null },
    draw(f, p, t) { const s = this.state, cut = Math.round(H * .5), pal = imagePalette(), frame = splitFrame(), sub = S.cache.splitSub, sb = sub ? splitSubjectBounds(sub) : { x0: W * .2, y0: 12, x1: W * .8, y1: cut - 12 };
      const topSub = s.topSub || (s.topSub = document.createElement('canvas')), bottomSub = s.bottomSub || (s.bottomSub = document.createElement('canvas')); topSub.width = bottomSub.width = W; topSub.height = bottomSub.height = H;
      const ta = topSub.getContext('2d'), ba = bottomSub.getContext('2d'); ta.clearRect(0, 0, W, H); ba.clearRect(0, 0, W, H);
      if (sub) { ta.drawImage(sub, 0, 0, W, cut); ta.globalAlpha = .72; ta.drawImage(sub, -1, 0, W, cut); ta.drawImage(sub, 1, 0, W, cut); ta.drawImage(sub, 0, -1, W, cut); ta.drawImage(sub, 0, 1, W, cut); ta.globalAlpha = 1; ba.drawImage(sub, 0, cut, W, H - cut); }
      const custom = (p.text || '').split(/[\/\n|,，]+/).map(x => x.trim()).filter(Boolean), liveLyric = lyricAt(t).trim();
      const phrases = p.copy === '自动歌词' && liveLyric ? [liveLyric] : custom.length ? custom : ['ON LOOP'];
      const active = phrases[s.word % phrases.length] || phrases[0], pulse = Math.max(f.beat, f.kick);
      if ((pulse > .55 || (!S.playing && t - s.last > 1.25)) && t - s.last > .28) { s.last = t; s.word++; s.hit = 1; }
      if ((pulse > .62 || (!S.playing && t - s.lastDrop > 2.8)) && t - s.lastDrop > 2.8) { s.lastDrop = t;
        const line = p.copy === '自动歌词' && liveLyric ? liveLyric : phrases[s.word % phrases.length];
        const side = Math.random() < .5;
        s.drops.push({ text: line, x: side ? rnd(22, W * .24) : rnd(W * .62, W * .76), y: cut + rnd(-8, 12), vy: rnd(22, 34) * p.fall, rot: rnd(-.035, .035), born: t, life: rnd(4.5, 5.8), size: rnd(18, 23), side }); s.drops = s.drops.slice(-2);
        const count = Math.round(1 + p.stars * 4); for (let i = 0; i < count; i++) s.sparks.push({ x: rnd(18, W - 18), y: cut + rnd(-20, 12), vy: rnd(34, 74) * p.fall, vx: rnd(-8, 8), born: t, life: rnd(2.5, 4.2), z: rnd(2.5, 5.5), ph: rnd(0, 7) }); s.sparks = s.sparks.slice(-14); }
      s.hit *= .86;
      const bg = p.bg === '手动纯色' ? p.col : p.bg === '深色取色' ? pal.deep : splitAccent(), ink = p.bg === '深色取色' ? '#f5f3ee' : pal.deep;

      // Upper half: untouched location plus an opaque typographic silhouette.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cut); ctx.clip(); ctx.filter = 'saturate(.78) contrast(.96) brightness(.88)';
      ctx.drawImage(frame, 0, 0, W, cut); ctx.filter = 'none';
      const plate = s.plate || (s.plate = document.createElement('canvas')); plate.width = W; plate.height = H; const pg = plate.getContext('2d'); pg.globalCompositeOperation = 'source-over'; pg.clearRect(0, 0, W, H); pg.drawImage(topSub, 0, 0); pg.globalCompositeOperation = 'source-in'; pg.fillStyle = bg; pg.fillRect(0, 0, W, H); pg.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.shadowColor = bg; ctx.shadowBlur = 6 + f.high * 10; ctx.drawImage(plate, 0, 0); ctx.restore();
      const tm = s.tm || (s.tm = document.createElement('canvas')); tm.width = W; tm.height = H; const tg = tm.getContext('2d'); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H);
      const copyPool = (p.copy === '自动歌词' && liveLyric ? [liveLyric] : custom.length ? custom : ['ON LOOP']).flatMap(q => { const ws = q.split(/\s+/).filter(Boolean); return ws.length > 1 ? ws : [q]; });
      const bx0 = clamp(sb.x0, 12, W - 40), bx1 = clamp(sb.x1, bx0 + 30, W - 12), by0 = clamp(sb.y0, 12, cut - 30), by1 = clamp(sb.y1, by0 + 24, cut - 10);
      const insideArea = Math.max(1, (bx1 - bx0) * (by1 - by0)), insideN = clamp(Math.round(insideArea / (2650 - p.type * 420)), 46, 72), insideKey = S.srcKey + '|' + copyPool.join('|') + '|' + Math.round(p.type * 10) + '|' + Math.round(bx0) + '|' + insideN;
      if (s.insideKey !== insideKey || s.inside.length !== insideN) { const cols = Math.max(6, Math.round(Math.sqrt(insideN * (bx1 - bx0) / Math.max(1, by1 - by0)))), rows = Math.ceil(insideN / cols); s.insideKey = insideKey; s.inside = Array.from({ length: insideN }, (_, i) => { const row = Math.floor(i / cols), col = i % cols, targetX = bx0 + (col + .5) * (bx1 - bx0) / cols, targetY = by0 + (row + .5) * (by1 - by0) / rows; return { text: copyPool[i % copyPool.length], x: targetX + rnd(-3, 3), y: by0 - 8 - row * rnd(3, 6), targetX, targetY, vx: rnd(-.14, .14), vy: rnd(3.1, 4.8), z: rnd(.64, .9), ph: rnd(0, 7), angle: rnd(-.025, .025), va: 0, pulse: 0, delay: rnd(0, .07), entered: false, born: t, hw: 20 }; }); const spots = [[.25,.25],[.7,.25],[.48,.48],[.25,.7],[.72,.72]]; s.nodes = spots.map((v, i) => ({ x: bx0 + v[0] * (bx1 - bx0), y: by0 + v[1] * (by1 - by0), band: i % 4, ph: i * 1.27 })); }
      const amp = p.motion == null ? 1 : p.motion, fs = 14 + p.type * 5.5, mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2, flow = amp * (.012 + f.bass * .065), beatWave = Math.sin(f.beatPhase * Math.PI * 2);
      tg.fillStyle = ink; tg.font = `500 ${fs}px Manrope, "PingFang SC", sans-serif`; tg.textBaseline = 'middle'; tg.textAlign = 'center';
      const nodeBands = [f.kick, f.bass, f.energy, f.high];
      for (const q of s.inside) { if (t - q.born < q.delay) continue; q.hw = Math.min((bx1 - bx0) * .14, 46, Math.max(10, tg.measureText(q.text).width * q.z * .5)); q.hh = fs * q.z * .48; const rx = q.x - mx, ry = q.y - my, rl = Math.max(30, Math.hypot(rx, ry)), landing = q.entered && t - q.enterAt < .72; let localPulse = 0; if (q.entered) for (const n of s.nodes) { const dxn = q.x - n.x, dyn = q.y - n.y, dn = Math.max(8, Math.hypot(dxn, dyn)), level = clamp(nodeBands[n.band] * .78 + f.beat * .34 + Math.max(0, Math.sin(f.beatPhase * Math.PI * 2 + n.ph)) * f.energy * .18, 0, 1), radius = 62 + level * 78, influence = dn < radius ? (1 - dn / radius) * level : 0; if (influence > 0) { localPulse = Math.max(localPulse, influence); q.vx += dxn / dn * influence * amp * .34; q.vy += dyn / dn * influence * amp * .26 + influence * amp * .035; q.va += (dxn >= 0 ? 1 : -1) * influence * amp * .014; } }
        q.pulse = Math.max(q.pulse * .82, localPulse); q.vx += (-ry / rl) * flow + amp * Math.sin(t * .9 + q.ph) * (.004 + f.high * .028) + amp * beatWave * .012; q.vy += (q.entered ? .014 : .16) + amp * ((rx / rl) * flow + Math.cos(t * .75 + q.ph) * (.003 + f.high * .02)); if (q.entered) { const hold = 1 - q.pulse * .78; q.vx += clamp((q.targetX - q.x) * (landing ? .022 : .0045) * hold, landing ? -.38 : -.1, landing ? .38 : .1); q.vy += clamp((q.targetY - q.y) * (landing ? .032 : .0055) * hold, landing ? -.68 : -.12, landing ? .68 : .12); } q.vx = clamp(q.vx * (q.entered ? (landing ? .955 : .935) : .992), -2.8, 2.8); q.vy = clamp(q.vy * (q.entered ? (landing ? .96 : .94) : .994), -2.2, 5.4); q.va *= .92; q.angle = clamp(q.angle + q.va, -.22, .22); q.x += q.vx; q.y += q.vy; if (!q.entered && q.y >= by0 + q.hh) { q.entered = true; q.enterAt = t; } }
      for (let pass = 0; pass < 6; pass++) { for (let i = 0; i < s.inside.length; i++) for (let j = i + 1; j < s.inside.length; j++) { const a = s.inside[i], b = s.inside[j]; if (!a.entered || !b.entered) continue; const ox = a.hw + b.hw + 2 - Math.abs(a.x - b.x), oy = a.hh + b.hh + 2 - Math.abs(a.y - b.y); if (ox > 0 && oy > 0) { if (ox < oy) { const dir = a.x < b.x ? -1 : 1; a.x += dir * ox * .51; b.x -= dir * ox * .51; const av = a.vx; a.vx = b.vx * .58; b.vx = av * .58; } else { const dir = a.y < b.y ? -1 : 1; a.y += dir * oy * .51; b.y -= dir * oy * .51; const av = a.vy; a.vy = b.vy * .52; b.vy = av * .52; } const spin = (a.vx - b.vx) * .006; a.va += spin; b.va -= spin; } } for (const q of s.inside) { if (!q.entered) continue; if (q.x - q.hw < bx0 || q.x + q.hw > bx1) { q.x = clamp(q.x, bx0 + q.hw, bx1 - q.hw); q.vx *= -.48; q.va += q.vy * .004; } if (q.y + q.hh > by1) { q.y = by1 - q.hh; q.vy *= -.46; q.va += q.vx * .005; } if (q.y - q.hh < by0) { q.y = by0 + q.hh; q.vy = Math.abs(q.vy) * .42; } } }
      for (const q of s.inside) { const breathe = q.z * (1 + amp * (f.energy * .035 + f.kick * .055 + q.pulse * .24)); tg.save(); tg.translate(q.x, q.y); tg.rotate(q.angle); tg.scale(breathe, breathe); tg.fillText(q.text, 0, 0); tg.restore(); }
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(topSub, 0, 0); tg.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .94; const shake = amp * f.kick * 1.25; ctx.drawImage(tm, rnd(-shake, shake), rnd(-shake, shake)); ctx.globalAlpha = 1; ctx.restore();

      // Lower half: picked paper colour, enlarged live cutout, open space for falling lyrics.
      ctx.fillStyle = bg; ctx.fillRect(0, cut, W, H - cut); ctx.save(); ctx.globalAlpha = .045; ctx.fillStyle = ink; for (let i = 0; i < 240; i++) { const x = (i * 83) % W, y = cut + ((i * 137) % (H - cut)); ctx.fillRect(x, y, 1, 1); } ctx.restore();
      const drive = clamp(f[p.drv], 0, 1); ctx.save(); ctx.beginPath(); ctx.rect(0, cut, W, H - cut); ctx.clip(); ctx.globalAlpha = 1; ctx.drawImage(bottomSub, 0, 0); ctx.restore();

      s.drops = s.drops.filter(d => t - d.born < d.life && d.y < H + 150); for (const d of s.drops) { const age = t - d.born; d.y += d.vy / 60 * (1 + f.kick * 2.2); d.x += Math.sin(t * 1.4 + d.born * 3) * .18; const fade = Math.min(1, age * 3) * Math.min(1, (d.life - age) * 1.5); ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot + Math.sin(t + d.born) * .018); ctx.globalAlpha = fade * .9; ctx.fillStyle = ink; ctx.strokeStyle = bg; ctx.lineWidth = 2; ctx.font = `italic 500 ${d.size}px Georgia, "PingFang SC", serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const ws = d.text.split(/\s+/).filter(Boolean), maxW = 170; let yy = 0, line = ''; for (const w of ws) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.strokeText(line, 0, yy); ctx.fillText(line, 0, yy); line = w; yy += d.size * .94; } else line = test; } if (line) { ctx.strokeText(line, 0, yy); ctx.fillText(line, 0, yy); } ctx.restore(); }
      s.sparks = s.sparks.filter(q => t - q.born < q.life && q.y < H + 20); for (const q of s.sparks) { const age = t - q.born; q.y += q.vy / 60 * (1 + f.kick * 1.8); q.x += q.vx / 60 + Math.sin(t * 2 + q.ph) * .12; const a = Math.min(1, age * 5) * Math.min(1, (q.life - age) * 2); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(t * .35 + q.ph); ctx.globalAlpha = a * (.55 + f.high * .4); ctx.fillStyle = p.bg === '深色取色' ? '#fff' : ink; ctx.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? q.z * .42 : q.z, an = -Math.PI / 2 + j * Math.PI / 5; if (!j) ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); else ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.globalAlpha = .18 + f.high * .35; ctx.fillRect(0, cut - 1, W, 1 + f.high * 2); ctx.globalAlpha = 1; dropFlash(f, p); } },

  mosaic: { name: '马赛克脉冲', icon: '🟦', desc: '格子随能量呼吸', hint: '整幅画面量化成方格，格子大小跟着能量和 Kick 呼吸，重拍瞬间变粗再回落。',
    params: [R('base', '基础格', 4, 60, 16, 1), R('punch', '鼓点冲击', 0, 1, .6), R('decay', '回弹', .5, .97, .85), R('edge', '格线', 0, 1, .25), D('drv', 'kick')],
    state: { z: 0 },
    draw(f, p, t) { const s = this.state; s.z = Math.max(s.z * p.decay, f[p.drv]);
      const pitch = Math.max(2, p.base * (1 + s.z * p.punch * 2.2 + f.energy * .5));
      const cw = Math.max(2, Math.round(W / pitch)), chh = Math.max(2, Math.round(H / pitch));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, W, H, 0, 0, cw, chh); ctx.drawImage(cv, 0, 0, cw, chh, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      if (p.edge > 0) { ctx.strokeStyle = `rgba(0,0,0,${p.edge * .5})`; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = 0; x < W; x += W / cw) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = 0; y < H; y += H / chh) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); }
      dropFlash(f, p); } },

  warhol: { name: '波普四宫格', icon: '🎨', desc: '四格换色', hint: '安迪·沃霍尔式四宫格，每格一套高饱和配色，色相在每个重拍上整体推进。',
    params: [R('hue', '色相步进', 0, 180, 70, 1), R('sat', '饱和', 1, 3, 1.8), R('contrast', '对比', 1, 3, 1.5), R('gap', '缝隙', 0, 14, 5, 1), D('drv', 'beat', ['beat', 'kick', 'snare', 'bar'])],
    state: { h: 0, last: 0 },
    draw(f, p, t) { const s = this.state;
      if (f[p.drv] > .5 && t - s.last > .12) { s.last = t; s.h = (s.h + p.hue) % 360; }
      ctx.fillStyle = '#0b0b0e'; ctx.fillRect(0, 0, W, H);
      const cells = [[0, 0], [1, 0], [0, 1], [1, 1]], hw = W / 2, hh = H / 2;
      cells.forEach((c, i) => { const x = c[0] * hw + p.gap / 2, y = c[1] * hh + p.gap / 2;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, hw - p.gap, hh - p.gap); ctx.clip();
        ctx.filter = `hue-rotate(${s.h + i * 90}deg) saturate(${p.sat}) contrast(${p.contrast})`;
        ctx.drawImage(src, x, y, hw - p.gap, hh - p.gap); ctx.filter = 'none'; ctx.restore(); });
      dropFlash(f, p); } },

  bars: { name: '频谱条', icon: '🎚️', desc: '实时频谱压在画面上', hint: '把实时 FFT 频谱直接画在画面上，低频在左高频在右，条带随音乐跳动，是最直给的「音乐可视化」。',
    params: [R('n', '条数', 12, 64, 32, 1), R('h', '高度', .1, 1, .45), R('op', '不透明度', .1, 1, .65), C('col', '颜色', '#4ad4f0'), Sel('pos', '位置', ['底部', '顶部', '居中', '全屏'], '底部'), R('dark', '压暗底图', 0, 1, .25)],
    state: { sm: new Float32Array(64) },
    draw(f, p, t) { const s = this.state; ctx.drawImage(src, 0, 0);
      if (p.dark > 0) { ctx.fillStyle = `rgba(0,0,0,${p.dark})`; ctx.fillRect(0, 0, W, H); }
      const n = Math.round(p.n), bw = W / n, maxH = H * p.h;
      ctx.save(); ctx.globalAlpha = p.op; ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) { let v = 0;
        if (freq && S.playing) { const lo = Math.floor(Math.pow(i / n, 1.7) * 460) + 1, hi = Math.max(lo + 2, Math.floor(Math.pow((i + 1) / n, 1.7) * 460));
          let q = 0; for (let k = lo; k < hi; k++) q += freq[k]; v = clamp(q / (hi - lo) / 190 * (.6 + i / n), 0, 1); }
        s.sm[i] = Math.max(v, (s.sm[i] || 0) * .84);
        const bh = Math.max(2, s.sm[i] * maxH), x = i * bw;
        const y = p.pos === '顶部' ? 0 : p.pos === '居中' ? H / 2 - bh / 2 : p.pos === '全屏' ? H / 2 - bh : H - bh;
        const hh = p.pos === '全屏' ? bh * 2 : bh;
        ctx.fillStyle = p.col; ctx.fillRect(x + bw * .12, y, bw * .76, hh); }
      ctx.restore(); dropFlash(f, p); } },

  ascii: { name: '字符画', icon: '🔤', desc: '亮度换成字符', hint: '按亮度把画面换成字符矩阵，密度和字符集随能量变化，重拍时整屏字符刷新。',
    params: [R('pitch', '字距', 6, 26, 11, 1), C('col', '字色', '#d8f5ff'), R('dark', '压暗', 0, 1, .7), R('sat', '保留原色', 0, 1, .25), D('drv', 'energy', ['energy', 'high', 'hat', 'kick'])],
    chars: ' .:-=+*#%@',
    draw(f, p, t) { ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, W, H);
      if (p.sat > 0) { ctx.globalAlpha = p.sat * .5; ctx.drawImage(src, 0, 0); ctx.globalAlpha = 1; }
      ctx.fillStyle = `rgba(7,8,11,${p.dark})`; ctx.fillRect(0, 0, W, H);
      const g = lumGrid(p.pitch), ch = this.chars, boost = 1 + f[p.drv] * .5;
      ctx.font = `600 ${p.pitch * 1.15}px Manrope, monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = p.col;
      for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
        const l = clamp(g.g[y * g.cols + x] / (g.hi || 1) * boost, 0, 1), i = Math.min(ch.length - 1, Math.floor(l * ch.length));
        if (i < 1) continue; ctx.globalAlpha = .35 + l * .65;
        ctx.fillText(ch[i], x * p.pitch + p.pitch / 2, y * p.pitch + p.pitch / 2); }
      ctx.globalAlpha = 1; dropFlash(f, p); } },

  rain: { name: '字符雨', icon: '🌧️', desc: '数码雨落在画面前', hint: '一列列字符从上往下落，速度跟能量走，Hi-hat 时头部字符爆亮，像数码雨盖在人像前面。',
    params: [R('cols', '列数', 8, 40, 20, 1), R('speed', '速度', .2, 3, 1), R('len', '拖尾', 4, 30, 14, 1), C('col', '颜色', '#8ef5c0'), R('dark', '压暗', 0, 1, .45), D('drv', 'energy', ['energy', 'hat', 'high', 'kick'])],
    state: { ys: null, key: 0 }, chars: 'アイウエオカキクケコサシスセソ01234567',
    draw(f, p, t) { const s = this.state, n = Math.round(p.cols);
      if (!s.ys || s.ys.length !== n) { s.ys = Array.from({ length: n }, () => rnd(-H, H)); }
      ctx.drawImage(src, 0, 0); ctx.fillStyle = `rgba(4,8,6,${p.dark})`; ctx.fillRect(0, 0, W, H);
      const cw = W / n, fs = cw * .82; ctx.font = `600 ${fs}px Manrope, monospace`; ctx.textAlign = 'center';
      const spd = (2 + p.speed * 9) * (0.4 + f[p.drv]);
      for (let i = 0; i < n; i++) { s.ys[i] += spd; if (s.ys[i] > H + p.len * fs) s.ys[i] = -rnd(0, H * .6);
        for (let k = 0; k < p.len; k++) { const y = s.ys[i] - k * fs; if (y < -fs || y > H + fs) continue;
          const a = (1 - k / p.len);
          ctx.fillStyle = k === 0 ? '#fff' : p.col; ctx.globalAlpha = k === 0 ? .9 + f.hat * .1 : a * .7;
          ctx.fillText(this.chars[(i * 7 + k + Math.floor(t * 6)) % this.chars.length], i * cw + cw / 2, y); } }
      ctx.globalAlpha = 1; dropFlash(f, p); } },

};
const FX_ORDER = ['none', 'glitch', 'scan', 'dots', 'mosaic', 'warhol', 'ascii', 'rain', 'bars', 'hud', 'pixelReveal', 'stretchBands', 'subjectSplit'];

const FX_CAPS = {
  none: ['9:16 素材适配'], glitch: ['分块采样', 'RGB 通道分离', 'Kick/Hi-hat 瞬态检测'], scan: ['亮度降采样', '小节对齐', '高频/能量驱动'],
  dots: ['亮度阈值', 'LED 点阵量化', '高频/节拍驱动'], mosaic: ['画面量化', '低频脉冲', '惯性回弹'], warhol: ['多格重排', '色相变换', '重拍触发'],
  ascii: ['亮度字符映射', '能量密度驱动'], rain: ['程序化文字粒子', 'Hi-hat/高频驱动'], bars: ['实时 FFT', '频带映射', '包络平滑'],
  hud: ['短标记自动分组', '曲线点阵网格', '流动高亮点', '双层湍流场', 'CH/QUERY 数据标注', '音乐位移波'], pixelReveal: ['亮度/主体目标', '像素重采样', '扫描带', '粒子系统'],
  stretchBands: ['局部色彩采样', '横向像素延展', '主体分割保护', '节拍状态机'],
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
  try { fx.draw(f, S.params[S.fx], t); } catch (e) { ctx.drawImage(src, 0, 0); }
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
  const w = spec.width, h = spec.height, n = specSm.length, gap = 3, bw = (w - gap * (n - 1)) / n;
  spctx.clearRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    let v = 0;
    if (freq && S.playing) { const lo = Math.floor(Math.pow(i / n, 1.75) * 480) + 1, hi = Math.max(lo + 2, Math.floor(Math.pow((i + 1) / n, 1.75) * 480));
      let s = 0; for (let k = lo; k < hi; k++) s += freq[k]; v = clamp(s / (hi - lo) / 175 * (0.6 + i / n * 1.0), 0, 1); }
    specSm[i] = Math.max(Math.max(v * 1.25, 0.02 + 0.015 * Math.sin(i * 0.7 + performance.now() / 900)), specSm[i] * 0.87);
    const bh = Math.max(2, specSm[i] * h), x = i * (bw + gap);
    const g = spctx.createLinearGradient(0, h - bh, 0, h);
    g.addColorStop(0, '#bff3fb'); g.addColorStop(.45, '#4ad4f0'); g.addColorStop(1, 'rgba(74,212,240,.25)');
    spctx.fillStyle = g; spctx.fillRect(x, h - bh, bw, bh);
    spctx.fillStyle = 'rgba(255,255,255,.10)'; spctx.fillRect(x, h - 1.5, bw, 1.5);
  }
}
function setMeter(a, b, v) { $(a).textContent = v.toFixed(2); $(b).style.width = clamp(v, 0, 1) * 100 + '%'; }

/* ---------- timeline ---------- */
const tlc = $('#tlc'), tctx = tlc.getContext('2d');
function drawTimeline(t = 0) {
  const A = S.analysis, w = tlc.width, h = tlc.height; tctx.clearRect(0, 0, w, h);
  if (!A) { tctx.fillStyle = '#4b4a46'; tctx.font = '600 30px Manrope'; tctx.fillText('选歌后显示节拍 / 段落 / Drop', 22, h / 2 + 11); return; }
  const X = s => s / A.dur * w;
  for (const s of A.segs) { tctx.fillStyle = ['#2b3038', '#3f6b7a', '#ffb04a'][s.lvl]; tctx.globalAlpha = .34; tctx.fillRect(X(s.a), 0, X(s.b) - X(s.a), h); }
  tctx.globalAlpha = 1; tctx.fillStyle = 'rgba(255,255,255,.18)'; for (const b of A.beats) tctx.fillRect(X(b), h - 10, 2, 10); tctx.fillStyle = 'rgba(255,255,255,.4)'; for (const b of A.downbeats) tctx.fillRect(X(b), h - 20, 2.5, 20);
  tctx.beginPath(); tctx.moveTo(0, h); A.curve.forEach((v, i) => tctx.lineTo(i / 199 * w, h - v * (h - 10))); tctx.lineTo(w, h); tctx.closePath(); tctx.fillStyle = 'rgba(240,236,228,.42)'; tctx.fill();
  for (const d of A.drops) { tctx.fillStyle = '#ff6b5e'; tctx.fillRect(X(d) - 1.5, 0, 3, h); tctx.font = '700 24px Manrope'; tctx.fillText('DROP', X(d) + 8, 28); }
  tctx.fillStyle = '#fff'; tctx.fillRect(X(t) - 1, 0, 2, h); tctx.fillStyle = 'rgba(255,255,255,.35)'; tctx.fillRect(X(t) - 5, 0, 10, 3);
}
$('#tl').addEventListener('click', e => { if (!S.buffer) return; const r = e.currentTarget.getBoundingClientRect(); const at = (e.clientX - r.left) / r.width * S.buffer.duration; play(at); });

/* =====================================================================
   7. UI
   ===================================================================== */
function selectFx(id) { S.fx = id; document.querySelectorAll('#fxlist button').forEach(b => b.classList.toggle('on', b.dataset.id === id)); $('#fxname').textContent = FX[id].name + ' · ' + FX[id].desc; const caps = FX_CAPS[id] || []; $('#fxhint').textContent = (FX[id].hint || '') + (caps.length ? '\n技术能力：' + caps.join(' · ') : ''); buildParams();
  if (id === 'subjectSplit') { if (curTag !== '横图') { curTag = '横图'; document.querySelectorAll('#filters .chip').forEach(b => b.classList.toggle('on', b.textContent === '横图')); renderGallery(true); applyFilter(); toast('已筛选横图，请手动选择素材'); } delete S.cache.splitSub; delete S.cache.splitBounds; setSeg(S.isVideo ? '实时视频抠像 · 启动中…' : 'MODNet 高清抠像 · 启动中…', 'working'); setTimeout(S.isVideo ? refineSubject : refineSubjectHQ, 20); }
}
function buildFxList() { const list = $('#fxlist'); list.innerHTML = '';
  for (const id of FX_ORDER) { const e = FX[id]; if (!e) continue; const b = document.createElement('button'); b.dataset.id = id;
    b.innerHTML = `<span class="ico">${e.icon}</span>${e.name}`; b.title = e.desc; b.classList.toggle('on', id === S.fx);
    b.onclick = () => selectFx(id); list.appendChild(b); }
}
function buildParams() {
  const box = $('#params'); box.innerHTML = ''; const defs = FX[S.fx].params, vals = S.params[S.fx];
  if (!defs.length) { box.innerHTML = '<div class="hint">该效果没有可调参数。</div>'; return; }
  for (const d of defs) { const row = document.createElement('div'); row.className = 'p'; const lab = document.createElement('label'); lab.textContent = d.label; row.appendChild(lab);
    if (d.type === 'range') { const inp = document.createElement('input'); inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.step; inp.value = vals[d.key]; const v = document.createElement('div'); v.className = 'v'; v.textContent = fmt(vals[d.key], d.step); inp.oninput = () => { vals[d.key] = +inp.value; v.textContent = fmt(+inp.value, d.step); if (d.key === 'pitch') delete S.cache['lum' + vals.pitch]; }; row.appendChild(inp); row.appendChild(v); }
    else if (d.type === 'text') { const inp = document.createElement('input'); inp.type = 'text'; inp.value = vals[d.key]; inp.placeholder = '用 / 或逗号分隔'; inp.style.gridColumn = '2/4'; inp.className = 'txt'; inp.oninput = () => vals[d.key] = inp.value; row.appendChild(inp); }
    else if (d.type === 'color') { const inp = document.createElement('input'); inp.type = 'color'; inp.value = vals[d.key]; inp.oninput = () => vals[d.key] = inp.value; row.appendChild(inp); row.appendChild(document.createElement('div')); }
    else if (d.type === 'select') { const sel = document.createElement('select'); d.opts.forEach(o => { const op = document.createElement('option'); op.textContent = o; op.value = o; op.selected = vals[d.key] === o; sel.appendChild(op); }); sel.onchange = () => vals[d.key] = sel.value; row.appendChild(sel); row.appendChild(document.createElement('div')); }
    else if (d.type === 'driver') { const wrap = document.createElement('div'); wrap.className = 'drv'; (d.only || Object.keys(DRIVERS)).forEach(k => { const c = document.createElement('button'); c.className = 'chip' + (vals[d.key] === k ? ' on' : ''); c.textContent = DRIVERS[k]; c.onclick = () => { vals[d.key] = k; wrap.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); }; wrap.appendChild(c); }); row.appendChild(wrap); }
    box.appendChild(row); }
  const reset = document.createElement('button'); reset.className = 'chip'; reset.textContent = '重置参数'; reset.style.alignSelf = 'flex-end'; reset.onclick = () => { defs.forEach(d => vals[d.key] = d.def); buildParams(); }; box.appendChild(reset);
}
const fmt = (v, step) => step >= 1 ? String(Math.round(v)) : v.toFixed(2);

/* ---------- tracks ---------- */
const trackCache = {};
function parseLRC(raw = '') { const out = []; for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/); if (m) out.push({ t: +m[1] * 60 + +m[2], text: m[3].trim() }); } return out.sort((a, b) => a.t - b.t); }
function lyricAt(t = songTime()) { let hit = null; for (const q of S.lyrics) { if (q.t > t) break; hit = q; } return hit ? hit.text : ''; }
window.MFX_MUSIC = { currentTrack: () => S.track, lyricAt, lyrics: () => S.lyrics };
function buildTracks() { const box = $('#tracks');
  if (PACK_TRACKS.length) { const pg = document.createElement('div'); pg.className = 'grp'; pg.textContent = '测试音乐 · ' + PACK_TRACKS.length + ' 首'; box.appendChild(pg);
    for (const tr of PACK_TRACKS) { const b = document.createElement('button'); b.className = 'pack'; b.dataset.id = tr.id;
      b.innerHTML = `<img class="cover" src="${tr.cover}" alt=""><div class="t">${tr.name}</div><div class="d">${tr.artist || tr.genre}</div>`; b.onclick = () => { loadTrack(tr); closeSheet(); }; box.appendChild(b); } }
  const g = document.createElement('div'); g.className = 'grp'; g.textContent = '内置曲目'; box.appendChild(g);
  for (const tr of TRACKS) { const b = document.createElement('button'); b.dataset.id = tr.id;
    b.innerHTML = `<div class="t">${tr.name}</div><div class="d">${tr.genre} · ${tr.bpm}</div>`; b.onclick = () => { loadTrack(tr); closeSheet(); }; box.appendChild(b); } }
function openSheet(kind) { $('#sheet').classList.add('on'); $('#sheetTracks').hidden = kind !== 'tracks'; $('#sheetParams').hidden = kind !== 'params';
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
  S.track = tr; S.lyrics = parseLRC(tr.lrc || ''); $('#nowT').textContent = tr.name; if (S.playing) pause(); S.pausedAt = 0;
  const disc = $('#discBtn'); disc.style.backgroundImage = tr.cover ? `url("${tr.cover}")` : ''; disc.classList.toggle('has-cover', !!tr.cover);
  try {
    if (tr.kind === 'pack') { $('#status').textContent = '解码并分析中…'; $('#nowD').textContent = (tr.artist || tr.genre) + ' · 内置测试音乐'; if (!trackCache[tr.id]) trackCache[tr.id] = await ac().decodeAudioData(await (await fetch(tr.url)).arrayBuffer()); }
    else if (tr.kind === 'remote') { $('#status').textContent = '下载并分析中…'; $('#nowD').textContent = tr.genre + ' · 云端加载中…'; if (!trackCache[tr.id]) trackCache[tr.id] = await ac().decodeAudioData(await (await fetch(tr.url)).arrayBuffer()); }
    else if (tr.kind === 'music') { $('#status').textContent = '解码并分析中…'; $('#nowD').textContent = '本地音乐 · 解码分析中…'; if (!trackCache[tr.id]) trackCache[tr.id] = await ac().decodeAudioData(await tr.blob.arrayBuffer()); }
    else { $('#status').textContent = trackCache[tr.id] ? '分析中…' : '首次合成这首曲目（几秒）…'; $('#nowD').textContent = tr.genre + ' · 合成并分析中…'; ac(); if (!trackCache[tr.id]) trackCache[tr.id] = await renderTrack(tr); }
    if (S.trackId !== tr.id) return;
    await setBuffer(trackCache[tr.id], tr.name); play(0);
  } catch (err) { toast('无法解码这个音频'); $('#status').textContent = '解码失败'; }
}
async function setBuffer(buf, name) {
  S.buffer = buf; S.analysis = null; lastBeatIdx = -1; S.lastSection = null;
  const A = await analyze(buf); S.analysis = A;
  $('#aBpm').textContent = A.bpm; $('#aGenre').textContent = A.genre; drawTimeline(0);
  $('#nowD').textContent = `${A.genre} · ${A.bpm} bpm · ${fmtT(A.dur)}`;
  $('#status').textContent = '正在播放'; $('#anaSub').textContent = `${A.segs.length} 段 · ${A.drops.length} 个 Drop`;
}
$('#musicUp').onclick = () => $('#musicFile').click();
$('#musicFile').onchange = async e => { const files = [...e.target.files]; if (!files.length) return; await importFiles(files, 'music'); const rec = LIB.music.find(x => x.name === files[0].name.replace(/\.[^.]+$/, '')); if (rec) loadTrack(rec); };
$('#play').onclick = () => { if (!S.buffer) return openSheet('tracks'); S.playing ? pause() : play(S.pausedAt || 0); };

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
  const startAt = songTime(); play(startAt);
  const out = document.createElement('canvas'); out.width = 780; out.height = 1688;
  const stream = out.captureStream(30);
  const audioTrack = recordDest?.stream.getAudioTracks()[0]; if (audioTrack) stream.addTrack(audioTrack);
  const choices = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
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
  (function paint() {
    if (!exporting) return;
    drawPhoneExport(out);
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
const TAGS = ['全部', '横图', '竖图', '本地', '自拍', '半身', '全身', '双人', '户外', '室内', '夜景'];
let curTag = '全部', galleryLimit = 24;
function presetMatches(d) { return curTag === '全部' || d.tags.includes(curTag); }
function presetButton(d, i) { const b = document.createElement('button'); b.dataset.i = i; b.dataset.tags = d.tags.join(','); const img = new Image(); img.loading = 'lazy'; img.decoding = 'async'; img.src = d.thumb || d.src; img.alt = d.name; b.appendChild(img);
  if (d.isVideo) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = '视频'; b.appendChild(tag); }
  const n = document.createElement('div'); n.className = 'n'; n.innerHTML = d.name + '<small>' + d.tags.join(' · ') + '</small>'; b.appendChild(n); b.onclick = () => selectPhoto(i); return b; }
function renderGallery(reset = false) { const box = $('#photos'); if (reset) { galleryLimit = 24; box.scrollTop = 0; }
  box.querySelectorAll('button[data-i],button.more').forEach(x => x.remove());
  const matches = PRESETS.map((d, i) => [d, i]).filter(([d]) => presetMatches(d));
  for (const [d, i] of matches.slice(0, galleryLimit)) box.appendChild(presetButton(d, i));
  if (galleryLimit < matches.length) { const more = document.createElement('button'); more.className = 'up more'; more.textContent = `加载更多\n${Math.min(galleryLimit, matches.length)} / ${matches.length}`; more.style.whiteSpace = 'pre-line'; more.onclick = () => { galleryLimit += 24; renderGallery(); applyFilter(); }; box.appendChild(more); }
}
function buildPhotos() { const box = $('#photos'), fl = $('#filters');
  TAGS.forEach(t => { const c = document.createElement('button'); c.className = 'chip' + (t === curTag ? ' on' : ''); c.textContent = t; c.onclick = () => { curTag = t; fl.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); renderGallery(true); applyFilter(); }; fl.appendChild(c); });
  const up = document.createElement('button'); up.className = 'up'; up.textContent = '上传\n照片/视频'; up.style.whiteSpace = 'pre-line'; up.onclick = () => $('#photoFile').click(); box.appendChild(up);
  renderGallery();
  applyFilter(); }
function applyFilter() { let n = PRESETS.filter(presetMatches).length; document.querySelectorAll('#photos button[data-lib]').forEach(b => { const show = curTag === '全部' || b.dataset.tags.split(',').includes(curTag); b.classList.toggle('hide', !show); if (show) n++; }); $('#photoCount').textContent = (PRESETS[S.photoIdx]?.name || '本地素材') + ' · ' + n + '/' + (PRESETS.length + LIB.photos.length) + ' 个'; }
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
function selectLib(rec) { document.querySelectorAll('#photos button').forEach(b => b.classList.toggle('on', b.dataset.lib === rec.id)); const url = URL.createObjectURL(rec.blob); if (rec.isVideo) setVideo(url); else { const img = new Image(); img.onload = () => setImage(img); img.src = url; } S.photoIdx = -1; $('#photoCount').textContent = rec.name + ' · 本地'; }
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
  const narrow = innerWidth < 1080;
  document.body.classList.toggle('stack', narrow);
  const s = narrow ? Math.min(1, (innerWidth - 40) / 390) : clamp((innerHeight - 30) / 844, 0.62, 0.96);
  document.documentElement.style.setProperty('--s', s.toFixed(3));
}
addEventListener('resize', fitPhone); fitPhone();
/* ---------- boot ---------- */
buildFxList(); buildTracks(); buildPhotos(); selectFx('glitch'); selectPhoto(0); drawTimeline(0); frame(); addEventListener('load', () => { try { restoreLibrary(); } catch (e) { }
  const mf = new URLSearchParams(location.search).get('manifest') || window.MFX_MANIFEST; if (mf) loadManifest(mf);
  setTimeout(mpLoad, 1200);
  const apt = PACK_TRACKS.find(x => x.id === 'apt') || PACK_TRACKS[0]; if (apt) setTimeout(() => loadTrack(apt), 180);
});
// Chrome may suspend audible autoplay until the first user gesture. The source
// is already prepared, so the first pointer/key interaction resumes it instantly.
const unlockAudio = () => { if (AC?.state === 'suspended' && S.playing) AC.resume(); };
addEventListener('pointerdown', unlockAudio, { passive: true }); addEventListener('keydown', unlockAudio);
