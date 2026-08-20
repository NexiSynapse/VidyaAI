import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "dashboard" | "documents" | "chat" | "quiz" | "progress" | "settings";
type QuizPhase = "generate" | "taking" | "results";
type DocStatus = "ready" | "processing" | "error";

interface Document {
  id: string;
  title: string;
  topic: string;
  status: DocStatus;
  pages: number;
  date: string;
  size: string;
}

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  citations?: { snippet: string; page: number }[];
  timestamp: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface TopicProgress {
  topic: string;
  mastery: number;
  attempts: number;
  lastAttempt: string;
  trend: "up" | "down" | "flat";
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DOCS: Document[] = [
  { id: "d1", title: "lecture_week5_binary_trees.pdf", topic: "Data Structures", status: "ready", pages: 24, date: "Aug 18, 2026", size: "1.2 MB" },
  { id: "d2", title: "dynamic_programming_notes.pdf", topic: "Algorithms", status: "ready", pages: 38, date: "Aug 17, 2026", size: "2.8 MB" },
  { id: "d3", title: "os_memory_management.pdf", topic: "Operating Systems", status: "processing", pages: 0, date: "Aug 20, 2026", size: "4.1 MB" },
  { id: "d4", title: "graph_algorithms_midterm.pdf", topic: "Algorithms", status: "ready", pages: 15, date: "Aug 15, 2026", size: "0.9 MB" },
  { id: "d5", title: "networking_fundamentals.pdf", topic: "Networks", status: "error", pages: 0, date: "Aug 14, 2026", size: "3.3 MB" },
];

const MOCK_MESSAGES: Message[] = [
  {
    id: "m1", role: "user", content: "What is the time complexity of inserting a node into a balanced BST?",
    timestamp: "10:42 AM",
  },
  {
    id: "m2", role: "ai",
    content: "Inserting a node into a balanced Binary Search Tree (BST) — such as an AVL tree or Red-Black tree — takes **O(log n)** time in both average and worst cases.\n\nThis is because the tree maintains a height of at most O(log n) through rotations after each insertion. You traverse from root to leaf (log n levels) to find the insertion point, then perform at most O(log n) rotations to rebalance.",
    citations: [{ snippet: "A balanced BST maintains O(log n) height by performing rotations after insertions...", page: 7 }],
    timestamp: "10:42 AM",
  },
  {
    id: "m3", role: "user", content: "How does an AVL tree differ from a Red-Black tree?",
    timestamp: "10:44 AM",
  },
  {
    id: "m4", role: "ai",
    content: "Both are self-balancing BSTs, but they differ in their balancing strategy:\n\n**AVL Trees** maintain a stricter balance — every node's subtrees differ in height by at most 1. This makes lookups slightly faster but requires more rotations on insertions/deletions.\n\n**Red-Black Trees** are more loosely balanced — the longest path is at most twice the shortest. They require fewer rotations on writes, which is why most standard library implementations (Java's `TreeMap`, C++'s `std::map`) use Red-Black trees.",
    citations: [
      { snippet: "AVL trees enforce |height(left) - height(right)| ≤ 1 at every node...", page: 11 },
      { snippet: "Red-Black trees guarantee no path is more than twice as long as any other...", page: 14 },
    ],
    timestamp: "10:44 AM",
  },
];

const MOCK_QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    question: "Which traversal of a BST produces nodes in sorted (ascending) order?",
    options: ["Pre-order", "In-order", "Post-order", "Level-order"],
    correct: 1,
    explanation: "In-order traversal visits left subtree → root → right subtree. Since all values in a BST's left subtree are smaller and right subtree are larger, in-order traversal yields nodes in ascending sorted order.",
  },
  {
    id: "q2",
    question: "What is the worst-case height of a Red-Black tree with n nodes?",
    options: ["O(n)", "O(log n)", "O(2 log n)", "O(n log n)"],
    correct: 2,
    explanation: "A Red-Black tree guarantees that no path from root to leaf is more than twice the length of any other path. The minimum path is log n (all black nodes), so the maximum height is 2 log n — still O(log n) asymptotically.",
  },
  {
    id: "q3",
    question: "When deleting a node with two children from a BST, which replacement strategy is most common?",
    options: ["Replace with the root node", "Replace with in-order successor or predecessor", "Replace with the leftmost leaf", "Restructure the entire subtree"],
    correct: 1,
    explanation: "The standard approach replaces the deleted node's value with its in-order successor (smallest node in right subtree) or predecessor (largest in left subtree), then deletes that successor/predecessor node instead — which has at most one child.",
  },
  {
    id: "q4",
    question: "Which operation is NOT O(log n) in a balanced BST?",
    options: ["Search", "Insert", "Delete", "Finding all nodes in a range [a, b]"],
    correct: 3,
    explanation: "Range queries require visiting all k nodes in the range, making them O(log n + k) — not pure O(log n). The log n term covers finding the starting point; k covers outputting every matching node.",
  },
];

