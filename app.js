const { useEffect, useMemo, useState } = React;

const LS_KEY = "wk-tracker-static-v1";

const CYCLES = {
  strength: {
    label: "Strength",
    dayA: {
      title: "Day A — Chest / Back / Light Arms",
      blocks: [
        { heading: "Flat DB Press", items: ["Set 1: 70 × 6–8", "Set 2: 60–65 × 8–10", "Set 3: 60 × 10–12", "Rest: ~90s"] },
        { heading: "Back Pull Machine", items: ["3 sets: 8 / 10 / 12", "Rest: 75–90s", "Alternate grip weekly"] },
        { heading: "Incline DB Press", items: ["3 × 8–10", "3-sec controlled descent", "Rest: ~75s"] },
        { heading: "Light Arms", items: ["Biceps: 2 × 8–12", "Triceps: 2 × 10–12"] }
      ]
    },
    dayB: {
      title: "Day B — Legs / Delts / Core",
      blocks: [
        { heading: "Lower Body", items: ["Goblet squat: 3 × 8–12", "Romanian deadlift: 3 × 8–10", "Bulgarian split squat: 3 × 8–10/leg"] },
        { heading: "Delts", items: ["Lateral raises: 3 × 12–15", "No swinging"] },
        { heading: "Core (choose 2)", items: ["Plank: 30–45s", "Side plank: 30s/side", "Dead bug: 10 slow reps"] }
      ]
    },
    guidance: [
      "Stop 1–2 reps before failure.",
      "Add weight only when top reps are clean and controlled.",
      "Deload every 8–10 weeks (~10% lighter)."
    ]
  },
  fatloss: {
    label: "Fat Loss",
    dayA: {
      title: "Day A — Upper Body Density Supersets",
      blocks: [
        { heading: "Superset 1 (3 rounds)", items: ["Flat DB press: 70 × 6–8", "Back pull machine: 8–10", "Rest 60–75s after the pair"] },
        { heading: "Superset 2 (2–3 rounds)", items: ["Incline DB press: 8–10", "Row/pull variation: 10–12", "Rest ~60s after the pair"] },
        { heading: "Arms finisher", items: ["Biceps: 2 × 10–12", "Triceps: 2 × 10–12", "Minimal rest"] }
      ]
    },
    dayB: {
      title: "Day B — Lower Body Density + Core",
      blocks: [
        { heading: "Superset 1 (3 rounds)", items: ["Goblet squat: 8–12", "Romanian deadlift: 8–10", "Rest ~75s after the pair"] },
        { heading: "Superset 2 (3 rounds)", items: ["Bulgarian split squat: 8/leg", "Lateral raises: 12–15", "Rest ~60s after the pair"] },
        { heading: "Core circuit (2 rounds)", items: ["Plank: 40s", "Dead bug: 10", "Side plank: 30s/side", "Minimal rest"] }
      ]
    },
    guidance: [
      "Keep rest short but controlled; never grind reps.",
      "Maintain 1–2 reps in reserve.",
      "Add 30–45 min walks on off days.",
      "Pair with a modest calorie deficit (avoid crash dieting)."
    ]
  }
};

const THREE_DAY_PATTERN = {
  weekOdd: ["A", "B", "A"],
  weekEven: ["B", "A", "B"]
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
  try { return JSON.parse(json) ?? fallback; } catch { return fallback; }
}

