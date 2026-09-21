# Design QA · Single-image punch effect

- PASS: `🔘 单图打孔` appears immediately after `🌀 轮廓声场` without changing the surrounding effect order.
- PASS: Glyphs are used as canvas masks rather than a flat sticker layer; the primary mask reveals a photo-derived complementary ground.
- PASS: Secondary masks display offset samples from the same source image and a restrained printed-color layer, matching the collage behavior in the references.
- PASS: Presets cover stars, weather, music, flowers, geometry, and a mixed set; custom glyph input is available in the shared parameter drawer.
- PASS: Count, size variation, offset sampling, printed blocks, color logic, pulse, beat replacement, vibration, and audio driver are adjustable.
- PASS: Playback verification shows symbols changing position/type on musical transients while the underlying image remains stable.
- PASS: The phone preview remains visible while parameters are edited, and the main effect/material cards stay unchanged.
- PASS: Latest source build passes JavaScript syntax validation and returns HTTP 200 from the local service.

final result: passed
