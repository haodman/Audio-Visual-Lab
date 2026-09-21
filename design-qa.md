# Design QA · Text wrap effect

## 2026-09-21 · Signal poster single-image prototype

- Added 失真海报 after 图形镂空; existing renderers unchanged. White-space poster, monochrome photo card, editable headline, accent color, scanlines and brief horizontal tears. Three layouts switch after 4/8 detected beats; fixed option available. Kick/snare/drop edges trigger tears and playback-gated clock controls recovery.
- Browser tab 12 at 774×803: green-coat portrait and 多人20 landscape, real Dehors playback, SIGNAL 01/02 layouts, Chinese/English copy, 34-cue lyrics, pace control and drawer close verified. No captured Effect render failed logs. Corrected initial title obstruction, idle transition smear and Latin word splitting. Final build reloaded with readable default headline.
- Initial single-photo adaptation of user video, not full multi-image replication. Layout 03, extreme parameters, pause screenshot comparison and export remain unverified. Syntax/build/diff checks passed. Local only.

## 2026-09-21 · Random accent enlargement

- Defaults now size 25 / rhythm amplitude 1. Added 重音放大 (0–2, default 1); setting it to zero disables the extra accent scale. Kick/snare/drop rising edges select 2–4 unique random indices, with a 220ms retrigger guard and exponential recovery. Upper/lower masks share size/coordinates. Enlarged offscreen mask to avoid large-setting glyph clipping.
- Browser tab 12: verified displayed defaults and control, real unhappy playback, two rendered frames and no Effect render failed logs. Node mock-canvas execution of the actual renderer passed unique subset count, sustained-signal debounce, pause-clock freeze and subsequent snare trigger assertions. Syntax/build/diff checks pass. Local only; no export retest.

## 2026-09-21 · Photo-family textile punch revision

- Supersedes the rejected complementary-ground revision below. Hue-family histogram with saturation and center weighting selects the source photo's representative color, with deep/light controls. Default five-point star at 46px replaces the small 30px four-point star.
- Source: `/var/folders/51/xmd_3xcd60xgcl3l5mbx33rr0000gn/T/codex-clipboard-f7f09d34-7c88-4abd-be28-ee3098c0405b.png` (1440×1920). Textile source: `src/textures/punch-weave-reference.png`, copied from the supplied butterfly reference; runtime samples only its empty top-left textile region. Keep this asset with the app for future deployment.
- Implementation evidence: in-app browser tab 12 screenshots in this task, local music-fx-lab.html; viewport 774×803, preview 288×512 CSS / 540×960 backing. Reference and implementation emitted together in the comparison call. This is an adaptation to existing 9:16 output and selected user photos, not a pixel-identical 3:4 cloud collage.
- Comparison history: first photo-family implementation selected yellow/brown from the pink photo; added neighboring hue aggregation and center weighting. Recapture shows dark pink-purple textile with matching lower holes. Green portrait uses olive; landscape 多人20 uses warm brown.
- Fidelity surfaces: existing UI typography/copy untouched; larger single-grapheme masks remain editable per explicit user request. Equal halves, same local coordinates and photo sampling preserved. Texture is a real reference sample, shared by upper background/lower holes. Source photo stays unfiltered and sharp; reference caption intentionally not copied. Full-view comparison sufficient for composition; drawer screenshots separately verify text and controls. No remaining P0/P1/P2 in this scoped revision; aesthetic preference remains for user review.
- Tested real Die With A Smile and Be By You playback, portrait and landscape selection, deep/light and woven/solid switches, custom `爱★` rendering only 爱, reset and close. No captured Effect render failed logs. Syntax/build/diff checks pass. Video/export and extreme glyph coverage not retested. Not deployed.
- final result: passed

## 2026-09-21 · Punch ground contrast

- Automatic ground now derives a muted complementary hue from the split photo, with a light/dark choice based on photo luminance. Cached per source; manual color and paired coordinates untouched.
- Local browser screenshot verified pink-coffee photo against a pale blue ground, visibly separated from the previous gray-pink ground. Lower holes share this new ground color. Syntax/build/whitespace checks passed; not deployed.