const MOCK_PROGRESS: TopicProgress[] = [
  { topic: "Data Structures", mastery: 82, attempts: 7, lastAttempt: "Aug 19", trend: "up" },
  { topic: "Algorithms", mastery: 64, attempts: 5, lastAttempt: "Aug 18", trend: "up" },
  { topic: "Operating Systems", mastery: 31, attempts: 2, lastAttempt: "Aug 16", trend: "flat" },
  { topic: "Networks", mastery: 55, attempts: 4, lastAttempt: "Aug 15", trend: "down" },
];

const RECENT_ATTEMPTS = [
  { date: "Aug 19", topic: "Data Structures", score: 8, total: 10, time: "4m 32s" },
  { date: "Aug 18", topic: "Algorithms", score: 6, total: 10, time: "6m 18s" },
  { date: "Aug 17", topic: "Data Structures", score: 7, total: 10, time: "5m 01s" },
  { date: "Aug 16", topic: "Operating Systems", score: 3, total: 10, time: "8m 44s" },
  { date: "Aug 15", topic: "Networks", score: 5, total: 8, time: "3m 55s" },
];

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

const Icon = {
  folder: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25" />
    </svg>
  ),
  chat: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  ),
  quiz: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
  chart: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  upload: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  send: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  chevronDown: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  x: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  sparkle: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  arrowUp: (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  ),
  arrowDown: (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
    </svg>
  ),
  minus: (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
    </svg>
  ),
};

const ACTIVITY_FEED = [
  { type: "quiz", text: "Scored 8/10 on Data Structures quiz", time: "2h ago", color: "text-green-400", dot: "bg-green-400" },
  { type: "upload", text: "Uploaded os_memory_management.pdf", time: "4h ago", color: "text-indigo-400", dot: "bg-indigo-400" },
  { type: "chat", text: "Asked 6 questions in AI Teacher", time: "5h ago", color: "text-[#818cf8]", dot: "bg-[#818cf8]" },
  { type: "quiz", text: "Scored 6/10 on Algorithms quiz", time: "Yesterday", color: "text-yellow-400", dot: "bg-yellow-400" },
  { type: "upload", text: "Uploaded dynamic_programming_notes.pdf", time: "Yesterday", color: "text-indigo-400", dot: "bg-indigo-400" },
  { type: "chat", text: "Started session on Binary Trees", time: "2 days ago", color: "text-[#818cf8]", dot: "bg-[#818cf8]" },
];

const SUGGESTED_TOPICS = [
  { topic: "AVL Tree Rotations", doc: "lecture_week5_binary_trees.pdf", reason: "Low mastery — 3 questions unanswered" },
  { topic: "Memoization Patterns", doc: "dynamic_programming_notes.pdf", reason: "Not practiced yet" },
  { topic: "Page Replacement Algorithms", doc: "os_memory_management.pdf", reason: "New upload — ready to explore" },
];

// Weekly activity heatmap data (last 7 days, sessions per day)
const WEEKLY_SESSIONS = [
  { day: "Mon", sessions: 3, questions: 12 },
  { day: "Tue", sessions: 1, questions: 4 },
  { day: "Wed", sessions: 4, questions: 18 },
  { day: "Thu", sessions: 2, questions: 9 },
  { day: "Fri", sessions: 5, questions: 22 },
  { day: "Sat", sessions: 0, questions: 0 },
  { day: "Sun", sessions: 2, questions: 7 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocStatus }) {
  const styles: Record<DocStatus, string> = {
    ready: "bg-green-500/15 text-green-400 border-green-500/20",
    processing: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    error: "bg-red-500/15 text-red-400 border-red-500/20",
  };
  const labels: Record<DocStatus, string> = { ready: "Ready", processing: "Processing", error: "Error" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "ready" ? "bg-green-400" : status === "processing" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
      {labels[status]}
    </span>
  );
}

