# LinkedIn Idea Agent (MVP)

A single-user, AI-powered LinkedIn post idea manager. Capture, review, and organize your LinkedIn post ideas via a conversational web interface.

## Features
- Add, list, mark as used, and delete post ideas
- Simple chat-style web UI (React + Vite)
- Backend API (Node.js + Express) with local JSON file storage
- No external database or authentication required for MVP
- Ready for local development and easy to extend (Slack, SMS, etc.)

## Project Structure

- `/backend` — Express server, handles API and stores ideas in a JSON file
- `/frontend` — Vite + React app, chat UI

## Getting Started

### 1. Backend

```
cd backend
npm install
npm run dev
```

The backend runs on [http://localhost:3001](http://localhost:3001) by default.

### 2. Frontend

```
cd frontend
npm install
npm run dev
```

The frontend runs on [http://localhost:5173](http://localhost:5173) by default.

## Development Notes
- All ideas are stored in `backend/data/ideas.json`.
- For production, you can deploy the frontend to Vercel and the backend to any Node.js host.
- To extend with AI (OpenAI, etc.), add intent parsing in the backend.

---

**MVP: Focused on speed, simplicity, and extensibility.** 