## 2026-09-21 · Paired random punch positions

- Removed upper-half centering/scaling. Both 540×480 halves now use identical local positions, angles, sizes and beat displacement; their only global offset is 480 pixels vertically.
- Photo sampling uses the current displaced hole coordinate, so each upper piece contains exactly the corresponding lower photo region.
- Random best-candidate placement generates once per source/count change; positions and variation are retained between frames. Bounded generation always produces the requested number, without a rejection-loop shortfall.
- Local browser checked green-coat and pink-coffee photos at 774×803 during real-song playback. Both screenshots show paired coordinates and sampled photo colors; switching photo generates a new arrangement. No effect render errors captured. Syntax/build/whitespace checks passed. Not deployed.

## 2026-09-21 · Reference-led single-character punch

- Reference: user-supplied Eagle MUA49J300GXOT.info/1040g2sg32533706s367g5o1rjdogbr8uu682a28 2.png (1200×1600) and accompanying variants. Implementation: local music-fx-lab.html, in-app browser screenshots in this task at 774×803; preview 288×512 CSS, 540×960 backing canvas.
- Intentional adaptation: preserve the existing 9:16 output rather than the reference's 3:4; use the user's selected photo instead of the reference cloud photo. User explicitly requested editable glyphs, so these are live text masks, not flattened raster illustrations. No reference caption was copied.
- Layout: equal halves, sparse photo-filled pieces above, matching ground-colored holes below. First screenshot found a too-regular grid; replaced it with deterministic spaced scatter and recaptured portrait and landscape states.
- Typography/content: a single grapheme per composition; tested custom `爱★` and observed only 爱, then ★ preset and reset to ✦. Caption omitted for clean default. Shared drawer controls retained.
- Palette/masking: photo-derived soft ground; each upper piece samples the exact photo location of its lower hole. No source-image distortion; splitFrame handles crop. Restrained shadow, no flashing overlay.
- Interaction: real Loser playback with beat-driven pulse; count 24, preset selection, custom input, reset, portrait/landscape material switch and drawer close verified. Pause screenshot shows stopped analysis and retained composition. No captured Effect render failed errors.
- Residual gaps: video and export not retested; supplied bird silhouette is not a preset. Extreme glyph font coverage remains platform-dependent.
- final result: passed

## 2026-09-21 · Editorial effect rework, local review version

- Preserved the renderers for 文字随风、上下分屏、轮廓波纹、文字环绕.
- Replaced the other eleven renderers: large photo windows; torn-photo strips; stepped scan/stretch; sampled light beads; geometric photo mosaic; four beat-counted storyboard layouts; lyric typography portrait; falling text reconstruction; FFT/cutout poster; fine photo-grain displacement; layered sampled ribbons.
- Replaced the rejected four-panel and cutout-edge particle prototypes. Stable internal IDs and selected ordering remain.
- New effects use a playback-gated clock and real transient drivers; no random idle timer or full-screen white flash. Sample grids are cached per source/pitch and throttled for video.
- Browser: all eleven viewed on the green-coat portrait and landscape 多人20 during real-song playback (Dehors/unhappy); MODNet completed. Observed changing storyboard layouts and grain displacement. Increased initially dim dot/text rendering and extended ribbons after screenshot review.
- Tested storyboard gap at 10 and 24, drawer open/close, material filtering/selection. Added custom/lyric inputs to character portrait and character rain. Render failures now log once instead of silently falling back.
- Final build: Chinese custom text and the current song's 22-cue lyric mode both rendered in 字符画. Paused storyboard remained visually fixed across screenshots, then resumed playback. No "Effect render failed" entries were captured; ONNX emitted provider-placement performance warnings, while matting completed. Syntax/build/whitespace checks passed.
- This is an initial aesthetic review version, not a final-quality claim. Extreme settings, video performance and export remain unverified. No deployment.

## 2026-09-21 · Four-panel relay and particle return prototype

