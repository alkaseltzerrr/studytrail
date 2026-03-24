
# StudyTrail

> **Status: Still Under Development**
>
> Features and UI are actively evolving. Expect ongoing updates and occasional breaking changes.

**Personalized AI-powered study planner**

StudyTrail helps students organize their study time efficiently by generating tailored weekly plans based on deadlines, subject importance, and personal study preferences. It combines rule-based logic and heuristics to maximize productivity and reduce stress.

---

## Tech Stack & Architecture

- **Backend:** FastAPI (Python)
- **Frontend:** TypeScript + Vite
- **API:** JSON-based, schema-validated

**Architecture:**

```
User ↔️ Frontend (Vite/TS) ↔️ FastAPI Backend ↔️ Scheduling Logic
```

---


## Features

- Input subjects, deadlines, available daily study hours, and study style
- Rule-based + heuristic scheduling (urgency, importance, chunking, spaced review)
- Structured weekly plan output: day, subject, topic, minutes, activity type

---


## Project Structure

- `backend/schemas/input.schema.json` – API input schema
- `backend/schemas/output.schema.json` – API output schema
- `backend/app/main.py` – FastAPI app
- `frontend/index.html` – App entry point
- `frontend/src/main.ts` – Main frontend logic
- `frontend/src/styles.css` – Styles

---


## Getting Started

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)


### Frontend (TypeScript + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open the app URL printed by Vite (usually [http://127.0.0.1:5173](http://127.0.0.1:5173)).

---


## API Usage

### `POST /api/plan`

- **Request:** Follows `backend/schemas/input.schema.json`
- **Response:** Follows `backend/schemas/output.schema.json`

**Example request:**

```json
{
  "timezone": "Europe/Belgrade",
  "week_start_date": "2026-03-23",
  "daily_hours": {
    "monday": 2,
    "tuesday": 2,
    "wednesday": 1.5,
    "thursday": 2,
    "friday": 1,
    "saturday": 3,
    "sunday": 2
  },
  "subjects": [
    { "name": "Algorithms", "importance": 5 },
    { "name": "Databases", "importance": 4 }
  ],
  "tasks": [
    {
      "subject": "Algorithms",
      "title": "Midterm prep",
      "topic": "Graphs + DP",
      "due_date": "2026-03-28",
      "estimated_total_minutes": 360,
      "task_type": "exam"
    },
    {
      "subject": "Databases",
      "title": "Assignment 2",
      "topic": "Normalization",
      "due_date": "2026-03-27",
      "estimated_total_minutes": 180,
      "task_type": "assignment"
    }
  ],
  "study_style": "balanced",
  "max_session_minutes": 90
}
```

---

## Usage

1. Start the backend and frontend as above.
2. Enter your subjects, deadlines, and preferences in the web UI.
3. Receive a personalized weekly study plan.

---
