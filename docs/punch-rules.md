# Punch Studio — matching, cropping and motion rules

Revision 04 · Source branch review · September 21, 2026

The output is a 1080 × 1920 portrait video (9:16), 30 fps, with the selected song. A preview lasts 15 seconds, or the available remainder if the song ends sooner. All examples use the existing Audio Visual Lab WebAudio analyzer. The canvas contains the artwork only.

## 1. Inputs and automatic selection

Required: one original photo and one audio file. Optional: a caption and a few descriptive words about the song or scene. The caption is display text; it is not treated as evidence about the photo. The song title, available lyrics, genre and explicitly supplied descriptive words can influence matching. The standalone studio uses the audio filename/title and the optional descriptive words; it does not transcribe or understand sung lyrics. The repository page can also use its existing timed lyrics.

The local image classifier examines the full image plus a 3 × 3 grid. A scene score is the maximum of its full-image confidence, 0.65 when at least four tiles support it, and 0.40 when at least two tiles support it. A tile supports a cue at confidence 0.20 or higher. A supplied scene hint can contribute 0.78. The demonstration catalog supplies no hidden scene hints or forced seasonal shapes. The 26 imported library photos and 34 existing photo-pack entries include pre-analyzed scene scores and face boxes from Apple Vision plus the same pixel rules, so a static checkout can select immediately without the local service. These are image cues, not shape overrides. Uploaded photos use local Apple Vision where available, otherwise browser CLIP with the same matching rules. Detection is approximate; use the visible shape selector to correct a poor match.

Each shape starts at zero, except four-point stars at 0.70 and six-point stars at 0.60. Image cue weights below are multiplied by the scene confidence and added to shape scores. Matching song cues add the stated weight once per category. The highest permitted score wins. This is a deterministic rule system, not an assertion that one pairing is objectively correct.

| Image cue | Shape score contribution | Reason |
| --- | --- | --- |
| Sky / clouds | Birds +4.8 × confidence | Movement through open air |
| Sea / lake / beach / water | Raindrops +5.2 × confidence | Related material with a different silhouette |
| Forest | Butterflies +5.0 × confidence | A complementary living detail |
| A tree | Trees +3.8; leaves +2.2, each × confidence | Appropriate when trees are not already repeated |
| Flowers | Butterflies +5.4 × confidence | Avoid repeating the flower silhouette |
| Garden / ferns / vegetation | Butterflies +4.5 × confidence | A light contrasting motif |
| Night | Four-point stars +4.9; moons +4.2, each × confidence | Light against darkness |
| Sheep / flock | Six-point stars +5.0 × confidence | Neutral geometry instead of more sheep |
| Snow | Six-point stars +4.8 × confidence | Crystalline geometry |
| City / street / buildings | Notes +3.2 × confidence | An everyday paper motif |
| Portrait | Four-point stars +1.0 × confidence | A restrained fallback |
| Autumn scene | Leaves +6.0 × confidence | Seasonal context |
| Sparse spring blossom branch | Petals +7.0 × confidence | A falling detail from an airy spring scene |
| Maillard / brown / camel styling | Leaves +12.0 × confidence | Autumn/winter color styling, including clothes and interiors |
| Pink outfit or overall pink styling | Petals +13.0 × confidence | A soft color relationship, without needing visible flowers |

| Song title / lyrics / descriptive words | Shape bonus |
| --- | --- |
| rain, tears, cry, sad, unhappy, melancholy, lonely | Raindrops +3.4 |
| romantic, love, kiss, touch | Butterflies +2.4 |
| young, youth, school | Notes +3.7 |
| night, moon | Moons +2.7 |
| star, celebration, party, wish | Five-point stars +4.2 |
| autumn, falling leaves | Leaves +4.0 |
| spring, bloom | Petals +3.2 |
| sea, ocean, beach | Raindrops +3.0 |
| playful, happy, cute | Flowers +2.2 |

Related Chinese keywords are also accepted. These are literal metadata cues. The system does not infer a song's emotion from its sound. A repeated cue does not gain extra points by appearing many times in lyrics.

