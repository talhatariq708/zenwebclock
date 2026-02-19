import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Settings, X } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Mode = "focus" | "short" | "long";

const MODES: Record<Mode, { label: string; seconds: number }> = {
  focus: { label: "Focus", seconds: 25 * 60 },
  short: { label: "Short Break", seconds: 5 * 60 },
  long: { label: "Long Break", seconds: 15 * 60 },
};

/* ─── Zen Chime via Web Audio API ───────────────────────────────────────── */
function playZenChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const createTone = (freq: number, delay: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const convolver = ctx.createConvolver();

      // Gentle reverb impulse
      const impulseLen = ctx.sampleRate * 2;
      const impulse = ctx.createBuffer(2, impulseLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < impulseLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLen, 2.5);
        }
      }
      convolver.buffer = impulse;

      osc.connect(gainNode);
      gainNode.connect(convolver);
      convolver.connect(ctx.destination);
      gainNode.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.1);
    };

    // Singing bowl overtones
    createTone(432, 0, 4.5, 0.22);
    createTone(648, 0.08, 3.5, 0.12);
    createTone(864, 0.15, 2.5, 0.06);
    createTone(396, 1.2, 4.0, 0.18);
    createTone(594, 1.3, 3.5, 0.09);

    setTimeout(() => ctx.close(), 6000);
  } catch (e) {
    console.warn("Audio not available", e);
  }
}

