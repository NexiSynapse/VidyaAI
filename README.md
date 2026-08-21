# VidyaAI

An AI-powered Computer Science study teacher: upload your course notes/PDFs and get RAG-grounded answers, auto-generated quizzes, and tracked mastery.

> Hackathon MVP. Three-person build split across Frontend (Person 1), Backend — Data & Ingestion (Person 2), and Backend — AI & Orchestration (Person 3).

---

## Quick Start

### 1. Install backend dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy the template and fill in your keys:
```bash
cp .env.example .env
```

Then edit `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
OPENAI_API_KEY=your_openai_api_key   # OPTIONAL — see below
PORT=5000
```

> **OpenAI is optional.** If `OPENAI_API_KEY` is left blank, the server automatically falls back to deterministic **placeholder embeddings** (1536-dim) so the ingestion/search flow still runs end-to-end without a key. Real OpenAI gives meaningful semantic search; the placeholder is just for local dev/demo-when-rate-limited.

### 3. Set up the Supabase database
Open the **Supabase SQL Editor** and run the contents of [`schema.sql`](./schema.sql). This creates the `documents`, `chunks`, `topics`, `quizzes`, `quiz_questions`, `quiz_attempts`, and `progress` tables — plus the `match_chunks` (vector search) and `update_topic_mastery` (auto-mastery) functions.

### 4. Run the server
```bash
node server.js
```
Server runs on `http://localhost:5000`.

---

## API Key Setup (quick reference)

| Variable | Where to get it | Required? |
|---|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL | Yes |
| `SUPABASE_KEY` | Supabase dashboard → Project Settings → API → anon public key | Yes |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | No (placeholder fallback) |
| `PORT` | – | No (defaults to 5000) |

> **Security:** `.env` is gitignored and is **never** committed. Only `.env.example` (template) is pushed.

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ingest` | POST | Upload a PDF → extract text → chunk → embed → store |
| `/api/documents` | GET | List all documents |
| `/api/documents/:id` | DELETE | Delete a document and its chunks |
| `/api/topics` | GET | List all topics |
| `/api/topics` | POST | Create a topic |
| `/api/search` | POST | Semantic vector search over chunks (RAG retrieval) |
| `/api/quizzes` | POST | Create a quiz (with questions) |
| `/api/quizzes` | GET | List all quizzes |
| `/api/quizzes/:id` | GET | Fetch a quiz + its questions |
| `/api/quiz/submit` | POST | Submit answers → grade → store attempt → update mastery |
| `/api/attempts/:userId` | GET | Fetch a user's quiz attempt history |
| `/api/progress/:userId` | GET | Fetch a user's mastery per topic |
| `/api/flashcards/due` | GET | Fetch due flashcards for a user (SM-2 spaced repetition) |
| `/api/flashcards/review` | POST | Submit a flashcard review → update SM-2 schedule → return next review date |

---

## Project Structure (Person 2 — Backend/Data)

- [`server.js`](./server.js) — Express API server (ingestion, retrieval, quizzes, progress)
- [`schema.sql`](./schema.sql) — Postgres + pgvector schema & stored functions
- `.env` *(local only, gitignored)* — secrets
- `.env.example` — template for new contributors

---

## MVP Progress (Person 2)

- ✅ **P0:** Server foundation, document ingestion, semantic retrieval (RAG)
- ✅ **P1:** Topics, quizzes, quiz submission/grading, mastery tracking, topic-filtered retrieval, auto-mastery SQL function
- ✅ **P2 (Person 2 complete):** Flashcard tables + SM-2 stored functions (`schema.sql`), due-cards endpoint (`GET /api/flashcards/due`), review endpoint (`POST /api/flashcards/review`)
