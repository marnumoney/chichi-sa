#!/usr/bin/env python3
"""Take Checker: grade iPhone ad takes against a script, pick the best take
per shot, auto-trim it, and optionally stitch + caption the final ad.

Usage:
    python3 take_check.py                     # check everything in inbox/
    python3 take_check.py --stitch            # ...and join Shot1..N into final.mov
    python3 take_check.py --stitch --captions # ...and write final.srt
    python3 take_check.py --script scripts/other_ad.txt

Everything runs locally (ffmpeg + faster-whisper "small.en"). No API keys.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

BASE = Path(__file__).resolve().parent

# Re-launch inside the TakeChecker virtualenv if faster-whisper isn't importable
# from whatever `python` the user typed, so `python3 take_check.py` just works.
try:
    import numpy as np
    from faster_whisper import WhisperModel
except ImportError:
    venv = BASE / ".venv"
    for venv_py in (venv / "bin" / "python", venv / "Scripts" / "python.exe"):
        if venv_py.exists() and Path(sys.prefix).resolve() != venv.resolve():
            if os.name == "nt":  # execv on Windows doesn't hand over the console cleanly
                sys.exit(subprocess.call([str(venv_py), __file__, *sys.argv[1:]]))
            os.execv(str(venv_py), [str(venv_py), __file__, *sys.argv[1:]])
    sys.exit("faster-whisper isn't installed. Run the installer first (install.sh / install.ps1).")

# ---------------------------------------------------------------- settings
MODEL_NAME = "small.en"
VIDEO_EXTS = {".mov", ".mp4", ".m4v"}
LEAD_IN = 0.25           # seconds kept before the first word
TAIL_OUT = 0.50          # seconds kept after the last word
PAUSE_LIMIT = 0.6        # mid-sentence gap that gets flagged
TARGET_WPS = 3.0         # ideal pace for punchy short-form ads
SLOW_WPS, FAST_WPS = 2.2, 3.8
QUIET_LUFS, LOUD_LUFS = -30.0, -10.0
NOISY_DBFS, VERY_NOISY_DBFS = -50.0, -40.0
MUMBLE_PROB = 0.40       # whisper word confidence below this is flagged
FILLERS = {"um", "umm", "uh", "uhh", "uhm", "er", "erm", "ah", "hmm", "mm", "mhm"}
SOFT_FILLERS = {"like"}  # only a filler when it isn't in the script at that spot
FILLER_PROMPT = "Umm, so, uh, I mean, like, you know, I was, uh, thinking..."


# ---------------------------------------------------------------- helpers
def run(cmd: list[str], capture=True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=capture, text=True)


def need(tool: str):
    if not shutil.which(tool):
        sys.exit(f"'{tool}' not found on PATH. Run the installer first (install.sh / install.ps1).")


def norm(word: str) -> str:
    w = word.lower().replace("\u2019", "'").replace("\u2018", "'")
    w = re.sub(r"[^a-z0-9'\-]", "", w)
    return w.strip("'")


def fmt_t(sec: float) -> str:
    return f"{sec:.2f}s"


def srt_t(sec: float) -> str:
    ms = int(round(max(sec, 0) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def load_script(path: Path) -> dict[int, str]:
    """Accepts `SHOT 3: text` lines, or plain lines (numbered in order).
    Blank lines and lines starting with # are ignored."""
    if not path.exists():
        sys.exit(f"Script not found: {path}")
    shots, n = {}, 0
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^shot\s*(\d+)\s*[:.\-)]\s*(.+)$", line, re.I)
        if m:
            n = int(m.group(1))
            shots[n] = m.group(2).strip()
        else:
            n += 1
            shots[n] = line
    if not shots:
        sys.exit(f"No shots found in {path}")
    return dict(sorted(shots.items()))


def tokens(text: str) -> list[str]:
    return [t for t in (norm(w) for w in text.split()) if t]


