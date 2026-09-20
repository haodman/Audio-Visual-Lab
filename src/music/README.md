# Test music pack

Each track is declared in `library.json` and contains:

- `audio`: MP3/M4A/WAV/OGG file relative to this directory.
- `cover`: square JPEG cover. The current pack uses matched official release artwork sourced from Apple Music.
- `lyrics`: UTF-8 LRC timeline.
- `name`, `artist`, `genre`: display and effect metadata.

To add a track:

1. Copy the audio file into this directory with a short ASCII filename.
2. Add a square cover under `covers/`.
3. Add an LRC file under `lyrics/`. Licensed full lyrics can replace the included structural cue placeholders.
4. Add one object to `library.json`.
5. Run `python3 build.py` from `src/`.

`build.py` embeds the test pack into `music-fx-lab.html`, so the HTML still works when opened directly from disk. Effects can read the active music data through:

```js
MFX_MUSIC.currentTrack()
MFX_MUSIC.lyricAt(timeInSeconds)
MFX_MUSIC.lyrics()
```
