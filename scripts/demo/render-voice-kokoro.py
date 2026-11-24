#!/usr/bin/env python3
"""
Renders the demo's sample recording with Kokoro, a free neural voice, and writes word timings that match it.
Run with a throwaway venv outside the repo (Kokoro is never an app dependency):

  /opt/homebrew/bin/python3.12 -m venv ~/.spectr-tts
  ~/.spectr-tts/bin/pip install kokoro soundfile      # needs: brew install espeak-ng ffmpeg
  ~/.spectr-tts/bin/python scripts/demo/render-voice-kokoro.py [--out DIR]

1. Reads TOUR_PLAY.sampleRecording.chunks from src/demo/seed/content.ts.
2. Renders each chunk as its own clip (voice am_michael, speed 0.97), trims the silence at its edges, and joins
   the clips in order with a 220 ms pause between them, so every chunk's real start time is known.
3. Word timings: Kokoro's own per word timestamps inside each clip. If a clip has none, words are spaced by
   character count across that clip.
4. Loudness is normalized to -16 LUFS and encoded to AAC 128k mono 44.1 kHz:
   public/demo/sample-recording.m4a (under 1 MB).
5. Writes src/demo/seed/sampleRecordingTimings.json, and updates the chunks' delayMs and durationSeconds in
   content.ts so they match the audio.
6. Checks the timings against the waveform: every chunk start must be within 300 ms of where the voice resumes.
"""
import argparse, json, os, re, subprocess, sys, tempfile

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTENT = os.path.join(ROOT, "src/demo/seed/content.ts")
VOICE, SPEED, SR = "am_michael", 0.97, 24000
PAUSE_S = 0.22
EDGE_DB = -45  # silence threshold for trimming clip edges


def chunks_from_content():
    src = open(CONTENT, encoding="utf8").read()
    block = src[src.index("sampleRecording:") : src.index("outputs:")]
    return [t.strip() for t in re.findall(r'text:\s*"([^"]*)"', block)]


def trim(audio):
    """Index range of the clip without silence at its edges (keeps 30 ms either side)."""
    thr = 10 ** (EDGE_DB / 20) * float(np.max(np.abs(audio)) or 1)
    loud = np.where(np.abs(audio) > thr)[0]
    if not len(loud):
        return 0, len(audio)
    pad = int(0.03 * SR)
    return max(0, loud[0] - pad), min(len(audio), loud[-1] + pad)


def render(pipe, text):
    """Audio for one chunk plus [(word, start_seconds)] measured from the start of that audio."""
    parts, words, offset = [], [], 0.0
    for res in pipe(text, voice=VOICE, speed=SPEED):
        audio = res.audio.numpy() if hasattr(res.audio, "numpy") else np.asarray(res.audio)
        for tok in getattr(res, "tokens", None) or []:
            st = getattr(tok, "start_ts", None)
            if st is not None and re.search(r"\w", tok.text or ""):
                words.append((tok.text, offset + float(st)))
        parts.append(audio)
        offset += len(audio) / SR
    return np.concatenate(parts), words


def spread_by_chars(text, start, dur):
    ws = text.split()
    total = sum(len(w) + 1 for w in ws)
    out, t = [], start
    for w in ws:
        out.append((w, t))
        t += dur * (len(w) + 1) / total
    return out


def onsets(audio, frame=0.01, min_quiet=0.12):
    step = int(SR * frame)
    lv = np.array([np.sqrt(np.mean(audio[i : i + step] ** 2)) for i in range(0, len(audio), step)])
    thr = np.quantile(lv, 0.9) * 0.05
    out, quiet = [], 0
    for i, v in enumerate(lv):
        if v < thr:
            quiet += 1
        else:
            if quiet * frame >= min_quiet:
                out.append(i * frame)
            quiet = 0
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=ROOT, help="write outputs under this root instead of the repo")
    args = ap.parse_args()
    audio_out = os.path.join(args.out, "public/demo/sample-recording.m4a")
    json_out = os.path.join(args.out, "src/demo/seed/sampleRecordingTimings.json")
    os.makedirs(os.path.dirname(audio_out), exist_ok=True)
    os.makedirs(os.path.dirname(json_out), exist_ok=True)

    chunks = chunks_from_content()
    pipe = KPipeline(lang_code="a")
    pause = np.zeros(int(PAUSE_S * SR), dtype=np.float32)
    track, words, starts, t = [], [], [], 0.0
    for k, text in enumerate(chunks):
        audio, ws = render(pipe, text)
        a, b = trim(audio)
        clip = audio[a:b].astype(np.float32)
        lead = a / SR
        dur = len(clip) / SR
        if k:
            track.append(pause)
            t += PAUSE_S
        starts.append(t)
        mine = text.split()
        # Use Kokoro's timestamps when they line up one to one with the chunk's words.
        if len(ws) == len(mine):
            words += [(w, t + max(0.0, s - lead)) for w, (_, s) in zip(mine, ws)]
            src = "kokoro"
        else:
            words += spread_by_chars(text, t, dur)
            src = f"chars ({len(ws)} timestamps for {len(mine)} words)"
        print(f"chunk {k + 1}: {dur:.2f}s at {t:.2f}s, timings from {src}")
        track.append(clip)
        t += dur
    full = np.concatenate(track)
    total = len(full) / SR

    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "take.wav")
        sf.write(wav, full, SR)
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-ar", "44100", "-ac", "1", "-c:a", "aac", "-b:a", "128k", audio_out,
            ],
            check=True,
        )

    # Check: each chunk after the first starts where the waveform comes out of the pause before it.
    on = onsets(full)
    errs = [min(abs(s - o) for o in on) for s in starts[1:]] if on else [0]
    worst = round(max(errs) * 1000)
    json.dump(
        {
            "voice": f"Kokoro {VOICE}",
            "durationMs": round(total * 1000),
            "source": "Kokoro word timestamps per chunk, placed at each chunk's real start in the joined audio",
            "check": {"chunkStartsVsAudioMaxMs": worst},
            "chunkStartsMs": [round(s * 1000) for s in starts],
            "words": [{"w": w, "t": round(s * 1000)} for w, s in words],
        },
        open(json_out, "w"),
        indent=1,
    )

    if args.out == ROOT:
        # delayMs is the wait before each chunk appears, so it follows the real chunk starts.
        src = open(CONTENT, encoding="utf8").read()
        a, b = src.index("sampleRecording:"), src.index("outputs:")
        block = src[a:b]
        delays = [round((s - (starts[k - 1] if k else 0)) * 1000) for k, s in enumerate(starts)]
        it = iter(delays)
        block = re.sub(r"delayMs:\s*\d+", lambda m: f"delayMs: {next(it)}", block)
        block = re.sub(r"durationSeconds:\s*[\d.]+", f"durationSeconds: {round(total)}", block)
        open(CONTENT, "w", encoding="utf8").write(src[:a] + block + src[b:])

    size = os.path.getsize(audio_out)
    print(f"{VOICE}: {total:.2f}s, {len(words)} words, {size / 1024:.0f} KB, chunk starts within {worst} ms")
    if size > 1_000_000:
        sys.exit("Audio is over 1 MB")
    if worst > 300:
        sys.exit("Chunk starts drift more than 300 ms from the audio")


if __name__ == "__main__":
    main()
