# 智能动态贴纸（smartStickers）

One feature with two retained sticker styles adapted from the user's original MDP drawing engines: rotating sunshine and irregular rotating text clock. Umbrella code is removed from the source bundle, registry, controls and automatic fallback. Earlier flower/star/willow effects are not registered. Original Desktop files are unchanged.

- `rules.js`: conservative foreground subject gates, cake/candle spatial context, ranking, image-adaptive palette, WebAudio onset analysis and locally phase-aligned clock events with pre-debounce onset candidates and tempo-aware separation.
- `matching.js`: lazy OWL-ViT worker, crop rechecks, stale-result protection, memory cache and automatic clock/sunshine selection on photo changes. The clock is the unconditional fallback. No music-genre model is downloaded.
- `composition.js`: photo sampling and existing shared MODNet/person data; no clock placement search.
- `effects.js`: two adapters in the existing canvas/audio/parameter system.
- `clock-renderer.js`: 95% full-frame white outline and hand with shadow; exact shared word/hand targets, 85ms onset step + 35ms settle, one beat per custom word by default, deterministic pause/seek and eight-slot timed lyrics.
- `light-stickers.js`: sunshine with candle flame anchors and filled text/emoticon spokes.
- `fonts/`: original Gochi Hand and OFL license.

The selected birthday-cake image is tracked at `src/models/mdp/birthday-flash.png` and embedded in both built entry points. Other test photos remain outside git behind an ignored localhost-only link. Test labels never feed matching.

Run `node src/mdp/rules.test.cjs`, `node src/mdp/clock-renderer.test.cjs` and `node src/mdp/clock-fast-beats.test.cjs`, check JavaScript syntax, build via `python3 src/build.py`, and run `git diff --check`. Local review uses port 8937; port 8765 was occupied. `?stickers=1&material=<photo name>` can open a material for review. An explicit unrelated Visual effect remains available in its own tab.

TRIGGER-RULES.md defines exact gates, rhythm and color behavior. Subject prominence and beat analysis are estimates; weak evidence falls back to the clock. All processing stays in-browser, except first-use model/runtime downloads. Both styles are submitted together for source PR review. No merge or website publication is authorized. Reread website instructions and obtain separate authorization before any website release.