### Color styling and seasonal evidence

Color styling is direct evidence: a brown outfit or warm cafe does not need a tree, and a pink outfit does not need a flower. The rule samples the entire original photo at 60 × 60 pixels and measures overall color shares plus central patches in a 5 × 5 grid. The central 3 × 3 patches are an approximate clothing area, not clothing segmentation. A small lip color, sticker or tiny accessory cannot satisfy the area requirement on its own.

**Maillard / autumn-winter styling:** count brown pixels at HSL hue 8–45°, saturation 0.13–0.70 and lightness 0.09–0.44; camel pixels at hue 15–48°, saturation 0.12–0.48 and lightness above 0.44 through 0.76; muted taupe pixels at hue 15–55°, saturation 0.04–0.18 and lightness 0.20–0.65. A match requires either brown over 15% of the image with total earth colors over 35%, or brown over 8.5%, one central patch at least 48% brown and total earth colors over 25%. Confidence is 0.72 plus half the whole-image brown share, capped at 0.96. Brown and camel clothes, coffee interiors and a coherent autumn palette can therefore select leaves without botanical recognition. A purely orange sunset is not automatically classified as brown clothing.

**Pink outfit / pink palette:** count light pink pixels at hue 315–360° or 0–12°, saturation at least 0.10 and lightness 0.48–0.88, plus saturated pink/magenta at hue 305–345°, saturation at least 0.30 and lightness 0.32–0.80. A match requires either at least 12% of the whole photo, or at least 4.5% overall plus one central patch at least 35% pink. Confidence is 0.72 plus 0.7 times the whole-image pink share, capped at 0.98. The higher pink weight allows an obvious pink outfit to win even in a cafe or beside the sea.

These color rules run before the optional semantic classifier and still work if the classifier cannot load. Scene and song cues remain additive. Dense matching silhouettes retain the exclusions below. Detection is approximate; the visible shape selector can correct a choice.

Additional semantic cues include autumn scenes and sparse blossom branches. One to three tiles supporting blossom/cherry/sakura at confidence 0.20 provide sparse-blossom evidence: 0.55 for one tile and 0.78 for two or three. Dense flower evidence removes this bonus. Generic foliage alone does not count as repeated leaf silhouettes.

### Repeated-silhouette protection

Four or more supporting tiles mark an element as repeated. Strong full-image flower, forest or sheep evidence also counts. Repeated flowers exclude flower and petal punches; forests exclude tree punches; repeated birds, butterflies and leaves exclude their matching punch. Water does not exclude raindrops: a lake silhouette is not a drop silhouette. These are hard exclusions in automatic mode. An explicit shape selection takes priority and is labeled as a user choice.

All 12 shapes are directly available. Examples labeled **Automatic match** run the rules. Examples labeled **Shape study** intentionally select a visible shape. A study is not presented as a successful automatic prediction.

## 2. Paper color

Sample the entire original image on a 48 × 48 grid before cropping. Ignore nearly neutral pixels (saturation below 0.09), near-black pixels (lightness below 0.07) and near-white pixels (lightness above 0.94) when choosing hue. Group the remaining pixels into 24 hue bins and weight them by saturation and midtone strength. Use the strongest bin's circular mean hue.

Reduce the winning bin's saturation to 56% of its original value, limited to 0.12–0.43. A photo with mean HSL lightness above 0.50 gets dark paper at lightness 0.28; other photos get light paper at 0.82. This keeps a recognizable color relationship while separating the textured photo chips from the paper. If no usable hue exists, use a near-neutral warm hue. The optional Light and Dark overrides use lightness 0.84 and 0.26.

The recipe displays the color and the weighted center of the sampled pixels that contributed to the chosen hue. That coordinate summarizes a distribution; it is not a single eyedropper pixel. Caption ink is warm white on dark paper and charcoal on light paper. Material marks add only fine tonal variation.

## 3. Texture choice

Automatic priority: water → fine sand; forest → linen; flowers/garden → fiber paper; otherwise notes → graph paper, petals → rice paper, leaves → fiber paper, flowers → crayon, and other shapes → woven cloth. Higher-priority scene cues can override a shape's default material.

