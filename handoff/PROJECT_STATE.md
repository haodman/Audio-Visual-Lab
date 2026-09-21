# Project state

Last updated: 2026-09-21

## Product purpose

Audio Visual Lab is a browser-based workbench for prototyping image/video effects driven by music. It is designed for fast comparison and iteration, not as a finished consumer editor. The primary acceptance criterion is whether a visual relationship to rhythm, accents, energy, sections, drops, and lyrics is immediately legible.

## Current experience

- Fixed 9:16 phone preview on the left.
- Music player, analysis, effects, and materials on the right.
- Refresh selects a random test song and begins loading/playing it.
- Effects and materials preserve their state while parameters are edited.
- “Parameters” and music selection open the same right-side drawer.
- The drawer does not dim or blur the phone preview and has one internal scroll region.
- The center phone action exports a 15-second video containing the selected media, music, effect, and phone UI.

## Active effect order

Local addition: 失真海报 (`signalPoster`) follows 图形镂空. Single-photo typographic poster, custom/timed copy, three beat-switched layouts, scanlines and transient horizontal tears. No multi-image selection or deployment yet.

Local revision (2026-09-21): 文字随风、上下分屏、轮廓波纹、文字环绕、图形镂空、碎片错位、像素扫描、发光点阵、马赛克、波普四格、字符画、字符雨、音乐频谱、粒子显影、横向拉丝. 原图 is a separate comparison control. The first four renderers are unchanged; the remaining eleven have a new editorial prototype implementation. This revision is not deployed; the list below describes the older published naming.

1. Original
2. Wind Trace
3. Upper/Lower Split
4. Fragment Displacement
5. Contour Sound Field
6. Text Wrap
7. Single-image Punch
8. Pixel Scan
9. LED Matrix
10. Mosaic Pulse
11. Pop-art Grid
12. ASCII
13. Character Rain
14. Spectrum Bars
15. Local Pixel Reveal
16. Local Horizontal Stretch

The Chinese UI labels are the source of truth: `原图`, `风迹`, `上下分屏`, `碎块位移`, `轮廓声场`, `单图打孔`, and the remaining labels in `FX_ORDER`.

## Important effect definitions

### Upper/Lower Split

- Both halves use consistent crop and scale logic to fill a 9:16 composition.
- Upper half: environment plus lyric-filled subject silhouette; lyric objects fall with gravity and collide inside the subject mask.
- Lower half: paper-like sampled background plus the real cutout subject and restrained falling copy.
- Default custom copy is lowercase: `don't you want to / be the one / when you go / nowhere else to go`.
- Custom text is higher priority than lyrics; timed lyrics remain available as a source.

### Contour Sound Field

- Uses the shared subject mask and distance field, not center-scaling copies.
- Every outer contour is derived from equal-distance expansion of the prior contour.
- Inner lines are thinner; outer lines are thicker with increasing spacing and restrained irregularity.
- Beat impulses push contours outward continuously: the inner ring grows into the next ring and a new inner ring appears.
- Motion rests in quiet passages.
- Default manual color: `#E7E192`; center copy defaults to empty; edge feather defaults to `0`.

### Single-image Punch

- Glyph masks punch through the photo to a photo-derived complementary ground.
- Some glyphs reveal offset samples from the same source image; a minority use printed color blocks.
- Includes star, weather, music, flower, geometric, and mixed presets plus custom symbols.
- Beat transients replace a subset of glyphs and cause a brief scale/position response.

### Text Wrap

- Uses the shared MODNet alpha to derive and smooth a closed path around the subject's outer silhouette.
- Lays out each glyph along the local curve tangent using measured arc-length advances, so enlarged focus words push neighboring text instead of overlapping it.
- Default custom copy is TikTok-style everyday English; timed lyrics are available from the same source selector used by the other text effects.
- Reference pink is the default, with image, contrast, and manual color modes. Beat/transient events advance the text and enlarge the active word; high-frequency energy adds restrained breathing.

## Media and text

- Real test songs live under `src/music/` and are referenced by `src/music/library.json`.
- Covers and LRC data are built into the generated page where appropriate; MP3 files are lazy-loaded.
- Text-capable effects should expose custom text and timed lyric sources when meaningful.
- Materials include landscape/portrait tags and multiple-person samples. Do not restore the previously removed bulk QuickCreate library without an explicit request; it caused load and usability problems.

## Matting

- Still images: shared MODNet high-quality path.
- Video preview: MediaPipe real-time segmentation.
- Fallback: heuristic local segmentation, visibly lower quality.
- Matting progress/status appears in the material card.
- `showMask` is the diagnostic view.

## Current deployment

- Source: `https://github.com/haodman/Audio-Visual-Lab`
- Public: `https://haodman.com/audio-visual-lab/`
- Public files currently live in `haodman/haodman.com/audio-visual-lab/` and deploy through Vercel.
- Root `index.html` serves the full app directly to avoid a visible redirect-link flash.
- Deployment is not yet automated between the two repositories.