- Reworked 波普四格 into original photo, photo-picked two-tone silhouette, tighter crop and monochrome print-dot treatments. Rising musical pulses advance the active cell; drop energy drives all four.
- Reworked 粒子显影 into cached cutout-edge samples with outward displacement and return to source coordinates. Default beat driver; distance, edge depth, particle size and duration controls. No idle auto-trigger.
- Browser verified four distinct panels with Alive and visible outward photo-colored particles with Die With A Smile on the default green-coat portrait; shared MODNet completed. Build/syntax/whitespace checks passed.
- First local creative prototype only. Landscape/group, extreme parameter and video regression checks remain; not deployed.

## 2026-09-21 · Friendly effect names and priority

- Renamed effect display labels with stable internal IDs. Prioritized 文字随风、上下分屏、轮廓波纹、文字环绕、图形镂空, then 碎片错位 and the remaining effects.
- Moved 原图 to a separate comparison control beside the diagnostic toggles; selection state updates across both locations.
- Browser verified new labels, ordering, and original-image rendering. Syntax/build/whitespace checks passed. Creative redesign directions are proposals only; rendering algorithms remain unchanged. Not deployed.

## 2026-09-21 · Gallery priority and compact copy row

- New Eagle pack precedes legacy presets; 粉衣咖啡正坐 is the first preset and initial preview.
- Source chips and single-line text input share one 30px row instead of a heading plus multiline editor. At the verified 774×803 viewport the material grid shows a full row plus part of the next, instead of a clipped first row.
- Browser reload confirms the default image and new-pack ordering. Syntax, build and whitespace checks passed. Local only.

## 2026-09-21 · Inline text source controls (local only)

- Moved custom copy and timed-lyric selection into the effect card for all four copy-capable effects; style controls remain in the shared drawer. Symbol presets remain unchanged.
- Browser tested live custom input (`HELLO / 好心情`) in Wind Trace: canvas immediately reflects English and Chinese text. Lyrics mode shows the current song and 45 loaded cues, and hides the input.
- Original effect hides this section; returning to Wind Trace preserves source and custom text. Parameter drawer contains style controls without duplicate copy inputs.
- Verified the compact layout visually with phone preview and materials still visible. Build, syntax and whitespace checks passed; not deployed.

## 2026-09-21 · Model material pack (local only)

- Added 34 user-supplied Eagle images, preserving the existing 24 presets (58 total).
- Applied existing orientation, selfie, framing, people-count, indoor/outdoor and night tags where appropriate; original Eagle files are unchanged.
- Added 1400px JPEG assets and 280px thumbnails under `src/models/eagle-pack/`, with a rebuildable manifest and importer. Images remain lazy-loaded, not embedded in the HTML.
- Browser verification: 58/58 total; landscape filter returns 6/58; new 白帽横版自拍 renders correctly with the active effect and shared MODNet completes successfully (0.2s).
- Build, JavaScript syntax and whitespace checks passed. No deployment performed.
- Future publishing must copy `src/models/eagle-pack/` alongside the generated HTML; the HTML references these assets using relative URLs.

## 2026-09-21 · Local-only outward emphasis correction

- Removed viewport-safe horizontal displacement of focus words, which pushed edge-adjacent text onto the subject.
- Enlarged glyphs now move along the contour's outward normal; canvas boundaries clip overflow naturally.
- Verified the rebuilt local page on the close-up car selfie with MODNet completed and active playback: enlarged left-edge letters extend offscreen instead of shifting onto the shoulder.
- JavaScript syntax, generated build, and diff whitespace checks passed. No deployment performed for this change.
- This is a targeted emphasis-position fix; exhaustive contour clearance across all images and extreme parameter values has not been verified.

