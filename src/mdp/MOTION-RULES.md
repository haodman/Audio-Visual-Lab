# Dynamic clock — audio motion and color rules

One effect named 动态时钟. Every photo uses the same full-frame clock. The former candle/sunshine renderer and semantic image matcher are removed. The approved birthday photograph remains a normal material.

## Dynamic clock

**Scope:** One full-frame clock for any photo. Selecting another photo keeps this effect active.

The resting outline covers 95% of each frame dimension. The white hand and words keep shared target positions; only the outer outline flows with the audio.

**Motion / stability:** The hand advances on measured audio beats, moves for 85ms, settles for 35ms, then holds. One beat per word is the default, with two/four-beat options.

## Flowing audio outline

**Scope:** Measured full-band energy, bass and transient detail shape the outer white contour.

WebAudio reads the decoded PCM at 100Hz. Normalize by track energy, then smooth attack/release over 120/460ms (energy), 160/580ms (bass) and 180/380ms (detail), followed by a 90ms smoothing stage. Broad three-lobe and two-lobe curves carry most movement; fine detail stays restrained. Movement travels according to accumulated audio energy, never a free-running timer.

**Motion / stability:** Deformation is inward only, up to 6.8% of the local radius at default depth, preserving the outer safety margin. Quiet passages relax toward the resting shape; silence settles to rest. Pause, seek and export use identical song-time samples. Outline depth changes the contour only, not hand timing or word positions.

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

The contour combines broad periodic three-lobe and two-lobe shapes with a small five-lobe detail. Each component is spatially closed, so the seam stays continuous. Deformation moves inward from the resting 95% outline, preserving safe margins at maximum depth. At default depth, the upper bound is 6.8% of each point’s local radius; the depth control ranges from zero (static outline) to 1.5. The central hand and word positions stay stable while the outside contour changes.

## Words, hand and color

Custom copy groups into at most twelve labels without dropping words. The hand angle and length come from the active label; its tip stops before the text. Each step uses 85ms ease-out with 3.5% angular overshoot, 35ms settling, then holds. The outline uses separate smooth audio envelopes instead of these sharp beat pulses.

Timed lyrics occupy eight persistent slots. Existing word times are used when available; line-only lyrics are divided into approximate groups. Groups snap to actual detected beats. This is not forced word alignment and does not guarantee perfect transcription for every song.

The outline, hand, hub and tip use #ffffff with a soft dark shadow. Soft word colors are yellow, mint, pink, sky blue, lilac, peach, green and rose. Photo accents sample 108 x 192 pixels, use saturation-weighted 30-degree hue bins, and choose a light tint, dark shade, ivory or navy by 25th-percentile contrast. Accent offsets are 0, 55 and 310 degrees; accents below 3:1 median contrast fall back to the base ink. White and manual word-color modes never change the white clock.

## Runtime and delivery

The clock has no object-recognition worker, semantic trigger, sunshine fallback or additional image-model download. It does not wait for matting; unrelated app effects keep their shared MODNet path. Audio is decoded and analyzed locally using WebAudio. Source media files and custom text remain on-device. Rendering is deterministic by song time, including pause, seek and export.

The selected birthday-cake original stays in Materials. Other generated review photographs remain outside git. The original Desktop drawing files are unchanged. This effect updates the existing source PR as one feature; it remains Open and unmerged. Public-site publication requires separate authorization.
