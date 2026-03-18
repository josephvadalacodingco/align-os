/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState } from 'react';

type LaneKey =
  | 'CRITICAL_IMMEDIATE'
  | 'HIGH_IMPORTANCE'
  | 'URGENT_LOW_IMPORTANCE'
  | 'LOW_IMPACT';

type BoardTask = {
  id: string;
  title: string;
  type: 'ENDEAVOR' | 'LIFE_MAINTENANCE';
  importance: number;
  urgency: number;
  durationHours: number;
  recurringRule: string | null;
  endeavorId: string | null;
  score: number;
};

type LaneBuckets = Record<LaneKey, BoardTask[]>;

type BoardColumn = {
  id: string;
  name: string;
  priorityRank?: number;
  baselineHours?: number | null;
  lanes: LaneBuckets;
};

type Capacity = {
  weekTotalHours: number;
  strategicHours: number;
  selectedHours: number;
  slackHours: number;
};

type CalendarEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: 'HARD_CONSTRAINT' | 'SCHEDULED_TASK';
};

type WeeklyBoardResponse = {
  usingDemoData: boolean;
  capacity: Capacity;
  endeavors: { id: string; name: string; priorityRank: number; baselineHours?: number | null }[];
  lifeMaintenanceColumnId: string;
  tasksByEndeavor: Record<string, LaneBuckets>;
  events: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    type: 'HARD_CONSTRAINT' | 'SCHEDULED_TASK';
  }[];
};

const laneLabels: Record<LaneKey, string> = {
  CRITICAL_IMMEDIATE: 'Critical & Immediate',
  HIGH_IMPORTANCE: 'High Importance',
  URGENT_LOW_IMPORTANCE: 'Urgent but Low Importance',
  LOW_IMPACT: 'Low Impact',
};

