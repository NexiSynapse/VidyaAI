-- StudyBuddy — Priority 0 schema (Person 2 owns ingestion; this migration provides the
-- pgvector contract that Person 3's retrieval layer (match_chunks RPC) depends on).
--
-- Run this in the Supabase SQL editor (or via the Supabase CLI) on the project
-- used by the app. Enable the pgvector extension first.

create extension if not exists vector;

-- Documents uploaded by the (single demo) user.
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user',
  title text not null,
  topic text,
  storage_path text,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

-- Chunked + embedded text from documents. Embeddings are 1536-dim (text-embedding-3-small).
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  page integer,
  section text,
  topic text,
  created_at timestamptz not null default now()
);

create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists chunks_document_id_idx on chunks (document_id);

-- Cosine-similarity search used by src/lib/retrieval.ts retrieveChunks().
-- Returns chunks above match_threshold, scoped optionally by document/topic.
create or replace function match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  document_id uuid default null,
  topic text default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page integer,
  section text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.page,
    c.section,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where 1 - (c.embedding <=> query_embedding) > match_threshold
    and (document_id is null or c.document_id = match_chunks.document_id)
    and (topic is null or c.topic = match_chunks.topic)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
