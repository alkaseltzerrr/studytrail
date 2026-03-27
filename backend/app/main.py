from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from enum import Enum
from math import ceil
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Dict, List, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator


class StudyStyle(str, Enum):
    more_practice = "more_practice"
    more_theory = "more_theory"
    balanced = "balanced"


class TaskType(str, Enum):
    exam = "exam"
    assignment = "assignment"
    project = "project"
    quiz = "quiz"


class ActivityType(str, Enum):
    theory = "theory"
    practice = "practice"
    review = "review"
    test = "test"


class DailyHours(BaseModel):
    monday: float = Field(ge=0, le=24)
    tuesday: float = Field(ge=0, le=24)
    wednesday: float = Field(ge=0, le=24)
    thursday: float = Field(ge=0, le=24)
    friday: float = Field(ge=0, le=24)
    saturday: float = Field(ge=0, le=24)
    sunday: float = Field(ge=0, le=24)


class SubjectInput(BaseModel):
    name: str = Field(min_length=1)
    importance: int = Field(ge=1, le=5)


class StudyTaskInput(BaseModel):
    subject: str = Field(min_length=1)
    title: str = Field(min_length=1)
    topic: Optional[str] = None
    due_date: date
    estimated_total_minutes: int = Field(ge=30)
    task_type: TaskType


class StudyPlanRequest(BaseModel):
    timezone: str
    week_start_date: date
    daily_hours: DailyHours
    subjects: List[SubjectInput] = Field(min_length=1)
    tasks: List[StudyTaskInput] = Field(min_length=1)
    study_style: StudyStyle
    max_session_minutes: int = Field(default=90, ge=30, le=180)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as error:
            raise ValueError("timezone must be a valid IANA timezone") from error
        return value

    @model_validator(mode="after")
    def validate_task_subjects(self) -> "StudyPlanRequest":
        subject_names = {subject.name.strip().casefold() for subject in self.subjects}
        missing_subjects = sorted(
            {
                task.subject
                for task in self.tasks
                if task.subject.strip().casefold() not in subject_names
            }
        )

        if missing_subjects:
            raise ValueError(
                "Each task.subject must match a subject in subjects. "
                f"Unknown task subjects: {', '.join(missing_subjects)}"
            )

        return self


class PlanEntry(BaseModel):
    date: date
    day: Literal[
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]
    subject: str
    topic: str
    minutes: int = Field(ge=15)
    activity_type: ActivityType
    notes: Optional[str] = None


class PlanSummary(BaseModel):
    total_minutes: int
    minutes_by_subject: Dict[str, int]
    review_sessions: int
    heuristics_used: List[str]


class StudyPlanResponse(BaseModel):
    week_start_date: date
    week_end_date: date
    schedule: List[PlanEntry]
    summary: PlanSummary