- PASS: `🪐 文字环绕` appears after `🌀 轮廓声场` and before `🔘 单图打孔`, without removing or reordering the preceding effects.
- PASS: The path is regenerated from the shared MODNet subject alpha and follows the outer silhouette rather than a fixed circular overlay.
- PASS: Individual glyphs rotate to the local path tangent; measured glyph and word advances reserve arc length before drawing, preventing adjacent copy from overlapping.
- PASS: Playback verification shows continuous contour scrolling plus clearly enlarged focus words on beat/transient events; high-frequency content adds restrained breathing rather than unrelated timer motion.
- PASS: The enlarged lyric playhead advances forward from the lower-left silhouette, over the head, and down the right side as successive words are sung; custom text advances by beat events instead of remaining in a fixed slot.
- PASS: Custom TikTok-style copy is the default. Switching to automatic lyrics immediately replaces it with the current timed lyric line; empty LRC cues are ignored, word emphasis uses length-weighted timing with held-note tail room, and a per-song timing offset is adjustable.
- PASS: Reference pink, image sampling, contrast sampling, and manual color are available. Reference monochrome and original-color background modes are available.
- PASS: Base size, focus enlargement, path offset, word spacing, speed, pulse, and driver controls respond visibly in the shared right-side drawer while the preview remains unobscured.
- PASS: Visual checks completed with a close portrait, full-body portrait, and multi-person landscape source. Multi-person images correctly use the group silhouette as one subject outline.
- PASS: Latest source build passes JavaScript syntax validation and the local page renders the completed interaction.

final result: passed

## 2026-09-21 — NetEase local music import

- Added 11 MP3 tracks with embedded cover extraction and matching timed LRC files; retained all 14 existing library entries (25 total). Original source files unchanged.
- All 11 imported audio files fully decoded with ffmpeg; each cover exists and each LRC contains 30–74 timed cues.
- Local browser music drawer lists 25 tracks. Babydoll reached active playback with analyzed waveform/BPM; its cover rendered and the lyrics mode reported 30 cues with lyrics visible in the split effect.
- JavaScript syntax, HTML build, and git whitespace checks passed. Local update only; not deployed.
# 2026-09-21 — Contour accent-wave local iteration

- Preserved MODNet distance-field contours, subject foreground and yellow ink default.
- Added bounded transient waves (four maximum), outward travel / taper / fade, alternating thin/thick resting contours and restrained blue overprint. CPU fallback shares event/radius model and selected ink.
- Verified: syntax, build, diff whitespace; isolated actual helper assertions for launch, travel, held-hit debounce, pause clock and quiet decay. Local browser Earrings playback renders contours with visible varying widths; pause control works; no Contour warnings/errors captured.
- Not verified: forced WebGL failure, all parameter extremes, export and public deployment. This iteration is local only.
# Contour overlap correction — supersedes accent-wave iteration below

- User rejected accumulated outlines. Removed extra wave geometry and disabled overprint. A single 0.75-second emphasis now travels through existing rings; width capped to 38% of local spacing.
- Checked repeated accents with 8 rings, max width/pulse and gaps 14/35/52: ring count constant, one event maximum, ring widths separated. Syntax/build/diff checks pass. Local Babydoll playback visually shows four distinct contours; no deployment.
# Contour rollback

- At user request, reverted both recent contour experiments to the original contour renderer, shader, animation and parameters. Kept the current display name 轮廓波纹 and all unrelated effects unchanged. Earlier experimental QA entries below are historical, no longer current.
# Contour timing refinement

- Kept the restored contour shader, spacing, colors and ring geometry unchanged.
- Each BPM-grid beat is now refined to the strongest real onset within ±120 ms during offline analysis. Contour motion listens to this calibrated accent impulse instead of live kick/snare threshold crossings.
- Motion still advances one existing ring per event; attack stiffness/velocity increased and damping shortened for faster arrival and cleaner rest before the next point.
- Verified syntax/build/diff checks and local playback with `Been By Now` (116 BPM); analysis completed, audio meters were active, contour rendered, and no effect/render errors appeared. Existing ONNX execution-provider notices are unchanged. Local only; export/public deployment not tested.
# Contour continuity correction

