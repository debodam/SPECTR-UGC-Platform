import { createServerFn } from "@tanstack/react-start";
import { errMessage } from "./utils";

interface TranscribeInput {
  audioBase64: string;
  mimeType: string;
}

interface TranscribeOutput {
  transcript?: string;
  error?: string;
}

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((v: TranscribeInput) => v)
  .handler(async ({ data }): Promise<TranscribeOutput> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: "OPENAI_API_KEY is not configured." };
    }

    try {
      const buffer = Buffer.from(data.audioBase64, "base64");

      const ext = data.mimeType.includes("ogg")
        ? "ogg"
        : data.mimeType.includes("mp4")
          ? "mp4"
          : "webm";

      const formData = new FormData();
      formData.append("file", new Blob([buffer], { type: data.mimeType }), `audio.${ext}`);
      formData.append("model", "whisper-1");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Whisper API error:", text);
        return { error: `Transcription failed (${response.status}).` };
      }

      const json = (await response.json()) as { text: string };
      return { transcript: json.text };
    } catch (err) {
      console.error("Transcribe error:", err);
      return { error: errMessage(err) ?? "Transcription failed." };
    }
  });
