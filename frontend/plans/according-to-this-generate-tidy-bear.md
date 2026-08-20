# VidyaAI UI Prototype Plan

## Context
Build a full UI prototype for VidyaAI — an AI study teacher web app from a hackathon brief. Students upload PDFs, chat with an AI grounded in their notes, generate quizzes, track mastery scores by topic, and review flashcards. The prototype covers all P0/P1 views with mocked data and working navigation state.

## Aesthetic Stance
**Swiss** — strict grid, precise alignment, function declares the aesthetic. Paired with monospace-as-display typography for an intelligent, technical feel. Indigo primary from the spec's color tokens, dark-ground canvas (near-black neutral-900), hairline borders, generous whitespace.

Fonts (Google Fonts via CSS @import in `src/index.css`):
- Display/labels: **JetBrains Mono** (headings, nav labels, data)  
- Body/UI: **Inter** (chat messages, descriptions, form controls)

## What to Build

Single `src/App.tsx` with React state driving a multi-view prototype:

### Shell
- Collapsible left sidebar (240px) with VidyaAI logo, nav sections: My Documents, AI Teacher, Practice Quizzes, Progress Tracker, Settings
- Top bar with active section title + quick-action buttons (Upload, New Chat, Generate Quiz)
- Main content area taking remaining width

### Views (tab/state-driven, no router needed)
1. **My Documents** — file list table + drag-and-drop upload card. Document rows show title, topic tag, status badge (Processing/Ready/Error), date. Upload card has dashed border drop zone.
2. **AI Teacher (Chat)** — document selector dropdown, scrollable message list with user/AI bubbles. AI messages include a collapsible citation chip showing snippet + page. Typing indicator. Message input with send button.
3. **Practice Quizzes** — two sub-states: Generate form (topic selector, question count slider) → Quiz in progress (MCQ cards, one question at a time, progress bar) → Results summary (score, per-question explanation).
4. **Progress Tracker** — mastery score ring per topic, recent quiz attempts table, weak-areas highlight row.

### Mocked Data
Realistic CS-course content: topics like "Binary Search Trees", "Dynamic Programming", "OS Memory Management". Fake documents: "lecture_week5.pdf", "algorithm_notes.pdf". Quiz questions about actual CS concepts.

## Files Modified
- `src/index.css` — add Google Fonts @imports at top (JetBrains Mono + Inter), define CSS custom properties for the dark theme color tokens
- `src/App.tsx` — full prototype implementation (~400-600 lines, split into logical component sections within the file)

## Implementation Notes
- Use Tailwind v4 utility classes throughout
- Dark background: `#18181B` (neutral-900), card surface: `#27272A` (neutral-800)
- Primary accent: `#6366F1` (indigo-500) for buttons, active nav, progress fills
- Secondary: `#22C55E` (green-500) for success/mastery
- Sidebar active state: indigo background pill
- All transitions via `transition-all duration-200`
- Responsive: sidebar collapses to icon-only at <1024px (or hidden), main area takes full width

## Verification
Open the preview panel — prototype should render the full dark-canvas dashboard. Clicking sidebar items switches views. Quiz flow: Generate → In-progress → Results. Upload card shows hover state on drag-over.
