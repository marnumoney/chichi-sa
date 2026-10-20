# Take Checker

Grades the short ad takes you film on your iPhone against a script. It picks the best take for each shot, trims it, and can stitch the shots together and write captions. Everything runs locally with ffmpeg and faster-whisper (`small.en`). No API keys, nothing uploaded.

## Install (once)

**Mac / Linux:**
```bash
cd take-checker
bash install.sh
```

**Windows (PowerShell):**
```powershell
cd take-checker
powershell -ExecutionPolicy Bypass -File install.ps1
```

The installer works out your OS and installs ffmpeg and Python (Homebrew on Mac; apt/dnf/pacman/zypper on Linux; winget on Windows). It then creates `~/TakeChecker` with `inbox/`, `trimmed/`, `reports/` and `scripts/`, sets up a private virtualenv with faster-whisper, and downloads the Whisper model (~500 MB, one time).

## Use it

1. AirDrop or copy your takes (`.MOV` / `.mp4`) into `~/TakeChecker/inbox/`.
2. Run:
   ```bash
   cd ~/TakeChecker
   python3 take_check.py                      # grade + trim best takes
   python3 take_check.py --stitch             # ...and join them into trimmed/final.mov
   python3 take_check.py --stitch --captions  # ...and write trimmed/final.srt
   ```
3. Open `reports/report.md` and `trimmed/`.

You don't need to name or sort your clips. Each one is matched to the script line it sounds closest to. If you'd rather force a clip onto a shot, put `shot3` in the filename (e.g. `shot3_take2.mov`).

Re-running is cheap: each clip's transcript is cached, so only new clips get transcribed. Add more takes to the inbox and run it again.

## Outputs

| File | What it is |
|---|---|
| `trimmed/Shot{N}_best.mov` | Best take for shot N, cut 0.25s before the first word to 0.5s after the last. Vertical, same codec, bit depth and HDR colour as the original. |
| `trimmed/final.mov` | `--stitch`: all best shots joined back to back. |
| `trimmed/final.srt` | `--captions`: max 4 words per line, split at punctuation, with the script's spelling. |
| `reports/report.md` | One table per shot (take, accuracy %, issues, start/end, verdict), audio and pace stats, and the full transcript of every take. |

## How it judges a take

- **Accuracy:** word match against the script line. Missed, wrong and added words count against it. Same-sounding spellings ("Jim" for "GYM") don't.
- **Delivery:** restarts (repeating part of the line), stutters, cut-off words and fillers (um, uh, and "like" when it isn't in the script).
- **Audio:** integrated loudness (LUFS), peak and clipping, background-noise floor, and any pause over 0.6s mid-sentence.
- **Pace:** words per second, plus when speech starts and ends. Target 3.0; flagged below 2.2 or above 3.8.

**Best take** is decided by accuracy first, then fewest restarts/stumbles/fillers, then cleanest audio, then pace closest to target. The report says why in one line.

Thresholds are constants at the top of `take_check.py`.

## Other ad scripts

A script is a text file with one shot per line, either `SHOT 1: text` or plain lines (numbered in order). Lines starting with `#` are ignored.

```bash
python3 take_check.py --script scripts/dentist_ad.txt --stitch --captions
```

Or replace `script.txt`. Clear out `inbox/` between ads so old takes don't get matched to the new script.

## Burning in the captions

```bash
ffmpeg -i trimmed/final.mov -vf "subtitles=trimmed/final.srt:force_style='Fontsize=18,Bold=1,Alignment=2,MarginV=60'" -c:a copy final_captioned.mov
```
Or import `final.srt` into CapCut, Premiere or DaVinci Resolve.
