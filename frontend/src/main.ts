import "./styles.css";

type StudyStyle = "more_practice" | "more_theory" | "balanced";
type TaskType = "exam" | "assignment" | "project" | "quiz";
type ActivityType = "theory" | "practice" | "review" | "test";

type DailyHours = {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
};

type SubjectInput = {
  name: string;
  importance: number;
};

type StudyTaskInput = {
  subject: string;
  title: string;
  due_date: string;
  estimated_total_minutes: number;
  task_type: TaskType;
  topic?: string;
};

type StudyPlanRequest = {
  timezone: string;
  week_start_date: string;
  daily_hours: DailyHours;
  subjects: SubjectInput[];
  tasks: StudyTaskInput[];
  study_style: StudyStyle;
  max_session_minutes: number;
};

type PlanEntry = {
  date: string;
  day: string;
  subject: string;
  topic: string;
  minutes: number;
  activity_type: ActivityType;
  notes?: string;
};

type StudyPlanResponse = {
  week_start_date: string;
  week_end_date: string;
  schedule: PlanEntry[];
  summary: {
    total_minutes: number;
    minutes_by_subject: Record<string, number>;
    review_sessions: number;
    heuristics_used: string[];
  };
};

const days: Array<keyof DailyHours> = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const dailyHoursGrid = document.getElementById("daily-hours-grid") as HTMLDivElement;
const form = document.getElementById("planner-form") as HTMLFormElement;
const statusBox = document.getElementById("status") as HTMLDivElement;
const scheduleGrid = document.getElementById("schedule-grid") as HTMLDivElement;
const heuristicsBox = document.getElementById("heuristics") as HTMLDivElement;
const summaryTotal = document.getElementById("summary-total") as HTMLSpanElement;
const summaryReviews = document.getElementById("summary-reviews") as HTMLSpanElement;
const demoButton = document.getElementById("fill-demo") as HTMLButtonElement;
const miniCalendarMonth = document.getElementById("mini-calendar-month") as HTMLParagraphElement;
const miniCalendarWeek = document.getElementById("mini-calendar-week") as HTMLDivElement;

for (const day of days) {
  const wrap = document.createElement("label");
  wrap.className = "day-hours";

  const dayText = document.createElement("span");
  dayText.textContent = day.slice(0, 3).toUpperCase();

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "24";
  input.step = "0.5";
  input.value = day === "saturday" || day === "sunday" ? "2" : "1.5";
  input.id = `hours_${day}`;
  input.ariaLabel = `${day} hours`;

  wrap.appendChild(dayText);
  wrap.appendChild(input);
  dailyHoursGrid.appendChild(wrap);
}

function getDefaultWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + (day === 1 ? 0 : diffToMonday));
  return monday.toISOString().slice(0, 10);
}

(document.getElementById("week_start_date") as HTMLInputElement).value = getDefaultWeekStartDate();

function normalizeImportance(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function parseSubjects(raw: string): SubjectInput[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, importanceText] = line.split(":").map((part) => part.trim());
      const importance = Number(importanceText);
      if (!name || !Number.isFinite(importance)) {
        throw new Error(`Invalid subject row: ${line}`);
      }
      return { name, importance: normalizeImportance(importance) };
    });
}

function parseTasks(raw: string): StudyTaskInput[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length < 5) {
        throw new Error(`Invalid task row: ${line}`);
      }
      const [subject, title, dueDate, minutesText, taskTypeText, topic] = parts;
      const estimated_total_minutes = Number(minutesText);
      if (!subject || !title || !dueDate || !Number.isFinite(estimated_total_minutes)) {
        throw new Error(`Invalid task row: ${line}`);
      }
      if (!["exam", "assignment", "project", "quiz"].includes(taskTypeText)) {
        throw new Error(`Invalid task type in row: ${line}`);
      }
      return {
        subject,
        title,
        due_date: dueDate,
        estimated_total_minutes,
        task_type: taskTypeText as TaskType,
        topic,
      };
    });
}

function collectDailyHours(): DailyHours {
  return {
    monday: Number((document.getElementById("hours_monday") as HTMLInputElement).value),
    tuesday: Number((document.getElementById("hours_tuesday") as HTMLInputElement).value),
    wednesday: Number((document.getElementById("hours_wednesday") as HTMLInputElement).value),
    thursday: Number((document.getElementById("hours_thursday") as HTMLInputElement).value),
    friday: Number((document.getElementById("hours_friday") as HTMLInputElement).value),
    saturday: Number((document.getElementById("hours_saturday") as HTMLInputElement).value),
    sunday: Number((document.getElementById("hours_sunday") as HTMLInputElement).value),
  };
}

function activityLabel(activityType: ActivityType): string {
  if (activityType === "theory") {
    return "Theory";
  }
  if (activityType === "practice") {
    return "Practice";
  }
  if (activityType === "review") {
    return "Review";
  }
  return "Test";
}

function addDays(base: Date, daysToAdd: number): Date {
  const next = new Date(base);
  next.setDate(base.getDate() + daysToAdd);
  return next;
}

