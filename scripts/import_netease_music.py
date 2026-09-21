#!/usr/bin/env python3
"""Import user-converted NetEase MP3 files into the lazy-loaded demo library."""

from pathlib import Path
import base64
import json
import re
import shutil
import struct
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/bytedance/Music/网易云音乐")
MUSIC = ROOT / "src" / "music"
AUDIO_DIR = MUSIC / "netease"
COVER_DIR = MUSIC / "covers" / "netease"
LYRIC_DIR = MUSIC / "lyrics" / "netease"

CORE_KEY = "687a4852416d736f356b496e62617857"
META_KEY = "2331346c6a6b5f215c5d2630553c2728"


def aes_decrypt(data: bytes, key_hex: str) -> bytes:
    result = subprocess.run(
        ["openssl", "enc", "-d", "-aes-128-ecb", "-K", key_hex, "-nopad"],
        input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
    ).stdout
    pad = result[-1]
    return result[:-pad] if 0 < pad <= 16 else result


def slug(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return value[:72] or "track"


def decode_ncm(path: Path, output: Path):
    with path.open("rb") as fh:
        if fh.read(8) != b"CTENFDAM":
            raise ValueError(f"Not an NCM file: {path.name}")
        fh.read(2)
        key_len = struct.unpack("<I", fh.read(4))[0]
        encrypted_key = bytes(b ^ 0x64 for b in fh.read(key_len))
        key_data = aes_decrypt(encrypted_key, CORE_KEY)[17:]

        box = bytearray(range(256))
        key_offset = 0
        last = 0
        for i in range(256):
            swap = box[i]
            last = (swap + last + key_data[key_offset]) & 0xFF
            key_offset += 1
            if key_offset >= len(key_data):
                key_offset = 0
            box[i] = box[last]
            box[last] = swap

        meta_len = struct.unpack("<I", fh.read(4))[0]
        meta = {}
        if meta_len:
            encrypted_meta = bytes(b ^ 0x63 for b in fh.read(meta_len))
            decoded = base64.b64decode(encrypted_meta[22:])
            meta_raw = aes_decrypt(decoded, META_KEY)[6:]
            meta = json.loads(meta_raw.decode("utf-8"))

        fh.read(5)
        image_space = struct.unpack("<I", fh.read(4))[0]
        image_len = struct.unpack("<I", fh.read(4))[0]
        fh.read(image_len)
        fh.seek(max(0, image_space - image_len), 1)
        encrypted_audio = fh.read()

    audio = bytearray(len(encrypted_audio))
    for i, value in enumerate(encrypted_audio):
        j = (i + 1) & 0xFF
        audio[i] = value ^ box[(box[j] + box[(box[j] + j) & 0xFF]) & 0xFF]
    output.write_bytes(audio)
    return meta


def estimate_bpm(path: Path) -> int:
    """Small onset-autocorrelation estimate; accurate enough for demo metadata."""
    import numpy as np
    pcm = subprocess.check_output([
        "ffmpeg", "-v", "error", "-ss", "10", "-t", "90", "-i", str(path),
        "-ac", "1", "-ar", "11025", "-f", "f32le", "-",
    ])
    samples = np.frombuffer(pcm, np.float32)
    hop = 220
    frames = len(samples) // hop
    if frames < 20:
        return 120
    samples = samples[:frames * hop].reshape(frames, hop)
    env = np.sqrt(np.mean(samples * samples, axis=1))
    novelty = np.maximum(0, np.diff(env, prepend=env[0]))
    novelty -= novelty.mean()
    best_score, best_bpm = -1.0, 120
    for bpm in range(70, 181):
        lag = max(1, round(60 / (bpm * (hop / 11025))))
        score = float(novelty[lag:] @ novelty[:-lag])
        if score > best_score:
            best_score, best_bpm = score, bpm
    return best_bpm


def copy_cover(track_id, destination):
    candidate = SOURCE / "meta" / f"track-{track_id}.jpg"
    if not candidate.exists():
        return None
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(candidate),
        "-vf", "scale=512:512:force_original_aspect_ratio=increase,crop=512:512",
        "-q:v", "4", str(destination),
    ], check=True)
    return destination


def main():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    COVER_DIR.mkdir(parents=True, exist_ok=True)
    LYRIC_DIR.mkdir(parents=True, exist_ok=True)
    library_path = MUSIC / "library.json"
    library = json.loads(library_path.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in library}

    for source_mp3 in sorted(SOURCE.glob("*.mp3")):
            probe = json.loads(subprocess.check_output([
                "ffprobe", "-v", "error", "-show_entries", "format=duration:format_tags=title,artist,album",
                "-of", "json", str(source_mp3),
            ]))
            tags = probe.get("format", {}).get("tags", {})
            title = str(tags.get("title") or source_mp3.stem.split(" - ", 1)[-1]).strip()
            artist = str(tags.get("artist") or source_mp3.stem.split(" - ", 1)[0]).replace("/", ", ").strip()
            track_id = "netease-" + slug(f"{artist}-{title}")
            if track_id in by_id:
                print(f"skipped existing {artist} — {title}")
                continue
            audio_name = slug(f"{artist}-{title}") + ".mp3"
            audio_path = AUDIO_DIR / audio_name
            subprocess.run([
                "ffmpeg", "-y", "-v", "error", "-i", str(source_mp3),
                "-map_metadata", "-1", "-vn", "-c:a", "libmp3lame", "-b:a", "128k",
                "-ar", "44100", str(audio_path),
            ], check=True)

            source_lrc = SOURCE / (source_mp3.stem + ".lrc")
            lyric_name = slug(f"{artist}-{title}") + ".lrc"
            lyric_path = LYRIC_DIR / lyric_name
            if source_lrc.exists():
                shutil.copy2(source_lrc, lyric_path)

            cover_name = slug(f"{artist}-{title}") + ".jpg"
            cover_path = COVER_DIR / cover_name
            cover_result = subprocess.run([
                "ffmpeg", "-y", "-v", "error", "-i", str(source_mp3), "-an",
                "-map", "0:v:0", "-frames:v", "1", "-vf", "scale=512:512", "-q:v", "3", str(cover_path),
            ])
            if cover_result.returncode or not cover_path.exists():
                cover_path = None
            duration = float(probe.get("format", {}).get("duration") or 0)
            entry = {
                "id": track_id,
                "name": title,
                "artist": artist,
                "genre": str(tags.get("album") or "Vocal").strip(),
                "bpm": estimate_bpm(audio_path),
                "duration": round(duration, 2),
                "audio": f"netease/{audio_name}",
                "cover": f"covers/netease/{cover_name}" if cover_path else "",
                "lyrics": f"lyrics/netease/{lyric_name}" if lyric_path.exists() else "",
                "embed": False,
                "lyricsStatus": "provided" if lyric_path.exists() else "missing",
                "source": "local-user-library",
            }
            if track_id in by_id:
                by_id[track_id].update(entry)
            else:
                library.append(entry)
                by_id[track_id] = entry
            print(f"imported {artist} — {title} ({entry['bpm']} bpm, {duration:.0f}s)")

    library_path.write_text(json.dumps(library, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"library {len(library)} tracks")


if __name__ == "__main__":
    main()