export default function AppPage() {
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requireFullAllocation, setRequireFullAllocation] = useState(false);
  const [inflationHint, setInflationHint] = useState<string | null>(null);
  const [showOnboardingHint, setShowOnboardingHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/weekly-board', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to load board (${res.status})`);
        }
        const data: WeeklyBoardResponse = await res.json();
        if (cancelled) return;

        const cols: BoardColumn[] = [];
        const lifeMaintenanceId = data.lifeMaintenanceColumnId;

        const sortedEndeavors = [...data.endeavors].sort(
          (a, b) => a.priorityRank - b.priorityRank
        );

        for (const endeavor of sortedEndeavors) {
          cols.push({
            id: endeavor.id,
            name: endeavor.name,
            priorityRank: endeavor.priorityRank,
            baselineHours: endeavor.baselineHours ?? undefined,
            lanes:
              data.tasksByEndeavor[endeavor.id] ??
              emptyLanes(),
          });
        }

        cols.push({
          id: lifeMaintenanceId,
          name: 'Life Maintenance',
          lanes: data.tasksByEndeavor[lifeMaintenanceId] ?? emptyLanes(),
        });

        setColumns(cols);
        setShowOnboardingHint(cols.length === 1 && cols[0].id === lifeMaintenanceId);
        setCapacity(data.capacity);
        setEvents(
          data.events.map((e) => ({
            ...e,
            startTime: e.startTime,
            endTime: e.endTime,
          }))
        );
        updateInflationHint(cols);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load weekly board'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedHours = useMemo(() => {
    let total = 0;
    for (const col of columns) {
      for (const laneKey of Object.keys(col.lanes) as LaneKey[]) {
        for (const task of col.lanes[laneKey]) {
          total += task.durationHours;
        }
      }
    }
    return Number(total.toFixed(1));
  }, [columns]);

  const effectiveCapacity = useMemo(() => {
    if (!capacity) return null;
    const selected = Math.min(selectedHours, capacity.strategicHours);
    const slack = Math.max(0, capacity.strategicHours - selected);
    return {
      ...capacity,
      selectedHours: selected,
      slackHours: Number(slack.toFixed(1)),
    };
  }, [capacity, selectedHours]);

  const selectionRatio =
    effectiveCapacity && effectiveCapacity.strategicHours > 0
      ? effectiveCapacity.selectedHours / effectiveCapacity.strategicHours
      : 0;

  function updateInflationHint(cols: BoardColumn[]) {
    let highOrCriticalCount = 0;
    let totalTasks = 0;
    cols.forEach((col) => {
      (Object.keys(col.lanes) as LaneKey[]).forEach((laneKey) => {
        col.lanes[laneKey].forEach((task) => {
          totalTasks += 1;
          if (task.importance >= 3) {
            highOrCriticalCount += 1;
          }
        });
      });
    });
    if (totalTasks >= 6 && highOrCriticalCount / totalTasks > 0.6) {
      setInflationHint('Are all of these truly high impact?');
    } else {
      setInflationHint(null);
    }
  }

  const displayedLanesForCapacity = (laneKey: LaneKey) => {
    if (!effectiveCapacity) return true;
    const ratio = selectionRatio;
    if (laneKey === 'LOW_IMPACT') return false;
    if (laneKey === 'URGENT_LOW_IMPORTANCE' && ratio < 0.6) return false;
    return true;
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <header className="app-header">
          <div>
            <div className="badge-subtle">AlignOS • Weekly Planning</div>
            <h1 className="app-title">Know exactly what matters this week.</h1>
          </div>
          <label className="pill-toggle">
            <input
              type="checkbox"
              checked={requireFullAllocation}
              onChange={(e) => setRequireFullAllocation(e.target.checked)}
            />
            <span className="pill-toggle-label">Require full allocation</span>
          </label>
        </header>

        {effectiveCapacity && (
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Capacity</h2>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem' }}>
                <span>
                  <span className="capacity-label">Strategic hours:</span>{' '}
                  <span className="capacity-value">
                    {effectiveCapacity.strategicHours.toFixed(1)}
                  </span>
                </span>
                <span>
                  <span className="capacity-label">Selected:</span>{' '}
                  <span className="capacity-value">
                    {effectiveCapacity.selectedHours.toFixed(1)}
                  </span>
                </span>
                <span>
                  <span className="capacity-label">Slack:</span>{' '}
                  <span className="capacity-value">
                    {effectiveCapacity.slackHours.toFixed(1)}
                  </span>
                </span>
              </div>
            </div>
            <div className="capacity-bar">
              <div className="capacity-bar-background" />
              <div
                className="capacity-bar-fill"
                style={{
                  transform: `scaleX(${Math.min(1, selectionRatio)})`,
                  background:
                    selectionRatio > 1 || (requireFullAllocation && selectionRatio < 0.99)
                      ? '#ef4444'
                      : '#22c55e',
                }}
              />
            </div>
            {requireFullAllocation && selectionRatio < 0.99 && (
              <p
                style={{
                  marginTop: '0.4rem',
                  fontSize: '0.75rem',
                  color: '#f97316',
                }}
              >
                You enabled full allocation, but there is still unplanned capacity.
              </p>
            )}
            {!requireFullAllocation && (
              <p
                style={{
                  marginTop: '0.4rem',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                }}
              >
                Slack is intentional here. You do not have to fill the week.
              </p>
            )}
          </section>
        )}

        {showOnboardingHint && (
          <p
            style={{
              fontSize: '0.8rem',
              color: '#d1d5db',
            }}
          >
            No Endeavors yet.{' '}
            <a
              href="/onboarding"
              style={{ textDecoration: 'underline', color: '#38bdf8' }}
            >
              Run the quick setup
            </a>{' '}
            to define what actually matters before you plan.
          </p>
        )}

        {inflationHint && (
          <p
            style={{
              fontSize: '0.8rem',
              color: '#f97316',
            }}
          >
            {inflationHint}
          </p>
        )}

        {error && (
          <p style={{ color: '#f97316', fontSize: '0.8rem' }}>{error}</p>
        )}
        {loading && (
          <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Loading your Decision Board…
          </p>
        )}

        <section className="app-grid">
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Decision Board</h2>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Importance → Urgency → Identity
              </span>
            </div>
            <div className="decision-board">
              {columns.map((col) => (
                <article key={col.id} className="decision-column">
                  <div className="decision-column-header">
                    <h3 className="decision-column-title">{col.name}</h3>
                    <span className="decision-column-meta">
                      {col.priorityRank != null && `#${col.priorityRank}`}{' '}
                      {col.baselineHours != null &&
                        `• ${col.baselineHours.toFixed(1)}h baseline`}
                    </span>
                  </div>
                  {(Object.keys(col.lanes) as LaneKey[]).map((laneKey) => {
                    const shouldShow = displayedLanesForCapacity(laneKey);
                    if (!shouldShow && col.lanes[laneKey].length === 0) {
                      return null;
                    }
                    const isAlwaysCollapsed = laneKey === 'LOW_IMPACT';
                    const tasks = col.lanes[laneKey];
                    const visible =
                      !isAlwaysCollapsed || tasks.length > 0
                        ? shouldShow || tasks.length > 0
                        : false;
                    if (!visible) return null;
                    return (
                      <section key={laneKey} className="lane">
                        <header className="lane-header">
                          <span className="lane-title">
                            {laneLabels[laneKey]}
                          </span>
                          <span className="lane-count">{tasks.length}</span>
                        </header>
                        <div className="lane-body">
                          {tasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              className="task-card"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  'application/json',
                                  JSON.stringify(task)
                                );
                              }}
                            >
                              <div className="task-title">{task.title}</div>
                              <div className="task-meta-row">
                                <div className="task-chips">
                                  <span
                                    className={[
                                      'chip',
                                      task.importance === 3
                                        ? 'chip-importance-high'
                                        : '',
                                      task.importance === 4
                                        ? 'chip-importance-critical'
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  >
                                    {importanceLabel(task.importance)}
                                  </span>
                                  <span
                                    className={[
                                      'chip',
                                      task.urgency === 4
                                        ? 'chip-urgency-immediate'
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  >
                                    {urgencyLabel(task.urgency)}
                                  </span>
                                  <span className="chip chip-duration">
                                    {task.durationHours.toFixed(1)}h
                                  </span>
                                  {task.recurringRule && (
                                    <span className="chip">
                                      Recurring: {task.recurringRule}
                                    </span>
                                  )}
                                </div>
                                <span style={{ opacity: 0.85 }}>
                                  Score {task.score.toFixed(0)}
                                </span>
                              </div>
                            </button>
                          ))}
                          {tasks.length === 0 && (
                            <p
                              style={{
                                fontSize: '0.7rem',
                                color: '#6b7280',
                              }}
                            >
                              Nothing selected here yet.
                            </p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </article>
              ))}
            </div>
          </section>

          <section className="card calendar-shell">
            <div className="card-header">
              <h2 className="card-title">Week Calendar</h2>
              <button
                type="button"
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(148,163,184,0.55)',
                  background: 'transparent',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.75rem',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                Plan week
              </button>
            </div>
            <div className="calendar-header-row">
              <span>Drag tasks into open focus windows. No ceremony required.</span>
              <div className="calendar-legend">
                <span className="legend-pill">
                  <span
                    className="legend-swatch"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(239,68,68,0.92), rgba(190,24,93,0.9))',
                    }}
                  />
                  Hard constraint
                </span>
                <span className="legend-pill">
                  <span
                    className="legend-swatch"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(56,189,248,0.9), rgba(59,130,246,0.9))',
                    }}
                  />
                  Scheduled task
                </span>
                <span className="legend-pill">
                  <span
                    className="legend-swatch"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(129,140,248,0.14))',
                      border: '1px dashed rgba(96,165,250,0.7)',
                    }}
                  />
                  Focus window (advisory)
                </span>
              </div>
            </div>
            <WeekCalendar events={events} />
          </section>
        </section>
      </main>
    </div>
  );
}