- Removed the spring jump that could visually skip a ring. The calibrated onset interval now drives a continuous one-ring-per-beat phase; motion is slightly faster after the accent and slower near the next beat without stopping.
- Added a 0.55-gap inner offset so the innermost ring remains visible at phase wrap and total visible contour count stays stable. WebGL and CPU fallback use the same phase curve.
- Local `The Fate of Ophelia` playback at 124 BPM: two sampled frames retained the same contour count, audio analysis/meters active, no effect render errors. Local only.
# Contour groove tightening

- Replaced the full-beat eased glide with a linear, compact motion window: each calibrated onset starts immediately, completes its ring travel in 52% of the beat interval, then holds cleanly until the next onset.
- Retained the stable inner offset and original visual styling. Syntax/build/diff checks pass; local `Loser` playback analyzed at 83 BPM and rendered without failure. Local only.

# 2026-09-21 — Horizontal scan and contour deformation

- Reworked `像素扫描` from square mosaic blocks into narrow horizontal image slices. The unswept area is progressively rebuilt from top to bottom, while adjacent slices offset left/right in alternating rhythm groups; the scan edge uses short stretched color strips for a refreshed-screen feel.
- The lateral displacement responds to the selected audio driver, with separate Kick/Snare contribution and bounded travel so the subject remains readable after the scan passes.
- Kept the existing subject distance-field contour system, adding low-amplitude local swelling/turbulence and slight per-ring spacing irregularity. Ring thickness and displacement are capped against local spacing to preserve visible clearance and avoid contact/overlap.
- Local browser verification used `Babydoll` at analyzed 168 BPM: segmented scan displacement was visible during playback; high-energy contour deformation remained separated with no retained trails. No effect-render errors were captured.
- JavaScript syntax, generated build, and diff whitespace checks passed. Forced CPU fallback, export, parameter extremes, and public deployment were not tested; this change is local only.

# 2026-09-21 — Variable-pressure contour and true horizontal smear

- Updated contour width from one value per ring to a continuous spatial pressure field. Each individual outline now contains broad thin/thick passages; accents temporarily strengthen only local lobes instead of inflating the entire ring.
- Width remains capped at 68% of the local ring gap, retaining clearance even at the thickest passages. The CPU fallback mirrors the WebGL pressure field.
- Replaced fragmented scan slices with dense continuous scanlines driven by a low-frequency vertical flow field. Each line blends stretched full-row samples with two locally sampled color threads, creating long horizontal image smears that join into a few broad moving bands.
- Scan position now advances continuously from top to bottom rather than waiting for a detected beat; music controls the lateral flow and smear reach.
- Browser-verified the variable-pressure outlines against the supplied reference direction and checked the stronger smear during playback on the current portrait. JavaScript syntax, build, and whitespace checks passed. Local only; export and forced CPU fallback remain untested.

# 2026-09-21 — Accent-selected contour swelling and directional blur

- Each detected Kick/beat transient now selects a random contour ring and a localized segment. That segment gains a short 420ms pressure swell plus a small outward deformation, then snaps back; non-selected rings do not inflate together.
- Increased the local width cap to 78% of ring spacing so the accent is clearly visible while retaining separation. WebGL and CPU fallback use the same selected-ring/local-patch model.
- Updated contour defaults to width 16, rings 6, pulse 2, release speed 2.5, and gap 25. Browser parameter drawer confirmed all five values after reload.
- Added directional blur and repeated X-axis color sampling to the scan's unswept region. Browser playback shows the lower image dissolving into continuous horizontal soft streaks beneath a clean scan boundary instead of discrete displaced slices.
- JavaScript syntax, build, and whitespace checks passed. Local only; export and public deployment were not tested.

# 2026-09-21 — Contour reference defaults

- Updated the contour defaults to match the supplied parameter screenshot: narrow poster font, soft outline, ultra quality, manual `#E7E192`, text size 1, 6 rings, gap 35, width 20, feather 0, release speed 2.5, pulse 2, and background dim 0.26.
- This supersedes the immediately preceding gap 25 / width 16 defaults. Rendering behavior is unchanged. Local only.

