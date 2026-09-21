## 2026-09-21 · Punch Studio revision 03 — native website review

- Removed padding in every crop mode. Photo panels always fill 1080×960 without distortion; face-aware automatic positioning and manual framing remain available. All twelve demo captions are English.
- Formation cues occur every second returned beat. Individual positions ease over 78% of the two-beat interval, capped at 1.6s. Nearest destination assignment reduces crossings. No abrupt position reset at a cue.
- Rain, petals and leaves now originate at holes in the upper photograph and cross the seam into the lower paper. Gravity paste transitions also travel from source holes. Rain falls vertically and scatters at beat timestamps; leaves/petals turn and drift naturally. Captions remain near the seam and render over falling cutouts.
- Verified the downloaded current public page and existing local source had identical stylesheet content before adding the example entry. Retained the native phone/player/analysis/effects/material layout and shared right-side drawer. A new 示例 button opens the existing parameter drawer with twelve photo examples.
- Imported 28 visually reviewed, distinct user-input photos. Kept the original 58 presets (86 total). MDP 照片 filters the new collection; MDP 示例 filters all twelve demo photos. Background textures, masks, intermediate screenshots and repeated exports were excluded according to the user's clarification. The 56 relative WebP photo/thumbnail files total 9.48 MB and remain lazy-loaded. No local paths or local-only audio are included in this publishable photo pack.
- Core checks: 15 passed, including full-bleed geometry, continuous two-beat formation transitions and all three gravity types crossing from upper to lower panel. Existing 12×10 shape/material checks retained.
- Real-browser checks: twelve examples/unique shapes selected in the native drawer, English captions, 28-photo filter, retained original material count, all 56 image endpoints, viewport-preserving drawer, manual framing, standalone page and real 15-second export. No local failed responses or JavaScript errors captured. Rain upper/lower frames confirmed continuous cross-seam travel.
- Media validation: all twelve revised H.264/AAC demo videos and the native-page export decoded cleanly at 1080×1920. Native browser recording is variable frame rate around 30 fps; offline movies are fixed 30 fps.
- User-facing evidence: website-layout-v3.png, user-photo-library.png, demo-overview.png, the twelve movies and English rules in the local output folder. Website-style local entry: /audio-visual-lab/?effect=punchSymbols&demo=reality&v=3.
- Source and website remain unpushed and undeployed. The photo pack is ready to synchronize alongside the built pages after user visual approval. Hosted CLIP verification remains a pre-publication check; the native local page uses Apple Vision.

## 2026-09-21 · Punch Studio revision 02 — local review

- User corrections: English matching/crop rules; individual bird/butterfly formation targets; website WebAudio beats only; seam-side captions in both orientations; twelve photo examples; original-photo crop controls; all punch outputs 9:16.
- Bird targets: flock, chevron, circle, wave, arc. Butterfly targets: scatter, ring, figure eight, spiral, rosette. The mean center is fixed and many pairwise distances change. No shared horizontal travel. Caption space is reserved above the seam on upper paper and below the seam on lower paper.
- Direct original-photo input removes double cropping. Auto mode retains at least 82% via fill or preserves the complete image with neutral matting. Fill supports x/y framing and zoom. Available local face boxes can trigger full-image retention and discourage face punching. Hosted browser classification does not currently supply face boxes.
- Twelve 15-second H.264/AAC demo movies generated at 1080×1920, 30 fps; all fully decoded without errors. Reality, Touch and repository unhappy. Four automatic examples and eight explicit shape studies are distinguished in the UI and manifest. All twelve shapes loaded through the actual browser selector.
- Browser checks: English UTF-8 rule page and recipes; photo/music upload; crop framing/full-image retention; empty and custom captions; frozen pause; 390px layout; both standalone and repository actual exports at 1080×1920 with audio. No page/effect errors captured. Repository export now directly renders artwork at export resolution instead of recording the phone frame.
- Targeted follow-up: actual timed lyric at 24.3 seconds visibly appeared in the lower paper caption band. Final repository export verified as H.264/AAC at 1080×1920. New uploads clear untouched demo metadata.
- Thirteen core checks passed, including all 120 shape/material combinations, automatic shape reachability, deterministic frames, phase timestamps, individual formation distances, seam-side caption bands and crop geometry.
- Local screenshot evidence: studio-v2-final.png, studio-v2-mobile.png, rules-v2.png and repo-preview.png in the task work directory. User-facing gallery, formation contact sheets and media are in the local review output folder. Revision 01 evidence below is historical and superseded.
- No push or deployment. Await user visual approval. Static CLIP path remains a pre-publication check. Do not publish personal demo music, generated videos, local tools, system fonts or absolute local asset paths.

