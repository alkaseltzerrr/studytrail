# StudyTrail

Web-based AI-style personalized study planner using **FastAPI** (backend) and **TypeScript + Vite** (frontend).

## Features

- Input subjects, deadlines/exams, available daily study hours, and preferred study style.
- Rule-based + heuristic scheduling:
	- Deadline urgency weighting
	- Subject importance weighting
	- Task chunking into manageable sessions
	- Spaced-repetition-style reviews near due dates
- Returns structured weekly plan with:
	- Date/day
	- Subject/topic
	- Minutes
	- Activity type (`theory`, `practice`, `review`, `test`)

## Project structure

- `backend/schemas/input.schema.json`
- `backend/schemas/output.schema.json`
- `backend/app/main.py`
- `frontend/index.html`
- `frontend/src/main.ts`
- `frontend/src/styles.css`

## Backend setup (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open API docs: `http://127.0.0.1:8000/docs`

## Frontend setup (TypeScript + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open app URL printed by Vite (usually `http://127.0.0.1:5173`).

## API

### `POST /api/plan`

Request body follows `backend/schemas/input.schema.json`.
Response body follows `backend/schemas/output.schema.json`.

Minimal example request:

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
