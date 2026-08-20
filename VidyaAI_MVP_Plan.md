# StudyBuddy — Hackathon Build Plan
### AI Study Teacher (RAG-based) — 3-person team, priority-driven scope

> **Scoping note:** The source plan is a 44-section enterprise architecture (multi-agent system, knowledge tracing, code-execution sandboxes, adaptive learning, integrations, etc.) — months of work for a full team. This doc keeps the *vision* (an AI teacher that answers questions grounded in your own course material) and cuts everything else down to what 3 people can actually ship in a hackathon. Assumes a **~36-hour event**; compress/stretch the timeline proportionally if yours is shorter/longer.

---

## 1. What we're building (hackathon version)

A web app where a student uploads their course notes/PDFs, and an AI teacher:
- Answers questions **grounded in those documents** (RAG), with citations
- Generates **quizzes** from the material and tracks a simple mastery score
- (Stretch) Generates **flashcards** with spaced repetition

That's it. Everything else from the original doc (agents, memory systems, code execution, algorithm visualization, collaboration, mobile, integrations) is explicitly **out of scope** — see §8.

---

## 2. Recommended Stack

| Layer | Choice | Why (hackathon-specific) |
|---|---|---|
| Frontend + Backend | **Next.js 14 (App Router) + TypeScript**, single repo | One deploy target, API routes = backend, no separate server to stand up |
| UI | **Tailwind CSS + shadcn/ui** | Prebuilt accessible components — don't hand-roll buttons/modals under time pressure |
| DB + Vector store | **Supabase (Postgres + pgvector, enabled by default)** | Managed Postgres, pgvector, file storage, and auth in one free project — zero infra setup |
| File storage | **Supabase Storage** | Same project, one SDK, avoids wiring S3 |
| Auth | **Skip for P0** (single hardcoded demo user). Add **Supabase magic-link auth** only in P2 if time allows | Auth burns hours for zero demo value early on |
| Embeddings | **OpenAI `text-embedding-3-small`** (primary) | Cheapest/fastest well-documented embedding API, plugs directly into pgvector. **Note:** Groq doesn't host any embedding models as of Aug 2026 — it's an inference-only (LPU hardware) platform for open-weight *chat* models, so it can't fill this slot no matter which model you pick. If you want a non-OpenAI option here, **Voyage AI `voyage-3.5-lite`** is the closest swap: cheap, strong retrieval quality, simple REST API |
| Chat + Quiz generation | **Groq `openai/gpt-oss-120b`** (or `openai/gpt-oss-20b` for even more speed/lower cost) for the interactive chat endpoint, with **OpenAI `gpt-4o-mini`** or **Claude Haiku/Sonnet** wired in as a fallback and for quiz JSON generation | Groq's LPU hardware serves GPT-OSS-120B at ~500 tok/s — chat answers stream in almost instantly, which is a genuinely good "wow" moment for judges watching a live demo. Keep a second provider behind the same interface: fall back to it if Groq rate-limits mid-demo, and lean on it for quiz generation where you want the most battle-tested structured/JSON-mode support. ⚠️ If any tutorial or old code you find uses `llama-3.3-70b-versatile` or `llama-3.1-8b-instant` on Groq — those were deprecated in June 2026. Use `openai/gpt-oss-120b` / `openai/gpt-oss-20b` (or `qwen/qwen3.6-27b` as a third option) instead |
| LLM provider layer | Thin wrapper (~1 file, e.g. `callLLM(provider, messages, opts)`) around each provider's chat-completions call | Groq, OpenAI, and most others expose an OpenAI-compatible `/chat/completions` schema, so one small wrapper lets any teammate swap models by changing a string, not touching business logic. Also sets you up for a cheap stretch demo: "same question, three models, watch the speed difference" |
| PDF/text parsing | **`pdf-parse`** npm package | Minimal setup, good enough for text-based PDFs (no OCR needed for hackathon docs) |
| Chunking | Hand-rolled ~30-line splitter (fixed-size + overlap) | A LangChain dependency isn't worth the setup time for one function |
| Markdown/code rendering in chat | **`react-markdown` + `rehype-highlight`** | CS content = code snippets; syntax highlighting matters for the demo |
| Deployment | **Vercel** (frontend+API) + Supabase (DB/storage) | Both have generous free tiers and near-zero config |

**Fallback if pgvector setup breaks under time pressure:** hold embeddings in a plain in-memory JS array and do cosine similarity in application code. Ugly, but keeps the demo alive.

