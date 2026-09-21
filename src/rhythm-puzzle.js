/* Rhythm Puzzle: reusable effect factory. Audio time, never a decorative timer,
   drives swaps, easing and the restrained type response. */
function createRhythmPuzzleEffect() {
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo, l = (hi + lo) / 2;
    let h = 0;
    if (d) { h = hi === r ? ((g - b) / d + (g < b ? 6 : 0)) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
  }
  function samplePalette(media) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(media, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data, colors = [], neutral = [];
    for (let i = 0; i < d.length; i += 16) {
      if (d[i + 3] < 128) continue;
      const c = hsl(d[i], d[i + 1], d[i + 2]); neutral.push(c);
      if (c[1] > .15 && c[2] > .12 && c[2] < .9) colors.push(c);
    }
    // Give small accent colors the same chance as large dominant areas. Keeping
    // one representative per hue band prevents skin/orange pixels from filling
    // nearly every palette slot while still using colors sampled from the image.
    const pool = colors.length ? colors : neutral.length ? neutral : [[0, 0, .56]], bands = new Map();
    for (const color of pool) {
      const band = Math.round(color[0] / 15) % 24;
      const score = color[1] * 1.4 + (1 - Math.abs(color[2] - .52));
      if (!bands.has(band) || score > bands.get(band).score) bands.set(band, { color, score });
    }
    return [...bands.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value.color);
  }
  function rotateLine(slots, horizontal, line, direction) {
    const segment = Array.from({ length: 3 }, (_, j) => horizontal ? line * 3 + j : j * 3 + line);
    const tileAt = Array(9);
    for (let id = 0; id < 9; id++) tileAt[slots[id]] = id;
    const ids = segment.map(slot => tileAt[slot]);
    for (let j = 0; j < 3; j++) slots[ids[j]] = segment[(j + direction + 3) % 3];
    return { segment, ids };
  }
  function shuffled() {
    const slots = Array.from({ length: 9 }, (_, i) => i);
    for (let i = 0; i < 8; i++) {
      const horizontal = Math.random() < .5, line = Math.floor(Math.random() * 3), direction = Math.random() < .5 ? -1 : 1;
      rotateLine(slots, horizontal, line, direction);
    }
    return slots;
  }
  const cubeMoves = Array.from({ length: 12 }, (_, i) => ({
    horizontal: i < 6, line: Math.floor((i % 6) / 2), direction: i % 2 ? 1 : -1
  }));
  function solvePath(slots) {
    const goal = Array.from({ length: 9 }, (_, i) => i), key = state => state.join('');
    const startKey = key(slots), goalKey = key(goal);
    if (startKey === goalKey) return [];
    const front = new Map([[startKey, { state: slots.slice(), path: [] }]]);
    const back = new Map([[goalKey, { state: goal, path: [] }]]);
    let frontEdge = [startKey], backEdge = [goalKey];
    for (let depth = 0; depth < 18 && frontEdge.length && backEdge.length; depth++) {
      const fromStart = frontEdge.length <= backEdge.length;
      const own = fromStart ? front : back, other = fromStart ? back : front;
      const edge = fromStart ? frontEdge : backEdge, next = [];
      // Rotate the move order per layer so repeated solves do not share one telltale route.
      const shift = Math.floor(Math.random() * cubeMoves.length);
      const moves = cubeMoves.map((_, i) => cubeMoves[(i + shift) % cubeMoves.length]);
      for (const stateKey of edge) {
        const node = own.get(stateKey);
        for (const move of moves) {
          const state = node.state.slice(); rotateLine(state, move.horizontal, move.line, move.direction);
          const nextKey = key(state);
          if (own.has(nextKey)) continue;
          const path = node.path.concat(move), entry = { state, path };
          own.set(nextKey, entry); next.push(nextKey);
          if (other.has(nextKey)) {
            const a = fromStart ? path : other.get(nextKey).path;
            const b = fromStart ? other.get(nextKey).path : path;
            return a.concat(b.slice().reverse().map(step => ({ ...step, direction: -step.direction })));
          }
        }
      }
      if (fromStart) frontEdge = next; else backEdge = next;
    }
    return [];
  }
  function hslRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l), f = n => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  }
  function luminance(rgb) {
    const c = rgb.map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  }
  function inkLightness(hue, saturation, lightness) {
    const bgLum = luminance(hslRgb(hue, saturation, lightness));
    const dark = clamp(lightness * .34, .12, .27), light = lightness + (1 - lightness) * .84;
    const darkLum = luminance(hslRgb(hue, saturation, dark));
    const lightLum = luminance(hslRgb(hue, saturation, light));
    const darkContrast = (Math.max(bgLum, darkLum) + .05) / (Math.min(bgLum, darkLum) + .05);
    const lightContrast = (Math.max(bgLum, lightLum) + .05) / (Math.min(bgLum, lightLum) + .05);
    return +(100 * (darkContrast >= lightContrast ? dark : light)).toFixed(1);
  }
  function textLines(text, maxWidth) {
    const lines = []; let line = '';
    // Word wrapping also handles Chinese and unbroken hashtags/long words.
    for (const word of String(text).split(/(\s+)/)) {
      if (line && ctx.measureText(line + word).width > maxWidth) { lines.push(line.trim()); line = ''; }
      for (const ch of word) {
        if (line && ctx.measureText(line + ch).width > maxWidth) { lines.push(line.trim()); line = ''; }
        line += ch;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }
  function copyBlock(text, x, y, width, size, bottom, motion = null) {
    let fs = size, lines;
    do { ctx.font = `600 ${fs}px Georgia, "Songti SC", serif`; lines = textLines(text, width); if (lines.length <= 3) break; fs -= 1; } while (fs > 11);
    if (lines.length > 3) { lines = lines.slice(0, 3); let end = lines[2]; while (end && ctx.measureText(end + '…').width > width) end = end.slice(0, -1); lines[2] = end + '…'; }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const top = bottom ? y : y - lines.length * fs * 1.22;
    let charIndex = motion?.base || 0;
    lines.forEach((line, i) => {
      let cx = x;
      for (const ch of Array.from(line)) {
        const cw = ctx.measureText(ch).width, distance = Math.abs(charIndex - (motion?.focus ?? -99));
        const weight = motion ? Math.max(0, 1 - distance * .34) * motion.pulse * motion.strength : 0;
        if (weight > .001) {
          ctx.save(); ctx.translate(cx + cw / 2, top + i * fs * 1.22 - weight * fs * .56); ctx.rotate((charIndex % 2 ? 1 : -1) * weight * .08); ctx.scale(1 + weight * .58, 1 + weight * .58); ctx.fillText(ch, -cw / 2, 0); ctx.restore();
        } else ctx.fillText(ch, cx, top + i * fs * 1.22);
        cx += cw; charIndex++;
      }
    });
  }
  return {
    name: '节奏拼图', icon: '🧩', desc: '九宫格错位 × 魔方滑轨 × 同色文字',
    hint: '图片裁成方形九宫格，鼓点推动完整的一行或一列三块同向轮转，不再出现相邻两块互换。下一条滑轨可以在上一条尚未落位时交叉接管。中频能量让文字轻轻摆动。用 / 分开上、下文案；取色编号可换一组图片颜色。',
    params: [Sel('copy', '文字来源', ['自定义文字', '自动歌词'], '自定义文字'),
      T('text', '自定义文案', 'just a little moment / life lately, on repeat.'),
      R('scale', '拼图画幅', .65, .88, .83), R('outline', '同色描边', 1, 6, 2, .5),
      R('pace', '滑动间隔（拍）', 1, 4, 1, 1), R('travel', '滑动速度', 0, 1, .82),
      R('resolveEvery', '完整图大约间隔（拍）', 16, 64, 32, 4), R('resolveHold', '完整图停留（拍）', 1, 4, 2, .5),
      R('textMotion', '文字律动', 0, 2.5, 1.55), R('textSize', '文字大小', .7, 1.4, 1),
      R('palette', '取色编号', 1, 16, 1, 1), R('saturation', '背景饱和度', .55, 1, .88),
      R('lightness', '背景明度', .48, .65, .56), D('drv', 'kick', ['kick', 'snare', 'beat'])],
    state: {},
    draw(f, p) {
      const s = this.state, media = S.media;
      if (!media) { ctx.drawImage(src, 0, 0); return; }
      const iw = S.isVideo ? media.videoWidth : media.naturalWidth || media.width;
      const ih = S.isVideo ? media.videoHeight : media.naturalHeight || media.height;
      if (!iw || !ih) return;
      if (s.sourceKey !== S.srcKey) {
        const opening = shuffled();
        Object.assign(s, { sourceKey: S.srcKey, colors: samplePalette(media), seed: Math.floor(Math.random() * 10000),
          slots: opening, positions: null, moves: [], pendingSlides: [], solveQueue: [], lastSwap: -99, prevHit: 0, prevBeat: 0, prevTextHit: 0, textPulse: 0, sway: 0, beatCount: 0, swaps: 0, lastAudio: null,
          nextResolveAt: null, resolving: false, resolveSettleAt: 0, resolveUntil: 0,
          tileOffsets: Array.from({ length: 9 }, (_, id) => ({
            x: (((id * 37 + 11) % 9) - 4) * .008,
            y: (((id * 53 + 7) % 9) - 4) * .007
          })), visualOffsets: null });
        s.positions = s.slots.map(slot => ({ x: slot % 3, y: Math.floor(slot / 3) }));
        s.visualOffsets = s.tileOffsets.map(offset => ({ ...offset }));
      }
      const audioTime = f.t, dt = s.lastAudio === null ? 0 : Math.max(0, Math.min(.05, audioTime - s.lastAudio));
      if (s.track !== S.track || (s.lastAudio !== null && (audioTime < s.lastAudio || audioTime - s.lastAudio > .5))) {
        s.moves = []; s.pendingSlides = []; s.solveQueue = []; s.lastSwap = -99; s.prevHit = 0; s.prevBeat = 0; s.prevTextHit = 0; s.textPulse = 0; s.beatCount = 0;
        s.nextResolveAt = null; s.resolving = false;
      }
      s.track = S.track; s.lastAudio = audioTime;
      const picked = s.colors[(s.seed + Math.round(p.palette) * 17) % s.colors.length];
      const sat = picked[1] < .15 ? Math.min(picked[1], .08) : p.saturation;
      const bg = `hsl(${picked[0].toFixed(1)} ${(sat * 100).toFixed(1)}% ${(p.lightness * 100).toFixed(1)}%)`;
      const ink = `hsl(${picked[0].toFixed(1)} ${(sat * 100).toFixed(1)}% ${inkLightness(picked[0], sat, p.lightness)}%)`;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      s.moves = s.moves.filter(move => audioTime - move.start < move.duration);
      const audible = S.playing && f.energy > .045;
      const hit = f[p.drv] || 0, onset = hit > .48 && s.prevHit <= .48;
      const beatOnset = f.beat > .45 && s.prevBeat <= .45;
      const textHit = Math.max(f.beat || 0, (f.kick || 0) * .96, (f.snare || 0) * .82, (f.mid || 0) * .42), textOnset = textHit > .42 && (s.prevTextHit || 0) <= .42;
      const beatSeconds = 60 / (f.bpm || 120);
      if (s.nextResolveAt === null) s.nextResolveAt = audioTime + beatSeconds * p.resolveEvery * (.75 + Math.random() * .6);
      if (audible && !s.resolving && beatOnset && audioTime >= s.nextResolveAt) {
        const solution = solvePath(s.slots), echo = clamp(beatSeconds * .11, .042, .072);
        const stride = beatSeconds * Math.max(.38, p.pace * .52);
        if (solution.length) {
          s.resolving = true; s.pendingSlides = [];
          s.solveQueue = solution.map((move, index) => ({
            due: audioTime + Math.floor(index / 2) * stride + (index % 2) * echo, ...move
          }));
          const lastDue = s.solveQueue[s.solveQueue.length - 1].due;
          s.resolveSettleAt = lastDue + clamp(beatSeconds * .55, .22, .38);
          s.resolveUntil = s.resolveSettleAt + beatSeconds * p.resolveHold;
        } else {
          s.nextResolveAt = audioTime + beatSeconds * p.resolveEvery * (.75 + Math.random() * .6);
        }
      }
      if (s.resolving && !s.solveQueue.length && audioTime >= s.resolveUntil) {
        s.resolving = false; s.lastSwap = -99;
        s.nextResolveAt = audioTime + beatSeconds * p.resolveEvery * (.75 + Math.random() * .6);
      }
      // Quiet/melodic music can follow the analysed beat when no strong drums fire.
      const melodicBeat = beatOnset && f.mid > .04 && audioTime - s.lastSwap >= beatSeconds * .82;
      const cooldown = beatSeconds * Math.max(.38, p.pace * .52);
      const startSlide = (strength, forced = null) => {
        let choice = null;
        for (let attempt = 0; attempt < 18 && !choice; attempt++) {
          const horizontal = forced ? forced.horizontal : Math.random() < .5, length = 3;
          const line = forced ? forced.line : Math.floor(Math.random() * 3), start = 0;
          const segment = Array.from({ length }, (_, j) => horizontal ? line * 3 + start + j : (start + j) * 3 + line);
          const tileAt = Array(9);
          for (let id = 0; id < 9; id++) tileAt[s.slots[id]] = id;
          const ids = segment.map(slot => tileAt[slot]);
          // Intersections may reuse a tile that is already moving. Retargeting it
          // from its current visual position makes consecutive row/column pushes
          // read as one continuous cube-like gesture.
          choice = { horizontal, length, segment, ids };
        }
        if (!choice) return false;
        const { horizontal, length, segment, ids } = choice;
        const direction = forced ? forced.direction : Math.random() < .5 ? -1 : 1, from = s.slots.slice();
        const fromOffsets = s.tileOffsets.map(offset => ({ ...offset }));
        for (let j = 0; j < length; j++) s.slots[ids[j]] = segment[(j + direction + length) % length];
        // The slight misregistration belongs to each physical tile. A slide carries
        // it forward and adds a restrained directional inertia instead of snapping
        // to a pre-offset grid position.
        for (let j = 0; j < length; j++) {
          const id = ids[j], fromSlot = from[id], toSlot = s.slots[id];
          const dx = (toSlot % 3) - (fromSlot % 3), dy = Math.floor(toSlot / 3) - Math.floor(fromSlot / 3);
          const grain = (((id * 17 + s.swaps * 11) % 7) - 3) * .0018;
          s.tileOffsets[id] = {
            x: clamp(fromOffsets[id].x * .68 + dx * .012 + (horizontal ? 0 : grain), -.052, .052),
            y: clamp(fromOffsets[id].y * .68 + dy * .012 + (horizontal ? grain : 0), -.052, .052)
          };
        }
        const speed = .27 - p.travel * .09;
        s.moves.push({ ids, segment, direction, horizontal, from, fromOffsets, start: audioTime,
          duration: clamp(speed + beatSeconds * .055, .11, .24), strength: clamp(strength, 0, 1) });
        s.swaps++;
        return true;
      };
      if (audible && !s.resolving && (onset || melodicBeat) && audioTime - s.lastSwap >= cooldown) {
        if (startSlide(Math.max(hit, f.energy))) {
          // A second group enters before the first one settles, as in the reference.
          s.pendingSlides.push({ due: audioTime + clamp(beatSeconds * .11, .042, .072), strength: Math.max(hit, f.energy) * .88 });
          s.lastSwap = audioTime;
        }
      }
      if (audible && !s.resolving && s.pendingSlides.length && audioTime >= s.pendingSlides[0].due) {
        const pending = s.pendingSlides.shift(); startSlide(pending.strength);
      }
      while (audible && s.resolving && s.solveQueue.length && audioTime >= s.solveQueue[0].due) {
        const solutionMove = s.solveQueue.shift(); startSlide(Math.max(.55, f.energy), solutionMove);
        if (!s.solveQueue.length) s.tileOffsets = s.tileOffsets.map(() => ({ x: 0, y: 0 }));
      }
      if (audible && beatOnset) s.beatCount++;
      if (audible && textOnset) { s.textPulse = Math.max(s.textPulse || 0, .94 + textHit * .34); s.textFocusSeed = Math.floor(Math.random() * 997); }
      if (S.playing) s.textPulse = (s.textPulse || 0) * Math.exp(-dt * 6.1);
      s.prevHit = hit; s.prevBeat = f.beat; s.prevTextHit = textHit;
      const size = W * p.scale, tile = size / 3, left = (W - size) / 2, top = H * .465 - size / 2;
      const side = Math.min(iw, ih), sx = (iw - side) / 2, sy = (ih - side) / 2;
      // A shared, critically damped position field couples every gesture. New
      // row/column commands can redirect tiles already in flight without a cut.
      const follow = S.playing ? 1 - Math.exp(-dt * (27 + p.travel * 24)) : 0;
      const offsetFollow = S.playing ? 1 - Math.exp(-dt * 22) : 0;
      const movingIds = new Set();
      for (let id = 0; id < 9; id++) {
        const target = s.slots[id], tx = target % 3, ty = Math.floor(target / 3), pos = s.positions[id];
        pos.x = lerp(pos.x, tx, follow); pos.y = lerp(pos.y, ty, follow);
        s.visualOffsets[id].x = lerp(s.visualOffsets[id].x, s.tileOffsets[id].x, offsetFollow);
        s.visualOffsets[id].y = lerp(s.visualOffsets[id].y, s.tileOffsets[id].y, offsetFollow);
        if (s.resolving && audioTime >= s.resolveSettleAt) {
          pos.x = tx; pos.y = ty; s.visualOffsets[id].x = 0; s.visualOffsets[id].y = 0;
        }
        if (Math.abs(pos.x - tx) + Math.abs(pos.y - ty) > .008) movingIds.add(id);
      }
      const order = Array.from({ length: 9 }, (_, i) => i).sort((a, b) => Number(movingIds.has(a)) - Number(movingIds.has(b)));
      for (const id of order) {
        const pos = s.positions[id], offset = s.visualOffsets[id];
        const x = left + (pos.x + offset.x) * tile;
        const y = top + (pos.y + offset.y) * tile;
        ctx.drawImage(media, sx + (id % 3) * side / 3, sy + Math.floor(id / 3) * side / 3, side / 3, side / 3, x, y, tile, tile);
        ctx.strokeStyle = bg; ctx.lineWidth = p.outline; ctx.strokeRect(x + p.outline / 2, y + p.outline / 2, tile - p.outline, tile - p.outline);
      }
      // The sign changes on musical beats; mid-band energy supplies the melody
      // envelope. No idle sine wave, and paused audio time freezes the animation.
      const target = audible ? (s.beatCount % 2 ? 1 : -1) * clamp(f.mid * .7 + f.beat * .3, 0, 1) : 0;
      if (S.playing) s.sway = lerp(s.sway, target, 1 - Math.exp(-dt * 9));
      const rawCopy = p.copy === '自动歌词' ? (lyricAt(audioTime) || (S.lyrics.length ? '…' : '暂无歌词')) : p.text;
      const parts = String(rawCopy || '').slice(0, 600).split(/\s*\/\s*|\n/).filter(Boolean);
      const topCopy = parts[0] || '', bottomCopy = parts.slice(1).join(' · ');
      const shift = s.sway * p.textMotion * .52;
      const allChars = Math.max(1, Array.from(topCopy + bottomCopy).length), textFocus = (s.textFocusSeed || 0) % allChars, textMotion = { pulse: s.textPulse || 0, focus: textFocus, strength: p.textMotion, base: 0 };
      ctx.save(); ctx.translate(W / 2 + shift * 5, H * .465); ctx.rotate(shift * .016); ctx.translate(-W / 2, -H * .465);
      ctx.fillStyle = ink;
      copyBlock(topCopy, left + 4, top - 18, size - 8, 19 * p.textSize, false, textMotion);
      copyBlock(bottomCopy, left + 4, top + size + 18, size - 8, 19 * p.textSize, true, { ...textMotion, base: Array.from(topCopy).length });
      ctx.restore();
    }
  };
}
