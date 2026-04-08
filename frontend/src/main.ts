import "./styles.css";

type AppView = "home" | "planner" | "output";
type StudyStyle = "more_practice" | "more_theory" | "balanced";
type TaskType = "exam" | "assignment" | "project" | "quiz";
type ActivityType = "theory" | "practice" | "review" | "test";
type ThemeMode = "light" | "dark";

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

type TaskDraft = {
  subject: string;
  title: string;
  dueDate: string;
  minutes: string;
  taskType: TaskType;
  topic: string;
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

const form = document.getElementById("planner-form") as HTMLFormElement;
const weekStartInput = document.getElementById("week_start_date") as HTMLInputElement;
const dailyHoursGrid = document.getElementById("daily-hours-grid") as HTMLDivElement;
const taskList = document.getElementById("task-list") as HTMLDivElement;
const addTaskButton = document.getElementById("add-task") as HTMLButtonElement;
const demoButton = document.getElementById("fill-demo") as HTMLButtonElement;

const navHome = document.getElementById("nav-home") as HTMLButtonElement;
const navPlanner = document.getElementById("nav-planner") as HTMLButtonElement;
const navOutput = document.getElementById("nav-output") as HTMLButtonElement;
const goCreate = document.getElementById("go-create") as HTMLButtonElement;
const goOutput = document.getElementById("go-output") as HTMLButtonElement;
const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement;
const themeToggleText = document.getElementById("theme-toggle-text") as HTMLSpanElement;

const homeView = document.getElementById("view-home") as HTMLElement;
const plannerView = document.getElementById("view-planner") as HTMLElement;
const outputView = document.getElementById("view-output") as HTMLElement;

const widgetTotal = document.getElementById("widget-total") as HTMLElement;
const widgetReviews = document.getElementById("widget-reviews") as HTMLElement;
const widgetSessions = document.getElementById("widget-sessions") as HTMLElement;
const widgetWeek = document.getElementById("widget-week") as HTMLElement;
const homePreviewList = document.getElementById("home-preview-list") as HTMLElement;

const statusBox = document.getElementById("status") as HTMLDivElement;
const summaryTotal = document.getElementById("summary-total") as HTMLSpanElement;
const summaryReviews = document.getElementById("summary-reviews") as HTMLSpanElement;
const miniCalendarMonth = document.getElementById("mini-calendar-month") as HTMLParagraphElement;
const miniCalendarWeek = document.getElementById("mini-calendar-week") as HTMLDivElement;
const weekPrevButton = document.getElementById("week-prev") as HTMLButtonElement;
const weekNextButton = document.getElementById("week-next") as HTMLButtonElement;
const subjectTags = document.getElementById("subject-tags") as HTMLDivElement;
const activityTags = document.getElementById("activity-tags") as HTMLDivElement;
const heuristicsBox = document.getElementById("heuristics") as HTMLDivElement;
const scheduleGrid = document.getElementById("schedule-grid") as HTMLDivElement;

let latestPlanResponse: StudyPlanResponse | null = null;
let selectedDateFilter: string | null = null;
let selectedSubjectFilters = new Set<string>();
let selectedActivityFilters = new Set<ActivityType>();
let isGeneratingPlan = false;
let currentView: AppView = "home";
let isViewTransitioning = false;

const themeStorageKey = "studytrail-theme";

function getSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
  const actionLabel = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
  themeToggle.setAttribute("aria-label", actionLabel);
  themeToggle.setAttribute("title", actionLabel);
  themeToggle.setAttribute("aria-pressed", String(mode === "dark"));
  themeToggleText.textContent = actionLabel;
}

function initializeTheme(): void {
  const savedTheme = localStorage.getItem(themeStorageKey);
  const initialTheme: ThemeMode = savedTheme === "dark" || savedTheme === "light" ? savedTheme : getSystemTheme();
  applyTheme(initialTheme);
}

function toggleTheme(): void {
  const currentTheme = (document.documentElement.getAttribute("data-theme") as ThemeMode | null) ?? "light";
  const nextTheme: ThemeMode = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
}

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

  wrap.appendChild(dayText);
  wrap.appendChild(input);
  dailyHoursGrid.appendChild(wrap);
}

function switchView(view: AppView): void {
  const map: Record<AppView, HTMLElement> = {
    home: homeView,
    planner: plannerView,
    output: outputView,
  };

  for (const [key, element] of Object.entries(map) as Array<[AppView, HTMLElement]>) {
    const isActive = key === view;
    element.classList.toggle("active", isActive);
  }

  navHome.classList.toggle("active", view === "home");
  navPlanner.classList.toggle("active", view === "planner");
  navOutput.classList.toggle("active", view === "output");
  currentView = view;
}

