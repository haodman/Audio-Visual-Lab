# Audio Visual Lab agent guide

Read `handoff/CODEX_START.md` and `handoff/PROJECT_STATE.md` before changing this repository.

## Non-negotiable workflow

1. Work locally first. Do not deploy unless the user explicitly asks.
2. Edit source files in `src/`; do not hand-edit generated `music-fx-lab.html` or root `index.html`.
3. After source changes run:
   - `node --check src/app.js`
   - `python3 src/build.py`
   - `git diff --check`
4. Open `http://127.0.0.1:8765/music-fx-lab.html` and test the changed interaction in a real browser.
5. Preserve unrelated user changes. Do not remove songs, materials, effects, or controls unless requested.
6. Treat a successful build as insufficient. Verify the visible result, playback behavior, parameter response, and resource loading.
7. Keep `design-qa.md` current for visual/effect changes.

## Product rules

- Effects must visibly follow real audio features, not decorative timers.
- Preserve the 9:16 phone preview and the existing main-page information architecture.
- Parameters and music selection use the shared right-side lightweight drawer. Do not reintroduce the rejected inline parameter panel or a blurred blocking modal.
- The preview must remain visible while parameters are adjusted.
- Selected chips are white/neutral. Green is reserved for positive status and lightweight actions.
- Text-capable effects must support both custom text and timed lyrics when that capability is applicable.
- Static-image effects share the same MODNet matting path. Do not create effect-specific lower-quality cutout logic.
- Avoid loading every heavy asset up front. Audio remains lazy-loaded from `src/music/`.

## Deployment boundary

- Source repository: `haodman/Audio-Visual-Lab`.
- Public site repository: `haodman/haodman.com`, directory `audio-visual-lab/`.
- Public URL: `https://haodman.com/audio-visual-lab/`.
- A push to this repository does not currently publish the website automatically.
- Publishing requires explicit authorization, access to both repositories, synchronization of the built HTML and referenced audio, and a final browser check of the public URL.
