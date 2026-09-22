# Design QA · Text wrap effect

## 2026-09-22 · 上下分屏节奏回调与歌词默认

- 上下分屏默认改为自动歌词；字体/符号大小 0.5、律动幅度 1.5、掉落速度 0.28、星点数量 0.2，主体律动保持 1。
- 上屏文字首次落入速度和随机旋转进一步降低，避免文字剪影在开场堆叠得过快、过乱。
- 下屏星点的横向抖动、旋转速度、高频拉伸和 Kick 加速均减弱。
- 全局开场随机曲目先过滤有效 LRC，仅从带可解析歌词的歌曲中抽取；没有歌词曲目的本地/在线素材不会进入随机开场池。
- 本地浏览器重载实测：随机开场抽到 Been By Now，界面确认解析 48 条歌词且「歌曲歌词」默认选中；参数抽屉确认 0.5 / 1.5 / 0.28 / 0.2 / 1 五项默认值。开场画面星点显著减少，上屏文字落入更慢，下屏未出现此前的快速旋转抖动。

## 2026-09-22 · 上下分屏频段与鼓点强化

- 默认值更新：律动幅度 2、掉落速度 0.48、星点数量 0.78、主体律动 1。
- 新增低/中/高频和节拍的独立瞬态包络：低频推动主体缩放抬升，中频带来主体拉伸与文字扰动，高频控制星点拉伸、旋转和闪烁，节拍提供清晰位移冲击。
- 星点单次生成量、并发上限、尺寸和生命周期均提升；分屏线随中高频改变粗细、亮度和取色。
- 本地浏览器实测：参数抽屉显示四项新默认值；Blue Apple 低能段与 Die With A Smile 高能段均正常渲染。高能段（Energy 0.81）文字剪影幅度、主体尺度和星点密度相较低能段出现明确变化，未观察到画布空白或布局溢出。

## 2026-09-22 · 交错色条多图选择横向压缩

- 将多图控制改为左右单行布局：左侧选择图片张数，右侧选择图片顺序，下方筛选和素材库保持常驻。
- 顺序槽位只保留序号与缩略图，当前槽位使用绿色高亮；完整素材名通过悬停提示提供。
- 点击下方素材后不再自动跳到下一槽位，保留当前槽位以便连续切换素材对比效果。
- 本地浏览器实测：三图模式在单行内完整显示，素材标签与首行图库同时可见；选择顺序 2 后点击「粉衣咖啡正坐」，仅第二段预览更新，顺序 2 保持绿色激活，图库角标同步显示 2。

## 2026-09-22 · 熟人素材隔离

- 新增「熟人」图库标签，收录 34 张指定模特原图。
- 熟人素材在「全部」及其他公开分类中均不渲染，只有点击「熟人」后才显示和可选。
- 熟人原图使用相对资源路径按需加载，避免默认首屏下载约 35MB 私有素材。
- 数量统计按当前素材域计算：「全部」不把熟人素材计入总数，「熟人」显示独立数量。
- 本地浏览器实测：默认「全部」仍为 58/58 且无熟人卡片；点击「熟人」显示 34/34，加载更多后 01–34 全部可见；选择「熟人 01」后真实预览和抠像状态均成功更新。

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

## 2026-09-22 · 主体闪拍实时通用分割

- 将原来的低分辨率色块连通区估算升级为 SlimSAM 通用物体分割：对当前上传图片建立一次图像 embedding，通过 4×5 自动提示点获取多个物体蒙版，再用 IoU 去重并缓存最多 10 个选区。
- 模型只在首次进入「主体闪拍」时按需下载；更换强度、颜色、节奏驱动或主体数量都不会重复运行分割。更换图片只重算当前图，不预处理素材库。
- 取消了每次换图都无条件启动 MODNet 的逻辑；现在只有依赖人物蒙版的当前效果才按需运行。
- 闪烁默认强度提高到 `1.25`，使用更快的攻击、更强的局部曝光，并新增默认 `0.18` 的背景压暗，让当前选区在花杂背景上也能明显跳出。
- 本地页面实测成功载入模型，绿衣街边咖啡素材识别并去重得到 10 个选区；参数面板默认值和页面交互正常。JavaScript 语法、单文件构建和空白检查通过。本地修改，未发布。

## 2026-09-22 · 主体分割快速预览 / 缓存与文字波峰

