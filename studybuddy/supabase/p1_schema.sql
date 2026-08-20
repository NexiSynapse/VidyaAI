-- StudyBuddy — Priority 1 schema (quiz + progress tables used by Person 3 endpoints)
-- Run this after p0_schema.sql in the Supabase SQL editor.

-- Quizzes generated from document chunks
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete set null,
  topic text not null default 'general',
  created_at timestamptz not null default now()
);

-- Individual MCQs belonging to a quiz
create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_answer integer not null,
  explanation text,
  created_at timestamptz not null default now()
);

-- Student attempts on quizzes (single demo user for P0/P1)
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id text not null default 'demo-user',
  score float not null,
  answers integer[] not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_id_idx on quiz_attempts (user_id);
create index if not exists quiz_attempts_quiz_id_idx on quiz_attempts (quiz_id);