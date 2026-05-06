import { useMemo } from "react";

export interface PracticeExercise {
  id: string;
  label: string;
  threshold: number; // 0..1 pass score
  type?: string;
}

export type RecordingState = "idle" | "armed" | "recording";

export interface PracticeResult {
  score: number; // 0..1
  passed: boolean;
  octavesOff: number; // signed; + means user too high
  threshold: number;
}

export interface AudioInput {
  deviceId: string;
  label: string;
}

export interface PracticePageProps {
  // Exercises
  exercises: PracticeExercise[];
  selectedExerciseId: string;
  onSelectExercise: (id: string) => void;

  // Target
  referenceCurve: number[]; // Hz values

  // Live pitch
  pitchHz: number | null;
  pitchCents: number | null; // -50..+50 within nearest semitone (informational)
  voiced: boolean;
  clarity: number; // 0..1
  inputLevel: number; // 0..1

  // Recording
  recordingState: RecordingState;
  recordedDurationMs: number;

  // Reference playback
  isPlayingReference: boolean;
  onTogglePlay: () => void;

  // Recording controls
  onRecord: () => void;
  onStopRecording: () => void;

  // Result
  result: PracticeResult | null;
  lastAttemptBlobUrl: string | null;

  // Errors
  micError: string | null;
  captureError: string | null;
  submitError: string | null;

  // Mic picker
  audioInputs: AudioInput[];
  selectedMicId: string | null;
  onMicChange: (id: string) => void;
  micStatus: "idle" | "checking" | "ready" | "denied" | "unavailable";
  onToggleMic: () => void;

  // Navigation
  onBack: () => void;

  // Live trail (optional): user's pitch samples so far during recording, in Hz aligned to time index.
  liveTrail?: (number | null)[];
  // Final attempt curve (for result overlay)
  attemptCurve?: (number | null)[];
}

const CORAL = "#ff6b5b";
const CORAL_DARK = "#d94d3e";
const CORAL_LIGHT = "#ffa07a";

// Graph viewBox constants
const VB_W = 800;
const VB_H = 280;
const PAD_X = 24;
const PAD_Y = 28;

