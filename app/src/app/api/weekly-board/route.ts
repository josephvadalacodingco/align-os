import { NextResponse } from 'next/server';
import { EventType, TaskType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateTaskScore } from '@/lib/priority';

const WEEK_TOTAL_HOURS = 168;

type RawTask = {
  id: string;
  title: string;
  type: TaskType;
  importance: number;
  urgency: number;
  durationHours: number;
  recurringRule: string | null;
  endeavorId: string | null;
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    const demo = buildDemoBoard();
    return NextResponse.json(demo, { status: 200 });
  }

  try {
    const userId = await getOrCreateUserId();

    const [endeavors, tasks, events] = await Promise.all([
      prisma.endeavor.findMany({
        where: { userId },
        orderBy: { priorityRank: 'asc' },
      }),
      prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.calendarEvent.findMany({
        where: { userId },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    const strategicHours = computeStrategicHours(events);
    const scored = scoreTasks(tasks, endeavors);

    const response = {
      usingDemoData: false,
      capacity: {
        weekTotalHours: WEEK_TOTAL_HOURS,
        strategicHours,
        selectedHours: 0,
        slackHours: strategicHours,
      },
      endeavors: endeavors.map((e) => ({
        id: e.id,
        name: e.name,
        priorityRank: e.priorityRank,
        baselineHours: e.baselineHours,
      })),
      lifeMaintenanceColumnId: 'life-maintenance',
      tasksByEndeavor: groupTasksForBoard(scored),
      events: events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
        type: ev.type,
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    const demo = buildDemoBoard();
    return NextResponse.json(demo, { status: 200 });
  }
}

async function getOrCreateUserId(): Promise<string> {
  const email = 'demo@alignos.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;

  const user = await prisma.user.create({
    data: {
      email,
    },
  });

  return user.id;
}

function computeStrategicHours(events: {
  type: EventType;
  startTime: Date;
  endTime: Date;
}[]): number {
  const hardAndScheduled = events.filter(
    (e) =>
      e.type === EventType.HARD_CONSTRAINT ||
      e.type === EventType.SCHEDULED_TASK
  );

  const used = hardAndScheduled.reduce((sum, ev) => {
    const hours = (ev.endTime.getTime() - ev.startTime.getTime()) / (1000 * 60 * 60);
    return sum + Math.max(0, hours);
  }, 0);

  const strategic = Math.max(0, WEEK_TOTAL_HOURS - used);
  return Number(strategic.toFixed(1));
}

function scoreTasks(
  tasks: RawTask[],
  endeavors: { id: string; priorityRank: number }[]
) {
  const endeavorPriority = new Map<string, number>();
  for (const e of endeavors) {
    endeavorPriority.set(e.id, e.priorityRank);
  }

  return tasks.map((t) => {
    const score = calculateTaskScore(
      {
        id: t.id,
        type: t.type,
        importance: t.importance,
        urgency: t.urgency,
      },
      t.endeavorId ? endeavorPriority.get(t.endeavorId) ?? null : null
    );

    return { ...t, score };
  });
}

function groupTasksForBoard(tasks: (RawTask & { score: number })[]) {
  const lanes = (task: RawTask & { score: number }) => {
    const imp = task.importance;
    const urg = task.urgency;
    if (imp === 4 && urg === 4) return 'CRITICAL_IMMEDIATE';
    if (imp >= 3 && urg >= 2) return 'HIGH_IMPORTANCE';
    if (urg >= 3 && imp <= 2) return 'URGENT_LOW_IMPORTANCE';
    return 'LOW_IMPACT';
  };

  const byEndeavor: Record<
    string,
    {
      CRITICAL_IMMEDIATE: (RawTask & { score: number })[];
      HIGH_IMPORTANCE: (RawTask & { score: number })[];
      URGENT_LOW_IMPORTANCE: (RawTask & { score: number })[];
      LOW_IMPACT: (RawTask & { score: number })[];
    }
  > = {};

  for (const task of tasks) {
    const bucket =
      task.type === TaskType.LIFE_MAINTENANCE
        ? 'life-maintenance'
        : task.endeavorId ?? 'unassigned';
    if (!byEndeavor[bucket]) {
      byEndeavor[bucket] = {
        CRITICAL_IMMEDIATE: [],
        HIGH_IMPORTANCE: [],
        URGENT_LOW_IMPORTANCE: [],
        LOW_IMPACT: [],
      };
    }
    const lane = lanes(task);
    byEndeavor[bucket][lane].push(task);
  }

  for (const bucket of Object.values(byEndeavor)) {
    for (const key of Object.keys(bucket) as (keyof typeof bucket)[]) {
      bucket[key].sort((a, b) => b.score - a.score);
    }
  }

  return byEndeavor;
}

function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday as start
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - diff);
  return result;
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

function buildDemoBoard() {
  const now = new Date();
  const monday = startOfWeek(now);
  const hardStart = new Date(monday);
  const hardEnd = addHours(monday, 40); // demo 40h of constraints

  const demoEvents = [
    {
      id: 'demo-hard-1',
      title: 'Work (9–5, Mon–Fri)',
      startTime: hardStart,
      endTime: hardEnd,
      type: EventType.HARD_CONSTRAINT,
    },
  ];

  const strategicHours = computeStrategicHours(demoEvents);

  return {
    usingDemoData: true,
    capacity: {
      weekTotalHours: WEEK_TOTAL_HOURS,
      strategicHours,
      selectedHours: 0,
      slackHours: strategicHours,
    },
    endeavors: [
      { id: 'music', name: 'Music Career', priorityRank: 1, baselineHours: 8 },
      {
        id: 'appdev',
        name: 'App Development',
        priorityRank: 2,
        baselineHours: 10,
      },
      {
        id: 'theory',
        name: 'Songwriter Theory',
        priorityRank: 3,
        baselineHours: 4,
      },
    ],
    lifeMaintenanceColumnId: 'life-maintenance',
    tasksByEndeavor: groupTasksForBoard([
      {
        id: 't1',
        title: 'Finish chorus draft for single',
        type: TaskType.ENDEAVOR,
        importance: 4,
        urgency: 3,
        durationHours: 2,
        recurringRule: null,
        endeavorId: 'music',
      },
      {
        id: 't2',
        title: 'Outline v1 of Decision Board UX',
        type: TaskType.ENDEAVOR,
        importance: 4,
        urgency: 2,
        durationHours: 3,
        recurringRule: null,
        endeavorId: 'appdev',
      },
      {
        id: 't3',
        title: 'File quarterly taxes',
        type: TaskType.LIFE_MAINTENANCE,
        importance: 4,
        urgency: 4,
        durationHours: 2,
        recurringRule: null,
        endeavorId: null,
      },
      {
        id: 't4',
        title: 'Groceries + meal prep',
        type: TaskType.LIFE_MAINTENANCE,
        importance: 3,
        urgency: 3,
        durationHours: 2,
        recurringRule: 'weekly',
        endeavorId: null,
      },
      {
        id: 't5',
        title: 'Tidy workspace',
        type: TaskType.LIFE_MAINTENANCE,
        importance: 2,
        urgency: 2,
        durationHours: 1,
        recurringRule: null,
        endeavorId: null,
      },
    ]),
    events: demoEvents,
  };
}

