import React, {
  useState,
  useEffect,
  useMemo,
  memo,
  useCallback,
  useRef,
} from "react";
import { Hourglass, Settings, ChevronRight, Sun, Moon } from "lucide-react";

const MOODS = {
  HAPPY: "green",
  BAD: "red",
  NEUTRAL: "grey",
  EMPTY: "empty",
};

const MOOD_COLORS = {
  [MOODS.HAPPY]: "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]",
  [MOODS.BAD]: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]",
  [MOODS.NEUTRAL]: "bg-zinc-400 shadow-[0_0_12px_rgba(161,161,170,0.2)]",
  [MOODS.EMPTY]:
    "bg-slate-200 border border-slate-300 dark:bg-zinc-800/20 dark:border-zinc-800/50",
};

// 1. Day Component (Memoized for individual cell performance)
const DayCell = memo(
  ({ dayIndex, mood, isPast, isToday, dobString, onClick }) => {
    const dateDetails = useMemo(() => {
      if (!isPast || !dobString) return "Future";
      const date = new Date(dobString);
      date.setDate(date.getDate() + dayIndex);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }, [isPast, dobString, dayIndex]);

    return (
      <button
        onClick={() => onClick(dayIndex)}
        className={`
        aspect-square rounded-[3px] transition-all duration-200 relative
        ${isPast ? MOOD_COLORS[mood] : MOOD_COLORS[MOODS.EMPTY]}
        ${
          !isPast
            ? "opacity-30 dark:opacity-10 cursor-default"
            : "hover:scale-150 hover:z-20 active:scale-90"
        }
        ${
          isToday
            ? "ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-black scale-110 z-10"
            : ""
        }
      `}
        title={dateDetails}
      >
        {isToday && (
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-black text-white uppercase tracking-tighter bg-slate-900 dark:bg-zinc-800 px-2 py-1 rounded-md border border-slate-800 dark:border-zinc-700 whitespace-nowrap shadow-2xl z-50">
            Today
          </span>
        )}
      </button>
    );
  }
);

// 2. Year Chunk Component (Only updates if a mood in THIS specific year changes)
// This prevents React from evaluating 30,000 cells on every click
const YearSection = memo(
  ({ yearIndex, moods, stats, dobString, onDayClick }) => {
    const [hasRendered, setHasRendered] = useState(false);
    const sectionRef = useRef(null);

    // Intersection Observer for Lazy Loading (Only renders DOM nodes when scrolled near)
    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setHasRendered(true);
            observer.disconnect(); // Once loaded, keep it loaded to prevent scroll jitter
          }
        },
        { rootMargin: "800px" } // Load slightly before it comes into view
      );

      if (sectionRef.current) observer.observe(sectionRef.current);
      return () => observer.disconnect();
    }, []);

    return (
      <section
        ref={sectionRef}
        className="relative"
        style={{
          contentVisibility: "auto",
          containIntrinsicSize: "auto 350px",
        }}
      >
        <div className="sticky top-[96px] z-20 bg-slate-50/90 dark:bg-black/80 py-3 backdrop-blur-md mb-8 transition-colors duration-300">
          <h2 className="text-xs font-black tracking-[0.4em] text-slate-400 dark:text-zinc-700 uppercase flex items-center gap-4">
            Year {yearIndex}{" "}
            <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-900/50"></span>
          </h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(20px,1fr))] gap-2.5 min-h-[250px]">
          {hasRendered &&
            Array.from({ length: 365 }).map((_, dayOfYear) => {
              const dayIndex = yearIndex * 365 + dayOfYear;
              const mood = moods[dayIndex] || MOODS.EMPTY;
              const isPast = stats && dayIndex <= stats.livedDays;
              const isToday = stats && dayIndex === stats.livedDays;

              return (
                <DayCell
                  key={dayOfYear}
                  dayIndex={dayIndex}
                  mood={mood}
                  isPast={isPast}
                  isToday={isToday}
                  dobString={dobString}
                  onClick={onDayClick}
                />
              );
            })}
        </div>
      </section>
    );
  },
  (prev, next) => {
    // Custom Equality Check: Only re-render this year if one of ITS days changed
    if (prev.stats?.livedDays !== next.stats?.livedDays) return false;
    if (prev.dobString !== next.dobString) return false;

    const startIndex = prev.yearIndex * 365;
    for (let i = 0; i < 365; i++) {
      const dayIndex = startIndex + i;
      if (prev.moods[dayIndex] !== next.moods[dayIndex]) {
        return false; // Re-render this year
      }
    }
    return true; // Skip re-rendering this year
  }
);