app = FastAPI(title="StudyTrail Planner API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _activity_mix(style: StudyStyle, task_type: TaskType) -> ActivityType:
    if task_type == TaskType.exam:
        return ActivityType.test
    if style == StudyStyle.more_practice:
        return ActivityType.practice
    if style == StudyStyle.more_theory:
        return ActivityType.theory
    return ActivityType.practice if task_type in {TaskType.assignment, TaskType.project} else ActivityType.theory


def _daily_capacity_minutes(daily_hours: DailyHours) -> List[int]:
    return [
        int(daily_hours.monday * 60),
        int(daily_hours.tuesday * 60),
        int(daily_hours.wednesday * 60),
        int(daily_hours.thursday * 60),
        int(daily_hours.friday * 60),
        int(daily_hours.saturday * 60),
        int(daily_hours.sunday * 60),
    ]


def generate_week_plan(payload: StudyPlanRequest) -> StudyPlanResponse:
    week_dates = [payload.week_start_date + timedelta(days=i) for i in range(7)]
    capacities = _daily_capacity_minutes(payload.daily_hours)
    subject_importance = {subject.name: subject.importance for subject in payload.subjects}
    local_today = datetime.now(ZoneInfo(payload.timezone)).date()
    planning_anchor_date = payload.week_start_date if payload.week_start_date > local_today else local_today
    schedulable_day_indexes = [
        index for index, current_date in enumerate(week_dates) if current_date >= local_today and capacities[index] >= 15
    ]

    weighted_chunks = []
    for task in payload.tasks:
        due_in_days = max((task.due_date - planning_anchor_date).days, 0)
        urgency = 1 / (1 + due_in_days)
        importance = subject_importance.get(task.subject, 3)
        sessions = max(1, ceil(task.estimated_total_minutes / payload.max_session_minutes))
        session_minutes = ceil(task.estimated_total_minutes / sessions)

        for index in range(sessions):
            progress_bonus = 1 + (index / max(1, sessions - 1)) * 0.15
            weight = (importance * 0.6 + urgency * 8.0) * progress_bonus
            weighted_chunks.append(
                {
                    "subject": task.subject,
                    "topic": task.topic or task.title,
                    "minutes": session_minutes,
                    "weight": weight,
                    "activity_type": _activity_mix(payload.study_style, task.task_type),
                    "task_type": task.task_type,
                    "due_date": task.due_date,
                }
            )

    weighted_chunks.sort(key=lambda item: item["weight"], reverse=True)

    schedule: List[PlanEntry] = []
    minutes_by_subject: Dict[str, int] = defaultdict(int)

    for chunk in weighted_chunks:
        assigned = False
        days_before_due = [
            i
            for i in schedulable_day_indexes
            if week_dates[i] <= chunk["due_date"] and capacities[i] >= 15
        ]
        candidate_days = (
            days_before_due
            if days_before_due
            else [i for i in schedulable_day_indexes if capacities[i] >= 15]
        )

        for day_index in candidate_days:
            alloc = min(chunk["minutes"], capacities[day_index])
            if alloc < 15:
                continue

            capacities[day_index] -= alloc
            schedule.append(
                PlanEntry(
                    date=week_dates[day_index],
                    day=week_dates[day_index].strftime("%A"),
                    subject=chunk["subject"],
                    topic=chunk["topic"],
                    minutes=alloc,
                    activity_type=chunk["activity_type"],
                    notes="Core task block",
                )
            )
            minutes_by_subject[chunk["subject"]] += alloc
            assigned = True
            break

        if not assigned:
            continue

    review_count = 0
    for day_index, current_date in enumerate(week_dates):
        if current_date < local_today:
            continue

        if capacities[day_index] < 20:
            continue

        due_soon = [
            task
            for task in payload.tasks
            if 0 <= (task.due_date - current_date).days <= 2 and capacities[day_index] >= 20
        ]

        for task in due_soon:
            review_minutes = min(30, capacities[day_index])
            if review_minutes < 20:
                break

            capacities[day_index] -= review_minutes
            schedule.append(
                PlanEntry(
                    date=current_date,
                    day=current_date.strftime("%A"),
                    subject=task.subject,
                    topic=task.topic or task.title,
                    minutes=review_minutes,
                    activity_type=ActivityType.review,
                    notes="Spaced repetition review",
                )
            )
            minutes_by_subject[task.subject] += review_minutes
            review_count += 1

    schedule.sort(key=lambda entry: (entry.date, entry.subject, entry.activity_type.value))

    return StudyPlanResponse(
        week_start_date=payload.week_start_date,
        week_end_date=payload.week_start_date + timedelta(days=6),
        schedule=schedule,
        summary=PlanSummary(
            total_minutes=sum(item.minutes for item in schedule),
            minutes_by_subject=dict(minutes_by_subject),
            review_sessions=review_count,
            heuristics_used=[
                "Urgency weighting by deadline proximity",
                "Subject importance multiplier",
                "Chunking tasks into max-session blocks",
                "Spaced review sessions near due dates",
                "Timezone-aware scheduling based on user's local date",
            ],
        ),
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/plan", response_model=StudyPlanResponse)
def create_plan(payload: StudyPlanRequest) -> StudyPlanResponse:
    return generate_week_plan(payload)
