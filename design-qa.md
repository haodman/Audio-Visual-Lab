**Source visual truth**

- `/Users/bytedance/Downloads/音乐 x AI 节奏可视化-副本(3) (1).mp4`
- Contact sheet: `/tmp/mdp-video-analysis/v3.jpg`
- Related live reference: `https://flora-mdp-visuals.netlify.app/色彩移动特效/index.html`
- `/Users/bytedance/Downloads/AI情绪氛围-对比2-副本 (1).mp4`
- `/Users/bytedance/Downloads/音乐 x AI 节奏可视化-副本(4).mp4`
- `/Users/bytedance/Downloads/音乐 x AI 节奏可视化-副本(1) (1).mp4`

**Implementation evidence**

- `http://127.0.0.1:8765/music-fx-lab.html`
- Effect states: `风迹`, `局部像素显影`, `局部横向拉丝`, `方块叙事拼贴`, `主体上下分屏`
- Viewport: desktop workbench with 540 × 960 canvas scaled into the phone preview
- Runtime states checked: no-audio auto preview; Warehouse Techno at detected 133 BPM; portrait with close crop; wide-environment portrait; parameter sheet; segmentation preview; HUD overlay; pixel reveal; collage negative-space state; split-subject lyric state
- Console/runtime outcome: no visible runtime failure; audio synthesis, analysis, playback, effect selection and parameter controls completed

**Full-view comparison**

- Composition: the app shell intentionally remains unchanged. The effect preserves the selected photo and extends sampled horizontal bands behind the segmented subject, matching the reference's foreground/background hierarchy.
- Motion grammar: bands enter in groups, alternate left/right direction, hold, then retract; beat impulses accelerate extension.
- Density: final defaults use five mixed-width bands, 0.94 canvas-length reach and a 0.52 second hold to match the reference's broader background coverage.

**Focused comparison**

- Subject edge: MediaPipe grayscale confidence is now converted to alpha before compositing. This fixed the previous full-frame opaque mask and keeps face/body pixels above the streak layer.
- Band detail: each band contains a soft stretched body, crisp sampled spine and low-opacity displaced echo. This matches the reference more closely than a generic blur filter.
- Background behavior: faint one-pixel strands keep motion alive between major beat events without altering the subject.

**Findings**

- No remaining P0/P1/P2 issue in the first-pass baseline scope.
- `风迹` was rebuilt from the user's high-resolution reference captures: 15 large primary markers form a loose irregular grid; curved dotted paths connect nearby markers; moving light points travel along those paths; every marker carries CH coordinates and a QUERY id. Energy and high-frequency inputs now pass through low-pass envelopes before affecting motion. Kick injects a spatially traveling displacement wave instead of translating every node at once, eliminating the previous twitching behavior.
- Pixel reveal adds luminance/subject/full-frame targeting, a moving reveal band and music-reactive square fragments.
- Block collage adds three timed narrative layouts with black negative space, crop rearrangement and beat-driven transitions.
- Subject split converts the segmentation mask into a color plate plus lyric-filled silhouette and keeps the original subject in the lower half.
- P3: very tight portrait crops naturally expose less background streak area than the landscape-heavy reference examples. The `主体清晰` and `横带粗细` parameters allow art-direction adjustment per source.
- P3: the demo preserves the primary human subject; preserving arbitrary associated objects such as bicycles or shopping carts would require instance segmentation rather than selfie segmentation.

**Comparison history**

1. Initial pass: foreground redraw used the opaque alpha of MediaPipe's grayscale mask, hiding nearly all bands. Result blocked.
2. Fix: converted mask luminance to alpha and added threshold shaping. Bands became visible but the subject remained semi-transparent. Result blocked.
3. Fix: tightened the confidence curve so foreground pixels redraw fully above bands; verified mask preview and 133 BPM playback. Result passed.

**Implementation checklist**

- [x] Add independent FX entry and parameters.
- [x] Implement sampled horizontal stretch bands.
- [x] Add extend / hold / retract state machine.
- [x] Bind triggers to beat, kick, snare, hi-hat, bar or energy.
- [x] Preserve segmented human foreground.
- [x] Correct grayscale-mask-to-alpha compositing.
- [x] Build the single-file HTML.
- [x] Verify no-audio and music-driven states in browser.
- [x] Add custom HUD copy and per-character dotted network motion.
- [x] Match the reference's large marker scale, CH/QUERY microcopy, loose grid and `[0+]` default.
- [x] Connect nearby markers using curved dotted paths with moving highlight particles.
- [x] Drive two-axis turbulent displacement from audio energy and beat impulses.
- [x] Verify arbitrary long-form Chinese copy input and automatic chunking in browser.
- [x] Add localized pixel reveal effect.
- [x] Add block narrative collage effect.
- [x] Upgrade subject split with sampled-color plate and lyric silhouette.
- [x] Document each new effect's technical capability stack.

**Follow-up polish**

- Add instance masks for person + associated object preservation.
- Add an optional multi-image mode matching the website's 2–4 image color-strip template.
- Tune each newly added baseline effect one by one against its corresponding video after user direction.

**Embedded test music QA**

- Six supplied MP3 files appear in a dedicated `测试音乐` group with matched 600×600 official release covers and corrected artist metadata.
- Browser-tested `Espresso`: decoded successfully, analyzed as 105 BPM / Pop-R&B / 0:25, and entered playback with live energy updates.
- LRC structural cue timelines are embedded and available to effects through `MFX_MUSIC.currentTrack()`, `MFX_MUSIC.lyricAt()` and `MFX_MUSIC.lyrics()`.
- Full commercial lyrics were not sourced; the included LRC files intentionally contain replaceable section cues until licensed/user-provided lyrics are supplied.
- APT. is loaded automatically at startup. Browser-tested startup analysis returned 149 BPM / 2:53; after the first allowed user gesture, live energy and spectrum updates began and `风迹` responded continuously.


final result: passed