# 2026-09-21 — Rhythm Puzzle merge and scan performance rollback

- Imported the complete `createRhythmPuzzleEffect()` implementation from the supplied `Audio-Visual-Lab-线上最新合并版.zip` as `src/rhythm-puzzle.js`; added it to both the local source page and single-file build pipeline.
- Registered `节奏拼图` immediately after `图形镂空`. Browser verification confirms the requested order and a working 3×3 image puzzle with row/column slide states, image-derived background/copy color, custom copy, rhythm triggering, and automatic resolve logic.
- Replaced the scan's per-line filtered drawing loop with six configurable broad exposure bands. Each band uses nine lightweight X-offset samples plus one stretched sample; there is no per-pixel pass, per-scanline loop, or Canvas blur filter.
- Ran the new scan continuously for five seconds during active playback, then switched back to Rhythm Puzzle in 278ms; the page remained responsive. This is a local interaction check, not a full profiler trace.
- Both JavaScript sources pass syntax checks; the single-file build and diff whitespace checks pass. Local only; export and public deployment were not tested.

# 2026-09-21 — Softer contour accents and per-character puzzle type

- Replaced the contour accent's instant linear decay with a 75ms smooth attack followed by an exponential elastic release. Reduced local offset, width gain, base turbulence, and width cap; widened the selected patch slightly so it reads as a soft push rather than a rigid block.
- Rhythm Puzzle retains a restrained whole-copy sway, but every analysed beat now selects one character and briefly lifts, scales, and tilts it with light influence on its nearest neighbour. The character pulse decays independently from the tile motion.
- Raised the Rhythm Puzzle `文字律动` range from 0–1 to 0–2 and its default from 0.35 to 1.15. Browser parameter drawer confirmed 1.15 after reload.
- Browser playback verified both effects still render and remain interactive. JavaScript syntax, single-file build, and whitespace checks pass. Local only; frame-by-frame export comparison was not tested.

# 2026-09-21 — Contour neighbour coupling and stronger puzzle rhythm

- Replaced the isolated selected-ring bulge with a distance-decayed coupling field. The chosen contour receives the main pressure, while neighbouring rings inherit progressively weaker deformation and a small phase offset; the spatial patch is broader and smoother, with lower peak width/offset.
- Rhythm Puzzle text accents now listen to the strongest of beat, kick, snare, and mid-band onset. A selected character lifts/scales strongly and carries a softer two-character neighbourhood; the pulse lasts longer while the whole copy sway remains secondary.
- Increased `文字律动` to range 0–2.5 with default 1.55. Browser parameter drawer confirmed the new default.
- Increased melodic fallback frequency and slide duration so row/column movement remains readable on tracks with weak drums. Browser playback confirmed both effects render and controls remain responsive.
- JavaScript syntax, single-file build, and whitespace checks pass. Local only; exported frame comparison and public deployment were not tested.

# 2026-09-21 — Effect reorder and image-derived spectrum ribbon

- Reordered the effect list so `音乐频谱`, `马赛克`, and `字符雨` appear immediately after `节奏拼图`, followed by the remaining effects. Browser snapshot confirmed the exact sequence.
- Replaced the old dark vertical bar spectrum, yellow editorial ground, and bottom `SOUND / BPM` panel with a continuous mirrored FFT ribbon behind the segmented subject.
- The background now preserves the source image with restrained saturation/brightness treatment. Ribbon fill uses the same representative image accent family as the cutout workflow, plus automatically derived deep and light contrast outlines.
- Added a visible minimum amplitude and stronger outer/inner strokes so the ribbon remains legible beside large foreground subjects during quiet passages without covering the face.
- Browser playback verified the new ordering, clean background, absent metadata label, source-derived color, and foreground subject layering. Syntax, build, and whitespace checks pass. Local only.
# 2026-09-21 · 频谱 / 马赛克 / 字符雨可读性收敛