/* ─── Liquid Wave SVG ────────────────────────────────────────────────────── */
function LiquidWave({ phase }: { phase: number }) {
  return (
    <div
      className="absolute inset-x-0"
      style={{ top: -38, height: 40 }}
    >
      {/* Back wave */}
      <svg
        viewBox="0 0 1440 40"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full animate-wave-2"
        style={{ opacity: 0.55 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,20 C180,38 360,4 540,20 C720,36 900,6 1080,20 C1260,36 1380,8 1440,20 L1440,40 L0,40 Z"
          fill="hsl(var(--liquid-wave))"
        />
      </svg>
      {/* Front wave */}
      <svg
        viewBox="0 0 1440 40"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full animate-wave-1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,24 C200,8 400,36 600,22 C800,8 1000,34 1200,22 C1320,14 1400,30 1440,24 L1440,40 L0,40 Z"
          fill="hsl(var(--liquid-top))"
        />
      </svg>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function ZenClock() {
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(MODES.focus.seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [settling, setSettling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalSeconds = MODES[mode].seconds;
  const progress = timeLeft / totalSeconds; // 1 = full, 0 = empty
  const liquidHeight = `${Math.max(0, Math.min(100, progress * 100))}%`;

  /* ── Format time ── */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  /* ── Timer tick ── */
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  /* ── Completion ── */
  const handleComplete = useCallback(() => {
    setIsComplete(true);
    playZenChime();

    // Browser notification
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Zen-Clock", {
          body: "Session Complete! Take a breath. 🧘",
          icon: "/favicon.ico",
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            new Notification("Zen-Clock", {
              body: "Session Complete! Take a breath. 🧘",
              icon: "/favicon.ico",
            });
          }
        });
      }
    }

    setTimeout(() => setIsComplete(false), 6000);
  }, []);

  /* ── Start ── */
  const handleStart = () => {
    if (!isRunning && timeLeft > 0) {
      // Request notification permission on first start
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      setSettling(true);
      setTimeout(() => setSettling(false), 900);
      setIsRunning(true);
    }
  };

  /* ── Pause ── */
  const handlePause = () => setIsRunning(false);

  /* ── Reset ── */
  const handleReset = () => {
    setIsRunning(false);
    setIsComplete(false);
    setTimeLeft(MODES[mode].seconds);
  };

  /* ── Mode switch ── */
  const switchMode = (m: Mode) => {
    setIsRunning(false);
    setIsComplete(false);
    setMode(m);
    setTimeLeft(MODES[m].seconds);
    setShowSettings(false);
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* ── Subtle radial glow at top ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% 0%, hsl(var(--liquid-top) / 0.08) 0%, transparent 70%)",
        }}
      />

      {/* ── Liquid Tank ── */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-all ${isComplete ? "animate-glow-pulse" : ""}`}
        style={{
          height: liquidHeight,
          background: `linear-gradient(to top, hsl(var(--liquid-bottom)), hsl(var(--liquid-top)))`,
          transition: isRunning
            ? "height 1.02s linear"
            : "height 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        <LiquidWave phase={0} />

        {/* Inner liquid shimmer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--liquid-glow) / 0.15) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* ── Timer Display ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        {/* Mode label */}
        <p
          className="text-sm font-light tracking-[0.3em] uppercase mb-8 animate-fade-up"
          style={{
            color: "hsl(var(--foreground) / 0.6)",
            mixBlendMode: "difference",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {MODES[mode].label}
        </p>

        {/* Countdown */}
        <div
          className={`tabular-nums leading-none ${settling ? "animate-settle" : ""}`}
          style={{
            fontSize: "clamp(5rem, 18vw, 14rem)",
            fontFamily: "'DM Mono', monospace",
            fontWeight: 300,
            letterSpacing: "-0.03em",
            color: "hsl(0 0% 96%)",
            mixBlendMode: "difference",
            lineHeight: 1,
          }}
        >
          {formatTime(timeLeft)}
        </div>

        {/* Progress label */}
        <p
          className="mt-8 text-xs tracking-[0.2em] uppercase"
          style={{
            color: "hsl(var(--foreground) / 0.4)",
            mixBlendMode: "difference",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {isComplete
            ? "✦ session complete"
            : isRunning
            ? "in flow"
            : timeLeft === totalSeconds
            ? "ready"
            : "paused"}
        </p>
      </div>

      {/* ── Controls ── */}
      <div className="absolute bottom-12 inset-x-0 flex items-center justify-center gap-4 z-20">
        {/* Reset */}
        <button
          onClick={handleReset}
          className="glass glass-hover rounded-full w-12 h-12 flex items-center justify-center text-foreground/70 hover:text-foreground"
          title="Reset"
        >
          <RotateCcw size={18} strokeWidth={1.5} />
        </button>

        {/* Play / Pause — primary */}
        {isRunning ? (
          <button
            onClick={handlePause}
            className="glass glass-hover rounded-full w-16 h-16 flex items-center justify-center"
            style={{
              background: "hsl(var(--primary) / 0.2)",
              borderColor: "hsl(var(--primary) / 0.6)",
            }}
            title="Pause"
          >
            <Pause size={22} strokeWidth={1.5} style={{ color: "hsl(var(--primary))" }} />
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={timeLeft === 0}
            className="glass glass-hover rounded-full w-16 h-16 flex items-center justify-center disabled:opacity-40"
            style={{
              background: "hsl(var(--primary) / 0.2)",
              borderColor: "hsl(var(--primary) / 0.6)",
            }}
            title="Start"
          >
            <Play
              size={22}
              strokeWidth={1.5}
              style={{ color: "hsl(var(--primary))", marginLeft: 2 }}
            />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="glass glass-hover rounded-full w-12 h-12 flex items-center justify-center text-foreground/70 hover:text-foreground"
          title="Settings"
        >
          {showSettings ? (
            <X size={18} strokeWidth={1.5} />
          ) : (
            <Settings size={18} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div
          className="absolute bottom-32 inset-x-0 flex items-center justify-center z-20 animate-fade-up"
        >
          <div className="glass rounded-2xl p-2 flex gap-2">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="px-4 py-2 rounded-xl text-sm font-light tracking-wide transition-all duration-200"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  background:
                    mode === m
                      ? "hsl(var(--primary) / 0.25)"
                      : "transparent",
                  color:
                    mode === m
                      ? "hsl(var(--primary))"
                      : "hsl(var(--foreground) / 0.65)",
                  borderRadius: "0.75rem",
                  border:
                    mode === m
                      ? "1px solid hsl(var(--primary) / 0.5)"
                      : "1px solid transparent",
                }}
              >
                {MODES[m].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Completion overlay flash ── */}
      {isComplete && (
        <div
          className="absolute inset-0 pointer-events-none z-30 animate-fade-up"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, hsl(var(--liquid-glow) / 0.18) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}
