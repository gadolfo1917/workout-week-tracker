import React, { useEffect, useMemo, useState } from "react";

/**
 * Workout Week Tracker (A/B rotation)
 * - Tracks cycles: Strength, Fat Loss
 * - Supports 3-day schedule: Week 1 A/B/A, Week 2 B/A/B (repeats)
 * - Stores progress in localStorage
 *
 * Notes:
 * - This is a simple single-file React app component.
 * - Tailwind classes are used for styling.
 */

const LS_KEY = "wk-tracker-v1";

const CYCLES = {
  strength: {
    label: "Strength",
    dayA: {
      title: "Day A — Chest / Back / Light Arms",
      blocks: [
        {
          heading: "Flat DB Press",
          items: ["Set 1: 6–8", "Set 2: 8–10", "Set 3: 10–12", "Rest: ~90s"],
          loadKey: "flatPress",
          defaultLoad: "80 / 70 / 60",
        },
        {
          heading: "Back Pull Machine",
          items: ["3 sets: 8 / 10 / 12", "Rest: 75–90s", "Alternate grip weekly"],
          loadKey: "backPull",
          defaultLoad: "",
        },
        {
          heading: "Incline DB Press",
          items: ["Top set: 5–7", "Back-off sets: 8–12", "3-sec controlled descent"],
          loadKey: "inclinePress",
          defaultLoad: "60 / 50 / 50",
        },
        {
          heading: "Biceps",
          items: ["2 × 8–12", "Controlled tempo"],
          loadKey: "biceps",
          defaultLoad: "40",
        },
        {
          heading: "Triceps",
          items: ["2 × 10–12", "Full stretch, no strain"],
          loadKey: "triceps",
          defaultLoad: "45",
        },
      ],
    },
    dayB: {
      title: "Day B — Legs / Delts / Core",
      blocks: [
        {
          heading: "Goblet Squat",
          items: ["3 × 8–12", "Add weight when 12 feels easy"],
          loadKey: "gobletSquat",
          defaultLoad: "",
        },
        {
          heading: "Romanian Deadlift",
          items: ["3 × 8–10", "Neutral spine, hips back"],
          loadKey: "rdl",
          defaultLoad: "",
        },
        {
          heading: "Bulgarian Split Squat",
          items: ["3 × 8–10/leg", "Balance + control"],
          loadKey: "splitSquat",
          defaultLoad: "",
        },
        {
          heading: "Lateral Raises",
          items: ["3 × 12–15", "No swinging"],
          loadKey: "lateralRaise",
          defaultLoad: "20 each side",
        },
        {
          heading: "Core",
          items: ["Choose 2: plank, side plank, dead bug", "30–45 sec or slow reps"],
          loadKey: "core",
          defaultLoad: "bodyweight",
        },
      ],
    },
    guidance: [
      "Stop 1–2 reps before failure.",
      "Add weight only when the top rep range is clean and controlled.",
      "Deload every 8–10 weeks (~10% lighter).",
    ],
  },
  fatloss: {
    label: "Fat Loss",
    dayA: {
      title: "Day A — Upper Body Density Supersets",
      blocks: [
        {
          heading: "Superset 1: Flat DB Press + Back Pull",
          items: ["3 rounds", "Flat DB press: 6–8", "Back pull machine: 8–10", "Rest 60–75s after pair"],
          loadKey: "fatUpperSuperset1",
          defaultLoad: "Press 80 / Pull ___",
        },
        {
          heading: "Superset 2: Incline DB Press + Row/Pull",
          items: ["2–3 rounds", "Incline DB press: 8–10", "Row/pull variation: 10–12", "Rest ~60s after pair"],
          loadKey: "fatUpperSuperset2",
          defaultLoad: "Incline 60/50 / Row ___",
        },
        {
          heading: "Arms Finisher",
          items: ["Biceps: 2 × 10–12", "Triceps: 2 × 10–12", "Minimal rest"],
          loadKey: "fatArms",
          defaultLoad: "Biceps 40 / Triceps 45",
        },
      ],
    },
    dayB: {
      title: "Day B — Lower Body Density + Core",
      blocks: [
        {
          heading: "Superset 1: Goblet Squat + RDL",
          items: ["3 rounds", "Goblet squat: 8–12", "Romanian deadlift: 8–10", "Rest ~75s after pair"],
          loadKey: "fatLowerSuperset1",
          defaultLoad: "",
        },
        {
          heading: "Superset 2: Split Squat + Lateral Raises",
          items: ["3 rounds", "Bulgarian split squat: 8/leg", "Lateral raises: 12–15", "Rest ~60s after pair"],
          loadKey: "fatLowerSuperset2",
          defaultLoad: "Raises 20 each side",
        },
        {
          heading: "Core Circuit",
          items: ["2 rounds", "Plank: 40s", "Dead bug: 10", "Side plank: 30s/side"],
          loadKey: "fatCore",
          defaultLoad: "bodyweight",
        },
      ],
    },
    guidance: [
      "Keep rest short but controlled; never grind reps.",
      "Maintain 1–2 reps in reserve.",
      "Add 30–45 min walks on off days.",
      "Pair with a modest calorie deficit (avoid crash dieting).",
    ],
  },
};