def sound(tok: str) -> str:
    """Rough phonetic key so same-sounding spellings match (gym/jim, ok/okay)."""
    t = {"okay": "ok", "alright": "allright"}.get(tok, tok).replace("'", "").replace("-", "")
    for a, b in (("ph", "f"), ("ck", "k"), ("wh", "w"), ("gh", "g")):
        t = t.replace(a, b)
    t = re.sub(r"g(?=[eiy])", "j", t)
    t = re.sub(r"c(?=[eiy])", "s", t)
    t = t.replace("c", "k").replace("y", "i")
    t = re.sub(r"(.)\1+", r"\1", t)
    return t


# ---------------------------------------------------------------- media probing
def probe(path: Path) -> dict:
    out = run(["ffprobe", "-v", "error", "-print_format", "json",
               "-show_streams", "-show_format", str(path)]).stdout
    return json.loads(out or "{}")


def video_info(path: Path) -> dict:
    info = probe(path)
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    a = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), None)
    if not v:
        return {}
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(float(sd["rotation"]))
    rot = int(v.get("tags", {}).get("rotate", rot))
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) % 180 == 90:
        w, h = h, w
    num, den = (v.get("avg_frame_rate") or v.get("r_frame_rate") or "30/1").split("/")
    fps = float(num) / float(den) if float(den) else 30.0
    return {
        "codec": v.get("codec_name"), "pix_fmt": v.get("pix_fmt", "yuv420p"),
        "width": w, "height": h, "fps": fps, "fps_str": v.get("r_frame_rate", "30/1"),
        "color_primaries": v.get("color_primaries"), "color_transfer": v.get("color_transfer"),
        "color_space": v.get("color_space"), "color_range": v.get("color_range"),
        "has_audio": a is not None,
        "audio_rate": int(a.get("sample_rate", 48000)) if a else 48000,
        "audio_channels": int(a.get("channels", 1)) if a else 0,
        "duration": float(info.get("format", {}).get("duration", 0) or 0),
    }


def have_encoder(name: str) -> bool:
    return name in run(["ffmpeg", "-hide_banner", "-encoders"]).stdout


def encode_args(vi: dict) -> list[str]:
    """High-quality re-encode that keeps the source codec family, bit depth and
    colour tags (iPhone HDR/HLG survives). Rotation is baked into the pixels so
    vertical clips stay vertical in every player."""
    tenbit = "10" in (vi.get("pix_fmt") or "")
    if vi.get("codec") == "hevc" and have_encoder("libx265"):
        args = ["-c:v", "libx265", "-preset", "medium", "-crf", "16", "-tag:v", "hvc1",
                "-x265-params", "log-level=error",
                "-pix_fmt", "yuv420p10le" if tenbit else "yuv420p"]
    else:
        # 8-bit H.264: 10-bit H.264 barely plays anywhere.
        args = ["-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p"]
    for key, flag in (("color_primaries", "-color_primaries"), ("color_transfer", "-color_trc"),
                      ("color_space", "-colorspace"), ("color_range", "-color_range")):
        if vi.get(key) and vi[key] != "unknown":
            args += [flag, vi[key]]
    return args + ["-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart"]


# ---------------------------------------------------------------- transcription
_model = None


def model() -> WhisperModel:
    global _model
    if _model is None:
        print(f"Loading Whisper model '{MODEL_NAME}' (first run downloads ~500 MB)...")
        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    return _model


def transcribe(path: Path, cache_dir: Path) -> list[dict]:
    """Word list [{word, start, end, prob}], cached by file content fingerprint."""
    st = path.stat()
    key = hashlib.sha1(f"{path.name}|{st.st_size}|{st.st_mtime_ns}|{MODEL_NAME}".encode()).hexdigest()[:16]
    cache = cache_dir / f"{path.stem}.{key}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    # Decode with ffmpeg ourselves (first audio track, 16 kHz mono): sidesteps
    # PyAV version breakage and iPhone files with extra spatial-audio tracks.
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0", "-ac", "1",
                          "-ar", "16000", "-f", "f32le", "-acodec", "pcm_f32le", "-"],
                         capture_output=True).stdout
    audio = np.frombuffer(raw, dtype=np.float32)
    if audio.size == 0:
        return []
    segments, _ = model().transcribe(
        audio, language="en", word_timestamps=True, beam_size=5,
        condition_on_previous_text=False, initial_prompt=FILLER_PROMPT, vad_filter=False,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            if w.word.strip():
                words.append({"word": w.word.strip(), "start": round(w.start, 3),
                              "end": round(w.end, 3), "prob": round(w.probability, 3)})
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(words))
    return words