| Material | Visual construction | Suggested use |
| --- | --- | --- |
| Woven cloth | Fine crossing warp and weft with stable grain | Sky, stars, nostalgic or tactile compositions |
| Linen | Wider irregular threads and fine fibers | Forests, muted greens, calm natural scenes |
| Fiber paper | Short fibers and delicate grain | Gardens, butterflies, leaves |
| Fine sand | Small light and dark granules | Sea, beach, water-themed music |
| Solid color | Untextured flat tone | Busy photos or a minimal composition; manual choice |
| Crayon | Short diagonal wax-like strokes | Playful photos and small flower cutouts |
| Rice paper | Fine, pale fiber texture | Soft spring petals |
| Felt | Dense, short textile marks | A soft, quiet mood; manual choice |
| Graph paper | Fine square grid | Youth, school and note-shaped cutouts |
| Watercolor paper | Grain with broad faint tonal blooms | Soft romantic scenes; manual choice |

Textures are procedural and deterministic. They evoke these materials rather than using a newly photographed material scan. Texture does not animate or flicker independently of the music.

## 4. Exact crop and layout rules

The artwork is **1080 × 1920 (9:16)**, split into two **1080 × 960 (9:8)** panels. Every photo fills its panel edge to edge. No black, gray, white or blurred padding is added. The renderer reads the original photo once, without re-cropping the website's preview.

Use one uniform scale k = max(1080 / image width, 960 / image height) × zoom. Crop only the content extending beyond the panel. Image proportions are preserved. The retained image area is (1080 × 960) / (image width × image height × k²); the studio reports this value. A tall portrait necessarily loses some content when filling a 9:8 panel.

- **Automatic framing:** center landscape images. For portraits without a detected face, move the viewport toward the upper portion of the original photo. When face boxes are available, center the union of the faces horizontally and place its vertical center near 34% of the panel height, clamped to the original image edges. This prioritizes faces while keeping every edge filled.
- **Manual framing:** the horizontal and vertical sliders move through the available crop. Zero shows the left/top edge, 0.5 centers it, and one shows the right/bottom edge. Zoom 1–2 enlarges the photo. Switch to Manual to use the position sliders.
- **Compatibility:** older full-image/contain settings also resolve to a fill crop; they cannot reintroduce padding.

Available face boxes discourage punching over faces. Recognition is approximate and users can adjust the framing. Local face detection is available through Apple Vision; the browser-only classifier used by the hosted version does not supply face boxes.

Raindrops, petals and leaves use **photo above / paper below**. Other shapes use **paper above / photo below**. Holes reveal the same paper material. Each chip contains photo pixels from its corresponding hole.

## 5. Caption placement

The caption always sits on the paper close to the central seam. For paper above the photo, its center is 82 artwork pixels above the seam. For paper below the photo, its center is 82 pixels below the seam. Both orientations reserve a 104-pixel caption band. Upper-paper motion stays outside it. Falling shapes cross both panels and are drawn behind the caption, so they do not disappear at the seam. Thus raindrop captions appear at the top of the lower paper panel.

The caption reveals from left to right over 1.5 seconds, after the paste phase. Blank text skips this stage. The studio accepts up to 100 characters. Text wraps to at most two lines and reduces its size when needed. The style uses the existing light Songti family, with system serif fallbacks; no personalized fonts are introduced.

## 6. Timing and motion

Analyze the complete song with the website's existing WebAudio algorithm, then subtract the selected excerpt start from the detected beat timestamps. The existing analyzer estimates a tempo and phase and returns a regular beat grid; the renderer uses that returned grid unchanged rather than rebuilding timestamps from the rounded display BPM. This is not a neural beat model or a ground-truth beat annotation. The local comparison/demo analysis uses a 44.1 kHz audio context. Small differences between browser/platform audio decoding can affect detection.