// 3-day template that alternates each week
const THREE_DAY_PATTERN = {
  weekOdd: ["A", "B", "A"],
  weekEven: ["B", "A", "B"],
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(date, days) {
  const x = new Date(date);
  x.setDate(x.getDate() + days);
  return x;
}

function daysBetween(a, b) {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDate(d) {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function safeParse(json, fallback) {
  try {
    const x = JSON.parse(json);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-white/70">
      {children}
    </span>
  );
}

function PillButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-sm transition shadow-sm border " +
        (active
          ? "bg-black text-white border-black"
          : "bg-white text-black border-black/15 hover:border-black/30")
      }
      type="button"
    >
      {children}
    </button>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-black/10">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-black/90">{title}</div>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Checkbox({ checked, onChange, label, sub }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        className="mt-1 h-4 w-4 rounded border-black/20"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-black/90">{label}</div>
        {sub ? <div className="text-xs text-black/55">{sub}</div> : null}
      </div>
    </label>
  );
}

export default function WorkoutWeekTrackerApp() {
  const [state, setState] = useState(() => {
    const fallback = {
      cycleKey: "strength",
      // default start date: today
      startDateISO: new Date().toISOString().slice(0, 10),
      // completion map: sessionId -> { done: boolean, doneAtISO?: string }
      completion: {},
      // optional notes: sessionId -> string
      notes: {},
      // adjustable load targets: loadKey -> string
      loads: {},
      // per-session achieved reps/log: sessionId -> { loadKey -> string }
      sessionLogs: {},
    };
    const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    return saved ? { ...fallback, ...safeParse(saved, fallback) } : fallback;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const cycle = CYCLES[state.cycleKey] ?? CYCLES.strength;

  const startDate = useMemo(() => new Date(state.startDateISO + "T00:00:00"), [state.startDateISO]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const dayIndex = useMemo(() => daysBetween(startDate, today), [startDate, today]);
  const weekNumber = useMemo(() => Math.max(1, Math.floor(dayIndex / 7) + 1), [dayIndex]);
  const isEvenWeek = weekNumber % 2 === 0;

  const weekStart = useMemo(() => addDays(startDate, (weekNumber - 1) * 7), [startDate, weekNumber]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const pattern = useMemo(() => (isEvenWeek ? THREE_DAY_PATTERN.weekEven : THREE_DAY_PATTERN.weekOdd), [isEvenWeek]);

  // Build 3 sessions for the current week: Mon/Wed/Fri relative to weekStart
  const sessions = useMemo(() => {
    // Use offsets 0, 2, 4 to mimic M/W/F; user can still do them any day.
    const offsets = [0, 2, 4];
    return pattern.map((kind, idx) => {
      const date = addDays(weekStart, offsets[idx]);
      const sessionId = `${state.cycleKey}-${formatDate(weekStart)}-w${weekNumber}-s${idx + 1}-${kind}`;
      return {
        sessionId,
        kind, // A or B
        plannedDate: date,
        title: kind === "A" ? cycle.dayA.title : cycle.dayB.title,
        detail: kind === "A" ? cycle.dayA : cycle.dayB,
      };
    });
  }, [pattern, weekStart, weekNumber, state.cycleKey, cycle.dayA, cycle.dayB]);

  const completedCount = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (state.completion?.[s.sessionId]?.done ? 1 : 0), 0);
  }, [sessions, state.completion]);

  function markSessionToday(sessionIndex) {
    const s = sessions[sessionIndex];
    if (!s) return;
    // Mark as done with a timestamp of "now" (auto-dated)
    toggleDone(s.sessionId, true);
  }

  function toggleDone(sessionId, done) {
    setState((prev) => {
      const next = { ...prev };
      next.completion = { ...(prev.completion || {}) };
      next.completion[sessionId] = done
        ? { done: true, doneAtISO: new Date().toISOString() }
        : { done: false };
      return next;
    });
  }

  function setNote(sessionId, note) {
    setState((prev) => ({
      ...prev,
      notes: { ...(prev.notes || {}), [sessionId]: note },
    }));
  }

  function setLoad(loadKey, value) {
    setState((prev) => ({
      ...prev,
      loads: { ...(prev.loads || {}), [loadKey]: value },
    }));
  }

  function setSessionLog(sessionId, loadKey, value) {
    setState((prev) => ({
      ...prev,
      sessionLogs: {
        ...(prev.sessionLogs || {}),
        [sessionId]: {
          ...((prev.sessionLogs || {})[sessionId] || {}),
          [loadKey]: value,
        },
      },
    }));
  }

  function resetAll() {
    const ok = window.confirm("Reset all completion and notes? This cannot be undone.");
    if (!ok) return;
    setState((prev) => ({ ...prev, completion: {}, notes: {} }));
  }

  function jumpToTodayAsWeek1() {
    const ok = window.confirm("Set today as the start of Week 1? This will change the week calculation.");
    if (!ok) return;
    const iso = new Date().toISOString().slice(0, 10);
    setState((prev) => ({ ...prev, startDateISO: iso }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Workout Week Tracker</div>
            <div className="mt-1 text-sm text-black/60">
              Tracks your 3-day A/B rotation (Week 1: A/B/A, Week 2: B/A/B) for Strength or Fat Loss.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PillButton
              active={state.cycleKey === "strength"}
              onClick={() => setState((p) => ({ ...p, cycleKey: "strength" }))}
            >
              Strength
            </PillButton>
            <PillButton
              active={state.cycleKey === "fatloss"}
              onClick={() => setState((p) => ({ ...p, cycleKey: "fatloss" }))}
            >
              Fat Loss
            </PillButton>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            title="Current Week"
            right={<Badge>{cycle.label} cycle</Badge>}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-4xl font-semibold">Week {weekNumber}</div>
              <div className="text-sm text-black/60">{isEvenWeek ? "Even" : "Odd"} week pattern</div>
            </div>
            <div className="mt-2 text-sm text-black/70">
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </div>
            <div className="mt-4">
              <div className="text-sm font-medium">This week’s plan</div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {pattern.map((k, i) => (
                  <Badge key={i}>Session {i + 1}: {k}</Badge>
                ))}
              </div>
            </div>
            <div className="mt-4 text-sm">
              <span className="font-medium">Completed:</span> {completedCount} / {sessions.length}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => markSessionToday(0)}
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm hover:border-black/30"
              >
                I did Session 1 today
              </button>
              <button
                type="button"
                onClick={() => markSessionToday(1)}
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm hover:border-black/30"
              >
                I did Session 2 today
              </button>
              <button
                type="button"
                onClick={() => markSessionToday(2)}
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm hover:border-black/30"
              >
                I did Session 3 today
              </button>
            </div>
          </Card>

          <Card title="Start Date (Week 1)" right={<Badge>Editable</Badge>}>
            <div className="text-sm text-black/70">Pick the date you want to count as Week 1 Day 1.</div>
            <div className="mt-3 flex items-center gap-2">
              <input
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                type="date"
                value={state.startDateISO}
                onChange={(e) => setState((p) => ({ ...p, startDateISO: e.target.value }))}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={jumpToTodayAsWeek1}
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm hover:border-black/30"
              >
                Set today as Week 1
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm hover:border-black/30"
              >
                Reset checkboxes/notes
              </button>
            </div>
          </Card>

          <Card title="Cycle Guidance" right={<Badge>Quick rules</Badge>}>
            <ul className="space-y-2 text-sm text-black/80">
              {cycle.guidance.map((g, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-black/50" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4">
          {sessions.map((s, idx) => {
            const done = !!state.completion?.[s.sessionId]?.done;
            const doneAt = state.completion?.[s.sessionId]?.doneAtISO;
            return (
              <Card
                key={s.sessionId}
                title={`Session ${idx + 1}: ${s.kind}  ·  ${formatDate(s.plannedDate)}`}
                right={<Badge>{s.kind === "A" ? "Upper" : "Lower"}</Badge>}
              >
                <div className="flex flex-col gap-3">
                  <Checkbox
                    checked={done}
                    onChange={(v) => toggleDone(s.sessionId, v)}
                    label={s.title}
                    sub={doneAt ? `Completed: ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(doneAt))}` : ""}
                  />

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {s.detail.blocks.map((b, i) => {
                      const targetLoad = state.loads?.[b.loadKey] ?? b.defaultLoad ?? "";
                      const actualLog = state.sessionLogs?.[s.sessionId]?.[b.loadKey] ?? "";
                      return (
                        <div key={i} className="rounded-2xl border border-black/10 bg-zinc-50 p-3">
                          <div className="text-sm font-semibold">{b.heading}</div>
                          <ul className="mt-2 space-y-1 text-sm text-black/80">
                            {b.items.map((it, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-black/40" />
                                <span>{it}</span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <label className="text-xs font-medium text-black/70">
                              Target load
                              <input
                                className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm"
                                value={targetLoad}
                                onChange={(e) => setLoad(b.loadKey, e.target.value)}
                                placeholder="Example: 80 / 70 / 60"
                              />
                            </label>
                            <label className="text-xs font-medium text-black/70">
                              Actual today / reps
                              <input
                                className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm"
                                value={actualLog}
                                onChange={(e) => setSessionLog(s.sessionId, b.loadKey, e.target.value)}
                                placeholder="Example: 80x6, 70x8, 60x10"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <div className="text-sm font-medium">Notes</div>
                    <textarea
                      className="mt-2 w-full rounded-2xl border border-black/15 bg-white px-3 py-2 text-sm shadow-sm"
                      rows={3}
                      value={state.notes?.[s.sessionId] || ""}
                      onChange={(e) => setNote(s.sessionId, e.target.value)}
                      placeholder="Weights used, reps achieved, how it felt, etc."
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70">
          <div className="font-medium text-black/90">Tip</div>
          <div className="mt-1">
            If you train 4 days/week, just run A/B/A/B and mark the sessions you complete—this tracker is still useful for the alternating pattern.
          </div>
        </div>
      </div>
    </div>
  );
}