async function animateToView(view: AppView): Promise<void> {
  if (view === currentView || isViewTransitioning) {
    return;
  }

  isViewTransitioning = true;
  const leavingView = document.querySelector(".view.active") as HTMLElement | null;

  if (leavingView) {
    leavingView.classList.add("leaving");
    await new Promise((resolve) => window.setTimeout(resolve, 220));
  }

  switchView(view);

  if (leavingView) {
    leavingView.classList.remove("leaving");
  }

  const enteringView = document.querySelector(".view.active") as HTMLElement | null;
  if (enteringView) {
    enteringView.classList.add("entering");
    window.requestAnimationFrame(() => {
      enteringView.classList.add("entering-active");
    });

    await new Promise((resolve) => window.setTimeout(resolve, 280));
    enteringView.classList.remove("entering", "entering-active");
  }

  isViewTransitioning = false;
}

function getDefaultWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + (day === 1 ? 0 : diffToMonday));
  return monday.toISOString().slice(0, 10);
}

initializeTheme();
themeToggle.addEventListener("click", toggleTheme);

function getApiBaseUrl(): string {
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }
  return "";
}

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

function createTaskRow(draft?: Partial<TaskDraft>): void {
  const row = document.createElement("article");
  row.className = "task-row";

  const subjectInput = document.createElement("input");
  subjectInput.type = "text";
  subjectInput.dataset.field = "subject";
  subjectInput.value = draft?.subject ?? "";
  subjectInput.placeholder = "Subject";
  subjectInput.required = true;

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.dataset.field = "title";
  titleInput.value = draft?.title ?? "";
  titleInput.placeholder = "Title";
  titleInput.required = true;

  const dueDateInput = document.createElement("input");
  dueDateInput.type = "date";
  dueDateInput.dataset.field = "dueDate";
  dueDateInput.value = draft?.dueDate ?? "";
  dueDateInput.required = true;

  const minutesInput = document.createElement("input");
  minutesInput.type = "number";
  minutesInput.dataset.field = "minutes";
  minutesInput.min = "30";
  minutesInput.step = "15";
  minutesInput.value = draft?.minutes ?? "120";
  minutesInput.required = true;

  const taskTypeSelect = document.createElement("select");
  taskTypeSelect.dataset.field = "taskType";
  const taskTypeOptions: Array<{ value: TaskType; label: string }> = [
    { value: "exam", label: "Exam" },
    { value: "assignment", label: "Assignment" },
    { value: "project", label: "Project" },
    { value: "quiz", label: "Quiz" },
  ];
  for (const optionConfig of taskTypeOptions) {
    const option = document.createElement("option");
    option.value = optionConfig.value;
    option.textContent = optionConfig.label;
    if (draft?.taskType === optionConfig.value) {
      option.selected = true;
    }
    taskTypeSelect.appendChild(option);
  }

  const topicInput = document.createElement("input");
  topicInput.type = "text";
  topicInput.dataset.field = "topic";
  topicInput.value = draft?.topic ?? "";
  topicInput.placeholder = "Topic";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "ghost small task-remove";
  removeButton.setAttribute("aria-label", "Remove task");
  removeButton.textContent = "Remove";

  row.append(subjectInput, titleInput, dueDateInput, minutesInput, taskTypeSelect, topicInput, removeButton);

  removeButton.addEventListener("click", () => {
    row.remove();
    if (taskList.children.length === 0) {
      createTaskRow();
    }
  });

  taskList.appendChild(row);
}

