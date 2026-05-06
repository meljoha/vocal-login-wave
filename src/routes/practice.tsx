import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import PracticePage, {
  type PracticeExercise,
  type PracticeResult,
  type RecordingState,
} from "@/components/PracticePage";

export const Route = createFileRoute("/practice")({
  component: PracticeRoute,
});

// Build a fake reference curve: a simple ascending arpeggio pattern for preview.
function makeRefCurve(): number[] {
  const notes = [220, 246.94, 277.18, 329.63, 277.18, 246.94, 220, 220];
  const samplesPerNote = 18;
  const out: number[] = [];
  notes.forEach((n) => {
    for (let i = 0; i < samplesPerNote; i++) out.push(n);
  });
  return out;
}

const EXERCISES: PracticeExercise[] = [
  { id: "warm-up", label: "Morning warm-up", threshold: 0.6 },
  { id: "arpeggio", label: "Major arpeggio", threshold: 0.7 },
  { id: "scale", label: "C major scale", threshold: 0.75 },
  { id: "interval", label: "Octave jumps", threshold: 0.8 },
];

function PracticeRoute() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(EXERCISES[1].id);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [pitchHz, setPitchHz] = useState<number | null>(null);
  const [voiced, setVoiced] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [liveTrail, setLiveTrail] = useState<(number | null)[]>([]);
  const [attemptCurve, setAttemptCurve] = useState<(number | null)[] | undefined>();
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [isPlayingReference, setIsPlayingReference] = useState(false);

  const ref = useRef<number>(0);
  const refCurve = useRef(makeRefCurve()).current;

  // Mock recording loop for preview
  useEffect(() => {
    if (recordingState !== "recording") return;
    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      setRecordedDurationMs(elapsed);
      const idx = Math.min(refCurve.length - 1, Math.floor(elapsed / 50));
      const target = refCurve[idx];
      // Simulate user pitch hugging target with some wobble
      const wobble = (Math.sin(elapsed / 120) * 18) + (Math.random() - 0.5) * 12;
      const sim = Math.max(60, target + wobble);
      setPitchHz(sim);
      setVoiced(true);
      setInputLevel(0.4 + Math.random() * 0.4);
      setLiveTrail((prev) => {
        const next = prev.slice();
        while (next.length <= idx) next.push(null);
        next[idx] = sim;
        return next;
      });
      if (elapsed > refCurve.length * 50 + 300) {
        ref.current = elapsed;
        clearInterval(interval);
        finalize(elapsed);
      }
    }, 50);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingState]);

  const finalize = (elapsed: number) => {
    setRecordingState("idle");
    setRecordedDurationMs(0);
    setVoiced(false);
    setInputLevel(0);
    setLiveTrail((trail) => {
      setAttemptCurve(trail.slice());
      const score = 0.62 + Math.random() * 0.35;
      const ex = EXERCISES.find((e) => e.id === selected)!;
      setResult({
        score,
        passed: score >= ex.threshold,
        octavesOff: 0,
        threshold: ex.threshold,
      });
      return [];
    });
    void elapsed;
  };

  return (
    <PracticePage
      exercises={EXERCISES}
      selectedExerciseId={selected}
      onSelectExercise={(id) => {
        setSelected(id);
        setResult(null);
        setAttemptCurve(undefined);
      }}
      referenceCurve={refCurve}
      pitchHz={pitchHz}
      pitchCents={null}
      voiced={voiced}
      clarity={0.8}
      inputLevel={inputLevel}
      recordingState={recordingState}
      recordedDurationMs={recordedDurationMs}
      isPlayingReference={isPlayingReference}
      onTogglePlay={() => setIsPlayingReference((p) => !p)}
      onRecord={() => {
        setResult(null);
        setAttemptCurve(undefined);
        setLiveTrail([]);
        setRecordingState("armed");
        setTimeout(() => setRecordingState("recording"), 600);
      }}
      onStopRecording={() => finalize(recordedDurationMs)}
      result={result}
      lastAttemptBlobUrl={null}
      micError={null}
      captureError={null}
      submitError={null}
      audioInputs={[
        { deviceId: "default", label: "Default - MacBook Pro Microphone" },
        { deviceId: "ext", label: "Blue Yeti USB" },
      ]}
      selectedMicId="default"
      onMicChange={() => {}}
      micStatus="ready"
      onToggleMic={() => {}}
      onBack={() => navigate({ to: "/" })}
      liveTrail={liveTrail}
      attemptCurve={attemptCurve}
    />
  );
}
