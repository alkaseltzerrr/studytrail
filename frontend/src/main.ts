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
const planTableBody = document.querySelector("#plan-table tbody") as HTMLTableSectionElement;

for (const day of days) {
  const wrap = document.createElement("label");
  wrap.textContent = day[0].toUpperCase() + day.slice(1);
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "24";
  input.step = "0.5";
  input.value = day === "saturday" || day === "sunday" ? "2" : "1.5";
  input.id = `hours_${day}`;
  wrap.appendChild(input);
  dailyHoursGrid.appendChild(wrap);
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
      return { name, importance };
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

function renderPlan(response: StudyPlanResponse): void {
  planTableBody.innerHTML = "";
  for (const entry of response.schedule) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.day}</td>
      <td>${entry.subject}</td>
      <td>${entry.topic}</td>
      <td>${entry.minutes}</td>
      <td>${entry.activity_type}</td>
      <td>${entry.notes ?? ""}</td>
    `;
    planTableBody.appendChild(row);
  }

  statusBox.textContent = `Total: ${response.summary.total_minutes} minutes | Reviews: ${response.summary.review_sessions}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    statusBox.textContent = "Generating plan...";
    const backendUrl = (document.getElementById("backend_url") as HTMLInputElement).value;
    const weekStart = (document.getElementById("week_start_date") as HTMLInputElement).value;
    const studyStyle = (document.getElementById("study_style") as HTMLSelectElement).value as StudyStyle;

    const payload: StudyPlanRequest = {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      week_start_date: weekStart,
      daily_hours: collectDailyHours(),
      subjects: parseSubjects((document.getElementById("subjects") as HTMLTextAreaElement).value),
      tasks: parseTasks((document.getElementById("tasks") as HTMLTextAreaElement).value),
      study_style: studyStyle,
      max_session_minutes: 90,
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
    statusBox.textContent = error instanceof Error ? error.message : "Unknown error";
  }
});