function MasteryRing({ mastery, topic }: { mastery: number; topic: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - mastery / 100);
  const color = mastery >= 75 ? "#22c55e" : mastery >= 50 ? "#6366f1" : mastery >= 30 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#3f3f46" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono font-bold text-lg" style={{ color }}>{mastery}</span>
        </div>
      </div>
      <span className="text-xs text-[#a1a1aa] font-mono text-center leading-tight">{topic}</span>
    </div>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function DashboardView({ navigate }: { navigate: (v: View) => void }) {
  const totalDocs = MOCK_DOCS.length;
  const readyDocs = MOCK_DOCS.filter(d => d.status === "ready").length;
  const avgMastery = Math.round(MOCK_PROGRESS.reduce((a, p) => a + p.mastery, 0) / MOCK_PROGRESS.length);
  const totalQuizzes = RECENT_ATTEMPTS.length;
  const totalQuestions = WEEKLY_SESSIONS.reduce((a, d) => a + d.questions, 0);

  const [activeStreak] = useState(5);
  const [quickPrompt, setQuickPrompt] = useState("");

  const maxSessions = Math.max(...WEEKLY_SESSIONS.map(d => d.sessions));

  return (
    <div className="p-6 space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600/30 via-indigo-500/10 to-transparent border border-indigo-500/20 p-6 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-indigo-400 uppercase tracking-widest mb-1">Wednesday, Aug 20</p>
          <h2 className="font-mono font-bold text-2xl text-[#f4f4f5] mb-1">Good afternoon, Student</h2>
          <p className="text-sm text-[#71717a]">You have 1 document processing and 2 topics below 60% mastery.</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="flex items-center gap-1.5 text-xs font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
              🔥 {activeStreak}-day streak
            </span>
            <span className="text-xs font-mono text-[#52525b]">{totalQuestions} questions this week</span>
          </div>
        </div>
        <div className="hidden sm:flex flex-col gap-2 shrink-0">
          <button onClick={() => navigate("chat")} className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-mono font-semibold transition-colors duration-150 flex items-center gap-2">
            {Icon.chat} Continue Studying
          </button>
          <button onClick={() => navigate("quiz")} className="px-4 py-2.5 rounded-xl border border-[#3f3f46] hover:border-[#52525b] hover:bg-[#27272a] text-[#a1a1aa] text-xs font-mono transition-colors duration-150 flex items-center gap-2">
            {Icon.quiz} Quick Quiz
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Documents", value: readyDocs, sub: `${totalDocs} total`, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", onClick: () => navigate("documents") },
          { label: "Avg Mastery", value: `${avgMastery}%`, sub: "across all topics", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", onClick: () => navigate("progress") },
          { label: "Quizzes Taken", value: totalQuizzes, sub: "this session", color: "text-[#818cf8]", bg: "bg-indigo-500/10", border: "border-indigo-500/20", onClick: () => navigate("quiz") },
          { label: "This Week", value: totalQuestions, sub: "questions answered", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", onClick: () => navigate("progress") },
        ].map(tile => (
          <button
            key={tile.label}
            onClick={tile.onClick}
            className={`rounded-xl border ${tile.border} ${tile.bg} p-4 text-left hover:brightness-110 transition-all duration-150 group`}
          >
            <div className={`font-mono font-bold text-3xl ${tile.color}`}>{tile.value}</div>
            <div className="font-mono text-xs text-[#f4f4f5] mt-1">{tile.label}</div>
            <div className="font-mono text-[10px] text-[#52525b] mt-0.5">{tile.sub}</div>
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left col: mastery + weekly activity */}
        <div className="lg:col-span-2 space-y-5">

          {/* Topic mastery mini-bars */}
          <div className="bg-[#27272a] rounded-2xl border border-[#3f3f46] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-xs text-[#52525b] uppercase tracking-wider">Topic Mastery</h3>
              <button onClick={() => navigate("progress")} className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors">View all →</button>
            </div>
            <div className="space-y-3">
              {MOCK_PROGRESS.map(p => {
                const color = p.mastery >= 75 ? "#22c55e" : p.mastery >= 50 ? "#6366f1" : p.mastery >= 30 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={p.topic} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#a1a1aa] w-36 truncate shrink-0">{p.topic}</span>
                    <div className="flex-1 h-2 bg-[#3f3f46] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.mastery}%`, backgroundColor: color }} />
                    </div>
                    <span className="font-mono text-xs w-8 text-right shrink-0" style={{ color }}>{p.mastery}</span>
                    <span className={`shrink-0 ${p.trend === "up" ? "text-green-400" : p.trend === "down" ? "text-red-400" : "text-[#52525b]"}`}>
                      {p.trend === "up" ? Icon.arrowUp : p.trend === "down" ? Icon.arrowDown : Icon.minus}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly activity chart */}
          <div className="bg-[#27272a] rounded-2xl border border-[#3f3f46] p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-mono text-xs text-[#52525b] uppercase tracking-wider">Weekly Sessions</h3>
              <span className="text-xs font-mono text-[#52525b]">Aug 14 – 20</span>
            </div>
            <div className="flex items-end gap-3 h-24">
              {WEEKLY_SESSIONS.map(d => {
                const height = maxSessions > 0 ? (d.sessions / maxSessions) * 100 : 0;
                const isToday = d.day === "Sun";
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="relative w-full flex items-end justify-center" style={{ height: "80px" }}>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${isToday ? "bg-indigo-500" : "bg-[#3f3f46] group-hover:bg-indigo-500/50"}`}
                        style={{ height: `${Math.max(height, d.sessions > 0 ? 8 : 3)}%` }}
                      />
                      {d.sessions > 0 && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-[#18181b] border border-[#3f3f46] rounded px-1.5 py-0.5 text-[10px] font-mono text-[#f4f4f5] whitespace-nowrap pointer-events-none">
                          {d.sessions}s · {d.questions}q
                        </div>
                      )}
                    </div>
                    <span className={`font-mono text-[10px] ${isToday ? "text-indigo-400" : "text-[#52525b]"}`}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick ask */}
          <div className="bg-[#27272a] rounded-2xl border border-[#3f3f46] p-5">
            <h3 className="font-mono text-xs text-[#52525b] uppercase tracking-wider mb-3">Quick Ask</h3>
            <div className="flex gap-3">
              <input
                value={quickPrompt}
                onChange={e => setQuickPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && quickPrompt.trim()) { navigate("chat"); } }}
                placeholder="Ask your AI teacher anything…"
                className="flex-1 bg-[#1c1c1f] border border-[#3f3f46] rounded-xl px-4 py-3 text-sm text-[#f4f4f5] placeholder:text-[#52525b] focus:outline-none focus:border-indigo-500 font-sans transition-colors duration-150"
              />
              <button
                onClick={() => { if (quickPrompt.trim()) navigate("chat"); }}
                className="px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm transition-colors duration-150"
              >
                {Icon.send}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {["Explain BST rotations", "What is memoization?", "Difference between TCP and UDP"].map(q => (
                <button
                  key={q}
                  onClick={() => { setQuickPrompt(q); navigate("chat"); }}
                  className="px-2.5 py-1 rounded-lg bg-[#1c1c1f] border border-[#3f3f46] text-xs font-mono text-[#71717a] hover:text-[#f4f4f5] hover:border-[#52525b] transition-colors duration-150"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right col: activity feed + suggestions */}
        <div className="space-y-5">

          {/* Suggested next */}
          <div className="bg-[#27272a] rounded-2xl border border-[#3f3f46] p-5">
            <h3 className="font-mono text-xs text-[#52525b] uppercase tracking-wider mb-4">Suggested Next</h3>
            <div className="space-y-3">
              {SUGGESTED_TOPICS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => navigate("chat")}
                  className="w-full text-left p-3 rounded-xl border border-[#3f3f46] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-150 group"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-mono font-bold">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[#d4d4d8] font-semibold group-hover:text-indigo-300 transition-colors truncate">{s.topic}</p>
                      <p className="text-[10px] text-[#52525b] mt-0.5 truncate">{s.reason}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent docs */}
          <div className="bg-[#27272a] rounded-2xl border border-[#3f3f46] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-xs text-[#52525b] uppercase tracking-wider">Recent Files</h3>
              <button onClick={() => navigate("documents")} className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors">All →</button>
            </div>
            <div className="space-y-2">
              {MOCK_DOCS.slice(0, 4).map(doc => (
                <button
                  key={doc.id}
                  onClick={() => navigate("documents")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#3f3f46] transition-colors duration-150 text-left group"
                >
                  <div className="w-7 h-7 rounded-md bg-[#3f3f46] flex items-center justify-center text-[#71717a] shrink-0">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z"/><path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-[#d4d4d8] truncate group-hover:text-[#f4f4f5]">{doc.title}</p>
                    <p className="font-mono text-[10px] text-[#52525b]">{doc.topic}</p>
                  </div>
                  <StatusBadge status={doc.status} />
                </button>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="bg-[#27272a] rounded-2xl border border-[#3f3f46] p-5">
            <h3 className="font-mono text-xs text-[#52525b] uppercase tracking-wider mb-4">Activity</h3>
            <div className="relative">
              <div className="absolute left-[5px] top-0 bottom-0 w-px bg-[#3f3f46]" />
              <div className="space-y-4 pl-5">
                {ACTIVITY_FEED.map((a, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full ${a.dot} ring-2 ring-[#27272a] translate-x-0`} />
                    <p className={`text-xs font-mono ${a.color} leading-snug`}>{a.text}</p>
                    <p className="text-[10px] font-mono text-[#3f3f46] mt-0.5">{a.time}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsView() {
  const [dragging, setDragging] = useState(false);
  const [docs, setDocs] = useState(MOCK_DOCS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const newDoc: Document = {
      id: `d${Date.now()}`, title: file.name,
      topic: "Untagged", status: "processing",
      pages: 0, date: "Aug 20, 2026", size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    };
    setDocs(prev => [newDoc, ...prev]);
    setTimeout(() => setDocs(prev => prev.map(d => d.id === newDoc.id ? { ...d, status: "ready", pages: 22 } : d)), 2800);
  }

  return (
    <div className="p-8 space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 select-none
          ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-[#3f3f46] hover:border-[#6366f1]/60 hover:bg-[#27272a]"}`}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" className="hidden" />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200 ${dragging ? "bg-indigo-500/20 text-indigo-400" : "bg-[#3f3f46] text-[#a1a1aa]"}`}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="font-mono font-semibold text-sm text-[#f4f4f5]">Drop PDF or click to upload</p>
            <p className="text-xs text-[#71717a] mt-1">Supports .pdf, .txt, .md — text-based only</p>
          </div>
        </div>
      </div>

      {/* Documents table */}
      <div className="rounded-xl overflow-hidden border border-[#3f3f46]">
        <div className="px-4 py-3 bg-[#27272a] border-b border-[#3f3f46] flex items-center justify-between">
          <span className="font-mono text-xs text-[#a1a1aa] uppercase tracking-wider">Documents — {docs.length} files</span>
          <div className="flex gap-2">
            {["All", "Ready", "Processing"].map(f => (
              <button key={f} className="px-2.5 py-1 rounded-md text-xs font-mono text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#3f3f46] transition-colors duration-150">{f}</button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#3f3f46]">
              {["File", "Topic", "Pages", "Size", "Added", "Status"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-mono text-xs text-[#52525b] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, i) => (
              <tr
                key={doc.id}
                className={`border-b border-[#27272a] hover:bg-[#27272a] transition-colors duration-150 cursor-pointer ${i === docs.length - 1 ? "border-b-0" : ""}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-[#c7d2fe]">{doc.title}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono">{doc.topic}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#71717a]">{doc.pages > 0 ? doc.pages : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#71717a]">{doc.size}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#52525b]">{doc.date}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChatView() {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const [selectedDoc, setSelectedDoc] = useState("d1");
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function toggleCitation(id: string) {
    setExpandedCitations(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function sendMessage() {
    if (!input.trim()) return;
    const userMsg: Message = { id: `m${Date.now()}`, role: "user", content: input, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const aiMsg: Message = {
        id: `m${Date.now() + 1}`, role: "ai",
        content: "That's a great question. Based on your uploaded notes, this concept relates to the material covered in the lecture on tree rotations. The key insight is that maintaining structural invariants during mutations is what gives balanced trees their logarithmic guarantees.",
        citations: [{ snippet: "The rotation operation preserves the BST property while adjusting heights...", page: 9 }],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1800);
  }

  const readyDocs = MOCK_DOCS.filter(d => d.status === "ready");

  function renderContent(content: string) {
    return content.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) return <strong key={j} className="font-semibold text-[#f4f4f5]">{part.slice(2, -2)}</strong>;
            if (part.startsWith("`") && part.endsWith("`")) return <code key={j} className="px-1.5 py-0.5 rounded bg-[#3f3f46] font-mono text-xs text-[#c7d2fe]">{part.slice(1, -1)}</code>;
            return <span key={j}>{part}</span>;
          })}
          {i < content.split("\n").length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-[#3f3f46] flex items-center gap-3 bg-[#1c1c1f]">
        <span className="text-xs font-mono text-[#71717a]">Context:</span>
        <select
          value={selectedDoc}
          onChange={e => setSelectedDoc(e.target.value)}
          className="flex-1 max-w-xs bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-1.5 text-xs font-mono text-[#c7d2fe] focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {readyDocs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          <span className="text-xs font-mono text-[#71717a]">RAG active</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-bold ${msg.role === "user" ? "bg-indigo-500 text-white" : "bg-[#3f3f46] text-[#818cf8]"}`}>
              {msg.role === "user" ? "U" : "AI"}
            </div>
            <div className={`max-w-[72%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-500 text-white rounded-tr-sm" : "bg-[#27272a] text-[#d4d4d8] rounded-tl-sm"}`}>
                {renderContent(msg.content)}
              </div>
              {msg.citations && msg.citations.length > 0 && (
                <div className="space-y-1 w-full">
                  {msg.citations.map((c, ci) => (
                    <div key={ci} className="rounded-lg overflow-hidden border border-[#3f3f46]">
                      <button
                        onClick={() => toggleCitation(`${msg.id}-${ci}`)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-[#27272a] hover:bg-[#3f3f46] transition-colors duration-150 text-left"
                      >
                        <span className="text-indigo-400">{Icon.sparkle}</span>
                        <span className="text-xs font-mono text-[#818cf8]">Source — p.{c.page}</span>
                        <span className={`ml-auto text-[#52525b] transition-transform duration-200 ${expandedCitations.has(`${msg.id}-${ci}`) ? "rotate-180" : ""}`}>{Icon.chevronDown}</span>
                      </button>
                      {expandedCitations.has(`${msg.id}-${ci}`) && (
                        <div className="px-3 py-2 bg-[#1c1c1f] border-t border-[#3f3f46]">
                          <p className="text-xs font-mono text-[#71717a] italic">"{c.snippet}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <span className="text-[10px] font-mono text-[#52525b]">{msg.timestamp}</span>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#3f3f46] text-[#818cf8] text-xs font-mono font-bold">AI</div>
            <div className="px-4 py-3 rounded-xl bg-[#27272a] flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-[#3f3f46]">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask a question about your notes…"
            rows={1}
            className="flex-1 bg-[#27272a] border border-[#3f3f46] rounded-xl px-4 py-3 text-sm text-[#f4f4f5] placeholder:text-[#52525b] focus:outline-none focus:border-indigo-500 resize-none font-sans transition-colors duration-150"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors duration-150 shrink-0"
          >
            {Icon.send}
          </button>
        </div>
        <p className="mt-2 text-[10px] font-mono text-[#52525b]">Shift+Enter for newline · Answers grounded in your uploaded document</p>
      </div>
    </div>
  );
}

function QuizView() {
  const [phase, setPhase] = useState<QuizPhase>("generate");
  const [topic, setTopic] = useState("Data Structures");
  const [count, setCount] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  function generate() {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setPhase("taking"); setCurrentQ(0); setSelected({}); setSubmitted(false); }, 1800);
  }

  function selectOption(qi: number, oi: number) {
    if (!submitted) setSelected(prev => ({ ...prev, [qi]: oi }));
  }

  function submitQuiz() {
    setSubmitted(true);
    setTimeout(() => setPhase("results"), 800);
  }

  const score = MOCK_QUIZ.slice(0, count).reduce((acc, q, i) => acc + (selected[i] === q.correct ? 1 : 0), 0);

  const topics = ["Data Structures", "Algorithms", "Operating Systems", "Networks"];

  if (phase === "generate") {
    return (
      <div className="p-6 w-full max-w-lg">
        <h2 className="font-mono font-bold text-xl text-[#f4f4f5] mb-1">Generate Quiz</h2>
        <p className="text-sm text-[#71717a] mb-8">AI generates multiple-choice questions grounded in your uploaded notes.</p>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-mono text-[#a1a1aa] uppercase tracking-wider mb-2">Topic</label>
            <div className="grid grid-cols-2 gap-2">
              {topics.map(t => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`px-4 py-3 rounded-xl text-sm font-mono text-left transition-all duration-150 border ${topic === t ? "border-indigo-500 bg-indigo-500/15 text-indigo-300" : "border-[#3f3f46] bg-[#27272a] text-[#71717a] hover:border-[#6366f1]/50 hover:text-[#f4f4f5]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-[#a1a1aa] uppercase tracking-wider mb-3">
              Question Count — <span className="text-indigo-400">{count}</span>
            </label>
            <input
              type="range" min={2} max={10} value={count}
              onChange={e => setCount(+e.target.value)}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs font-mono text-[#52525b] mt-1">
              <span>2</span><span>10</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#3f3f46] space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#52525b]">Source document</span>
              <span className="text-[#c7d2fe]">lecture_week5_binary_trees.pdf</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#52525b]">Estimated time</span>
              <span className="text-[#71717a]">~{count * 45}s</span>
            </div>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-mono font-semibold text-sm flex items-center justify-center gap-2 transition-colors duration-150"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generating…
              </>
            ) : (
              <>{Icon.sparkle} Generate {count} Questions</>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "taking") {
    const q = MOCK_QUIZ[currentQ];
    const progress = ((currentQ + (selected[currentQ] !== undefined ? 1 : 0)) / count) * 100;
    const allAnswered = Object.keys(selected).length === count;

    return (
      <div className="p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#71717a]">{topic}</span>
            <span className="text-[#3f3f46]">/</span>
            <span className="font-mono text-xs text-[#a1a1aa]">{currentQ + 1} of {count}</span>
          </div>
          <button onClick={() => setPhase("generate")} className="text-xs font-mono text-[#52525b] hover:text-[#f4f4f5] transition-colors">Exit</button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#27272a] rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="space-y-6">
          <h3 className="font-mono font-semibold text-base text-[#f4f4f5] leading-relaxed">{q.question}</h3>
          <div className="space-y-3">
            {q.options.map((opt, oi) => {
              const isSelected = selected[currentQ] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => selectOption(currentQ, oi)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-mono transition-all duration-150 flex items-center gap-3
                    ${isSelected ? "border-indigo-500 bg-indigo-500/15 text-indigo-200" : "border-[#3f3f46] bg-[#27272a] text-[#a1a1aa] hover:border-[#6366f1]/50 hover:text-[#f4f4f5]"}`}
                >
                  <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center font-bold shrink-0 ${isSelected ? "bg-indigo-500 text-white" : "bg-[#3f3f46] text-[#52525b]"}`}>
                    {String.fromCharCode(65 + oi)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3 pt-2">
            {currentQ > 0 && (
              <button onClick={() => setCurrentQ(q => q - 1)} className="px-5 py-2.5 rounded-xl border border-[#3f3f46] text-sm font-mono text-[#71717a] hover:text-[#f4f4f5] hover:border-[#52525b] transition-colors duration-150">
                ← Back
              </button>
            )}
            {currentQ < count - 1 ? (
              <button
                onClick={() => setCurrentQ(q => q + 1)}
                disabled={selected[currentQ] === undefined}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-mono font-semibold transition-colors duration-150"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={submitQuiz}
                disabled={!allAnswered}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-mono font-semibold transition-colors duration-150"
              >
                Submit Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Results
  const pct = Math.round((score / count) * 100);
  return (
    <div className="p-6 w-full max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-mono font-bold text-xl text-[#f4f4f5]">Quiz Complete</h2>
          <p className="text-sm text-[#71717a] mt-1">{topic} · {count} questions</p>
        </div>
        <button onClick={() => setPhase("generate")} className="px-4 py-2 rounded-xl border border-[#3f3f46] text-xs font-mono text-[#71717a] hover:text-[#f4f4f5] hover:border-[#52525b] transition-colors">
          New Quiz
        </button>
      </div>

      {/* Score card */}
      <div className="bg-[#27272a] rounded-2xl p-6 border border-[#3f3f46] flex items-center gap-8">
        <div className="text-center">
          <div className="font-mono font-bold text-5xl" style={{ color: pct >= 80 ? "#22c55e" : pct >= 60 ? "#6366f1" : "#f59e0b" }}>{score}/{count}</div>
          <div className="text-xs font-mono text-[#52525b] mt-1">Score</div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#71717a]">Accuracy</span>
            <span style={{ color: pct >= 80 ? "#22c55e" : pct >= 60 ? "#6366f1" : "#f59e0b" }}>{pct}%</span>
          </div>
          <div className="h-2 bg-[#3f3f46] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? "#22c55e" : pct >= 60 ? "#6366f1" : "#f59e0b" }} />
          </div>
          <div className="text-xs font-mono text-[#52525b]">{pct >= 80 ? "Excellent — keep it up!" : pct >= 60 ? "Good progress — review weak areas." : "Needs more practice — re-read the material."}</div>
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-3">
        <h3 className="font-mono text-xs text-[#52525b] uppercase tracking-wider">Review</h3>
        {MOCK_QUIZ.slice(0, count).map((q, i) => {
          const correct = selected[i] === q.correct;
          return (
            <div key={q.id} className={`rounded-xl border p-4 space-y-3 ${correct ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${correct ? "bg-green-500" : "bg-red-500"}`}>
                  {correct ? Icon.check : Icon.x}
                </div>
                <p className="text-sm font-mono text-[#d4d4d8] leading-relaxed">{q.question}</p>
              </div>
              <div className="pl-8 space-y-1">
                {selected[i] !== undefined && selected[i] !== q.correct && (
                  <div className="flex gap-2 text-xs font-mono text-red-400">
                    <span className="shrink-0">Your answer:</span>
                    <span>{q.options[selected[i]]}</span>
                  </div>
                )}
                <div className="flex gap-2 text-xs font-mono text-green-400">
                  <span className="shrink-0">Correct:</span>
                  <span>{q.options[q.correct]}</span>
                </div>
                <p className="text-xs text-[#71717a] mt-2 leading-relaxed">{q.explanation}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressView() {
  return (
    <div className="p-8 space-y-8">
      {/* Mastery rings */}
      <div>
        <h2 className="font-mono text-xs text-[#52525b] uppercase tracking-wider mb-5">Topic Mastery</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {MOCK_PROGRESS.map(p => (
            <div key={p.topic} className="bg-[#27272a] rounded-2xl p-5 border border-[#3f3f46] flex flex-col items-center gap-3">
              <MasteryRing mastery={p.mastery} topic={p.topic} />
              <div className="text-center space-y-1">
                <div className="flex items-center gap-1.5 justify-center">
                  <span className={`${p.trend === "up" ? "text-green-400" : p.trend === "down" ? "text-red-400" : "text-[#52525b]"}`}>
                    {p.trend === "up" ? Icon.arrowUp : p.trend === "down" ? Icon.arrowDown : Icon.minus}
                  </span>
                  <span className="text-xs font-mono text-[#52525b]">{p.attempts} quizzes</span>
                </div>
                <div className="text-xs font-mono text-[#3f3f46]">{p.lastAttempt}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weak areas */}
      <div>
        <h2 className="font-mono text-xs text-[#52525b] uppercase tracking-wider mb-3">Needs Attention</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MOCK_PROGRESS.filter(p => p.mastery < 60).map(p => (
            <div key={p.topic} className="bg-[#27272a] rounded-xl border border-yellow-500/20 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-mono font-bold text-sm shrink-0">{p.mastery}</div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-[#f4f4f5] truncate">{p.topic}</p>
                <div className="mt-1.5 h-1.5 bg-[#3f3f46] rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${p.mastery}%` }} />
                </div>
              </div>
              <button className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors shrink-0">Practice →</button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent attempts table */}
      <div>
        <h2 className="font-mono text-xs text-[#52525b] uppercase tracking-wider mb-3">Recent Attempts</h2>
        <div className="rounded-xl overflow-hidden border border-[#3f3f46]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3f3f46] bg-[#27272a]">
                {["Date", "Topic", "Score", "Time", "Trend"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-mono text-xs text-[#52525b] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT_ATTEMPTS.map((a, i) => {
                const pct = Math.round((a.score / a.total) * 100);
                return (
                  <tr key={i} className={`border-b border-[#27272a] hover:bg-[#27272a] transition-colors duration-150 ${i === RECENT_ATTEMPTS.length - 1 ? "border-b-0" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs text-[#52525b]">{a.date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono">{a.topic}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-semibold text-sm ${pct >= 80 ? "text-green-400" : pct >= 60 ? "text-indigo-400" : "text-yellow-400"}`}>
                        {a.score}/{a.total}
                      </span>
                      <span className="text-xs font-mono text-[#52525b] ml-1">({pct}%)</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#71717a]">{a.time}</td>
                    <td className="px-4 py-3">
                      <div className="w-16 h-1.5 bg-[#3f3f46] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? "#22c55e" : pct >= 60 ? "#6366f1" : "#f59e0b" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="p-6 w-full max-w-xl space-y-8">
      <div>
        <h2 className="font-mono font-bold text-xl text-[#f4f4f5] mb-1">Settings</h2>
        <p className="text-sm text-[#71717a]">Configure your VidyaAI environment.</p>
      </div>
      {[
        { label: "LLM Provider", value: "Groq — openai/gpt-oss-120b", note: "Chat endpoint" },
        { label: "Embeddings", value: "OpenAI — text-embedding-3-small", note: "Vector search" },
        { label: "Fallback Model", value: "Claude Haiku 4.5", note: "Quiz generation" },
        { label: "Vector Store", value: "Supabase pgvector", note: "Connected" },
        { label: "Chunk Size", value: "~700 tokens / 15% overlap", note: "Default" },
      ].map(row => (
        <div key={row.label} className="flex items-center justify-between gap-4 py-3 border-b border-[#27272a]">
          <div className="min-w-0">
            <p className="font-mono text-sm text-[#d4d4d8]">{row.label}</p>
            <p className="font-mono text-xs text-[#52525b] mt-0.5">{row.note}</p>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-[#3f3f46] border border-[#52525b]/40 text-xs font-mono text-[#a1a1aa] shrink-0 text-right">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )},
  { id: "documents", label: "My Documents", icon: Icon.folder },
  { id: "chat", label: "AI Teacher", icon: Icon.chat },
  { id: "quiz", label: "Practice Quizzes", icon: Icon.quiz },
  { id: "progress", label: "Progress Tracker", icon: Icon.chart },
  { id: "settings", label: "Settings", icon: Icon.settings },
];

const VIEW_TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  documents: "My Documents",
  chat: "AI Teacher",
  quiz: "Practice Quizzes",
  progress: "Progress Tracker",
  settings: "Settings",
};

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="size-full flex bg-[#18181b] text-[#f4f4f5] overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-[#27272a] bg-[#1c1c1f] transition-all duration-300 shrink-0 ${sidebarOpen ? "w-56" : "w-14"}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#27272a]">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <span className="font-mono font-bold text-sm text-[#f4f4f5] whitespace-nowrap">VidyaAI</span>
              <span className="block text-[10px] font-mono text-[#52525b] whitespace-nowrap">Study Teacher</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left
                  ${active ? "bg-indigo-500/20 text-indigo-300" : "text-[#71717a] hover:bg-[#27272a] hover:text-[#d4d4d8]"}
                  ${!sidebarOpen ? "justify-center" : ""}`}
              >
                <span className={`shrink-0 ${active ? "text-indigo-400" : ""}`}>{item.icon}</span>
                {sidebarOpen && <span className="font-mono text-xs truncate">{item.label}</span>}
                {active && sidebarOpen && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="mx-2 mb-3 flex items-center justify-center py-2 rounded-lg text-[#52525b] hover:text-[#d4d4d8] hover:bg-[#27272a] transition-colors duration-150"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {sidebarOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />}
          </svg>
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[#27272a] bg-[#1c1c1f] shrink-0 min-w-0">
          <h1 className="font-mono font-semibold text-sm text-[#f4f4f5] truncate">{VIEW_TITLES[view]}</h1>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {[
              { label: "Upload", icon: Icon.upload, onClick: () => setView("documents") },
              { label: "New Chat", icon: Icon.chat, onClick: () => setView("chat") },
              { label: "Generate Quiz", icon: Icon.quiz, onClick: () => setView("quiz") },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3f3f46] text-xs font-mono text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#52525b] transition-colors duration-150"
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-mono font-bold text-xs ml-1">
              S
            </div>
          </div>
        </header>

        {/* View content */}
        <main className="flex-1 overflow-y-auto">
          {view === "dashboard" && <DashboardView navigate={setView} />}
          {view === "documents" && <DocumentsView />}
          {view === "chat" && <ChatView />}
          {view === "quiz" && <QuizView />}
          {view === "progress" && <ProgressView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