---

## 2.1 Reference implementations we're pulling from

Two existing hackathon projects are close enough to our shape to study before building from scratch — borrow *patterns*, not necessarily raw files (see licensing note at the end).

**StudyMate** — https://github.com/adetorojeremiahfadesayo/StudyMate
Nearly our exact stack: Next.js App Router + TypeScript + Tailwind + Supabase, with Azure OpenAI standing in for our OpenAI/Groq calls. Worth lifting:
- **A `/demo` route with pre-seeded data and no login required** — always works for judges regardless of what's broken in the live upload flow. Build this from hour 1 as a safety net, not as P2 polish.
- **Revision PDF export via `jsPDF`** — cheap, visible P2 differentiator that maps directly onto our quiz results / flashcards.
- **"Plain Mode vs Story Mode"** — two prompt presets on the same chat endpoint, so the AI teacher feels like more than one feature for almost no extra code. Easy to reframe as e.g. "Explain simply" vs "Explain with an example."
- **A retrieval-adapter pattern** (one function, real backend or local fallback depending on whether credentials are configured) — a clean template for our own retrieval helper so pgvector and the in-memory fallback share one call site.

**StudyBuddy** — https://github.com/onenewborn/StudyBuddy-public
Different stack (Python/FastAPI + Alpine.js, not Next.js), so less directly portable, but worth reading for two ideas:
- Its **agent pipeline** (OCR → Grade → KnowPoint → ExamTag as separate steps) is a clean way to decompose "grade this and tag the concept" — useful if quiz scoring/explanation logic outgrows a single prompt.
- Its **`LLM_BINDING` env-var pattern** (swap `openai` / `anthropic` without touching code) is the same idea as our provider-abstraction row in §2 — good validation that it's worth the ~30 minutes.

**Before copying actual code:** check each repo's license. Neither repo shows a `LICENSE` file as of this writing — StudyMate's own README even lists "License file" under "still needed before submission." Treat both as "read for architecture, don't paste substantial code blocks" unless the authors say otherwise. Reimplementing a pattern, prompt structure, or schema shape in your own words is fine; copying chunks of unlicensed code is legally murkier even in a hackathon.

---

## 3. Team Roles

| Role | Owns |
|---|---|
| **Frontend (Person 1)** | All UI: upload, chat, quiz, dashboard, flashcards. Consumes the API contract below. |
| **Backend — Data & Ingestion (Person 2)** | DB schema, file upload/storage, PDF parsing, chunking, embeddings, vector retrieval, progress/mastery persistence. |
| **Backend — AI & Orchestration (Person 3)** | Chat endpoint (RAG → prompt → LLM → citations), quiz generation, quiz scoring logic, flashcard generation, prompt design. |