# ---------------------------------------------------------------- scoring
@dataclass
class Take:
    file: Path
    words: list
    shot: int | None = None
    match_score: float = 0.0
    accuracy: float = 0.0
    missed: list = field(default_factory=list)
    added: list = field(default_factory=list)
    wrong: list = field(default_factory=list)
    restarts: list = field(default_factory=list)
    stumbles: list = field(default_factory=list)
    fillers: list = field(default_factory=list)
    mumbled: list = field(default_factory=list)
    pauses: list = field(default_factory=list)
    speech_start: float = 0.0
    speech_end: float = 0.0
    wps: float = 0.0
    lufs: float | None = None
    peak_db: float | None = None
    clipped: int = 0
    noise_db: float | None = None
    snr_db: float | None = None
    audio_flags: list = field(default_factory=list)
    pace_flag: str = ""
    verdict: str = ""

    @property
    def name(self):
        return self.file.name

    @property
    def delivery_issues(self):
        return len(self.restarts) + len(self.stumbles) + len(self.fillers)

    @property
    def audio_score(self):
        score = 0
        for f in self.audio_flags:
            score += 3 if f.startswith("CLIPPING") else 2 if f.startswith("heavy") else 1
        return score + len(self.pauses)

    @property
    def pace_dev(self):
        return abs(self.wps - TARGET_WPS)


def content_words(words: list[dict]) -> list[tuple[str, int]]:
    """(normalized token, index into words) with hard fillers & partials removed."""
    out = []
    for i, w in enumerate(words):
        t = norm(w["word"])
        if not t or t in FILLERS or t.endswith("-"):
            continue
        out.append((t, i))
    return out


def match_shot(words: list[dict], shots: dict[int, str], hint: int | None) -> tuple[int | None, float]:
    hyp = [sound(t) for t, _ in content_words(words)]
    best, best_score = None, 0.0
    for n, text in shots.items():
        score = difflib.SequenceMatcher(None, [sound(t) for t in tokens(text)], hyp, autojunk=False).ratio()
        if score > best_score:
            best, best_score = n, score
    if hint in shots:
        ref = [sound(t) for t in tokens(shots[hint])]
        return hint, difflib.SequenceMatcher(None, ref, hyp, autojunk=False).ratio()
    return (best, best_score) if best_score >= 0.35 else (None, best_score)


def contains_run(haystack: list[str], needle: list[str]) -> bool:
    k = len(needle)
    return any(haystack[i:i + k] == needle for i in range(len(haystack) - k + 1))