function toIsoDate(inputDate: Date): string {
  return inputDate.toISOString().slice(0, 10);
}

function renderMiniCalendar(weekStartDateIso: string, plannedDateSet: Set<string>): void {
  miniCalendarWeek.innerHTML = "";

  const weekStartDate = new Date(`${weekStartDateIso}T00:00:00`);
  miniCalendarMonth.textContent = weekStartDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const nowIso = toIsoDate(new Date());

  for (let index = 0; index < 7; index += 1) {
    const current = addDays(weekStartDate, index);
    const currentIso = toIsoDate(current);
    const dayCell = document.createElement("article");
    dayCell.className = "mini-day";

    if (plannedDateSet.has(currentIso)) {
      dayCell.classList.add("has-plan");
    }
    if (currentIso === nowIso) {
      dayCell.classList.add("today");
    }

    dayCell.innerHTML = `
      <span>${current.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}</span>
      <strong>${current.getDate()}</strong>
    `;

    miniCalendarWeek.appendChild(dayCell);
  }
}

function renderPlan(response: StudyPlanResponse): void {
  scheduleGrid.innerHTML = "";

  const grouped = new Map<string, PlanEntry[]>();
  for (const entry of response.schedule) {
    if (!grouped.has(entry.date)) {
      grouped.set(entry.date, []);
    }
    grouped.get(entry.date)?.push(entry);
  }

  const dates = Array.from(grouped.keys()).sort();
  renderMiniCalendar(response.week_start_date, new Set(dates));

  for (const date of dates) {
    const entries = grouped.get(date) ?? [];
    const dayTitle = entries[0]?.day ?? "Day";
    const dayCard = document.createElement("article");
    dayCard.className = "day-card";

    const header = document.createElement("header");
    header.className = "day-card-header";
    header.innerHTML = `
      <div>
        <p>${dayTitle}</p>
        <h3>${date}</h3>
      </div>
      <strong>${entries.reduce((sum, item) => sum + item.minutes, 0)} min</strong>
    `;
    dayCard.appendChild(header);

    const list = document.createElement("div");
    list.className = "session-list";

    for (const item of entries) {
      const row = document.createElement("div");
      row.className = "session-item";
      row.innerHTML = `
        <div>
          <h4>${item.subject}</h4>
          <p>${item.topic}</p>
        </div>
        <div class="session-meta">
          <span class="activity ${item.activity_type}">${activityLabel(item.activity_type)}</span>
          <strong>${item.minutes}m</strong>
        </div>
      `;
      list.appendChild(row);
    }
    dayCard.appendChild(list);
    scheduleGrid.appendChild(dayCard);
  }

  summaryTotal.textContent = `${response.summary.total_minutes} min`;
  summaryReviews.textContent = String(response.summary.review_sessions);
  heuristicsBox.innerHTML = response.summary.heuristics_used
    .map((heuristic) => `<span class="heuristic-pill">${heuristic}</span>`)
    .join("");

  statusBox.textContent = `Generated ${response.schedule.length} sessions from ${response.week_start_date} to ${response.week_end_date}.`;
}

function loadDemoData(): void {
  (document.getElementById("subjects") as HTMLTextAreaElement).value = [
    "Algorithms:5",
    "Databases:4",
    "Software Engineering:4",
  ].join("\n");

  (document.getElementById("tasks") as HTMLTextAreaElement).value = [
    "Algorithms,Midterm prep,2026-03-28,360,exam,Graphs and dynamic programming",
    "Databases,Project milestone,2026-03-27,210,project,Schema + query optimization",
    "Software Engineering,Weekly quiz,2026-03-26,120,quiz,Design patterns",
  ].join("\n");
}

demoButton.addEventListener("click", loadDemoData);

renderMiniCalendar((document.getElementById("week_start_date") as HTMLInputElement).value, new Set());

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    statusBox.textContent = "Generating plan...";
    const backendUrl = (document.getElementById("backend_url") as HTMLInputElement).value;
    const weekStart = (document.getElementById("week_start_date") as HTMLInputElement).value;
    const studyStyle = (document.getElementById("study_style") as HTMLSelectElement).value as StudyStyle;
    const maxSessionMinutes = Number((document.getElementById("max_session_minutes") as HTMLInputElement).value);

    if (!weekStart) {
      throw new Error("Please choose a week start date.");
    }

    const payload: StudyPlanRequest = {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      week_start_date: weekStart,
      daily_hours: collectDailyHours(),
      subjects: parseSubjects((document.getElementById("subjects") as HTMLTextAreaElement).value),
      tasks: parseTasks((document.getElementById("tasks") as HTMLTextAreaElement).value),
      study_style: studyStyle,
      max_session_minutes: Number.isFinite(maxSessionMinutes) ? maxSessionMinutes : 90,
    };

    const response = await fetch(`${backendUrl}/api/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as StudyPlanResponse;
    renderPlan(data);
  } catch (error) {
    scheduleGrid.innerHTML = "";
    statusBox.textContent = error instanceof Error ? error.message : "Unknown error";
  }
});

loadDemoData();