- 主体闪拍切图后立即生成轻量快速选区，不再空白等待 SlimSAM；用户在当前图停留 `700ms` 后才启动精细分割，快速连续浏览不会为每张图排队重算。
- 使用图像指纹缓存最近 12 张图的精细蒙版；实测从「绿衣街边咖啡」切到「粉衣咖啡正坐」可立即看到快速选区，再切回第一张直接显示「主体分割缓存 · 10 个选区」，未重算。
- 主体闪拍默认「背景压暗」改为 `0`，「闪烁时长」改为 `0.30`，参数抽屉已验证。
- 文字环绕的单点放大改为 7 字波峰：当前字最大，前后各 3 字以 `1/3/5/7/5/3/1` 的相对权重平滑衰减，同时按字号向轮廓外侧退让，避免放大后压住人物。
- 本地播放已验证文字波峰、切图快速预览和返回缓存。本地修改，未发布。

## 2026-09-22 · 文字环绕放大逻辑回退

- 回退上一轮 7 字 / 7 词渐进放大实验，恢复为本次调整之前的「当前重点词单独放大」实现。
- 主体闪拍的快速预览、按图缓存、背景压暗 `0` 和闪烁时长 `0.30` 保持不变。

## 2026-09-22 · 文字环绕暂停定格与四个 PR 本地合入

- 文字环绕的歌词定位改为歌曲播放时间 `f.t`，不再误用页面运行时间；暂停时 `dt=0`，滚动、重点词推进、脉冲衰减和路径跟随全部定格，恢复播放后继续跟随节奏。
- 本地集成 PR #1 交错色条、PR #2 上下打孔、PR #3 智能动态贴纸、PR #4 单图方块打孔；保留当前分支已有的主体闪拍、图库排序和效果参数修改。
- 「上下打孔」替换旧的图形镂空实现；智能动态贴纸保留自动匹配的旋转阳光与文字时钟两个玩法，并使用独立页签避免挤占主效果列表。
- 合并采用功能模块接入，没有修改或关闭远端 PR。JavaScript 语法、所有新增模块语法、单文件构建及空白检查通过；浏览器已确认四个新入口和智能贴纸页签可访问。

## 2026-09-22 · 效果列表精简与打孔方案并存

- 恢复原有「图形镂空」完整实现；同事的 PR 方案改为独立「上下打孔」，紧随其后，不再覆盖原效果。
- 从可见入口移除「粒子显影、横向拉丝、字符雨、波普四格、发光点阵、像素扫描」；底层实现暂时保留，便于之后需要时恢复。
- 浏览器刷新确认：图形镂空与上下打孔同时存在，六个指定效果不再出现在效果面板。语法、构建与空白检查通过。

## 2026-09-22 · 移除智能动态贴纸框架

- 移除同事 PR 中新增的「视觉效果 / 智能动态贴纸」双页签，恢复原来的单一效果列表。
- 同步移除旋转阳光、文字时钟入口、自动匹配 UI、识别模型启动和额外音频分析；交错色条、上下打孔、单图方块打孔不受影响。
- 浏览器确认页面中已无贴纸页签、时钟与旋转阳光，只保留原图形镂空及三个需要合入的新效果。

## 2026-09-22 · 打孔性能与多频声场

- 上下打孔：取消进入效果时自动执行的整图语义模型推理，改用即时照片色彩 / 构图提示；纹理生成密度约降至原来的 1/3–1/4，播放预览限制为约 30fps，并继续复用同一渲染器与纹理缓存。切换效果不再触发十秒级识别和主线程卡顿。
- 单图方块打孔：新增「律动方式」与「多频律动」。低频控制整体呼吸，中频生成沿画面传播的横向声浪，高频让局部方块短促放大 / 跳闪；中高频与能量波峰也可提前触发下一块和铺满后的重排，不再只有鼓点事件。

## 2026-09-22 方块打孔节奏重构

- 「单图方块打孔」更名为「方块打孔」。
- 移除持续漂移、整体呼吸和横向声浪，构图保持固定，避免画面无意义晃动。
- 低频、中频、高频分别做独立上升沿检测与冷却；命中时仅随机点亮对应分组中的若干方块。
- 动画改为短促的「闪现 — 短停 — 消失」，默认每次 3 块、持续 0.28 秒；支持调节频段、触发灵敏度、闪现数量与闪现时长。
- 保留「看铺满效果」作为静态构图预览，实际播放状态不再按顺序逐块铺满或定时重排。

## 2026-09-22 主体闪拍持久缓存

