# Image-first music stickers — subject-gated sunshine and beat-locked clock

Current local revision: only Rotating sunshine and Rotating text clock are registered. All umbrella code is removed from the bundle and fallback path. Selecting a photo remains automatic.

## Rotating sunshine

**Scope:** A prominent foreground candle, single flower, lollipop, cotton candy, balloon or sun — not a small background detail.

Recognition alone is insufficient. Flower heads must cover >= 1.5% of the frame, with width >= 12% and height >= 5.5%; candy and balloons need >= 2% area and width >= 10% / height >= 8%. Object centers must remain within x 12–88%, y 10–88%. Small edge flowers, distant decorations and tiny sun disks are rejected. Standalone candles need >= 0.8% area and >= 14% height. A narrow birthday candle may qualify only when attached to a clearly detected foreground cake covering >= 3.5% of the frame. A recognized object with no prominent subject evidence falls back to the clock.

**Motion / stability:** Soft, restrained accents. Candle halos retain their faster rotation and every spoke remains filled with words or text emoticons.

## Rotating text clock

**Scope:** The default whenever no prominent sunshine subject qualifies.

Always fill 95% of both frame dimensions, with a 2.5% safety margin. Ignore subjects and composition. The outline and hand stay white with a soft dark shadow. Custom copy and timed lyrics share their exact active-word position with the hand.

**Motion / stability:** The hand jumps to the highlighted word on a measured audio beat, moves for 85ms, settles for 35ms, then holds. Custom words advance on every verified beat by default; optional two/four-beat pacing remains available. The whole clock stays fixed.

## Automatic photo selection

**Scope:** Selecting a still photo in Smart dynamic stickers immediately starts matching.

Start with Rotating text clock. Switch to sunshine only if both recognition and foreground prominence checks pass. There is no Auto match button, and no umbrella fallback. Manual selection lasts until the next photo.

**Motion / stability:** Image filenames and expected test labels never drive matching.

## Color and full-frame clock