- 音乐频谱：新增「频谱可见度」，默认 `1.55`；改为三层细线声浪，将线宽收窄至 `1.45 / 1 / 0.72`，使用照片取色和 screen 混合保持可见。
- 马赛克：改为原图打底，默认只覆盖 `17%` 局部色块；色块随 beat / kick / snare 翻动回落，不再全屏遮挡人像。
- 字符雨：改为原图打底，默认字符覆盖 `26%`；每个鼓点仅切换局部字列，使用快攻击落位，并增加微弱描边保证在明暗照片上都可读。
- 实际页面 QA：通过 `clarity3` 构建在绿衣街边咖啡素材上分别检查三个效果；原图主体始终可识别，频谱轮廓可见，马赛克和字符不再吞掉画面。

## 2026-09-21 · 曲线频谱 / 单色字雨 / 大块拼贴

- 音乐频谱：从折线改为二次曲线连续插值；声浪高度默认 `0.15`，可见度默认 `2.8`、上限 `5.0`。
- 字符雨：改为照片自适应单色；明图使用深色 multiply，暗图使用浅色 screen，并叠加反差描边。
- 马赛克：废弃网格方块，改为 3–10 个杂志宽幅取景切片；默认由 beat 驱动横向错位和快速回弹，静止时保留轻微切片缝隙。
- 顺序：马赛克已移到「失真海报」之后。
- 页面 QA：在 `curve-rain-mosaic1` 构建中检查绿衣街边咖啡素材；曲线高度已收敛，单色字列在树叶、衣物和白裤上均可辨识。

## 2026-09-21 · 回归线上碎块 / 闭合频谱 / 扁平字色

- 马赛克实验入口从效果列表移除，改为直接使用线上版「碎块位移」，位于「失真海报」之后。
- 音乐频谱修正曲线子路径未连接的问题，上下声浪现在组成真正闭合区域；中心颜色填充恢复并加强。
- 字符雨取消 screen / multiply 混合，改为基于照片取色的深、中、浅三阶扁平色板，同一字列使用稳定纯色。

## 2026-09-21 · 频谱不透明度

- 新增「颜色不透明度」参数，范围 `0–1`，默认 `0.88`。
- 频谱填充取消 screen 混合，改为普通 source-over；代表色渐变提高 alpha，避免在明亮或花杂背景上被吞掉。

## 2026-09-21 · 线上碎块复刻与频谱参数收敛

- 「碎块位移」按线上发布实现回归为方块采样错位、RGB 通道分离、半调网点和 Hi-hat 星光，不再使用误解后的撕纸切片方案。
- 音乐频谱默认参数按参考图调整为：频带数量 `51`、声浪高度 `0.09`、频谱可见度 `5.00`、背景清晰度 `0.45`、填充浓度 `0.10`。
- 删除「颜色不透明度」参数；其视觉职责与「频谱可见度」重叠，现在由一个可见度参数统一控制。

## 2026-09-21 · 字符雨扁平化

- 删除字符外描边与混合叠色，每个字只绘制一次不透明纯色填充，避免边缘发糊和多层重影。
- 默认取色改为「自动反差」：根据字符落点处的照片明度，仅在深色与暖白之间切换，优先保证可读性。
- 新增四种字体样式、三种排版颗粒度，以及自动反差、图片深色、图片亮色、图片代表色、经典黑白和手动颜色共七种颜色模式。
- 默认字符间距由 `23` 调整为 `27`、覆盖度由 `0.26` 调整为 `0.18`，减少画面拥挤。
- 发布默认值进一步调整为字符覆盖 `0.10`、颜色模式「图片代表色」。

## 2026-09-21 · 交错色条，本地待审

