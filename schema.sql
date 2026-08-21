-- P0: Core Ingestion & Search (from previous steps)
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table (from P0)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title TEXT NOT NULL,
    topic TEXT, -- Legacy text tag
    topic_id UUID REFERENCES topics(id), -- New FK
    storage_path TEXT,
    status TEXT DEFAULT 'processed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chunks table (from P0, updated for P1)
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id), -- New: Topic filtering
    content TEXT NOT NULL,
    embedding vector(1536),
    page INTEGER,
    section TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for vector search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- P1: Topics, Quizzes, and Progress Schema

-- 1. Topics Table
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id),
    topic_id UUID REFERENCES topics(id),
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Quiz Questions Table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings or objects
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    type TEXT DEFAULT 'mcq' -- 'mcq', 'true_false', etc.
);

-- 4. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id),
    user_id UUID, -- If auth is implemented
    score FLOAT NOT NULL,
    answers JSONB NOT NULL, -- User's answers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Progress Table
CREATE TABLE IF NOT EXISTS progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- If auth is implemented
    topic_id UUID REFERENCES topics(id),
    mastery_score FLOAT DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

-- 6. Mastery Calculation Function (Stored Procedure)
CREATE OR REPLACE FUNCTION update_topic_mastery(p_user_id UUID, p_topic_id UUID)
RETURNS VOID AS $$
DECLARE
    avg_score FLOAT;
BEGIN
    SELECT AVG(score) INTO avg_score
    FROM quiz_attempts
    WHERE user_id = p_user_id
    AND quiz_id IN (SELECT id FROM quizzes WHERE topic_id = p_topic_id);

    IF avg_score IS NOT NULL THEN
        INSERT INTO progress (user_id, topic_id, mastery_score, last_updated)
        VALUES (p_user_id, p_topic_id, avg_score, NOW())
        ON CONFLICT (user_id, topic_id)
        DO UPDATE SET mastery_score = EXCLUDED.mastery_score, last_updated = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Vector Search Function (RPC for RAG)
CREATE OR REPLACE FUNCTION match_chunks (
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_document_id uuid DEFAULT NULL,
    filter_topic_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    embedding vector(1536),
    document_id UUID,
    topic_id UUID,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        chunks.id,
        chunks.content,
        chunks.embedding,
        chunks.document_id,
        chunks.topic_id,
        1 - (chunks.embedding <=> query_embedding) AS similarity
    FROM chunks
    WHERE (filter_document_id IS NULL OR chunks.document_id = filter_document_id)
      AND (filter_topic_id IS NULL OR chunks.topic_id = filter_topic_id)
      AND 1 - (chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- P2 (Stretch): Flashcards with SM-2 Spaced Repetition
-- =====================================================

-- 8. Flashcards Table
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    topic_id UUID REFERENCES topics(id),
    document_id UUID REFERENCES documents(id),
    chunk_id UUID REFERENCES chunks(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    -- SM-2 Algorithm fields
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reviewed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching due flashcards
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards (user_id, next_review)
WHERE next_review <= NOW();

-- 9. Flashcard Reviews Table (for analytics/history)
CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    quality INTEGER NOT NULL, -- 0-5 SM-2 quality rating
    previous_ease_factor FLOAT,
    previous_interval INTEGER,
    previous_repetitions INTEGER,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Auto-generate Flashcards from Document/Topic (Stored Function)
CREATE OR REPLACE FUNCTION generate_flashcards_from_chunks(
    p_user_id UUID,
    p_document_id UUID DEFAULT NULL,
    p_topic_id UUID DEFAULT NULL,
    p_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    question TEXT,
    answer TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    selected_chunks RECORD;
BEGIN
    -- Deterministic heuristic fallback (no LLM): label each chunk's content as the answer.
    -- In production, this step would call an LLM to craft question/answer pairs.
    FOR selected_chunks IN
        SELECT id, content, topic_id, document_id
        FROM chunks
        WHERE (p_document_id IS NULL OR document_id = p_document_id)
          AND (p_topic_id IS NULL OR topic_id = p_topic_id)
        ORDER BY RANDOM()
        LIMIT p_count
    LOOP
        INSERT INTO flashcards (user_id, topic_id, document_id, chunk_id, question, answer)
        VALUES (
            p_user_id,
            selected_chunks.topic_id,
            selected_chunks.document_id,
            selected_chunks.id,
            'What does this section cover?',
            LEFT(selected_chunks.content, 500)
        )
        RETURNING id, question, answer;
    END LOOP;
END;
$$;

-- 11. SM-2 Update Function
CREATE OR REPLACE FUNCTION sm2_update_flashcard(
    p_flashcard_id UUID,
    p_user_id UUID,
    p_quality INTEGER -- 0-5: 0=complete blackout, 5=perfect recall
)
RETURNS VOID AS $$
DECLARE
    v_ease_factor FLOAT;
    v_interval INTEGER;
    v_repetitions INTEGER;
    v_next_review TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT ease_factor, interval_days, repetitions
    INTO v_ease_factor, v_interval, v_repetitions
    FROM flashcards
    WHERE id = p_flashcard_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Flashcard not found';
    END IF;

    -- Log the review
    INSERT INTO flashcard_reviews (flashcard_id, user_id, quality, previous_ease_factor, previous_interval, previous_repetitions)
    VALUES (p_flashcard_id, p_user_id, p_quality, v_ease_factor, v_interval, v_repetitions);

    -- SM-2 Algorithm
    IF p_quality < 3 THEN
        -- Failed: reset repetitions, interval = 1 day
        v_repetitions := 0;
        v_interval := 1;
    ELSE
        IF v_repetitions = 0 THEN
            v_interval := 1;
        ELSIF v_repetitions = 1 THEN
            v_interval := 6;
        ELSE
            v_interval := ROUND(v_interval * v_ease_factor)::INTEGER;
        END IF;
        v_repetitions := v_repetitions + 1;

        -- Update ease factor (clamped to >= 1.3)
        v_ease_factor := v_ease_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
        IF v_ease_factor < 1.3 THEN
            v_ease_factor := 1.3;
        END IF;
    END IF;

    v_next_review := NOW() + (v_interval || ' days')::INTERVAL;

    UPDATE flashcards
    SET ease_factor = v_ease_factor,
        interval_days = v_interval,
        repetitions = v_repetitions,
        next_review = v_next_review,
        last_reviewed = NOW()
    WHERE id = p_flashcard_id;
END;
$$ LANGUAGE plpgsql;

-- 12. Get Due Flashcards Function
CREATE OR REPLACE FUNCTION get_due_flashcards(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    question TEXT,
    answer TEXT,
    ease_factor FLOAT,
    interval_days INTEGER,
    repetitions INTEGER,
    next_review TIMESTAMP WITH TIME ZONE,
    topic_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.question,
        f.answer,
        f.ease_factor,
        f.interval_days,
        f.repetitions,
        f.next_review,
        t.name AS topic_name
    FROM flashcards f
    LEFT JOIN topics t ON f.topic_id = t.id
    WHERE f.user_id = p_user_id
      AND f.next_review <= NOW()
    ORDER BY f.next_review ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
