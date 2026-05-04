import { useState, type FormEvent } from "react";

interface LoginPageProps {
  onSubmit: (username: string, password: string) => void;
  isPending: boolean;
  errorMessage: string | null;
  onGoToRegister: () => void;
}

export default function LoginPage({
  onSubmit,
  isPending,
  errorMessage,
  onGoToRegister,
}: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    onSubmit(username, password);
  };

  // Bars for the little voice visualizer
  const bars = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-orange-50 via-rose-50 to-amber-50 flex flex-col items-center justify-center px-5 py-10 antialiased">
      <style>{`
        @keyframes vv-wave {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        .vv-bar {
          animation: vv-wave 1.1s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes vv-spin {
          to { transform: rotate(360deg); }
        }
        .vv-spin { animation: vv-spin 0.7s linear infinite; }
      `}</style>

      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-stone-900">
            Vibra<span className="text-coral" style={{ color: "#ff6b5b" }}>Vocal</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500">Find your voice, one note at a time.</p>

          {/* Animated visualizer */}
          <div className="mt-5 flex items-end gap-1.5 h-8" aria-hidden="true">
            {bars.map((i) => (
              <span
                key={i}
                className="vv-bar block w-1.5 rounded-full"
                style={{
                  height: "100%",
                  background: "linear-gradient(to top, #ff6b5b, #ffa07a)",
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-[0_10px_40px_-12px_rgba(255,107,91,0.25)] p-7 border border-rose-100">
          <h2 className="text-xl font-bold text-stone-900 mb-1">Welcome back</h2>
          <p className="text-sm text-stone-500 mb-6">Keep your streak alive 🔥</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="vv-username"
                className="block text-sm font-semibold text-stone-700 mb-1.5"
              >
                Username
              </label>
              <input
                id="vv-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isPending}
                placeholder="yoursingingname"
                className="w-full h-12 px-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-[#ff6b5b] focus:bg-white focus:ring-4 focus:ring-[#ff6b5b]/15 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="vv-password"
                className="block text-sm font-semibold text-stone-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="vv-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full h-12 px-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-[#ff6b5b] focus:bg-white focus:ring-4 focus:ring-[#ff6b5b]/15 disabled:opacity-60"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-13 mt-2 inline-flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-base tracking-wide shadow-[0_6px_0_0_#d94d3e] active:translate-y-[2px] active:shadow-[0_4px_0_0_#d94d3e] transition disabled:opacity-70 disabled:cursor-not-allowed disabled:active:translate-y-0"
              style={{
                background: "linear-gradient(180deg, #ff7d6e 0%, #ff6b5b 100%)",
                height: "52px",
              }}
            >
              {isPending ? (
                <>
                  <span
                    className="vv-spin inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                  <span>Warming up…</span>
                </>
              ) : (
                <span>Log in</span>
              )}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p className="mt-6 text-center text-sm text-stone-600">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onGoToRegister}
            className="font-bold text-[#ff6b5b] hover:text-[#e85546] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