- 独立分支 `feature/staggered-color-bars`，基于 `f8cc7b9`。用户要求先审本地效果，通过后再同步源码仓库与网站仓库；本次未推送、未部署。
- 从用户 MDP 素材库的 `color-motion-effects` 1.0.0 复用 OKLab 聚类取色、小面积强调色和平台完整伸缩曲线，适配现有 Canvas 渲染循环。新增模块 `src/color-bars.js`；其他效果保持原实现。
- 构图固定 540×960（9:16）；照片数量为 1–3，默认 3 张。照片宽度由旧模板 27% 提高至 58%，可在 44–68% 调整；上下照片紧贴，各自可调整裁切位置。默认采用原始橘子、人像、泳池示例，字体为随包 Silkscreen 400。
- 仅此效果改为自定义文字输入，默认 `GO / WITH / THE / FLOW / STAY / GOLD`；每段最多 6 个字符，长词分段保留，空输入不生成文字。文字先向上跳起再回到原位，边界由字体实际尺寸约束。
- 色条起点直接使用原 `S.analysis.beats` 时间戳；按拍在左右和照片之间轮换，照片取色决定各条颜色；静音片段不触发。原 WebAudio DSP 离线分析和实时特征提取代码逐段对比完全一致，没有引入 Beat This!。
- 参数使用共享右侧抽屉，支持示例、现有素材库和本地上传图片。上传、拖拽的构图最多三张；其他效果和素材库的数量规则不变。
- 此效果通过现有导出按钮输出 15 秒纯画面的 9:16 视频；其他效果沿用手机 UI 导出。Chrome 实测导出 540×960、15 秒、含音轨；本次审片视频另外转为 H.264/AAC 以便本地播放器预览。
- 验证：Chrome 实际播放、参数编辑、1/2/3 图、横图换图、长英文与中文、最大跳高、暂停、拖动时间轴、前后歌曲、效果切换均通过。对 9 种数量/宽度组合采样 8640 帧，13212 个文字位置没有越界；静音测试没有色条/文字触发；四图上传被拒绝。390px 手机视口无水平溢出。无效果异常及本地资源 HTTP 错误。
- 已运行 JavaScript 语法检查、构建及 `git diff --check`。端口 8765 已被另一任务使用，本次独立预览使用 `http://127.0.0.1:8876/music-fx-lab.html?effect=colorBars`。
- 构建器现在同时生成两个根 HTML。注意基础提交的 `index.html` 已经落后于 `music-fx-lab.html`/src，因此 index 的 diff 包含这段既存生成物差异；发布前需结合最新远端检查，避免覆盖其他任务随后合入的变更。

## 2026-09-21 · 交错色条多图选择与同拍群发

- 用户已确认上一版本地效果，随后要求明确颜色规则、增加同拍条数、略加粗色条，并修正素材库只替换第一张的交互。
- 素材区增加「1 张 / 2 张 / 3 张」按钮和编号缩略图；连续选图自动移到下一位置，可显式选择任一位置再替换。参数抽屉每张照片都有独立下拉与单张上传替换。多文件上传整体设置 1–3 图构图。
- 每张照片六个候选平台（左右各三处），每个真实拍点同时触发 1–3 个不同平台；按歌曲拍点 RMS 分位数决定数量，也可固定 1/2/3 条。下一拍换侧，平台保留完整伸缩过程。默认厚度由 7–14px 增至 10–18px，可调倍率。
- 页面参数说明与 README 明确记录：裁切后每张照片独立 OKLab 取色、主色和强调色优先、最多四色、少色复用；背景固定 #EEEDE7 加静态淡纸纹，不随照片/音乐变化。
- 浏览器实测：素材区连续选三图分别写入三处、定点替换第二张不改变第一/三张、单图模式、1/2/3图切换、每拍1/2/3条实际触发、暂停定格、静音不触发、15秒带音轨导出通过。
- 9种数量/宽度组合、最大跳高、长英文与中文共8640帧/40878个文字位置无越界。390px视口无水平溢出，1280×633下素材区单层滚动可选图，未捕获效果错误或本地资源错误。
- 当前 GitHub 连接与本机 Git 凭据均为 Floraxu-1113。源码仓库有写权限；网站仓库 haodman/haodman.com 的 Git dry-run 返回403，不能直接发布。源码按分支/PR提交，网站同步差异准备为本地发布包，待获得该仓库写权限或由维护者应用。