function emptyLanes(): LaneBuckets {
  return {
    CRITICAL_IMMEDIATE: [],
    HIGH_IMPORTANCE: [],
    URGENT_LOW_IMPORTANCE: [],
    LOW_IMPACT: [],
  };
}

function importanceLabel(level: number) {
  switch (level) {
    case 4:
      return 'Critical';
    case 3:
      return 'High';
    case 2:
      return 'Medium';
    default:
      return 'Low';
  }
}

function urgencyLabel(level: number) {
  switch (level) {
    case 4:
      return 'Immediate';
    case 3:
      return 'This week';
    case 2:
      return 'Soon';
    default:
      return 'Not time-sensitive';
  }
}

type WeekCalendarProps = {
  events: CalendarEvent[];
};

function WeekCalendar({ events }: WeekCalendarProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6–21

  const layoutEvents = useMemo(() => {
    return events.map((ev) => {
      const start = new Date(ev.startTime);
      const end = new Date(ev.endTime);
      const dayIndex = ((start.getDay() + 6) % 7) + 1;
      const startHour = start.getHours() + start.getMinutes() / 60;
      const endHour = end.getHours() + end.getMinutes() / 60;
      const top = (startHour - 6) * 40;
      const height = Math.max(40, (endHour - startHour) * 40);
      return {
        ...ev,
        dayIndex,
        top,
        height,
      };
    });
  }, [events]);

  const focusWindows = useMemo(() => {
    return days.map((_, index) => {
      const colIndex = index + 1;
      const top = (9 - 6) * 40;
      const height = (3) * 40;
      return { id: `focus-${colIndex}`, dayIndex: colIndex, top, height };
    });
  }, [days]);

  return (
    <div className="calendar-grid">
      <div className="calendar-columns">
        <div />
        {days.map((day) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px repeat(7, minmax(0, 1fr))',
        }}
      >
        <div className="calendar-hours">
          {hours.map((h) => (
            <div key={h} className="calendar-hour">
              {h}:00
            </div>
          ))}
        </div>
        {days.map((day, index) => (
          <div key={day} className="calendar-day-column">
            {hours.map((h) => (
              <div key={h} className="calendar-slot" />
            ))}
            {focusWindows
              .filter((fw) => fw.dayIndex === index + 1)
              .map((fw) => (
                <div
                  key={fw.id}
                  className="calendar-focus-window"
                  style={{
                    top: fw.top,
                    height: fw.height,
                  }}
                />
              ))}
            {layoutEvents
              .filter((ev) => ev.dayIndex === index + 1)
              .map((ev) => (
                <div
                  key={ev.id}
                  className={[
                    'calendar-event',
                    ev.type === 'HARD_CONSTRAINT'
                      ? 'calendar-event-hard'
                      : 'calendar-event-task',
                  ].join(' ')}
                  style={{
                    top: ev.top,
                    height: ev.height,
                  }}
                >
                  {ev.title}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