def score_words(take: Take, script_text: str):
    ref = tokens(script_text)
    words = take.words
    for w in words:
        t = norm(w["word"])
        if t in FILLERS:
            take.fillers.append(f"'{t}' @ {fmt_t(w['start'])}")
        elif t.endswith("-") and len(t) > 1:
            take.stumbles.append(f"cut-off '{w['word'].strip()}' @ {fmt_t(w['start'])}")
    cw = content_words(words)
    hyp = [t for t, _ in cw]
    ref_s, hyp_s = [sound(t) for t in ref], [sound(t) for t in hyp]
    sm = difflib.SequenceMatcher(None, ref_s, hyp_s, autojunk=False)
    errors = 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        ref_span, hyp_span = ref[i1:i2], hyp[j1:j2]
        at = fmt_t(words[cw[j1][1]]["start"]) if j1 < len(cw) else "end"
        if op == "delete":
            take.missed.append(" ".join(ref_span))
            errors += len(ref_span)
        elif op == "insert":
            seg = " ".join(hyp_span)
            if all(t in SOFT_FILLERS for t in hyp_span):
                take.fillers.append(f"'{seg}' @ {at}")
            elif contains_run(ref_s, hyp_s[j1:j2]):
                # The speaker repeated part of the script: a restart (2+ words) or a stutter.
                (take.restarts if len(hyp_span) >= 2 else take.stumbles).append(
                    f"{'restart' if len(hyp_span) >= 2 else 'repeated'} '{seg}' @ {at}")
            else:
                take.added.append(f"'{seg}' @ {at}")
                errors += len(hyp_span)
        else:  # replace
            take.wrong.append(f"'{' '.join(ref_span)}' -> '{' '.join(hyp_span)}' @ {at}")
            errors += max(len(ref_span), len(hyp_span))
    take.accuracy = max(0.0, 100.0 * (1 - errors / max(len(ref), 1)))
    take.mumbled = [f"'{w['word'].strip()}' ({w['prob']:.0%})" for w in words
                    if w["prob"] < MUMBLE_PROB and norm(w["word"]) not in FILLERS]


def score_timing(take: Take):
    words = take.words
    take.speech_start, take.speech_end = words[0]["start"], words[-1]["end"]
    spoken = [w for w in words if norm(w["word"]) not in FILLERS]
    dur = max(take.speech_end - take.speech_start, 0.01)
    take.wps = len(spoken) / dur
    for a, b in zip(words, words[1:]):
        gap = b["start"] - a["end"]
        if gap > PAUSE_LIMIT and not re.search(r"[.!?]['\"\u2019]?$", a["word"].strip()):
            take.pauses.append(f"{gap:.2f}s after '{a['word'].strip()}' @ {fmt_t(a['end'])}")
    if take.wps < SLOW_WPS:
        take.pace_flag = f"slow ({take.wps:.1f} w/s)"
    elif take.wps > FAST_WPS:
        take.pace_flag = f"fast ({take.wps:.1f} w/s)"


