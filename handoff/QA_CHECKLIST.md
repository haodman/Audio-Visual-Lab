# QA checklist

## Required for every change

```bash
node --check src/app.js
python3 src/build.py
git diff --check
python3 -m http.server 8765
```

Then test in the browser:

- [ ] Page loads without console-breaking errors.
- [ ] Refresh selects and loads a real test song.
- [ ] Play, pause, previous, next, and timeline seek work.
- [ ] BPM/energy/section/drop UI updates after analysis.
- [ ] The changed effect renders on at least one portrait and one landscape/multi-person asset.
- [ ] Effect parameters visibly change the output.
- [ ] Parameter drawer opens, scrolls once, preserves the preview, and closes via blank area/Close.
- [ ] Custom text and automatic lyrics update text-capable effects when applicable.
- [ ] Matting status reaches a completed or explicit fallback state.
- [ ] Material and song names truncate without breaking neighboring controls.
- [ ] Narrow-window layout does not wrap into an unusable structure.
- [ ] 15-second export starts and produces a playable file when export-related code changes.

## Effect-specific checks

### Upper/Lower Split

- [ ] Both halves cover their masks without gaps or contradictory scale.
- [ ] Upper lyrics fall downward, remain inside the mask, collide, and do not overlap excessively.
- [ ] Lower copy remains sparse and visually controlled.

### Contour Sound Field

- [ ] Contours bind to the actual subject mask.
- [ ] Spacing expands outward; outer lines are thicker.
- [ ] Beat causes continuous outward progression rather than snapping back.
- [ ] Quiet sections rest.

### Single-image Punch

- [ ] Primary glyph masks reveal the complement ground.
- [ ] Offset-image glyphs are visibly sampled from the same image.
- [ ] Presets and custom glyph input both work.
- [ ] Beat replaces only a subset of symbols and produces a brief readable pulse.

## Deployment check

Only after explicit deployment authorization:

- [ ] Source changes are committed and pushed to `haodman/Audio-Visual-Lab`.
- [ ] Built HTML and referenced audio are synchronized to `haodman/haodman.com/audio-visual-lab/`.
- [ ] Vercel deployment completes.
- [ ] `https://haodman.com/audio-visual-lab/` returns the full app directly, without a redirect-link flash.
- [ ] Public audio URLs return HTTP 200 and songs decode in the browser.
- [ ] The newest effect and parameter UI are visible on the public page.
