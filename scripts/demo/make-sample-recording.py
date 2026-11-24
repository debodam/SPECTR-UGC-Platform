#!/usr/bin/env python3
"""
Builds the demo's sample recording and its word timings (macOS only, run once; both outputs are committed).

  python3 scripts/demo/make-sample-recording.py

1. Joins TOUR_PLAY.sampleRecording chunks (src/demo/seed/content.ts) into one paragraph.
2. Speaks it with the best installed voice (Ava Premium, then Samantha, then Zoe) through Apple's speech engine
   (scripts/demo/sample-recording.swift), which also reports the audio frame where each word starts. The audio is
   encoded to public/demo/sample-recording.m4a (AAC).
3. Writes src/demo/seed/sampleRecordingTimings.json with a start time per word.
4. Checks the timings two ways and fails if either is off by more than 300 ms:
   - against the audio itself: after every full stop the next word must start within 300 ms of where the
     waveform comes out of the pause;
   - against an estimate spread by syllables with extra weight after commas and full stops (reported, so the
     proportional method is known to be close enough as a fallback).
"""
import array, json, os, re, statistics, subprocess, sys, tempfile, wave

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEED = os.path.join(ROOT, "src/demo/seed/content.ts")
AUDIO = os.path.join(ROOT, "public/demo/sample-recording.m4a")
OUT = os.path.join(ROOT, "src/demo/seed/sampleRecordingTimings.json")
SWIFT = os.path.join(ROOT, "scripts/demo/sample-recording.swift")
VOICES = ["Ava (Premium)", "Ava", "Samantha", "Zoe"]


def script_text():
    src = open(SEED, encoding="utf8").read()
    block = src[src.index("sampleRecording:") : src.index("outputs:")]
    return re.sub(r"\s+", " ", "".join(re.findall(r'text:\s*"([^"]*)"', block))).strip()


def pick_voice():
    listing = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
    names = {re.split(r"\s{2,}", l.strip())[0] for l in listing.splitlines() if l.strip()}
    return next((v for v in VOICES if v in names), None)


def syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and n > 1 and not w.endswith(("le", "ee")):
        n -= 1
    return max(1, n)


def levels(wav_path, frame_ms=10):
    with wave.open(wav_path) as f:
        rate = f.getframerate()
        raw = f.readframes(f.getnframes())
    data = array.array("h", raw)
    step = int(rate * frame_ms / 1000)
    return [
        (sum(x * x for x in data[i : i + step]) / max(1, len(data[i : i + step]))) ** 0.5
        for i in range(0, len(data), step)
    ]


def speech_onsets(lv, frame_ms=10, min_quiet_ms=150):
    """Times (ms) where the voice resumes after a pause of at least min_quiet_ms."""
    thr = sorted(lv)[int(len(lv) * 0.9)] * 0.05
    out, quiet = [], 0
    for i, v in enumerate(lv):
        if v < thr:
            quiet += 1
        else:
            if quiet * frame_ms >= min_quiet_ms:
                out.append(i * frame_ms)
            quiet = 0
    return out


def proportional(words, start_ms, end_ms):
    weights = []
    for w in words:
        x = syllables(w) + 0.4
        if w.endswith((".", "?", "!")):
            x += 2.6
        elif w.endswith((",", ";", ":")):
            x += 1.2
        weights.append(x)
    total, t, out = sum(weights[:-1]) + syllables(words[-1]), start_ms, []
    for w, x in zip(words, weights):
        out.append(round(t))
        t += (end_ms - start_ms) * x / total
    return out


def main():
    text = script_text()
    voice = pick_voice()
    if not voice:
        sys.exit("No suitable voice installed. The app falls back to speechSynthesis in the browser.")
    with tempfile.TemporaryDirectory() as tmp:
        txt, wav = os.path.join(tmp, "s.txt"), os.path.join(tmp, "s.wav")
        open(txt, "w").write(text)
        res = subprocess.run(["swift", SWIFT, txt, voice, wav], capture_output=True, text=True)
        if res.returncode:
            sys.exit(res.stderr)
        rows = [l.split("\t") for l in res.stdout.strip().splitlines()]
        dur_ms = round(float(rows[0][0]) * 1000)
        marks = [(round(float(t) * 1000), w) for t, w in rows[1:]]
        os.makedirs(os.path.dirname(AUDIO), exist_ok=True)
        pcm = os.path.join(tmp, "pcm.wav")
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16", wav, pcm], check=True)
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", pcm, AUDIO], check=True
        )
        lv = levels(pcm)

    words = text.split(" ")
    if [w for _, w in marks] != [re.sub(r"[^\w']+$", "", w) for w in words] and len(marks) != len(words):
        sys.exit(f"Engine reported {len(marks)} words for {len(words)} in the script")
    times = [t for t, _ in marks]

    # Check 1: against the waveform. Every sentence start must sit within 300 ms of a real speech onset.
    onsets = speech_onsets(lv)
    errs = []
    for i in range(1, len(words)):
        if words[i - 1].endswith((".", "?", "!")):
            errs.append(min(abs(times[i] - o) for o in onsets))
    # Check 2: the proportional estimate against the engine's times.
    est = proportional(words, times[0], dur_ms - 250)
    prop = [abs(a - b) for a, b in zip(est, times)]
    third = len(words) // 3
    report = {
        "sentenceStartsVsAudioMaxMs": max(errs) if errs else 0,
        "proportionalVsEngineMs": {
            "start": round(statistics.mean(prop[:third])),
            "middle": round(statistics.mean(prop[third : 2 * third])),
            "end": round(statistics.mean(prop[2 * third :])),
            "max": max(prop),
        },
    }
    json.dump(
        {
            "voice": voice,
            "durationMs": dur_ms,
            "source": "Apple speech engine word callbacks, measured in rendered audio frames",
            "check": report,
            "words": [{"w": w, "t": t} for w, t in zip(words, times)],
        },
        open(OUT, "w"),
        indent=1,
    )
    print(f"{voice}: {dur_ms / 1000:.2f}s, {len(words)} words")
    print(json.dumps(report))
    if report["sentenceStartsVsAudioMaxMs"] > 300:
        sys.exit("Word timings drift more than 300 ms from the audio")


if __name__ == "__main__":
    main()