def score_audio(take: Take, vi: dict):
    if not vi.get("has_audio"):
        take.audio_flags.append("no audio track")
        return
    # Loudness (EBU R128 integrated) via ffmpeg.
    log = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(take.file), "-map", "0:a:0",
               "-af", "ebur128=peak=sample", "-f", "null", "-"]).stderr
    summary = log[log.rfind("Summary:"):] if "Summary:" in log else log
    m = re.search(r"I:\s*(-?[\d.]+|-inf)\s*LUFS", summary)
    take.lufs = float(m.group(1)) if m and m.group(1) != "-inf" else None
    # Raw samples for peak / clipping / noise floor.
    ch = max(vi.get("audio_channels", 1), 1)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(take.file), "-map", "0:a:0",
                          "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "48000", "-"],
                         capture_output=True).stdout
    samples = np.frombuffer(raw, dtype=np.float32)
    if samples.size == 0:
        take.audio_flags.append("audio track is empty")
        return
    samples = samples[: samples.size - samples.size % ch].reshape(-1, ch)
    peak = float(np.max(np.abs(samples)))
    take.peak_db = 20 * np.log10(max(peak, 1e-9))
    take.clipped = int(np.sum(np.abs(samples) >= 0.999))
    mono = samples.mean(axis=1)
    sr, hop = 48000, 480  # 10 ms frames
    n = mono.size // hop
    rms = np.sqrt(np.mean(mono[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    speech = np.zeros(n, dtype=bool)
    for w in take.words:
        speech[int(w["start"] * sr / hop): int(w["end"] * sr / hop) + 1] = True
    # Keep a 100 ms guard band around speech out of the noise estimate.
    guard = np.convolve(speech.astype(int), np.ones(21, dtype=int), mode="same") > 0
    quiet = db[~guard]
    take.noise_db = float(np.percentile(quiet, 50)) if quiet.size >= 20 else float(np.percentile(db, 10))
    # Silences inside the speech window. Whisper often stretches a word across a
    # pause, so word gaps alone miss them; the audio level doesn't lie.
    voiced = db[speech[:n]]
    loud = float(np.percentile(voiced, 75)) if voiced.size else -20.0
    thresh = max(take.noise_db + 6, loud - 30)
    lo, hi = int(take.speech_start * sr / hop), min(int(take.speech_end * sr / hop), n)
    silent = db[lo:hi] < thresh
    run_start = None
    for k, s in enumerate(np.append(silent, False)):
        if s and run_start is None:
            run_start = k
        elif not s and run_start is not None:
            t0, t1 = (lo + run_start) * hop / sr, (lo + k) * hop / sr
            run_start = None
            if t1 - t0 <= PAUSE_LIMIT:
                continue
            before = [w for w in take.words if w["end"] <= t0 + 0.1]
            if not before or re.search(r"[.!?]['\"\u2019]?$", before[-1]["word"].strip()):
                continue
            if any(abs(float(p.split("@ ")[-1].rstrip("s")) - t0) < 0.4 for p in take.pauses):
                continue  # already caught by the word-gap check
            take.pauses.append(f"{t1 - t0:.2f}s after '{before[-1]['word'].strip()}' @ {fmt_t(t0)}")
    if voiced.size:
        take.snr_db = loud - take.noise_db

    if take.clipped > 3:
        take.audio_flags.append(f"CLIPPING ({take.clipped} samples at full scale)")
    elif take.peak_db > -0.5:
        take.audio_flags.append(f"peaks near 0 dBFS ({take.peak_db:.1f})")
    if take.lufs is not None and take.lufs < QUIET_LUFS:
        take.audio_flags.append(f"quiet ({take.lufs:.1f} LUFS)")
    if take.lufs is not None and take.lufs > LOUD_LUFS:
        take.audio_flags.append(f"very loud ({take.lufs:.1f} LUFS)")
    if take.noise_db > VERY_NOISY_DBFS:
        take.audio_flags.append(f"heavy background noise ({take.noise_db:.0f} dBFS)")
    elif take.noise_db > NOISY_DBFS:
        take.audio_flags.append(f"background noise ({take.noise_db:.0f} dBFS)")


def issues_text(t: Take) -> str:
    parts = []
    if t.missed:
        parts.append("missed: " + ", ".join(f"'{m}'" for m in t.missed))
    if t.wrong:
        parts.append("wrong: " + ", ".join(t.wrong))
    if t.added:
        parts.append("added: " + ", ".join(t.added))
    if t.restarts:
        parts.append("restarts: " + ", ".join(t.restarts))
    if t.stumbles:
        parts.append("stumbles: " + ", ".join(t.stumbles))
    if t.fillers:
        parts.append("fillers: " + ", ".join(t.fillers))
    if t.pauses:
        parts.append("long pause: " + ", ".join(t.pauses))
    parts += t.audio_flags
    if t.pace_flag:
        parts.append(t.pace_flag)
    if t.mumbled:
        parts.append("unclear: " + ", ".join(t.mumbled))
    return "; ".join(parts) or "clean"


def rank_key(t: Take):
    return (-round(t.accuracy, 1), t.delivery_issues, t.audio_score, round(t.pace_dev, 2))


def why_best(best: Take, others: list[Take]) -> str:
    if not others:
        return f"only take for this shot ({best.accuracy:.0f}% accurate, {issues_text(best)})."
    r = others[0]
    if round(best.accuracy, 1) > round(r.accuracy, 1):
        return f"most accurate: {best.accuracy:.0f}% vs {r.accuracy:.0f}% for {r.name}."
    if best.delivery_issues < r.delivery_issues:
        return (f"same accuracy as {r.name} but cleaner delivery "
                f"({best.delivery_issues} restarts/stumbles/fillers vs {r.delivery_issues}).")
    if best.audio_score < r.audio_score:
        return f"ties {r.name} on words and delivery, but has cleaner audio ({', '.join(r.audio_flags + ['long pause ' + p for p in r.pauses]) or 'fewer issues'} on the other)."
    return f"ties {r.name} on words, delivery and audio; pace is closer to target ({best.wps:.1f} vs {r.wps:.1f} w/s)."


# ---------------------------------------------------------------- ffmpeg output
def trim(take: Take, out: Path, vi: dict) -> tuple[float, float]:
    start = max(take.speech_start - LEAD_IN, 0.0)
    end = take.speech_end + TAIL_OUT
    if vi.get("duration"):
        end = min(end, vi["duration"])
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
           "-i", str(take.file), "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "0",
           *encode_args(vi), str(out)]
    res = run(cmd)
    if res.returncode != 0:
        raise RuntimeError(f"ffmpeg trim failed for {take.name}:\n{res.stderr}")
    return start, end


def stitch_clips(trimmed: Path, best_info: dict) -> list[tuple[int, Path]]:
    shots = sorted(int(k) for k in best_info)
    return [(n, trimmed / f"Shot{n}_best.mov") for n in shots if (trimmed / f"Shot{n}_best.mov").exists()]


def stitch(trimmed: Path, best_info: dict, all_shots: list[int]) -> Path:
    clips = [c for _, c in stitch_clips(trimmed, best_info)]
    if not clips:
        sys.exit("No Shot*_best.mov files to stitch. Run without --stitch first.")
    missing = [n for n in all_shots if str(n) not in best_info]
    if missing:
        print(f"  ! no good take yet for shot(s) {missing}; stitching the shots that exist.")
    ref = video_info(clips[0])
    W, H, fps = ref["width"], ref["height"], ref["fps_str"]
    inputs, chains, pads = [], [], []
    for i, c in enumerate(clips):
        inputs += ["-i", str(c)]
        chains.append(f"[{i}:v:0]scale={W}:{H}:force_original_aspect_ratio=decrease,"
                      f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},settb=AVTB,"
                      f"setpts=PTS-STARTPTS[v{i}]")
        # Pad/trim audio to exactly the video length so shots butt together with no drift.
        vdur = video_info(c)["duration"]
        chains.append(f"[{i}:a:0]aresample=48000,aformat=channel_layouts=stereo,"
                      f"apad,atrim=0:{vdur:.3f},asetpts=PTS-STARTPTS[a{i}]")
        pads.append(f"[v{i}][a{i}]")
    graph = ";".join(chains) + f";{''.join(pads)}concat=n={len(clips)}:v=1:a=1[v][a]"
    out = trimmed / "final.mov"
    res = run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", graph,
               "-map", "[v]", "-map", "[a]", *encode_args(ref), str(out)])
    if res.returncode != 0:
        sys.exit(f"ffmpeg stitch failed:\n{res.stderr}")
    return out