function hzToY(hz: number, minHz: number, maxHz: number): number {
  // Log scale across pitch range
  const lo = Math.log2(minHz);
  const hi = Math.log2(maxHz);
  const v = (Math.log2(hz) - lo) / (hi - lo);
  const clamped = Math.max(0, Math.min(1, v));
  // Invert: high pitch = top
  return PAD_Y + (1 - clamped) * (VB_H - PAD_Y * 2);
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    d += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x} ${last.y}`;
  return d;
}

export default function PracticePage(props: PracticePageProps) {
  const {
    exercises,
    selectedExerciseId,
    onSelectExercise,
    referenceCurve,
    pitchHz,
    voiced,
    inputLevel,
    recordingState,
    recordedDurationMs,
    isPlayingReference,
    onTogglePlay,
    onRecord,
    onStopRecording,
    result,
    lastAttemptBlobUrl,
    micError,
    captureError,
    submitError,
    audioInputs,
    selectedMicId,
    onMicChange,
    micStatus,
    onBack,
    liveTrail,
    attemptCurve,
  } = props;

  const selected = exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0];

  // Pitch range from reference curve (with a little headroom)
  const { minHz, maxHz } = useMemo(() => {
    if (!referenceCurve.length) return { minHz: 110, maxHz: 880 };
    const validRef = referenceCurve.filter((v) => v > 0);
    const lo = Math.min(...validRef);
    const hi = Math.max(...validRef);
    // half-octave padding
    return { minHz: lo / Math.SQRT2, maxHz: hi * Math.SQRT2 };
  }, [referenceCurve]);

  // Build target path
  const targetPath = useMemo(() => {
    if (!referenceCurve.length) return "";
    const pts = referenceCurve.map((hz, i) => ({
      x: PAD_X + (i / Math.max(1, referenceCurve.length - 1)) * (VB_W - PAD_X * 2),
      y: hzToY(hz, minHz, maxHz),
    }));
    return buildSmoothPath(pts);
  }, [referenceCurve, minHz, maxHz]);

  // Live or attempt overlay
  const overlayCurve = recordingState === "recording" ? liveTrail : attemptCurve;
  const overlayPath = useMemo(() => {
    if (!overlayCurve || overlayCurve.length === 0 || referenceCurve.length === 0) return "";
    const segments: string[] = [];
    let current: { x: number; y: number }[] = [];
    overlayCurve.forEach((hz, i) => {
      const x = PAD_X + (i / Math.max(1, referenceCurve.length - 1)) * (VB_W - PAD_X * 2);
      if (hz && hz > 0) {
        current.push({ x, y: hzToY(hz, minHz, maxHz) });
      } else if (current.length > 0) {
        segments.push(buildSmoothPath(current));
        current = [];
      }
    });
    if (current.length > 0) segments.push(buildSmoothPath(current));
    return segments.join(" ");
  }, [overlayCurve, referenceCurve.length, minHz, maxHz]);

  // Live indicator position
  const liveIndicator = useMemo(() => {
    if (recordingState !== "recording" || !voiced || !pitchHz || referenceCurve.length === 0)
      return null;
    const totalMs = referenceCurve.length * 50; // assume 20 fps reference (50ms/sample) — display only
    const progress = Math.min(1, recordedDurationMs / Math.max(1, totalMs));
    const x = PAD_X + progress * (VB_W - PAD_X * 2);
    const y = hzToY(pitchHz, minHz, maxHz);

    // How close to target at this x?
    const idx = Math.min(
      referenceCurve.length - 1,
      Math.floor(progress * (referenceCurve.length - 1)),
    );
    const targetHz = referenceCurve[idx];
    let onTarget = false;
    if (targetHz > 0 && pitchHz > 0) {
      const cents = 1200 * Math.log2(pitchHz / targetHz);
      onTarget = Math.abs(cents) < 50;
    }
    return { x, y, onTarget };
  }, [recordingState, voiced, pitchHz, recordedDurationMs, referenceCurve, minHz, maxHz]);

  const showMicError = micStatus === "denied" || micStatus === "unavailable" || !!micError;
  const recording = recordingState === "recording";
  const armed = recordingState === "armed";

  const seconds = (recordedDurationMs / 1000).toFixed(1);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-orange-50 via-rose-50 to-amber-50 antialiased">
      <style>{`
        @keyframes vv-pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(255,107,91,0.55)); opacity: 0.85; }
          50% { filter: drop-shadow(0 0 18px rgba(255,107,91,0.95)); opacity: 1; }
        }
        .vv-pulse-glow { animation: vv-pulse-glow 1.4s ease-in-out infinite; }
        @keyframes vv-rec-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .vv-rec-dot { animation: vv-rec-dot 1s ease-in-out infinite; }
        @keyframes vv-bar {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        .vv-bar { animation: vv-bar 1.1s ease-in-out infinite; transform-origin: center; }
        @keyframes vv-celebrate {
          0% { transform: scale(0.6) rotate(-8deg); opacity: 0; }
          60% { transform: scale(1.1) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        .vv-celebrate { animation: vv-celebrate 0.6s cubic-bezier(.2,1.2,.4,1) both; }
        @keyframes vv-trail-grow {
          from { stroke-dashoffset: 1200; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes vv-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vv-fade-in { animation: vv-fade-in 0.3s ease-out both; }
      `}</style>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-5 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home"
            className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/70 border border-rose-100 text-stone-700 hover:bg-white active:scale-95 transition shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-stone-800 tracking-wide uppercase">Practice</h1>
          <MicMenu
            audioInputs={audioInputs}
            selectedMicId={selectedMicId}
            onMicChange={onMicChange}
            micStatus={micStatus}
            onToggleMic={onToggleMic}
          />
        </div>

        {/* Exercise picker */}
        <div className="mb-5 -mx-1 overflow-x-auto">
          <div className="flex gap-2.5 px-1 py-1 min-w-max">
            {exercises.map((ex) => {
              const isSel = ex.id === selected?.id;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onSelectExercise(ex.id)}
                  className={[
                    "shrink-0 rounded-2xl px-4 py-3 text-left transition border-2 min-w-[140px]",
                    isSel
                      ? "bg-white border-[#ff6b5b] shadow-[0_6px_18px_-8px_rgba(255,107,91,0.55)]"
                      : "bg-white/60 border-transparent hover:bg-white",
                  ].join(" ")}
                  aria-pressed={isSel}
                >
                  <div className={["text-sm font-bold", isSel ? "text-stone-900" : "text-stone-700"].join(" ")}>
                    {ex.label}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-stone-500 flex items-center gap-1">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: isSel ? CORAL : "#cbb8b1" }}
                    />
                    Pass ≥ {ex.threshold.toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Karaoke graph card */}
        <div className="relative rounded-3xl bg-gradient-to-b from-stone-900 to-stone-800 p-3 sm:p-4 shadow-[0_18px_50px_-20px_rgba(40,20,15,0.55)] overflow-hidden">
          {/* Graph */}
          <div className="relative rounded-2xl bg-[#1a1414] overflow-hidden">
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="none"
              className="block w-full h-[220px] sm:h-[260px]"
              role="img"
              aria-label="Pitch target curve"
            >
              <defs>
                <linearGradient id="vv-bg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#241818" />
                  <stop offset="100%" stopColor="#140d0d" />
                </linearGradient>
                <linearGradient id="vv-track" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={CORAL_LIGHT} />
                  <stop offset="100%" stopColor={CORAL} />
                </linearGradient>
                <linearGradient id="vv-attempt" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7ee8c5" />
                  <stop offset="100%" stopColor="#41c79a" />
                </linearGradient>
                <filter id="vv-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#vv-bg)" />

              {/* Horizontal grid lines */}
              {[0.2, 0.4, 0.6, 0.8].map((f) => (
                <line
                  key={f}
                  x1={PAD_X}
                  x2={VB_W - PAD_X}
                  y1={PAD_Y + f * (VB_H - PAD_Y * 2)}
                  y2={PAD_Y + f * (VB_H - PAD_Y * 2)}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
              ))}

              {/* Target track shadow */}
              {targetPath && (
                <>
                  <path
                    d={targetPath}
                    fill="none"
                    stroke="rgba(255,107,91,0.18)"
                    strokeWidth="22"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Main glowing track */}
                  <path
                    d={targetPath}
                    fill="none"
                    stroke="url(#vv-track)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#vv-glow)"
                    className={armed || isPlayingReference ? "vv-pulse-glow" : ""}
                  />
                  {/* Inner highlight */}
                  <path
                    d={targetPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Live trail / attempt overlay */}
              {overlayPath && (
                <path
                  d={overlayPath}
                  fill="none"
                  stroke={recording ? "#fff" : "url(#vv-attempt)"}
                  strokeWidth={recording ? 3.5 : 4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={recording ? 0.95 : 1}
                  filter="url(#vv-glow)"
                />
              )}

              {/* Live indicator */}
              {liveIndicator && (
                <g>
                  <circle
                    cx={liveIndicator.x}
                    cy={liveIndicator.y}
                    r={liveIndicator.onTarget ? 14 : 9}
                    fill={liveIndicator.onTarget ? CORAL : "#fff"}
                    opacity="0.25"
                  />
                  <circle
                    cx={liveIndicator.x}
                    cy={liveIndicator.y}
                    r={liveIndicator.onTarget ? 8 : 6}
                    fill={liveIndicator.onTarget ? "#fff" : "#fff"}
                    stroke={liveIndicator.onTarget ? CORAL : "rgba(255,255,255,0.7)"}
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* Idle hint */}
              {recordingState === "idle" && !result && !showMicError && (
                <text
                  x={VB_W / 2}
                  y={VB_H - 14}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.45)"
                  fontSize="14"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="500"
                >
                  Press record and sing along
                </text>
              )}
            </svg>

            {/* Mic error overlay */}
            {showMicError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                <div className="text-center max-w-xs vv-fade-in">
                  <div className="mx-auto w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold text-sm mb-1">
                    {micStatus === "unavailable" ? "No microphone found" : "Microphone access needed"}
                  </p>
                  <p className="text-white/70 text-xs mb-4">
                    {micError ?? "We need your mic to hear you sing. Please grant permission to continue."}
                  </p>
                  <button
                    type="button"
                    onClick={onToggleMic}
                    className="inline-flex items-center justify-center h-10 px-5 rounded-full text-sm font-bold text-white"
                    style={{ background: CORAL }}
                  >
                    Grant access
                  </button>
                </div>
              </div>
            )}

            {/* Recording counter */}
            {recording && (
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white">
                <span className="vv-rec-dot inline-block w-2 h-2 rounded-full bg-red-500" />
                {seconds}s
              </div>
            )}

            {/* Armed status */}
            {armed && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white vv-fade-in">
                <span className="flex items-end gap-0.5 h-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="vv-bar block w-0.5 rounded-full bg-white"
                      style={{ height: "100%", animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
                Waiting for your voice…
              </div>
            )}

            {/* Input level meter (subtle, top-right while recording) */}
            {recording && (
              <div className="absolute top-3 right-3 w-20 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.min(100, Math.max(2, inputLevel * 100))}%`,
                    background: `linear-gradient(90deg, ${CORAL_LIGHT}, ${CORAL})`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={recording || armed}
              className="h-12 px-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 text-white font-semibold text-sm hover:bg-white/15 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPlayingReference ? (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  Stop
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Listen
                </>
              )}
            </button>

            {!recording ? (
              <button
                type="button"
                onClick={onRecord}
                disabled={showMicError || armed}
                aria-label="Record"
                className="relative h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-full text-white font-bold inline-flex items-center justify-center shadow-[0_8px_0_0_#d94d3e] active:translate-y-[3px] active:shadow-[0_5px_0_0_#d94d3e] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0"
                style={{ background: `linear-gradient(180deg, #ff7d6e, ${CORAL})` }}
              >
                <span className={["block rounded-full bg-white transition-all", armed ? "w-4 h-4" : "w-5 h-5"].join(" ")} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onStopRecording}
                aria-label="Stop recording"
                className="relative h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-full text-white font-bold inline-flex items-center justify-center shadow-[0_8px_0_0_#a01818] active:translate-y-[3px] active:shadow-[0_5px_0_0_#a01818] transition"
                style={{ background: "linear-gradient(180deg, #f04444, #d11b1b)" }}
              >
                <span className="block w-5 h-5 rounded-md bg-white" />
                <span className="vv-rec-dot absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white border-2 border-red-600" />
              </button>
            )}

            <div className="h-12 w-[88px] flex items-center justify-center text-xs text-white/60 font-medium">
              {recording ? "Tap to stop" : armed ? "Listening…" : "Tap to sing"}
            </div>
          </div>
        </div>

        {/* Errors */}
        {(captureError || submitError) && (
          <div className="mt-4 space-y-2">
            {captureError && (
              <InlineError message={captureError} />
            )}
            {submitError && (
              <InlineError message={submitError} />
            )}
          </div>
        )}

        {/* No-voice nudge after stopping with no result */}
        {!recording && !armed && !result && (props.attemptCurve?.every((v) => !v) ?? false) && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium vv-fade-in">
            We didn't catch your voice. Try moving closer to your mic and sing a bit louder.
          </div>
        )}

        {/* Result panel */}
        {result && (
          <div className="mt-5 rounded-3xl bg-white border border-rose-100 shadow-[0_10px_40px_-16px_rgba(255,107,91,0.3)] p-5 vv-fade-in">
            <div className="flex items-center gap-4">
              <div
                className={[
                  "h-16 w-16 rounded-2xl flex items-center justify-center text-2xl vv-celebrate",
                  result.passed ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-500",
                ].join(" ")}
              >
                {result.passed ? "🎉" : "🎧"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  {result.passed ? "You passed!" : "Almost there"}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-extrabold text-stone-900 tabular-nums">
                    {result.score.toFixed(3)}
                  </span>
                  <span className="text-sm text-stone-400 font-medium">
                    / threshold {result.threshold.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-4 h-2 rounded-full bg-stone-100 overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, result.score * 100)}%`,
                  background: result.passed
                    ? "linear-gradient(90deg, #6ee7b7, #10b981)"
                    : `linear-gradient(90deg, ${CORAL_LIGHT}, ${CORAL})`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-stone-400/70"
                style={{ left: `${result.threshold * 100}%` }}
                aria-label="Pass threshold"
              />
            </div>

            {Math.abs(result.octavesOff) >= 1 && (
              <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5 text-xs font-semibold text-rose-700">
                You were {Math.abs(result.octavesOff)} octave{Math.abs(result.octavesOff) > 1 ? "s" : ""}{" "}
                too {result.octavesOff > 0 ? "high" : "low"} — try singing{" "}
                {result.octavesOff > 0 ? "lower" : "higher"} next time.
              </div>
            )}

            {lastAttemptBlobUrl && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Listen back
                </div>
                <audio
                  controls
                  src={lastAttemptBlobUrl}
                  className="w-full h-10 rounded-full"
                />
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onRecord}
                disabled={showMicError}
                className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-sm shadow-[0_5px_0_0_#d94d3e] active:translate-y-[2px] active:shadow-[0_3px_0_0_#d94d3e] transition disabled:opacity-50"
                style={{ background: `linear-gradient(180deg, #ff7d6e, ${CORAL})` }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                className="h-12 px-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-100 text-stone-700 font-semibold text-sm hover:bg-stone-200 transition"
              >
                {isPlayingReference ? "Stop" : "Hear target"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700 vv-fade-in">
      {message}
    </div>
  );
}

function MicMenu({
  audioInputs,
  selectedMicId,
  onMicChange,
  micStatus,
  onToggleMic,
}: {
  audioInputs: AudioInput[];
  selectedMicId: string | null;
  onMicChange: (id: string) => void;
  micStatus: PracticePageProps["micStatus"];
  onToggleMic: () => void;
}) {
  return (
    <details className="relative">
      <summary
        className="list-none h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/70 border border-rose-100 text-stone-700 hover:bg-white active:scale-95 transition shadow-sm cursor-pointer"
        aria-label="Microphone settings"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </summary>
      <div className="absolute right-0 mt-2 w-64 z-10 rounded-2xl bg-white border border-rose-100 shadow-xl p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2 flex items-center justify-between">
          <span>Microphone</span>
          <span
            className={[
              "inline-block w-2 h-2 rounded-full",
              micStatus === "ready"
                ? "bg-emerald-500"
                : micStatus === "checking"
                  ? "bg-amber-400"
                  : micStatus === "denied" || micStatus === "unavailable"
                    ? "bg-red-500"
                    : "bg-stone-300",
            ].join(" ")}
            aria-label={`Mic ${micStatus}`}
          />
        </div>
        {audioInputs.length > 0 ? (
          <select
            value={selectedMicId ?? ""}
            onChange={(e) => onMicChange(e.target.value)}
            className="w-full h-9 px-2 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-800 outline-none focus:border-[#ff6b5b]"
          >
            {audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Microphone"}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-stone-500">No microphones detected.</p>
        )}
        <button
          type="button"
          onClick={onToggleMic}
          className="mt-2 w-full h-9 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition"
        >
          {micStatus === "ready" ? "Re-check mic" : "Enable mic"}
        </button>
      </div>
    </details>
  );
}
