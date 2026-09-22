# 动态时钟（dynamicClock）

A single full-frame clock, adapted from the user's original irregular text-clock drawing. The retired sunshine/candle renderer and semantic image matching are removed. Original Desktop files are unchanged.

- `effects.js`: one `mdpClock` adapter using the existing canvas, audio transport, custom text and timed lyrics.
- `clock-renderer.js`: white clock, shared word/hand target geometry and audio-driven outer-contour deformation.
- `rules.js`: actual PCM onset detection, fast-tempo beat selection, smooth contour energy/bass/detail envelopes and photo word colors.
- `composition.js`: cached whole-photo color sampling; no masks or subject-dependent placement.
- `clock-ui.js`: clock controls, English motion rules and localhost-only review photographs; no model worker.
- `fonts/`: locally bundled Gochi Hand and its SIL Open Font License.

See [MOTION-RULES.md](MOTION-RULES.md) for exact smoothing, frame bounds, beat timing and color logic. The clock itself does not download an image model. Existing unrelated effects keep the app's shared matting path. Music remains lazy-loaded.

Run `node src/mdp/rules.test.cjs`, `node src/mdp/clock-renderer.test.cjs`, `node src/mdp/clock-fast-beats.test.cjs`, and `node src/mdp/clock-outline.test.cjs`, then `python3 src/build.py` and real-browser QA. The outline regression covers audio dependence, silence, 60fps continuity, deterministic seek, safe bounds and unchanged word/hand geometry.

This revision updates the existing Open PR #3; it must not merge or deploy the public site. The approved birthday photograph remains in Materials. Other generated review photos stay outside version control.