def chunk(n_words: int, size: int = 4) -> list[int]:
    """Split a phrase into balanced pieces of <= size words (5 -> 3+2, not 4+1)."""
    parts = -(-n_words // size)
    base, extra = divmod(n_words, parts)
    return [base + (1 if i < extra else 0) for i in range(parts)]


def captions(final: Path, shots_text: dict[int, str], best_info: dict, trimmed: Path) -> Path:
    """SRT for final.mov built from each best take's word timings, shifted to
    where that shot sits in the stitched video, with the script's spelling."""
    timed, offset = [], 0.0
    for n, clip in stitch_clips(trimmed, best_info):
        b = best_info[str(n)]
        words = [w for w in b.get("words", []) if norm(w["word"]) not in FILLERS]
        ref_raw = shots_text[n].split()
        ref = [sound(norm(w)) for w in ref_raw]
        hyp = [sound(norm(w["word"])) for w in words]
        display = [w["word"].strip() for w in words]
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_opcodes():
            if op in ("equal", "replace") and (i2 - i1) == (j2 - j1):
                for k in range(i2 - i1):
                    display[j1 + k] = ref_raw[i1 + k]
        dur = video_info(clip)["duration"]
        for w, text in zip(words, display):
            t0 = offset + max(w["start"] - b["cut_start"], 0.0)
            t1 = offset + min(w["end"] - b["cut_start"], dur)
            timed.append({"text": text, "start": t0, "end": max(t1, t0 + 0.05)})
        offset += dur
    # Phrases end at punctuation or a real pause; each phrase is split evenly.
    phrases, cur = [], []
    for i, w in enumerate(timed):
        cur.append(w)
        last = i == len(timed) - 1
        if last or re.search(r"[.,!?;:]['\"\u2019]?$", w["text"]) or \
                timed[i + 1]["start"] - w["end"] > PAUSE_LIMIT:
            phrases.append(cur)
            cur = []
    cues = []
    for ph in phrases:
        i = 0
        for size in chunk(len(ph)):
            cues.append(ph[i:i + size])
            i += size
    lines = []
    for n, cue in enumerate(cues, 1):
        start, end = cue[0]["start"], cue[-1]["end"] + 0.15
        if n < len(cues):
            end = min(end, cues[n][0]["start"])
        text = " ".join(w["text"] for w in cue)
        lines.append(f"{n}\n{srt_t(start)} --> {srt_t(end)}\n{text}\n")
    out = final.with_suffix(".srt")
    out.write_text("\n".join(lines), encoding="utf-8")
    return out


# ---------------------------------------------------------------- report
def md_cell(s: str) -> str:
    return s.replace("|", "\\|").replace("\n", " ")


def write_report(path: Path, script_path: Path, shots: dict[int, str], by_shot: dict[int, list[Take]],
                 unmatched: list[Take], best_info: dict):
    L = ["# Take Checker report", "",
         f"- Script: `{script_path.name}`",
         f"- Generated: {time.strftime('%Y-%m-%d %H:%M')}",
         f"- Target pace: {TARGET_WPS} words/sec (flag below {SLOW_WPS} or above {FAST_WPS})", ""]
    for n, text in shots.items():
        L += [f"## Shot {n}", "", f"> {text}", ""]
        takes = by_shot.get(n, [])
        if not takes:
            L += ["_No takes yet._", ""]
            continue
        L += ["| Take | Accuracy | Issues | Start / End | Verdict |", "|---|---|---|---|---|"]
        for t in takes:
            L.append(f"| {md_cell(t.name)} | {t.accuracy:.0f}% | {md_cell(issues_text(t))} | "
                     f"{fmt_t(t.speech_start)} / {fmt_t(t.speech_end)} | {md_cell(t.verdict)} |")
        L.append("")
        b = best_info.get(str(n))
        if b:
            L += [f"**Best:** {b['take']} -> `trimmed/Shot{n}_best.mov` "
                  f"(cut {fmt_t(b['cut_start'])} to {fmt_t(b['cut_end'])}). {b['why']}", ""]
        L += ["| Take | Pace | Loudness | Peak | Noise floor | SNR |", "|---|---|---|---|---|---|"]
        for t in takes:
            L.append(f"| {md_cell(t.name)} | {t.wps:.1f} w/s | "
                     f"{'n/a' if t.lufs is None else f'{t.lufs:.1f} LUFS'} | "
                     f"{'n/a' if t.peak_db is None else f'{t.peak_db:.1f} dBFS'} | "
                     f"{'n/a' if t.noise_db is None else f'{t.noise_db:.0f} dBFS'} | "
                     f"{'n/a' if t.snr_db is None else f'{t.snr_db:.0f} dB'} |")
        L.append("")
    if unmatched:
        L += ["## Unmatched clips", "", "These didn't match any line in the script closely enough:", ""]
        for t in unmatched:
            L.append(f"- **{t.name}** (best match {t.match_score:.0%}): "
                     f"{' '.join(w['word'] for w in t.words) or '(no speech detected)'}")
        L.append("")
    L += ["## Full transcripts", ""]
    for n in shots:
        for t in by_shot.get(n, []):
            L += [f"### Shot {n}: {t.name}", "", " ".join(w["word"] for w in t.words), ""]
    path.write_text("\n".join(L), encoding="utf-8")


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description="Grade ad takes against a script and trim the best one per shot.")
    ap.add_argument("--script", default="script.txt", help="script file (default: script.txt)")
    ap.add_argument("--dir", default=str(BASE), help="TakeChecker folder (default: this script's folder)")
    ap.add_argument("--stitch", action="store_true", help="join Shot1_best..ShotN_best into trimmed/final.mov")
    ap.add_argument("--captions", action="store_true", help="write trimmed/final.srt (max 4 words per line)")
    args = ap.parse_args()

    need("ffmpeg"), need("ffprobe")
    root = Path(args.dir).expanduser().resolve()
    inbox, trimmed, reports = root / "inbox", root / "trimmed", root / "reports"
    for d in (inbox, trimmed, reports):
        d.mkdir(parents=True, exist_ok=True)
    cache = reports / ".cache"
    script_path = Path(args.script).expanduser()
    if not script_path.is_absolute():
        script_path = (Path.cwd() / script_path) if (Path.cwd() / script_path).exists() else root / script_path
    shots = load_script(script_path)

    clips = sorted(p for p in inbox.iterdir() if p.suffix.lower() in VIDEO_EXTS and not p.name.startswith("."))
    if not clips:
        sys.exit(f"No .mov/.mp4 files in {inbox}. Drop your takes there and run again.")
    print(f"Script: {script_path.name} ({len(shots)} shots) | {len(clips)} clip(s) in inbox/\n")

    by_shot: dict[int, list[Take]] = {}
    unmatched: list[Take] = []
    infos: dict[Path, dict] = {}
    for clip in clips:
        print(f"- {clip.name}: transcribing...", end="", flush=True)
        vi = infos[clip] = video_info(clip)
        words = transcribe(clip, cache) if vi else []
        take = Take(file=clip, words=words)
        if not words:
            print(" no speech found.")
            unmatched.append(take)
            continue
        hint = re.search(r"shot[\s_\-]*(\d+)", clip.stem, re.I)
        take.shot, take.match_score = match_shot(words, shots, int(hint.group(1)) if hint else None)
        if take.shot is None:
            print(f" couldn't match it to a script line ({take.match_score:.0%}).")
            unmatched.append(take)
            continue
        score_words(take, shots[take.shot])
        score_timing(take)
        score_audio(take, vi)
        by_shot.setdefault(take.shot, []).append(take)
        print(f" Shot {take.shot}, {take.accuracy:.0f}% accurate")

    best_path = reports / "best.json"
    best_info = json.loads(best_path.read_text()) if best_path.exists() else {}
    best_info = {k: v for k, v in best_info.items() if v.get("script") == script_path.name}
    print()
    for n in shots:
        takes = by_shot.get(n)
        if not takes:
            continue
        takes.sort(key=rank_key)
        best = takes[0]
        why = why_best(best, takes[1:])
        best.verdict = "BEST: " + why
        for t in takes[1:]:
            t.verdict = "-"
        out = trimmed / f"Shot{n}_best.mov"
        print(f"Shot {n}: best = {best.name}. {why}\n         trimming -> trimmed/{out.name} ...", flush=True)
        cut_start, cut_end = trim(best, out, infos[best.file])
        best_info[str(n)] = {"take": best.name, "cut_start": cut_start, "cut_end": cut_end,
                             "why": why, "script": script_path.name, "words": best.words}
    best_path.write_text(json.dumps(best_info, indent=2))

    report = reports / "report.md"
    write_report(report, script_path, shots, by_shot, unmatched, best_info)
    print(f"\nReport: {report}")

    if args.stitch or args.captions:
        final = trimmed / "final.mov"
        if args.stitch or not final.exists():
            print("Stitching shots -> trimmed/final.mov ...", flush=True)
            final = stitch(trimmed, best_info, list(shots))
            print(f"Final video: {final}")
        if args.captions:
            srt = captions(final, shots, best_info, trimmed)
            print(f"Captions: {srt}")


if __name__ == "__main__":
    main()