1. **Punch:** choose actual beats ending near 3 seconds; use up to six events, distributed across the detected beats. Punch several shapes per event.
2. **Paste:** use subsequent actual beats for approximately another 3 seconds. Place the photo chips into the first formation. For gravity shapes, each chip visibly travels from its original upper-photo hole to the lower composition over 0.9 seconds; caption timing waits for the last arrival.
3. **Caption:** reveal over 1.5 seconds, if present.
4. **Shape motion:** continue for the remainder of the excerpt.

The opening lengths follow available beats rather than forcing an exact three-second cutoff. Too few usable beats trigger a clearly reported untimed fallback; it is not described as synchronized.

**Birds:** open flock → chevron (`>`) → circle → wave → sweeping arc. Each cutout changes its own position. The formations share a center, so the group does not simply slide horizontally. Discrete wing poses complete one slow cycle per two-beat interval.

**Butterflies:** garden scatter → ring → figure eight → spiral → petal rosette. No chevron. Each shape moves between individual destinations, with discrete wing poses.

For birds, butterflies and stars, start one formation change every second returned beat. Ease between destinations over 78% of that two-beat interval, capped at 1.6 seconds, then hold. Nearby destinations are matched between successive formations to reduce long crossings. Position is continuous at the cue: there is no snap to a new formation. Wing poses, star brightness and scale, notes, flowers and trees all use this same two-beat clock. The skipped beat does not start a new gesture.

**Four-, five- and six-point stars, plus moons:** swap between a loose constellation, two constellations, a halo and a diagonal ribbon. Groups vary subtly in opacity and scale over alternate-beat intervals, returning smoothly to rest.

**Raindrops:** release from a real hole in the upper photograph, fall vertically through the seam, and scatter into six small photo chips on every second returned beat in the lower paper. The fall lead is about 1.1–2.2 seconds depending on available beat spacing. Previously pasted chips fade out as this repeated falling phase begins. Different groups rotate through those same alternate-beat impacts; skipped beats have no impact.

**Petals and leaves:** begin at upper-photo hole positions, sway and turn while crossing the seam, and continue below the bottom edge. Release one batch on each alternate-beat cue. Each piece then turns and descends continuously for 4.8–5.92 seconds. A piece can start another fall only at a later cue assigned to its batch after its previous fall has fully finished; there is no teleport or mid-fall reset. Punching and pasting retain the original opening beat schedule.

**Notes:** lift and fold slightly on the shared alternate-beat clock. **Flowers and trees:** use small rocking and lifting gestures on that same clock. These shapes do not use the bird formation sequence.

## 7. Review examples and current release state

Fourteen photo examples cover all twelve shapes. Reality, Touch and the repository's unhappy are retained locally; Midnight Love is omitted. Eight examples run automatic selection; six are explicit shape studies. The color-based examples use existing photos: Maillard cafe (the original cafe photo without stickers), Pink cafe, Pink afternoon and Pink by the sea. They have Shape set to Auto and empty song-cue fields. The four rejected generated images are not included in the material library, examples or source assets.

Within each page, preview and export share the renderer, crop, seed, caption placement and beat timestamps. Offline gallery movies use the standalone studio’s 44.1 kHz analysis; the native page uses the browser’s audio context, which can affect tempo or half-tempo detection. Both use the existing website algorithm.

The examples use the existing parameter drawer. The 58 original library photos remain; 26 selected user photos form the MDP pack (84 total). The user-requested City sky and Mountain air imports have been removed; Desktop originals are untouched. Textures, masks, process screenshots and duplicate exports are excluded. All demo captions are English.

Full photos, thumbnails, image cues and example configuration are included in the source repository with relative URLs. A normal static checkout requires no local photo paths or private analysis server for these photos. Reality and Touch remain local review audio only. Example loading checks whether the optional local review service exists; otherwise it keeps the selected soundtrack or loads repository unhappy. Users can upload their own music. No local review font, runtime, original song or rendered demo video is included in the repository.

The punch export is clean 1080 × 1920 artwork; unrelated effects retain their existing export behavior. This independent feature uses branch `feature/punch-music-refine` and one dedicated PR. The user authorized a source-branch push and PR, with no merge and no website-repository changes. A later website publication must synchronize both root HTML files and their relative resources according to the repository README.
