// Renders the demo's sample recording with Apple's speech engine and records when each word starts.
// Usage: swift scripts/demo/sample-recording.swift <script.txt> <voice name> <out.wav> > marks.tsv
// Each output line is "<seconds>\t<word>", measured in rendered audio frames, so it matches the file exactly.
import AVFoundation
import Foundation

let args = CommandLine.arguments
let text = try! String(contentsOfFile: args[1], encoding: .utf8)
let voiceName = args[2]
let outURL = URL(fileURLWithPath: args[3])

final class Marks: NSObject, AVSpeechSynthesizerDelegate {
  var frames: AVAudioFramePosition = 0
  var rate: Double = 22050
  var lines: [String] = []
  var done = false
  func speechSynthesizer(
    _ s: AVSpeechSynthesizer, willSpeakRangeOfSpeechString r: NSRange, utterance u: AVSpeechUtterance
  ) {
    let w = (u.speechString as NSString).substring(with: r)
    lines.append(String(format: "%.3f\t%@", Double(frames) / rate, w))
  }
}

let synth = AVSpeechSynthesizer()
let marks = Marks()
synth.delegate = marks
let u = AVSpeechUtterance(string: text)
u.voice =
  AVSpeechSynthesisVoice.speechVoices().first { $0.name == voiceName && $0.language == "en-US" }
  ?? AVSpeechSynthesisVoice(language: "en-US")
u.rate = 0.42  // under the default, close to a natural speaking pace
var file: AVAudioFile?
synth.write(u) { buf in
  guard let pcm = buf as? AVAudioPCMBuffer else { return }
  if pcm.frameLength == 0 {
    marks.done = true
    return
  }
  if file == nil {
    file = try! AVAudioFile(
      forWriting: outURL, settings: pcm.format.settings, commonFormat: pcm.format.commonFormat,
      interleaved: pcm.format.isInterleaved)
  }
  marks.rate = pcm.format.sampleRate
  try! file!.write(from: pcm)
  marks.frames += AVAudioFramePosition(pcm.frameLength)
}
let start = Date()
while !marks.done && Date().timeIntervalSince(start) < 120 {
  RunLoop.main.run(until: Date().addingTimeInterval(0.05))
}
file = nil  // closes the file so its header is complete
print(String(format: "%.3f\t__END__", Double(marks.frames) / marks.rate))
for l in marks.lines { print(l) }
