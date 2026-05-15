import { useMemo, useState, useRef, useEffect } from "react";

export interface HomeScreenUser {
  username: string;
  display_name: string;
  avatar: string | null;
  current_streak: number;
  longest_streak: number;
  last_practice_date: string | null;
  current_level: { id: number; order: number; name: string; category: string } | null;
}

export interface HomeScreenExercise {
  id: number;
  order_in_level: number;
  type: "hold_note" | "sing_scale" | "mimic_phrase";
  pass_threshold: number;
}

export interface HomeScreenProps {
  user: HomeScreenUser;
  exercises: HomeScreenExercise[];
  isLoadingExercises: boolean;
  exercisesError: string | null;
  isSigningOut: boolean;
  signOutError: string | null;
  onSelectExercise: (id: number) => void;
  onSignOut: () => void;
}

const TYPE_LABEL: Record<HomeScreenExercise["type"], string> = {
  hold_note: "Hold a note",
  sing_scale: "Sing a scale",
  mimic_phrase: "Mimic a phrase",
};

const TYPE_BLURB: Record<HomeScreenExercise["type"], string> = {
  hold_note: "Steady your pitch on a single tone.",
  sing_scale: "Climb the steps cleanly, top to bottom.",
  mimic_phrase: "Match a short melodic phrase by ear.",
};

function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5s1.6 3 1.6 5.2c0 1.6-1.1 2.4-1.1 2.4s-.9-1-.9-2.6c0 0-3.6 2.4-3.6 6.4 0 3.6 2.7 6.6 6 6.6s6-2.8 6-6.5c0-5.6-8-11.5-8-11.5z"
        fill="url(#vv-flame)"
      />
      <defs>
        <linearGradient id="vv-flame" x1="6" y1="2" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffb86b" />
          <stop offset="1" stopColor="#ff5b3e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function getInitials(name: string, fallback: string) {
  const src = (name || fallback || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function HomeScreen({
  user,
  exercises,
  isLoadingExercises,
  exercisesError,
  isSigningOut,
  signOutError,
  onSelectExercise,
  onSignOut,
}: HomeScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(
    () => getInitials(user.display_name, user.username),
    [user.display_name, user.username],
  );

  const sortedExercises = useMemo(
    () => exercises.slice().sort((a, b) => a.order_in_level - b.order_in_level),
    [exercises],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-orange-50 via-rose-50 to-amber-50 antialiased">
      <div className="mx-auto w-full max-w-md px-5 pt-6 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
            Vibra<span style={{ color: "#ff6b5b" }}>Vocal</span>
          </h1>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="w-11 h-11 rounded-full bg-white border border-rose-100 shadow-sm flex items-center justify-center font-bold text-stone-800 hover:border-[#ff6b5b]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff6b5b]/25 transition overflow-hidden"
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm tracking-wide">{initials}</span>
              )}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 origin-top-right rounded-2xl bg-white border border-rose-100 shadow-[0_10px_30px_-8px_rgba(255,107,91,0.25)] p-2 z-20"
              >
                <div className="px-3 py-2.5 border-b border-stone-100 mb-1">
                  <p className="text-sm font-semibold text-stone-900 truncate">
                    {user.display_name || user.username}
                  </p>
                  <p className="text-xs text-stone-500 truncate">@{user.username}</p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSignOut();
                  }}
                  disabled={isSigningOut}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-800 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none disabled:opacity-60 flex items-center justify-between"
                >
                  <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
                  {isSigningOut && (
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full border-2 border-stone-300 border-t-[#ff6b5b]"
                      style={{ animation: "vv-spin 0.7s linear infinite" }}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {signOutError && (
                  <p
                    role="alert"
                    className="mt-1 mx-2 mb-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2"
                  >
                    {signOutError}
                  </p>
                )}
              </div>
            )}
          </div>
        </header>

        <style>{`@keyframes vv-spin { to { transform: rotate(360deg); } }`}</style>

        {/* Streak hero */}
        <section
          className="relative overflow-hidden rounded-3xl p-5 mb-7 border border-rose-100 shadow-[0_10px_40px_-12px_rgba(255,107,91,0.3)]"
          style={{
            background:
              "linear-gradient(140deg, #fff7f1 0%, #ffe4d6 55%, #ffd0bd 100%)",
          }}
          aria-label="Your streak"
        >
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-40 blur-2xl" style={{ background: "#ffb89c" }} />
          <div className="relative flex items-center gap-4">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-white/70 backdrop-blur flex items-center justify-center shadow-inner">
              <FlameIcon className="w-9 h-9" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#c4543f]">
                Hey {user.display_name || user.username}
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-4xl font-extrabold text-stone-900 tabular-nums leading-none">
                  {user.current_streak}
                </span>
                <span className="text-sm font-semibold text-stone-700">
                  day{user.current_streak === 1 ? "" : "s"} streak
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                Longest: <span className="tabular-nums font-semibold">{user.longest_streak}</span>
                {user.current_level && (
                  <> · Level {user.current_level.order} — {user.current_level.name}</>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Exercises */}
        <section aria-labelledby="vv-exercises-heading">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 id="vv-exercises-heading" className="text-base font-bold text-stone-900">
              Today's exercises
            </h2>
            {user.current_level && (
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                {user.current_level.category}
              </span>
            )}
          </div>

          {isLoadingExercises ? (
            <div className="space-y-3" aria-live="polite" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[88px] rounded-2xl bg-white/70 border border-rose-100 animate-pulse"
                />
              ))}
            </div>
          ) : exercisesError ? (
            <div
              role="alert"
              className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700"
            >
              {exercisesError}
            </div>
          ) : sortedExercises.length === 0 ? (
            <div className="rounded-3xl bg-white border border-rose-100 p-6 text-center shadow-[0_10px_40px_-16px_rgba(255,107,91,0.2)]">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-[#ff6b5b] flex items-center justify-center mb-3">
                <SparkIcon />
              </div>
              <p className="font-bold text-stone-900">No exercises yet</p>
              <p className="mt-1 text-sm text-stone-500">
                Check back soon — new lessons are on their way.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sortedExercises.map((ex, idx) => {
                const label = TYPE_LABEL[ex.type];
                const blurb = TYPE_BLURB[ex.type];
                const pct = Math.round(ex.pass_threshold * 100);
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => onSelectExercise(ex.id)}
                      className="group w-full text-left rounded-2xl bg-white border border-rose-100 p-4 flex items-center gap-4 shadow-[0_4px_0_0_rgba(255,107,91,0.18)] hover:shadow-[0_6px_0_0_rgba(255,107,91,0.25)] hover:-translate-y-[1px] active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(255,107,91,0.18)] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff6b5b]/25"
                    >
                      <div
                        className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white tabular-nums"
                        style={{
                          background:
                            "linear-gradient(180deg, #ff7d6e 0%, #ff6b5b 100%)",
                          boxShadow: "0 3px 0 0 #d94d3e",
                        }}
                        aria-hidden="true"
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-stone-900 truncate">{label}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#c4543f] bg-rose-100/70 rounded-full px-2 py-0.5">
                            {pct}%
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 truncate">{blurb}</p>
                      </div>
                      <span className="shrink-0 text-stone-400 group-hover:text-[#ff6b5b] transition">
                        <ChevronIcon />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
