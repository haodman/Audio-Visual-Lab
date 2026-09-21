# Design QA · Text wrap effect

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