**Scope:** Sunshine uses image-adaptive ink. Clock outline and hand always use white (#ffffff), protected by a thin dark edge and soft shadow.

Clock words default to a soft multicolor palette: yellow, mint, pink, sky blue, lilac, peach, green and rose. Each word keeps its color through one complete turn; the next turn advances the palette by one color. Optional word modes are Photo accents, White and Manual. These controls never recolor the white outline or hand. Sunshine and optional Photo accents sample a 108 x 192 preview, measure luminance and saturation-weighted hue, and choose tinted light ink, tinted dark ink, ivory or navy by lower-quartile contrast. Accents below 3:1 median contrast use the base ink.

**Motion / stability:** No random color changes or color flashing on every beat. The clock always occupies 95% of frame width and height, independent of people, foreground objects or the photograph.

## Beat locking and silence

**Scope:** The clock follows measured WebAudio onsets, checked against the track beat grid when it has enough support.

Compare four beat-grid phases every 16 beats and favor the phase with stronger actual hits, so offbeat hats/chords do not displace the main accents. Snap supported beats to a real onset within 130ms or 26% of a beat, whichever is shorter. Retain onset candidates before the legacy 220ms debounce, so early quiet transients cannot hide the main hit. Reject weak events and use a tempo-aware minimum separation: 52% of one beat, clamped to 140–280ms. If fewer than 40% of active grid beats are supported, use prominent actual onsets instead. Every clock step must refer to a detected onset; no events are invented in silence.

**Motion / stability:** The active word defines both hand angle and hand length. Custom copy advances every 1, 2 or 4 verified beats (default 1). Timed lyric groups snap forward to measured beats and occupy eight persistent slots; their text and hand advance together. A step settles after 120ms and holds. Pausing and seeking reproduce the same frame.

## Foreground subject checks

All dimensions are normalized to the visible 9:16 frame. Recognition similarity is not a calibrated probability.

| Object | Minimum area | Minimum width / height | Extra condition |
|---|---:|---:|---|
| Single flower head | 1.5% | 12% / 5.5% | Bouquet suppression; foreground composition |
| Lollipop, cotton candy, balloon | 2% | 10% / 8% | Foreground composition |
| Standalone candle | 0.8% | 4% / 14% | Foreground composition |
| Birthday candle on cake | 0.15% | 2% / 7% | Candle score >= 0.25; cake score >= 0.18 and area >= 3.5%; spatial attachment required |
| Sun disk | 0.4% | 7.5% / 3.5% | Warm round disk evidence for a low-score candidate |

Object centers must be inside x 12–88% and y 10–88%. Boxes over 65% of the frame are rejected. A small/medium object with score below 0.18 also needs a successful crop recheck or sun pixel verification; only objects covering >= 8% bypass that additional weak-score check. A crop recheck does not bypass foreground size or edge constraints.

Cake context requires the candle base to lie within the cake vertical extent (with 2.5% tolerance), the candle center to lie within its horizontal bounds, and the candle top to be at most 22% of the frame above the cake. The cake center must lie within x 15–85%. An unrelated cake elsewhere cannot validate a distant candle.

Rank eligible objects by foreground/context area plus recognition support, so a smaller high-confidence decoration does not outrank a larger foreground subject. Refine the candle anchor to warm bright flame pixels. Separate qualified candles may each receive a halo. Every sunshine spoke has text or an emoticon, including lyric gaps.

These are deliberately conservative visible-prominence checks, not a claim to understand every photograph's artistic intention. Small background details now fall back to the clock even if the detector recognizes them correctly. For example, the railing flower in the seaside/dog material covers about 0.056% of the frame and is near the left edge: it is rejected. A large foreground flower and the user-selected birthday cake continue to qualify.

## Clock beat timing

WebAudio analyzes the actual decoded PCM at 100Hz, measuring RMS, bass energy and positive flux. Onsets use an adaptive local threshold and silence rejection. The clock selects sufficiently strong events and checks four possible beat-grid phases every 16 beats, preferring squared accent support. This corrects a grid that follows weak offbeat hats/chords and allows local phase adjustment when the tempo estimate drifts.

A grid position only qualifies when a measured onset exists within min(130ms, 26% of a beat). The clock retains all qualifying local onset peaks before the legacy 220ms debounce; an earlier quiet transient therefore cannot suppress the stronger beat. Events use a minimum separation of 52% of the beat period, clamped to 140–280ms (about 168ms at 186 BPM), instead of the old fixed 280ms rejection. If less than 40% of active grid positions have support, the fallback uses prominent actual onsets. No clock event is synthesized in silence.

The clock fills 95% of frame width and height with a 2.5% safety margin on each side. It ignores person masks, object positions and photo composition. Its outline stays still. Custom copy is grouped into at most twelve labels without dropping words. Labels use the same outline geometry as the hand targets. Every measured beat (default), the next word is highlighted and the hand moves to its exact angle; hand length stops before that label. At optional two/four-beat pacing, intervening beats accent the current word and tip without changing the target. The user can choose one, two or four beats per word.

Transitions use an 85ms ease-out with 3.5% angular overshoot, a 35ms settle, then a complete hold. The selected word and hand tip share the same onset pulse, with a fast attack and 160ms decay. Inactive custom labels stay visible. A single-word clock holds its target and accents it on the beat.

Timed lyrics use eight persistent slots. Existing word timestamps are honored when provided; line-only lyrics are divided into short groups at evenly estimated times within the line. Each group snaps forward to the next measured beat; groups sharing a beat are merged. Text and hand use that same event and slot. No new hand event is fabricated when no later measured beat is available. Line-only input is approximate lyric timing, not forced word alignment. Pause and seek remain deterministic.

The DSP and grid are estimates; they do not guarantee perfect beat/downbeat transcription for every song.

## Color and placement

The clock outline, hand, hub and tip always use pure white (#ffffff). A narrow dark edge plus soft dark shadow keep them readable against bright and mixed backgrounds. No photo hue or manual text setting changes the clock ink. Full-frame fitting applies to every photo.

Clock words default to yellow (#ffe28a), mint (#97eed4), pink (#ffb3cb), sky blue (#aee9ff), lilac (#dab7ff), peach (#ffd19c), green (#c5f09a) and rose (#f6a3b0). Each slot retains its color for one turn; the next complete turn offsets the palette by one color. Word modes also include Photo accents, White and Manual. Text has a restrained dark shadow and edge. Colors do not randomize or flash on every beat.

Sunshine stays centered on the qualified object and retains image-adaptive ink. Its palette, also used by optional clock Photo accents, samples the photo at 108 x 192. The strongest saturation-weighted 30-degree hue bin gives the color family. Relative luminance uses linear sRGB weights 0.2126 / 0.7152 / 0.0722. Compare a 93%-lightness tint, a 16%-lightness shade, warm ivory (#fff9ea), and dark navy (#191f29). Choose the strongest 25th-percentile local contrast. Accents use hue offsets 0, 55, and 310 degrees at restrained saturation; if an accent falls below 3:1 against median luminance, use the base ink. Subtle opposite-color edges protect mixed backgrounds. Sunshine manual color remains an explicit override.

## Runtime, materials and release

Recognition uses local quantized OWL-ViT with pinned Transformers.js 3.7.2. Initial use downloads weights. Photo pixels stay on-device. The existing app keeps its shared MODNet path; the full-frame clock does not use segmentation for placement. No new segmentation model is added. The music-mood model is not loaded. Automatic semantic matching is for still photos.

The birthday-cake original is in the local material library and embedded by the build. Other generated photos remain unapproved review assets outside git. Screenshot annotations are not baked into source photographs.

Both styles form one Smart dynamic stickers feature and one source PR. The source PR is authorized; merging and website publication are not. Before website publication, obtain separate authorization and reread fresh website README/AGENTS/handoff instructions. Source: haodman/Audio-Visual-Lab. Website: separate haodman/haodman.com repository, audio-visual-lab/. A source push alone does not publish the website.