function parseTasksFromEditor(): StudyTaskInput[] {
  const rows = Array.from(taskList.querySelectorAll(".task-row"));
  if (rows.length === 0) {
    throw new Error("Please add at least one task.");
  }

  return rows.map((row, rowIndex) => {
    const subject = (row.querySelector('[data-field="subject"]') as HTMLInputElement).value.trim();
    const title = (row.querySelector('[data-field="title"]') as HTMLInputElement).value.trim();
    const dueDate = (row.querySelector('[data-field="dueDate"]') as HTMLInputElement).value;
    const minutesText = (row.querySelector('[data-field="minutes"]') as HTMLInputElement).value;
    const taskType = (row.querySelector('[data-field="taskType"]') as HTMLSelectElement).value as TaskType;
    const topic = (row.querySelector('[data-field="topic"]') as HTMLInputElement).value.trim();
    const estimated_total_minutes = Number(minutesText);

    if (!subject || !title || !dueDate || !Number.isFinite(estimated_total_minutes)) {
      throw new Error(`Task ${rowIndex + 1} is incomplete.`);
    }

    return {
      subject,
      title,
      due_date: dueDate,
      estimated_total_minutes,
      task_type: taskType,
      topic: topic || undefined,
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

function createFilterTag(label: string, isActive: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `filter-tag${isActive ? " active" : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderOutputFilters(response: StudyPlanResponse): void {
  const uniqueSubjects = Array.from(new Set(response.schedule.map((entry) => entry.subject))).sort((a, b) =>
    a.localeCompare(b),
  );
  const uniqueActivities = ["theory", "practice", "review", "test"].filter((activity) =>
    response.schedule.some((entry) => entry.activity_type === activity),
  ) as ActivityType[];

  selectedSubjectFilters = new Set(Array.from(selectedSubjectFilters).filter((subject) => uniqueSubjects.includes(subject)));
  selectedActivityFilters = new Set(
    Array.from(selectedActivityFilters).filter((activity) => uniqueActivities.includes(activity)),
  );

  subjectTags.innerHTML = "";
  activityTags.innerHTML = "";

  subjectTags.appendChild(
    createFilterTag("All subjects", selectedSubjectFilters.size === 0, () => {
      selectedSubjectFilters.clear();
      if (latestPlanResponse) {
        renderPlan(latestPlanResponse);
      }
    }),
  );

  for (const subject of uniqueSubjects) {
    subjectTags.appendChild(
      createFilterTag(subject, selectedSubjectFilters.has(subject), () => {
        if (selectedSubjectFilters.has(subject)) {
          selectedSubjectFilters.delete(subject);
        } else {
          selectedSubjectFilters.add(subject);
        }
        if (latestPlanResponse) {
          renderPlan(latestPlanResponse);
        }
      }),
    );
  }

  activityTags.appendChild(
    createFilterTag("All types", selectedActivityFilters.size === 0, () => {
      selectedActivityFilters.clear();
      if (latestPlanResponse) {
        renderPlan(latestPlanResponse);
      }
    }),
  );

  for (const activity of uniqueActivities) {
    activityTags.appendChild(
      createFilterTag(activityLabel(activity), selectedActivityFilters.has(activity), () => {
        if (selectedActivityFilters.has(activity)) {
          selectedActivityFilters.delete(activity);
        } else {
          selectedActivityFilters.add(activity);
        }
        if (latestPlanResponse) {
          renderPlan(latestPlanResponse);
        }
      }),
    );
  }
}

function addDays(base: Date, daysToAdd: number): Date {
  const next = new Date(base);
  next.setDate(base.getDate() + daysToAdd);
  return next;
}

function toIsoDate(inputDate: Date): string {
  return inputDate.toISOString().slice(0, 10);
}

function sessionIntensityClass(count: number): string {
  if (count >= 3) {
    return "high";
  }
  if (count === 2) {
    return "medium";
  }
  return "low";
}

function renderMiniCalendar(
  weekStartDateIso: string,
  plannedDateSet: Set<string>,
  sessionCountsByDate: Map<string, number>,
  selectedDate: string | null,
): void {
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
    if (currentIso === selectedDate) {
      dayCell.classList.add("selected");
    }
    if (currentIso === nowIso) {
      dayCell.classList.add("today");
    }

    const sessionCount = sessionCountsByDate.get(currentIso) ?? 0;
    const dotCount = Math.min(3, sessionCount);
    const dots = Array.from({ length: dotCount })
      .map(() => `<i class="dot ${sessionIntensityClass(sessionCount)}"></i>`)
      .join("");

    dayCell.innerHTML = `
      <span>${current.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}</span>
      <strong>${current.getDate()}</strong>
      <small class="dots">${dots}</small>
    `;

    dayCell.addEventListener("click", () => {
      selectedDateFilter = selectedDateFilter === currentIso ? null : currentIso;
      if (latestPlanResponse) {
        renderPlan(latestPlanResponse);
      } else {
        renderMiniCalendar(weekStartInput.value, new Set(), new Map(), selectedDateFilter);
      }
    });

    miniCalendarWeek.appendChild(dayCell);
  }
}

function updateHomeWidgets(response: StudyPlanResponse): void {
  widgetTotal.textContent = `${response.summary.total_minutes} min`;
  widgetReviews.textContent = String(response.summary.review_sessions);
  widgetSessions.textContent = String(response.schedule.length);
  widgetWeek.textContent = `${response.week_start_date} -> ${response.week_end_date}`;

  const topSessions = response.schedule.slice(0, 4);
  homePreviewList.textContent = "";

  if (topSessions.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "muted-empty";
    emptyState.textContent = "No sessions generated yet.";
    homePreviewList.appendChild(emptyState);
    return;
  }

  for (const session of topSessions) {
    const previewItem = document.createElement("article");
    previewItem.className = "preview-item";

    const title = document.createElement("h4");
    title.textContent = session.subject;

    const detail = document.createElement("p");
    detail.textContent = `${session.day} | ${session.topic}`;

    const minutes = document.createElement("strong");
    minutes.textContent = `${session.minutes}m`;

    previewItem.append(title, detail, minutes);
    homePreviewList.appendChild(previewItem);
  }
}

function renderPlan(response: StudyPlanResponse): void {
  latestPlanResponse = response;
  scheduleGrid.innerHTML = "";

  renderOutputFilters(response);

  const tagFilteredEntries = response.schedule.filter((entry) => {
    const subjectMatch = selectedSubjectFilters.size === 0 || selectedSubjectFilters.has(entry.subject);
    const activityMatch = selectedActivityFilters.size === 0 || selectedActivityFilters.has(entry.activity_type);
    return subjectMatch && activityMatch;
  });

  const grouped = new Map<string, PlanEntry[]>();
  for (const entry of tagFilteredEntries) {
    if (!grouped.has(entry.date)) {
      grouped.set(entry.date, []);
    }
    grouped.get(entry.date)?.push(entry);
  }

  const dates = Array.from(grouped.keys()).sort();
  const counts = new Map<string, number>();
  for (const date of dates) {
    counts.set(date, grouped.get(date)?.length ?? 0);
  }

  if (selectedDateFilter && !grouped.has(selectedDateFilter)) {
    selectedDateFilter = null;
  }

  renderMiniCalendar(response.week_start_date, new Set(dates), counts, selectedDateFilter);

  const visibleDates = selectedDateFilter ? dates.filter((date) => date === selectedDateFilter) : dates;
  const visibleEntries = selectedDateFilter
    ? tagFilteredEntries.filter((entry) => entry.date === selectedDateFilter)
    : tagFilteredEntries;

  for (const date of visibleDates) {
    const entries = grouped.get(date) ?? [];
    const dayCard = document.createElement("article");
    dayCard.className = "day-card";

    const header = document.createElement("header");
    header.className = "day-card-header";

    const headerMeta = document.createElement("div");
    const dayName = document.createElement("p");
    dayName.textContent = entries[0]?.day ?? "Day";
    const dateHeading = document.createElement("h3");
    dateHeading.textContent = date;
    headerMeta.append(dayName, dateHeading);

    const totalMinutes = document.createElement("strong");
    totalMinutes.textContent = `${entries.reduce((sum, item) => sum + item.minutes, 0)} min`;
    header.append(headerMeta, totalMinutes);

    const list = document.createElement("div");
    list.className = "session-list";

    for (const item of entries) {
      const row = document.createElement("div");
      row.className = "session-item";

      const details = document.createElement("div");
      const subject = document.createElement("h4");
      subject.textContent = item.subject;
      const topic = document.createElement("p");
      topic.textContent = item.topic;
      details.append(subject, topic);

      const meta = document.createElement("div");
      meta.className = "session-meta";
      const activity = document.createElement("span");
      activity.classList.add("activity", item.activity_type);
      activity.textContent = activityLabel(item.activity_type);
      const minutes = document.createElement("strong");
      minutes.textContent = `${item.minutes}m`;
      meta.append(activity, minutes);

      row.append(details, meta);
      list.appendChild(row);
    }

    dayCard.append(header, list);
    scheduleGrid.appendChild(dayCard);
  }

  const filteredTotalMinutes = visibleEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  const filteredReviews = visibleEntries.filter((entry) => entry.activity_type === "review").length;

  summaryTotal.textContent = `${filteredTotalMinutes} min`;
  summaryReviews.textContent = String(filteredReviews);
  heuristicsBox.textContent = "";
  for (const heuristic of response.summary.heuristics_used) {
    const pill = document.createElement("span");
    pill.className = "heuristic-pill";
    pill.textContent = heuristic;
    heuristicsBox.appendChild(pill);
  }

  const hasTagFilter = selectedSubjectFilters.size > 0 || selectedActivityFilters.size > 0;

  if (selectedDateFilter) {
    statusBox.textContent = `Showing ${grouped.get(selectedDateFilter)?.length ?? 0} sessions on ${selectedDateFilter}${hasTagFilter ? " with selected tags" : ""}.`;
  } else {
    statusBox.textContent = `Showing ${visibleEntries.length} sessions from ${response.week_start_date} to ${response.week_end_date}${hasTagFilter ? " with selected tags" : ""}.`;
  }

  updateHomeWidgets(response);
  navOutput.disabled = false;
  goOutput.disabled = false;
}

async function requestPlan(): Promise<void> {
  if (isGeneratingPlan) {
    return;
  }

  isGeneratingPlan = true;
  weekPrevButton.disabled = true;
  weekNextButton.disabled = true;

  try {
    statusBox.textContent = "Generating plan...";
    const studyStyle = (document.getElementById("study_style") as HTMLSelectElement).value as StudyStyle;
    const maxSessionMinutes = Number((document.getElementById("max_session_minutes") as HTMLInputElement).value);

    if (!weekStartInput.value) {
      throw new Error("Please choose a week start date.");
    }

    const payload: StudyPlanRequest = {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      week_start_date: weekStartInput.value,
      daily_hours: collectDailyHours(),
      subjects: parseSubjects((document.getElementById("subjects") as HTMLTextAreaElement).value),
      tasks: parseTasksFromEditor(),
      study_style: studyStyle,
      max_session_minutes: Number.isFinite(maxSessionMinutes) ? maxSessionMinutes : 90,
    };

    const response = await fetch(`${getApiBaseUrl()}/api/plan`, {
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

    selectedDateFilter = null;
    renderPlan((await response.json()) as StudyPlanResponse);
    await animateToView("output");
  } catch (error) {
    latestPlanResponse = null;
    selectedDateFilter = null;
    scheduleGrid.innerHTML = "";
    renderMiniCalendar(weekStartInput.value, new Set(), new Map(), null);
    statusBox.textContent = error instanceof Error ? error.message : "Unknown error";
  } finally {
    isGeneratingPlan = false;
    weekPrevButton.disabled = false;
    weekNextButton.disabled = false;
  }
}

function shiftWeek(daysToShift: number): void {
  const base = weekStartInput.value ? new Date(`${weekStartInput.value}T00:00:00`) : new Date();
  weekStartInput.value = toIsoDate(addDays(base, daysToShift));
  selectedDateFilter = null;

  if (latestPlanResponse) {
    void requestPlan();
  } else {
    renderMiniCalendar(weekStartInput.value, new Set(), new Map(), null);
  }
}

function loadDemoData(): void {
  (document.getElementById("subjects") as HTMLTextAreaElement).value = [
    "Algorithms:5",
    "Databases:4",
    "Software Engineering:4",
  ].join("\n");

  taskList.innerHTML = "";
  createTaskRow({
    subject: "Algorithms",
    title: "Midterm prep",
    dueDate: "2026-03-28",
    minutes: "360",
    taskType: "exam",
    topic: "Graphs and dynamic programming",
  });
  createTaskRow({
    subject: "Databases",
    title: "Project milestone",
    dueDate: "2026-03-27",
    minutes: "210",
    taskType: "project",
    topic: "Schema + query optimization",
  });
  createTaskRow({
    subject: "Software Engineering",
    title: "Weekly quiz",
    dueDate: "2026-03-26",
    minutes: "120",
    taskType: "quiz",
    topic: "Design patterns",
  });
}

weekStartInput.value = getDefaultWeekStartDate();
createTaskRow();
loadDemoData();
renderMiniCalendar(weekStartInput.value, new Set(), new Map(), null);
switchView("home");

navHome.addEventListener("click", () => {
  void animateToView("home");
});
navPlanner.addEventListener("click", () => {
  void animateToView("planner");
});
navOutput.addEventListener("click", () => {
  if (!navOutput.disabled) {
    void animateToView("output");
  }
});

goCreate.addEventListener("click", () => {
  void animateToView("planner");
});
goOutput.addEventListener("click", () => {
  if (!goOutput.disabled) {
    void animateToView("output");
  }
});

addTaskButton.addEventListener("click", () => createTaskRow());
demoButton.addEventListener("click", loadDemoData);

weekPrevButton.addEventListener("click", () => shiftWeek(-7));
weekNextButton.addEventListener("click", () => shiftWeek(7));
weekStartInput.addEventListener("change", () => {
  selectedDateFilter = null;
  renderMiniCalendar(weekStartInput.value, new Set(), new Map(), null);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await requestPlan();
});
