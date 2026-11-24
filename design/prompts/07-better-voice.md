# 07: Replace the robotic sample voice with a free neural voice

Read this whole file, then do everything in it without asking me anything. No em dashes anywhere.

## Problem
`public/demo/sample-recording.m4a` was rendered with macOS `say` and sounds robotic. Replace it with a natural sounding free neural voice. The audio is a static pre-rendered file, so there is no runtime cost and no API key in the app.

## Do this
1. Use a throwaway Python venv outside the repo (for example `~/.spectr-tts`). Do not add TTS packages to the app's dependencies.
2. Try **Kokoro** first (`pip install kokoro soundfile`, needs `espeak-ng` via `brew install espeak-ng`). Use a calm, warm American male voice such as `am_michael` or `am_adam`, speed 0.95 to 1.0.
   If Kokoro fails to install or run after one reasonable attempt, fall back to **edge-tts** (`pip install edge-tts`) with voice `en-US-AndrewNeural` or `en-US-GuyNeural`, rate `-4%`.
3. Take the text from `TOUR_PLAY.sampleRecording.chunks` in `src/demo/seed/content.ts`. Render each chunk as its own audio clip so every chunk's real duration is known. Join the clips in order, inserting a natural short pause (150 to 300 ms) between chunks. Keep the delivery conversational, like a coach talking, not reading.
4. Encode to `public/demo/sample-recording.m4a` (AAC, 128k, mono is fine, 44.1 or 48 kHz). Normalize loudness to about -16 LUFS so it is not quiet. Keep the file under 1 MB.
5. Rewrite `src/demo/seed/sampleRecordingTimings.json` from the REAL clip durations: for each chunk, the start time is the cumulative duration of earlier clips plus pauses, and words inside a chunk are spaced in proportion to character count across that clip's duration. If you used edge-tts, use its word boundary events instead. Make sure the `delayMs` values that drive the live transcript match the new audio so the text appears in sync with the voice.
6. Update `TOUR_PLAY.sampleRecording.durationSeconds` to the real total length, and update any timer or progress UI constant that hardcodes the old duration.
7. Run `npm run e2e:demo`, typecheck, lint and build. Fix anything that breaks.
8. Play it through the tour once in a headless browser and confirm the transcript reveals in sync and the Stop step still appears right after the recording ends.
9. Append a short "07 better voice" note to `design/MORNING-REPORT.md` saying which engine was used (Kokoro or edge-tts), the voice name, and the final duration. Commit on `ui/rework`.