- 主体精确分割结果由仅存于内存的 `Map` 扩展为 IndexedDB 持久缓存，缓存键包含蒙版版本、图片内容指纹和画布规格。
- 仅保存 96 × 171 的无损二值蒙版，不重复保存用户原图；恢复时从当前原图重新生成 540 × 960 高质量裁切。
- 未见过的新图片仍立即显示快速选区，持久缓存查询与 SlimSAM 精修均在其后异步完成，避免进入效果时空白等待。
- 首次精确识别后刷新页面复测：再次进入主体闪拍，约 1 秒内显示「本地主体缓存 · 10 个选区 ✓」，未重新执行模型推理。
- 精确分割完成后同时写入内存热缓存和 IndexedDB；同一页面切换图片使用热缓存，跨刷新使用持久缓存。

## 2026-09-22 效果顺序与交错色条

- 效果顺序调整为：文字随风、上下分屏、轮廓波纹、文字环绕、音乐频谱、图形镂空、主体闪拍、交错色条、节奏拼图、字符雨滴、失真海报、上下打孔、碎块位移。
- 「字符雨」更名为四字名称「字符雨滴」；「方块打孔」从效果列表移除；交错色条与碎块位移改用 emoji 图标。
- 交错色条取消内置示例图和独立的 1–3 张图片选择链路，始终使用素材区当前选中的用户照片；上传、图库点击和拖放行为与其他效果保持一致。
- 色条从当前照片全幅裁切中提取主色与小面积强调色，并统一向高明度提升；背景由提取到的综合色板混合后进一步提亮，不再使用固定浅暖灰。

## 2026-09-22 发布视频导出与交错色条多图恢复

- 旧导出链路从当前播放位置继续录制，且复用预览中的效果状态；上下分屏的落字、粒子和当前文案序号因此会直接出现在导出首帧。
- 新导出固定从音乐第 0 秒开始，并在录制前重置当前效果的时钟、命中状态、落字、粒子、滑轨和文字序号；上下分屏从文字尚未落下的模板初态开始。
- 旧链路以 30fps 将 540 × 960 内容再次绘制进 780 × 1688 手机 UI 画布，编码码率 6Mbps；额外绘制会与效果渲染和编码争抢主线程。
- 新链路直接录制 540 × 960 的 9:16 内容画布，请求 60fps，视频码率提升到 10Mbps，不再录入手机外壳；完成后恢复用户导出前的播放位置和播放状态。
- 已执行一次完整 15 秒 MP4 导出，页面从「正在导出」正常回到「导出完成」，无运行时错误。
- 交错色条恢复 1–3 图模板：默认三个槽位均复用当前照片，不再出现内置陌生示例；用户点击槽位后可从图库依次替换，综合色背景由全部已选照片共同生成。
- 交错色条的「歌曲歌词 / 自定义文字」与输入框迁移到效果面板公共文字区，和文字随风、上下分屏、文字环绕等效果遵循同一信息架构；参数抽屉不再重复展示文字来源和文本输入。
- 交错色条：保留 PR 原有的 1–3 张多图选择、独立裁切与照片取色逻辑；照片列改为硬直角。新增低频推进、中频横移、高频跳闪和多频接力四种方式，鼓点保留为结构事件，多频声场作为连续运动层。
- 本地 `multiband1` 页面实测：三个效果均可切换与播放；单图打孔参数抽屉显示新多频控制；交错色条三张图保持上下拼接且无圆角。JavaScript 语法、单文件构建与空白检查通过。本地修改，未发布。

## 2026-09-22 · 字符效果入口更正

- 按最新反馈恢复「字符雨」可见入口，移除「字符画」可见入口；两者底层实现均暂时保留，避免不可逆删除。

## 2026-09-22 · 上下打孔轻量重构

- 将上下打孔从固定 `1080×1920` 内部画布改为按当前预览 Canvas 的真实尺寸生成；照片裁切、底纸纹理、剪影贴片与队形均只在换图或参数变化时重建。
- 每帧只二分定位一次当前音乐 cue，所有剪影共享队形插值；删除每个剪影重复扫描完整节拍数组的路径。取样落点候选从每块 160 次降低到 34 次。
- 删除运行链路中的 CLIP 场景识别、示例数据注入、专属「示例」按钮、通用 Select 特判及旧版兼容模块。自动搭配仅保留快速照片取色和轻量规则。
- 删除未引用的 `punch-scene.js`、`punch-presets.js`、`punch-legacy.js` 与旧渲染器测试；示例素材包暂未进入构建，也未在本轮物理删除二进制源文件。
- 本地 `punch-lite1` 页面实测：上下打孔成功显示上下正负形、照片取样贴片和队形运动；页面不再显示示例入口；字符雨存在、字符画不可见。两次连续效果切换的自动化交互耗时约 `730ms`（包含浏览器自动化往返），无十秒级识别等待。构建、语法及空白检查通过。本地修改，未发布。