**Why split this way and not "backend A does auth, B does everything else":** Person 2's work (ingestion pipeline) and Person 3's work (using what's ingested) are sequential but each is a full, parallel-buildable subsystem — Person 3 can build against mock chunks while Person 2 finishes real ingestion, so nobody blocks anybody for long.

### Coordination protocol
1. **Hour 0–1:** All three agree on the API contract (§6) and DB schema (§7) together — do not skip this, it's what lets you all work in parallel.
2. Person 2 stands up the Supabase project immediately so everyone has DB access by hour 1.
3. Frontend builds against **mocked JSON responses** matching the contract until real endpoints land — don't wait.
4. Merge/integrate at the end of every priority tier (P0, P1, P2), not just at the end.

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                          │
│   Upload UI  |  Chat UI  |  Quiz UI  |  Progress Dashboard    │
└──────────────────────────┬─────────────────────────────────────┘
                            │ fetch / streamed response
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              NEXT.JS APP (single Vercel deploy)                │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ /api/documents  │  │  /api/chat    │  │   /api/quiz       │  │
│  │  (Person 2)     │  │  (Person 3)   │  │   (Person 3)      │  │
│  └────────┬────────┘  └───────┬───────┘  └─────────┬─────────┘  │
└───────────┼───────────────────┼────────────────────┼────────────┘
            │                   │                     │
            ▼                   ▼                     ▼
   ┌────────────────┐  ┌────────────────┐   ┌─────────────────────┐
   │ Supabase Storage│  │   OpenAI API    │   │ Supabase Postgres    │
   │  (raw files)    │  │ (embed + chat)  │   │  + pgvector           │
   └────────────────┘  └────────────────┘   └─────────────────────┘
```

### RAG data flow (the core loop)

```
UPLOAD                                   QUESTION
  │                                         │
  ▼                                         ▼
Extract text (pdf-parse)              Embed the question
  │                                         │
  ▼                                         ▼
Chunk (~700 tokens, 15% overlap)      pgvector cosine search
  │                                    (top-k, scoped to doc/topic)
  ▼                                         │
Embed each chunk (OpenAI)                   ▼
  │                                    Assemble context + build prompt
  ▼                                         │
Store in `chunks` table                     ▼
(content + embedding + metadata)       LLM generates answer + citations
                                             │
                                             ▼
                                   { answer, citations[] } → frontend
```

---

## 5. Database Schema (simplified from the original 12-table design)

```
users                  documents                    chunks
─────                  ─────────                    ──────
id (pk)          ┌───▶ id (pk)               ┌─────▶ id (pk)
email             │     user_id (fk)          │       document_id (fk)
created_at        │     title                 │       content (text)
                   │     topic (text tag)      │       embedding (vector 1536)
                   │     storage_path          │       page / section
                   │     status                │
                   └──────────────────────────────┘

quizzes                 quiz_questions              quiz_attempts
───────                 ──────────────              ─────────────
id (pk)           ┌───▶ id (pk)                     id (pk)
document_id (fk)   │     quiz_id (fk)                quiz_id (fk)
topic               │     question                    user_id (fk)
created_at           │     options (jsonb)              score
                      │     correct_answer               answers (jsonb)
                      │     explanation                  created_at
                      └────────────────────────────────

progress                            flashcards  (P2 only)
────────                            ───────────────────
id (pk)                             id (pk)
user_id (fk)                        document_id (fk)
topic                                front / back
mastery_score (0–100)                interval, ease_factor
updated_at                           next_review_date
```

Mastery calc for the hackathon: keep it simple — `mastery = weighted average of last N quiz_attempt scores for that topic`. Skip Bayesian/decay models entirely; that's a V2-only concept from the original doc.

---

## 6. API Contract (agree on this in hour 1, then build in parallel)

| Endpoint | Method | Body → Response | Owner |
|---|---|---|---|
| `/api/documents` | POST | `{file, topic}` → `{documentId, status}` | Person 2 |
| `/api/documents` | GET | → `[{id, title, topic, status}]` | Person 2 |
| `/api/chat` | POST | `{documentId or topic, message, history}` → `{answer, citations: [{snippet, page}]}` | Person 3 |
| `/api/quiz/generate` | POST | `{documentId or topic, count}` → `{quizId, questions: [{id, question, options, }]}` | Person 3 |
| `/api/quiz/submit` | POST | `{quizId, answers}` → `{score, results: [{correct, explanation}]}` | Person 3 |
| `/api/progress` | GET | → `[{topic, mastery}]` | Person 2 (storage) / Person 3 (calc) |
| `/api/flashcards/generate` (P2) | POST | `{documentId}` → `{cards: [{front, back}]}` | Person 3 |
| `/api/flashcards/review` (P2) | POST | `{cardId, grade}` → `{nextReviewDate}` | Person 2 |

---

## 7. Priority-Based Task Breakdown

### 🟢 PRIORITY 0 — Barebones Prototype
**Goal:** Upload a document, ask a question, get an answer grounded in it with a citation. This alone is a legitimate demo.

| Owner | Tasks |
|---|---|
| **Frontend** | Next.js + Tailwind + shadcn/ui skeleton and routing • Upload page (file input → calls upload API, shows doc list + status) • Chat page: pick a document, send messages, render answer + cited snippet • Basic nav/layout |
| **Backend — Data (P2)** | Provision Supabase (Postgres, pgvector extension on, Storage bucket) • `documents` + `chunks` tables • `POST /api/documents`: store file, extract text, chunk, embed, insert rows • `GET /api/documents` • Retrieval helper: embed query → pgvector top-k cosine search |
| **Backend — AI (P3)** | `POST /api/chat`: call retrieval helper → build grounded prompt → call LLM → return `{answer, citations}` • Handle "not found in your material" fallback when no relevant chunks • Basic in-memory or DB-stored chat history |

**Definition of done:** Upload a PDF of lecture notes → ask "explain X" → get an answer that quotes/points to the actual notes.

---

### 🟡 PRIORITY 1 — Feature-Complete Additions
**Goal:** Turn the Q&A bot into an actual *study* tool — quizzes + progress tracking + topic organization.

| Owner | Tasks |
|---|---|
| **Frontend** | Quiz UI: generate → answer → submit → show score & explanations • Progress dashboard: mastery bar/list per topic + recent attempts • Topic tagging/filtering on documents and chat • Streaming response UX, loading/error states |
| **Backend — Data (P2)** | `topics` relation on documents • `quizzes`, `quiz_questions`, `quiz_attempts` tables • `progress` table + mastery calc function • Scope retrieval by topic filter |
| **Backend — AI (P3)** | `POST /api/quiz/generate`: retrieve chunks → prompt LLM for structured JSON MCQs (use JSON/structured output mode, not free text) • `POST /api/quiz/submit`: score, store attempt, update mastery • `GET /api/progress` |

**Definition of done:** Generate a quiz from uploaded notes, take it, and watch your dashboard mastery score update.

---

### 🔵 PRIORITY 2 — Stretch / Polish (only if P0+P1 are solid)
**Goal:** Differentiators for judging, not required for a working demo.

| Owner | Tasks |
|---|---|
| **Frontend** | Flashcard review UI (flip + again/good/easy) • Markdown + code-block syntax highlighting in chat • Magic-link auth screen (if adding real auth) • Landing page copy, dark mode, visual polish |
| **Backend — Data (P2)** | `flashcards` table (SM-2 fields) • Due-cards query endpoint • Supabase auth wiring if added |
| **Backend — AI (P3)** | `POST /api/flashcards/generate` • SM-2 spaced-repetition scheduling on review • Code-aware prompt path ("explain/debug this code" mode) • Better citations (section headers/page numbers, not raw chunk IDs) |

**If you're short on time, cut in this order:** auth polish → flashcards → dark mode/landing polish → code-aware mode. Never cut P0/P1 to make room for P2.

---

## 8. Explicitly Out of Scope (from the original plan)

Do **not** attempt these in a hackathon — they're multi-week+ efforts each:
- Multi-agent architecture (Explanation/Practice/Quiz/Code/Review agents as separate systems)
- Bayesian/Deep Knowledge Tracing, forgetting-curve models
- Code execution sandbox (Docker-isolated code running)
- Algorithm visualization / interactive animations
- Adaptive learning path generation, prerequisite graphs
- Voice interaction, mobile apps, offline support
- Collaborative/social features, teacher dashboards
- Third-party integrations (Canvas, GitHub, Notion, Slack, etc.)

If a judge asks "what's next," these are the honest answer — frame them as roadmap, not missing features.

---

## 9. Suggested Timeline (36-hour event, adjust proportionally)

| Time | Milestone |
|---|---|
| Hour 0–1 | Team aligns on API contract + schema; Supabase project created |
| Hour 1–8 | P0 build (parallel) |
| Hour 8–10 | P0 integration checkpoint — full demo loop working end to end |
| Hour 10–20 | P1 build (parallel) |
| Hour 20–22 | P1 integration checkpoint |
| Hour 22–30 | P2 stretch work (optional, cut freely) |
| Hour 30–33 | Final integration, bug fixes, seed demo data |
| Hour 33–36 | Demo rehearsal, slides, buffer |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scanned/image PDFs won't extract text | Tell demo users/testers to use text-based PDFs; OCR is explicitly out of scope |
| LLM quiz output isn't valid JSON | Use structured/JSON-mode output; add a retry-with-repair step rather than a full parser |
| pgvector/Supabase setup eats time | In-memory vector array fallback (see §2) |
| Running out of time on P1 | P0 alone is demoable — protect it above all else |
| LLM latency makes chat feel slow | Stream the response token-by-token so the UI feels responsive even at 2–3s latency |
| Groq model IDs change fast (deprecations can land with only weeks of notice) | Pin the exact model ID you test with, double check https://console.groq.com/docs/models the morning of the event, and keep the OpenAI/Claude fallback from §2 wired in from hour 1 — don't let a 404 surface mid-demo |

---

## 11. What to Show Judges at Each Tier

- **P0 only:** "Upload your own notes, ask it a question, watch it answer from *your* material with a citation — not a generic chatbot."
- **+ P1:** "Now it quizzes you on what you uploaded and tracks how well you actually know each topic."
- **+ P2:** "And it turns weak spots into spaced-repetition flashcards automatically."

Each tier is a complete, working sentence for your pitch — build in order and you're never left with something unshowable.
