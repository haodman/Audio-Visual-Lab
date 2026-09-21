# Design QA · Text wrap effect

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