const App = () => {
  // Inject Tailwind CSS for CodeSandbox environments automatically
  useEffect(() => {
    if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.onload = () => {
        window.tailwind.config = {
          darkMode: "class",
        };
      };
      document.head.appendChild(script);
    }
  }, []);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("memento_mori_theme") || "dark"
  );
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [dob, setDob] = useState(
    () => localStorage.getItem("memento_mori_dob") || ""
  );
  const [maxYears, setMaxYears] = useState(
    () => parseInt(localStorage.getItem("memento_mori_years")) || 80
  );
  const [moods, setMoods] = useState(() => {
    const saved = localStorage.getItem("memento_mori_moods");
    return saved ? JSON.parse(saved) : {};
  });
  const [showSettings, setShowSettings] = useState(!dob);
  const [activeMood, setActiveMood] = useState(MOODS.HAPPY);

  // Refs for stable callbacks
  const activeMoodRef = useRef(activeMood);
  useEffect(() => {
    activeMoodRef.current = activeMood;
  }, [activeMood]);

  useEffect(() => {
    localStorage.setItem("memento_mori_theme", theme);
  }, [theme]);
  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  useEffect(() => {
    if (dob) {
      const [y, m, d] = dob.split("-");
      setBirthYear(y);
      setBirthMonth(m);
      setBirthDay(d);
    }
  }, [dob]);

  useEffect(() => {
    if (dob) localStorage.setItem("memento_mori_dob", dob);
    localStorage.setItem("memento_mori_years", maxYears.toString());
  }, [dob, maxYears]);

  useEffect(() => {
    localStorage.setItem("memento_mori_moods", JSON.stringify(moods));
  }, [moods]);

  const stats = useMemo(() => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    const endDate = new Date(birthDate);
    endDate.setFullYear(birthDate.getFullYear() + maxYears);

    const totalDays = Math.floor((endDate - birthDate) / (1000 * 60 * 60 * 24));
    const livedDays = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));

    return {
      totalDays,
      livedDays,
      remainingDays: totalDays - livedDays,
      percentLived: Math.min(100, Math.max(0, (livedDays / totalDays) * 100)),
    };
  }, [dob, maxYears]);

  const livedDaysRef = useRef(stats?.livedDays || 0);
  useEffect(() => {
    if (stats) livedDaysRef.current = stats.livedDays;
  }, [stats]);

  const handleDayClick = useCallback((dayIndex) => {
    if (dayIndex > livedDaysRef.current) return;
    const currentMood = activeMoodRef.current;

    setMoods((prev) => ({
      ...prev,
      [dayIndex]: prev[dayIndex] === currentMood ? MOODS.EMPTY : currentMood,
    }));
  }, []);

  const saveSettings = () => {
    if (birthYear && birthMonth && birthDay) {
      const formattedMonth = birthMonth.toString().padStart(2, "0");
      const formattedDay = birthDay.toString().padStart(2, "0");
      setDob(`${birthYear}-${formattedMonth}-${formattedDay}`);
      setShowSettings(false);
    }
  };

  if (showSettings) {
    return (
      <div className={theme === "dark" ? "dark" : ""}>
        <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 flex items-center justify-center p-6 transition-colors duration-300">
          <div className="max-w-xl w-full relative">
            <button
              onClick={toggleTheme}
              className="absolute -top-16 right-0 p-3 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm hover:scale-110 transition-all text-slate-600 dark:text-zinc-400"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="bg-white dark:bg-zinc-900 p-10 md:p-14 rounded-[3rem] border border-slate-200 dark:border-zinc-800 shadow-[0_0_100px_rgba(0,0,0,0.05)] dark:shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-colors duration-300">
              <div className="flex justify-center mb-10">
                <div className="p-5 bg-slate-100 dark:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700">
                  <Hourglass
                    size={48}
                    strokeWidth={1.5}
                    className="text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <h1 className="text-4xl font-bold text-center mb-3 tracking-tight">
                Life Blueprint
              </h1>
              <p className="text-slate-500 dark:text-zinc-500 text-center mb-12 text-sm uppercase tracking-[0.2em] font-medium">
                Architect your limited time
              </p>

              <div className="space-y-10">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-zinc-500 mb-4 font-black">
                    When were you born?
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      placeholder="YYYY"
                      type="number"
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-600 transition-all text-center text-xl font-medium"
                    />
                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-600 transition-all text-lg appearance-none text-center font-medium"
                    >
                      <option value="">Month</option>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(0, i).toLocaleString("default", {
                            month: "short",
                          })}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="DD"
                      type="number"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-600 transition-all text-center text-xl font-medium"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-950/50 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800/50 transition-colors">
                  <label className="block text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-zinc-500 mb-6 font-black text-center">
                    How many years will you live?
                  </label>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() =>
                        setMaxYears((prev) => Math.max(1, prev - 1))
                      }
                      className="w-12 h-12 flex items-center justify-center bg-slate-200 dark:bg-zinc-800 rounded-full hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors text-2xl text-slate-700 dark:text-zinc-300"
                    >
                      −
                    </button>
                    <div className="flex flex-col items-center">
                      <input
                        type="number"
                        value={maxYears}
                        onChange={(e) =>
                          setMaxYears(parseInt(e.target.value) || 0)
                        }
                        className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-6xl font-black text-center w-32"
                      />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-600 font-bold mt-2">
                        Years Total
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setMaxYears((prev) => Math.min(120, prev + 1))
                      }
                      className="w-12 h-12 flex items-center justify-center bg-slate-200 dark:bg-zinc-800 rounded-full hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors text-2xl text-slate-700 dark:text-zinc-300"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={saveSettings}
                  disabled={!birthYear || !birthMonth || !birthDay || !maxYears}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.3em] py-6 rounded-3xl hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-10 disabled:grayscale transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_rgba(255,255,255,0.1)] group"
                >
                  Assemble Timeline{" "}
                  <ChevronRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 font-sans pb-48 transition-colors duration-300">
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-slate-200 dark:border-zinc-900 px-6 py-6 transition-colors duration-300">
          <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-slate-100 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 transition-colors">
                <Hourglass
                  size={20}
                  className="text-slate-600 dark:text-zinc-400"
                />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-[0.2em] uppercase leading-none">
                  Memento Mori
                </h1>
                <p className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase tracking-[0.3em] mt-1 font-bold">
                  {maxYears} Year Odyssey
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-3 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-slate-500 dark:text-zinc-500 border border-transparent flex items-center justify-center"
                title="Toggle Theme"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-3 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-slate-600 dark:text-zinc-500 border border-slate-200 dark:border-zinc-900 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              >
                <Settings size={16} /> Edit Life
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 pt-12">
          {/* Progress Grid Summary */}
          <div className="mb-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                label: "Days Lived",
                val: stats?.livedDays.toLocaleString() || "0",
                color: "text-slate-900 dark:text-zinc-100",
              },
              {
                label: "Days Left",
                val: stats?.remainingDays.toLocaleString() || "0",
                color: "text-slate-500 dark:text-zinc-500",
              },
              {
                label: "Completion",
                val: `${Math.round(stats?.percentLived || 0)}%`,
                color: "text-slate-400 dark:text-zinc-300",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900/30 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800/50 backdrop-blur-sm transition-colors duration-300 shadow-sm dark:shadow-none"
              >
                <div className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase tracking-[0.3em] mb-3 font-black">
                  {item.label}
                </div>
                <div
                  className={`text-5xl font-light tabular-nums tracking-tighter ${item.color}`}
                >
                  {item.val}
                </div>
              </div>
            ))}
          </div>

          {/* The Big Grid - Rendered using chunked, lazy-loaded Year components */}
          <div className="space-y-24">
            {Array.from({ length: maxYears }).map((_, yearIndex) => (
              <YearSection
                key={yearIndex}
                yearIndex={yearIndex}
                moods={moods}
                stats={stats}
                dobString={dob}
                onDayClick={handleDayClick}
              />
            ))}
          </div>
        </main>

        {/* Modern Fixed Palette Footer */}
        <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-50">
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl border border-slate-200 dark:border-zinc-800 p-2 rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.9)] transition-colors duration-300">
            <div className="flex items-center justify-between gap-2">
              {[
                { id: MOODS.HAPPY, color: "bg-green-500", label: "Happy" },
                { id: MOODS.NEUTRAL, color: "bg-zinc-400", label: "Neutral" },
                { id: MOODS.BAD, color: "bg-red-500", label: "Bad" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMood(m.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 px-3 rounded-[2rem] transition-all relative ${
                    activeMood === m.id
                      ? "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"
                      : "opacity-40 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${m.color} ${
                      activeMood === m.id
                        ? "ring-4 ring-slate-900/10 dark:ring-white/10"
                        : ""
                    }`}
                  ></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-zinc-200">
                    {m.label}
                  </span>
                  {activeMood === m.id && (
                    <div className="absolute -top-1 right-2 w-2 h-2 bg-slate-900 dark:bg-white rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
            <div className="pt-2 pb-1 text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-600 font-bold">
                Select mood, then tap past days to log
              </p>
            </div>
          </div>
        </footer>

        <style>{`
          ::-webkit-scrollbar {
            width: 6px;
          }
          ::-webkit-scrollbar-track {
            background: ${theme === "dark" ? "#000" : "#f8fafc"};
          }
          ::-webkit-scrollbar-thumb {
            background: ${theme === "dark" ? "#27272a" : "#cbd5e1"};
            border-radius: 10px;
          }
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
          body {
            overscroll-behavior: none;
            background-color: ${theme === "dark" ? "#000" : "#f8fafc"};
            transition: background-color 0.3s ease;
          }
        `}</style>
      </div>
    </div>
  );
};

export default App;