function Card({ title, right, children }) {
  return (
    <div className="card">
      <div className="cardH">
        <div className="cardT">{title}</div>
        {right}
      </div>
      <div className="cardB">{children}</div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(() => {
    const fallback = {
      cycleKey: "strength",
      startDateISO: new Date().toISOString().slice(0, 10),
      completion: {},
      notes: {}
    };
    const saved = localStorage.getItem(LS_KEY);
    return saved ? { ...fallback, ...safeParse(saved, fallback) } : fallback;
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const cycle = CYCLES[state.cycleKey] || CYCLES.strength;
  const startDate = useMemo(() => new Date(state.startDateISO + "T00:00:00"), [state.startDateISO]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const dayIndex = useMemo(() => daysBetween(startDate, today), [startDate, today]);
  const weekNumber = useMemo(() => Math.max(1, Math.floor(dayIndex / 7) + 1), [dayIndex]);
  const isEvenWeek = weekNumber % 2 === 0;
  const weekStart = useMemo(() => addDays(startDate, (weekNumber - 1) * 7), [startDate, weekNumber]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const pattern = useMemo(() => (isEvenWeek ? THREE_DAY_PATTERN.weekEven : THREE_DAY_PATTERN.weekOdd), [isEvenWeek]);

  const sessions = useMemo(() => {
    const offsets = [0, 2, 4]; // M/W/F-ish
    return pattern.map((kind, idx) => {
      const plannedDate = addDays(weekStart, offsets[idx]);
      const sessionId = `${state.cycleKey}-${weekStart.toISOString().slice(0,10)}-w${weekNumber}-s${idx+1}-${kind}`;
      return {
        sessionId,
        kind,
        plannedDate,
        title: kind === "A" ? cycle.dayA.title : cycle.dayB.title,
        detail: kind === "A" ? cycle.dayA : cycle.dayB
      };
    });
  }, [pattern, weekStart, weekNumber, state.cycleKey, cycle.dayA, cycle.dayB]);

  const completedCount = useMemo(
    () => sessions.reduce((acc, s) => acc + (state.completion?.[s.sessionId]?.done ? 1 : 0), 0),
    [sessions, state.completion]
  );

  function toggleDone(sessionId, done) {
    setState(prev => {
      const completion = { ...(prev.completion || {}) };
      completion[sessionId] = done ? { done: true, doneAtISO: new Date().toISOString() } : { done: false };
      return { ...prev, completion };
    });
  }

  function setNote(sessionId, note) {
    setState(prev => ({ ...prev, notes: { ...(prev.notes || {}), [sessionId]: note } }));
  }

  function resetAll() {
    if (!confirm("Reset all completion and notes?")) return;
    setState(prev => ({ ...prev, completion: {}, notes: {} }));
  }

  function setTodayAsWeek1() {
    if (!confirm("Set today as the start of Week 1?")) return;
    setState(prev => ({ ...prev, startDateISO: new Date().toISOString().slice(0,10) }));
  }

  return (
    <div>
      <div className="header">
        <div className="h1">Workout Week Tracker</div>
        <div className="sub">
          3-day A/B rotation: Week 1 = A/B/A, Week 2 = B/A/B. Saved on this device.
        </div>

        <div className="row">
          <button className={"pill " + (state.cycleKey === "strength" ? "active" : "")}
            onClick={() => setState(p => ({ ...p, cycleKey: "strength" }))}>
            Strength
          </button>
          <button className={"pill " + (state.cycleKey === "fatloss" ? "active" : "")}
            onClick={() => setState(p => ({ ...p, cycleKey: "fatloss" }))}>
            Fat Loss
          </button>
        </div>
      </div>

      <div className="grid cols3">
        <Card title="Current Week" right={<span className="badge">{cycle.label}</span>}>
          <div className="big">Week {weekNumber}</div>
          <div className="muted">{formatDate(weekStart)} – {formatDate(weekEnd)}</div>
          <div style={{ marginTop: 10 }} className="muted">Completed: <b>{completedCount}</b> / {sessions.length}</div>
             <div style={{ marginTop: 10 }} className="row">
  <button className="btn" onClick={() => markSessionToday(0)}>
    I did Session 1 today
  </button>
  <button className="btn" onClick={() => markSessionToday(1)}>
    I did Session 2 today
  </button>
  <button className="btn" onClick={() => markSessionToday(2)}>
    I did Session 3 today
  </button>
</div>
          <div style={{ marginTop: 10 }} className="row">
            {pattern.map((k, i) => <span key={i} className="badge">Session {i+1}: {k}</span>)}
          </div>
        </Card>

        <Card title="Start Date (Week 1)" right={<span className="badge">Editable</span>}>
          <div className="muted">Set the date you want to count as Week 1 Day 1.</div>
          <div style={{ marginTop: 10 }} className="row">
            <input
              className="btn"
              type="date"
              value={state.startDateISO}
              onChange={(e) => setState(p => ({ ...p, startDateISO: e.target.value }))}
            />
          </div>
          <div style={{ marginTop: 10 }} className="row">
            <button className="btn" onClick={setTodayAsWeek1}>Set today as Week 1</button>
            <button className="btn" onClick={resetAll}>Reset</button>
          </div>
        </Card>

        <Card title="Guidance" right={<span className="badge">Quick rules</span>}>
          <ul>
            {cycle.guidance.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </Card>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid">
        {sessions.map((s, idx) => {
          const done = !!state.completion?.[s.sessionId]?.done;
          const doneAt = state.completion?.[s.sessionId]?.doneAtISO;

          return (
            <Card
              key={s.sessionId}
              title={`Session ${idx+1}: ${s.kind} · ${formatDate(s.plannedDate)}`}
              right={<span className="badge">{s.kind === "A" ? "Upper" : "Lower"}</span>}
            >
              <div className="check" onClick={() => toggleDone(s.sessionId, !done)}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => toggleDone(s.sessionId, e.target.checked)}
                />
                <div>
                  <div className="sessionTitle">{s.title}</div>
                  {doneAt ? <div className="muted">Completed: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(doneAt))}</div> : null}
                </div>
              </div>

              <div style={{ height: 12 }} />
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {s.detail.blocks.map((b, i) => (
                  <div className="block" key={i}>
                    <h4>{b.heading}</h4>
                    <ul>
                      {b.items.map((it, j) => <li key={j}>{it}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              <div style={{ height: 12 }} />
              <div className="sessionTitle">Notes</div>
              <textarea
                rows={3}
                value={state.notes?.[s.sessionId] || ""}
                onChange={(e) => setNote(s.sessionId, e.target.value)}
                placeholder="Weights used, reps achieved, how it felt, etc."
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