## 2026-09-21 · 上下打孔本地审片

- Replaced the paired-coordinate glyph effect with user-derived vector cutters, photo-matched chips, scattered source holes and three asymmetric destination groups. Twelve shapes and ten procedural materials; shared deterministic renderer for local movies and repository preview. Gravity shapes use photo above paper.
- Automatic rules combine image scene evidence and provided song metadata. Repeated flowers/forest silhouettes are vetoed. Photo hue-family selection and light/dark contrast are recorded. Rules in docs/punch-rules.md. Apple Vision full/crop classification tested through the local service. Static browser CLIP path is implemented but remains a pre-publication validation item.
- A/B movies: Reality, Touch and repository unhappy; full supplied audio analyzed at 44.1 kHz, render interval 0–15 seconds, 810×1080 at 30 fps. Same input, seed and decoded audio for each pair. Each movie decodes successfully; no independent beat ground truth. Beat This! is local only while user selects the engine.
- Browser: standalone uploaded new violet-sky image and unhappy audio, empty/custom text, seek, frozen pause, 390px width and actual MP4 with audio export passed. Repository checked 540×960 canvas, portrait and landscape-tagged materials, shared parameter drawer, shape/material changes, 22-cue lyric source, frozen pause and 15-second MP4 export with existing phone UI. No JS or effect render errors captured. Timed lyric source was connected; a readable lyric frame remains a targeted follow-up before publication.
- Nine core assertions passed, including all 120 shape/material pairs. Node syntax, build, and whitespace checks passed. Build now writes both root HTML entry points from source, eliminating stale index output. Legacy punch renderer retained as inactive reference.
- Visual review corrected offline CJK weight to the existing local Songti Light and made the first rain cycle start from pasted chip positions. Personal audio, demo movies, system fonts and local runtime are not added to the publish payload.
- Local review only. No push, PR, merge or deployment; waiting for the user's visual approval.

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


## 2026-09-21 · 上下打孔音乐动效 · Revision 04（源码 PR，暂不合并）

- 功能范围：`punchSymbols` 的图像/歌曲搭配、矢量打孔、材质取色、分阶段隔拍动效、素材与示例入口、9:16 导出。使用独立分支 `feature/punch-music-refine` 和一个专属 PR；不混入其他独立功能，不更新网站仓库。
- 用户最终反馈：移除 City sky、Mountain air 以及四张否决的生成图，保留 26 张精选用户照片及其缩略图，原素材库 58 张保留，总计 84 张。背景材质、蒙版、过程图与重复导出不进入前台。
- 新规则：明显的美拉德/棕咖/驼色秋冬搭配可选落叶，明显粉色衣服或整体粉色调可选花瓣，不再要求画面存在树或花。像素色调规则独立运行，重复花叶保护继续生效。14 组示例用原始照片、英文文案，8 自动 / 6 形状示范；咖啡落叶采用用户参考图对应的无贴纸原图。
- 隔拍：开场仍按原拍点分批打孔和贴片；后续队形、翼姿、星星明暗/缩放、便利贴、小花、小树、雨滴落地散开统一使用同一隔拍时钟。花瓣/落叶隔拍分批释放，连续翻转下降，前一次下落结束后才能在下一个分组拍点重新释放。
- 真实浏览器检查：14 个示例覆盖 12 形状；84 张清单 / 26 张新增照片的 52 个图片 URL 均通过；抽屉不挡预览、手动裁切、英文可选字幕、播放暂停、效果切换、15 秒导出均通过。页面无脚本错误或本地资源错误。
- 静态环境：关闭本机 API 后，源码页面正常使用仓库 unhappy，四张穿搭示例按色调自动匹配。内置照片使用预分析画面信息而非固定形状；新上传图片保留即时色调与浏览器识别。
- 验证：18 项画布/规则回归通过；包含所有形状材质组合、无留边裁切、跨半幅下落、连续队形及统一隔拍事件。14 段离线示例和 1 段真实浏览器导出完整解码通过，均 H.264/AAC、1080×1920。
- 提交检查：源码语法、`python3 src/build.py`、生成入口一致性和 `git diff --check` 通过。提交前 fetch 确认 origin/main 为 f8cc7b9，无新增上游提交。Reality/Touch、审片视频、本机字体/模型运行时均不入库。

- 四张最终穿搭原图重新走纯浏览器 CLIP（绕过预分析素材）：窗边咖啡 → leaf；粉衣咖啡侧坐 / 正坐、海边粉衣双人 → petal。未填写提示词、未指定形状，检查通过。
