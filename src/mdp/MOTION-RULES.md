# Dynamic clock — audio motion and color rules

One effect named 动态时钟. Every photo uses the same full-frame clock. The former candle/sunshine renderer and semantic image matcher are removed. The approved birthday photograph remains a normal material.

## Dynamic clock

**Scope:** One full-frame clock for any photo. Selecting another photo keeps this effect active.

The resting outline covers 95% of each frame dimension. The outline stretches in multiple directions. Words follow the same deforming contour and the white hand follows its moving target.

**Motion / stability:** The hand advances on measured audio beats, moves for 85ms, settles for 35ms, then follows that word until the next event. One beat per word is the default, with two/four-beat options.

## Flowing audio outline

**Scope:** Measured full-band energy, bass and transient detail shape the outer white contour.

WebAudio reads the decoded PCM at 100Hz. Normalize by track energy, then smooth attack/release over 120/460ms (energy), 160/580ms (bass) and 180/380ms (detail), followed by a 120ms smoothing stage. Independent horizontal/vertical stretch, traveling bends and broad radial waves carry the movement; fine detail stays restrained. Movement travels according to accumulated audio energy, never a free-running timer.

**Motion / stability:** Default radial variation reaches 27.2% at peak input, with up to 12% independent horizontal/vertical stretch and traveling angular bends. The shape alternates between compression and extension inside the full-frame safety margin. Quiet passages relax toward the resting shape; silence settles to rest. Pause, seek and export use identical song-time samples. Stretch depth moves both the contour and the words. The hand recomputes its angle and length from the moving active word each frame; beat selection stays unchanged.

## White clock and word colors

**Scope:** The outline, hand, hub and tip stay white (#ffffff) with a thin dark edge and soft shadow.

Words use a soft multicolor palette by default, or Photo accents, White or Manual. Each word keeps its color for a complete turn; the next turn advances the palette. Photo accents sample a 108 x 192 preview and choose colors using saturation-weighted hue and local luminance contrast. Low-contrast accents fall back to the most legible ink.

**Motion / stability:** Colors never randomize on individual beats. Photo content does not change clock placement or select a different effect.

## Beat locking and silence

**Scope:** The hand follows measured WebAudio onsets, checked against the track beat grid when sufficiently supported.

Compare four grid phases every 16 beats and favor stronger actual hits. Preserve candidates before onset debounce, so an early quiet transient cannot hide the main hit at fast tempos. Minimum event separation is 52% of a beat, clamped to 140–280ms. Unsupported grids fall back to prominent actual onsets. No hand events are invented during silence.

**Motion / stability:** Custom words and the hand share each measured event and exact target position. Timed lyric groups snap forward to measured beats and occupy eight persistent slots. Line-only lyric timing is estimated, not forced word alignment. Pausing and seeking reproduce the same frame.

## Outline signal and geometry

Full-band and bass RMS are normalized against their 95th-percentile track energy, with small absolute noise floors. Positive full-band/bass flux supplies a restrained detail channel. Two causal smoothing stages give a rounded attack and longer release. The renderer interpolates the 100Hz envelopes at the precise song timestamp. Curve travel integrates smoothed energy and bass; it slows and settles as sound disappears. Silent PCM generates no movement. No wall-clock oscillation or simulated beat grid drives the contour.

The contour combines independent horizontal and vertical stretch, angular bends, broad three-lobe/two-lobe radial waves, and restrained five-lobe detail. Each component is spatially closed, so the seam stays continuous. At default depth, peak input permits up to 27.2% radial variation and up to 12% independent axis stretch, with angular bends up to 0.195 radians. The shape alternates between compression and extension while remaining within the resting 95% frame boundary. The depth control ranges from zero (resting geometry) to 1.5. Every word samples the same deformed contour and stays upright for readability. Both previous and current hand targets are recalculated from these moving word positions, so the hand keeps pointing to the active word between beat events.

## Words, hand and color

Custom copy groups into at most twelve labels without dropping words. The hand angle and length come from the active label; its tip stops before the text. Each step uses 85ms ease-out with 3.5% angular overshoot, 35ms settling, then follows the current moving word until the next beat event. The outline and word positions use separate smooth audio envelopes instead of these sharp beat pulses.

Timed lyrics occupy eight persistent slots. Existing word times are used when available; line-only lyrics are divided into approximate groups. Groups snap to actual detected beats. This is not forced word alignment and does not guarantee perfect transcription for every song.

The outline, hand, hub and tip use #ffffff with a soft dark shadow. Soft word colors are yellow, mint, pink, sky blue, lilac, peach, green and rose. Photo accents sample 108 x 192 pixels, use saturation-weighted 30-degree hue bins, and choose a light tint, dark shade, ivory or navy by 25th-percentile contrast. Accent offsets are 0, 55 and 310 degrees; accents below 3:1 median contrast fall back to the base ink. White and manual word-color modes never change the white clock.

## Runtime and delivery

The clock has no object-recognition worker, semantic trigger, sunshine fallback or additional image-model download. It does not wait for matting; unrelated app effects keep their shared MODNet path. Audio is decoded and analyzed locally using WebAudio. Source media files and custom text remain on-device. Rendering is deterministic by song time, including pause, seek and export.

The selected birthday-cake original stays in Materials. Other generated review photographs remain outside git. The original Desktop drawing files are unchanged. This effect updates the existing source PR as one feature; it remains Open and unmerged. Public-site publication requires separate authorization.
