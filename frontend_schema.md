# Frontend Schema — AI Study Teacher

A working spec for the frontend build: routes, component tree, data types, and state management, matched to the P0/P1/P2 priorities from the main plan. Build against the mocked types below — you don't need to wait on the backend to start.

---

## 1. Route Map

```
/                         → redirect to /login or /dashboard
/login                    → Supabase Auth UI (P0)
/dashboard                → Course list + progress overview (P1, stub in P0)
/courses/new              → Create course (P1)
/courses/[courseId]       → Course detail: resources, topics, scoped chat (P1)
/courses/[courseId]/chat  → Full chat view scoped to course (P0 as global /chat, P1 scoped)
/courses/[courseId]/quiz/[quizId]   → Take a quiz (P1)
/courses/[courseId]/progress        → Mastery breakdown (P1)
```

P0 note: skip courses entirely — just ship `/chat` as one global chat over whatever's been uploaded, and `/upload`. Introduce the `/courses/*` structure in P1.

---

## 2. Component Tree

```
app/
├── layout.tsx                  # shell: nav + auth guard
├── (auth)/
│   └── login/page.tsx
├── dashboard/
│   ├── page.tsx
│   └── components/
│       ├── CourseCard.tsx
│       └── ProgressSummary.tsx
├── upload/
│   ├── page.tsx                # P0
│   └── components/
│       └── FileDropzone.tsx
├── courses/
│   ├── new/page.tsx
│   └── [courseId]/
│       ├── page.tsx             # overview + resource list
│       ├── chat/page.tsx
│       ├── quiz/[quizId]/page.tsx
│       └── progress/page.tsx
└── components/
    ├── ui/                      # shadcn primitives (Button, Card, Input, Dialog, Progress, Tabs)
    ├── chat/
    │   ├── ChatWindow.tsx       # wraps useChat, message list + input
    │   ├── MessageBubble.tsx
    │   └── CitationList.tsx     # P1 — renders sources under an answer
    ├── quiz/
    │   ├── QuizRunner.tsx       # question-by-question flow, tracks answers in state
    │   ├── QuestionCard.tsx
    │   └── QuizResult.tsx       # score + per-question feedback
    ├── progress/
    │   ├── MasteryBar.tsx
    │   └── TopicBreakdown.tsx
    └── layout/
        ├── NavBar.tsx
        └── AuthGuard.tsx
```

---

## 3. Data Types

Define these once, share across components. Keep them in `lib/types.ts` and treat them as the contract with backend — if backend's response shape changes, this is the one file to update.

```typescript
// lib/types.ts

export interface Course {
  id: string
  title: string
  description: string
  createdAt: string
  progressPct?: number   // P1, comes from /api/student/progress
}

export interface Resource {
  id: string
  courseId: string
  filename: string
  status: 'processing' | 'ready' | 'failed'   // for upload UI feedback
  uploadedAt: string
}

export interface Topic {
  id: string
  courseId: string
  title: string
  mastery?: number        // 0–100, P1
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]  // P1
}

export interface Citation {
  resourceName: string
  snippet: string
}

export interface Quiz {
  id: string
  courseId: string
  topicId: string
  questions: QuizQuestion[]
}

export interface QuizQuestion {
  id: string
  prompt: string
  type: 'multiple_choice'
  options: { id: string; text: string }[]
}

export interface QuizResult {
  score: number
  total: number
  feedback: {
    questionId: string
    correct: boolean
    correctOptionId: string
    explanation: string
  }[]
}

export interface Progress {
  courseId: string
  topics: { topicId: string; title: string; mastery: number }[]
}
```

---

## 4. State Management

Keep it simple — you don't need Redux/Zustand for a hackathon:

| State | Where it lives | Why |
|---|---|---|
| Auth session | Supabase client (`useUser` hook) | Supabase handles this for you |
| Chat messages | Vercel AI SDK's `useChat` (local to ChatWindow) | Built-in streaming + message state |
| Course list, progress | React Query (`useQuery`) | Caching + refetch-on-focus for free, avoids manual `useEffect` fetch spaghetti |
| Quiz-in-progress answers | Local `useState` in `QuizRunner` | Ephemeral, only needs to live until submit |
| Upload status | Local `useState` in `FileDropzone`, polled via React Query | Show "processing → ready" without a full page reload |

Install: `@tanstack/react-query` + `ai` (Vercel AI SDK) + `@supabase/auth-helpers-nextjs`.

---

## 5. Page-by-Page Build Notes

### Upload (P0)
- Drag/drop or file picker → `POST /api/resources/ingest`
- Show status badge (`processing` → `ready`) — poll every 2s or just show a spinner until response resolves
- On success, link straight to `/chat`

### Chat (P0 → P1)
- `useChat({ api: '/api/chat', body: { courseId } })` from Vercel AI SDK handles streaming automatically
- P0: no `courseId`, global chat
- P1: scope to course, render `CitationList` under each assistant message using `message.citations`

### Dashboard (P1)
- `useQuery(['courses'], fetchCourses)` → map to `CourseCard`
- Each card shows title + `ProgressSummary` (thin progress bar using `progressPct`)
- Empty state: "No courses yet" + CTA to `/courses/new`

### Course detail (P1)
- Tabs: Resources | Topics | Chat
- Resources tab reuses `FileDropzone` scoped to `courseId`

### Quiz (P1)
- `QuizRunner` fetches quiz via `POST /api/quizzes/generate`, holds answers in local state, on submit calls `POST /api/quizzes/:id/submit`
- `QuizResult` renders score + walks through `feedback[]`, red/green per question with the explanation shown inline

### Progress (P1)
- `useQuery` on `/api/student/progress`
- `TopicBreakdown` maps each topic to a `MasteryBar` (just a styled `<progress>` or shadcn `Progress` component — no need for a charting library unless you want one)

---

## 6. What NOT to build (P0/P1 scope)

- No client-side routing guards beyond a single `AuthGuard` wrapper — don't build per-route permission logic
- No offline support / service workers
- No custom design system — use shadcn/ui defaults, spend polish time on the chat and quiz screens since those are what judges will actually interact with
- No dark mode toggle unless everything else is done (P2 stretch item from the main plan)