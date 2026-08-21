const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAI client setup (with fallback for missing key)
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Helper: Text extraction
async function extractText(filePath) {
  const buffer = await fs.readFile(filePath);
  const pdfResult = await pdf(buffer);
  return pdfResult.text;
}

// Helper: Generate embeddings with OpenAI fallback to placeholder
async function generateEmbeddings(textChunks) {
  // Fallback: deterministic pseudo-embedding (1536 dims) based on text hash
  const placeholderEmbedding = (seedText) => {
    const dims = 1536;
    const vec = new Array(dims);
    let h = 2166136261;
    for (let i = 0; i < seedText.length; i++) {
      h ^= seedText.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    for (let i = 0; i < dims; i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      vec[i] = ((h >>> 0) / 4294967295) * 2 - 1; // normalize to [-1, 1]
    }
    return vec;
  };

  if (!openai) {
    console.warn('OPENAI_API_KEY not set — using placeholder embeddings.');
    return textChunks.map(placeholderEmbedding);
  }

  const embeddings = [];
  for (const chunk of textChunks) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });
    embeddings.push(response.data[0].embedding);
  }
  return embeddings;
}

// Helper: Chunking
function chunkText(text, chunkSize = 1000) {
  const chunks = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push(text.slice(startIndex, endIndex));
    startIndex = endIndex;
  }
  return chunks;
}

// POST /api/ingest: Upload, extract, chunk, embed, and save
app.post('/api/ingest', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const { documentId, topicId } = req.body;

    // Create the document row if none provided (title = uploaded filename)
    let docId = documentId;
    if (!docId) {
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .insert({
          title: req.file.originalname || 'Untitled',
          topic_id: topicId || null,
          status: 'processed'
        })
        .select()
        .single();
      if (docErr) throw docErr;
      docId = doc.id;
    }

    const text = await extractText(req.file.path);
    const chunks = chunkText(text);
    const embeddings = await generateEmbeddings(chunks);

    const { error } = await supabase
      .from('chunks')
      .insert(chunks.map((chunk, i) => ({
        content: chunk,
        embedding: embeddings[i],
        document_id: docId,
        topic_id: topicId,
      })));

    if (error) throw error;

    // Cleanup uploaded file
    await fs.unlink(req.file.path);

    res.json({ success: true, documentId: docId, chunksCount: chunks.length });
  } catch (err) {
    console.error('Ingestion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents: Fetch all documents
app.get('/api/documents', async (req, res) => {
  try {
    const { data, error } = await supabase.from('documents').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/:id: Delete a document and its chunks
app.delete('/api/documents/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error: chunkError } = await supabase.from('chunks').delete().eq('document_id', id);
    if (chunkError) throw chunkError;
    const { error: docError } = await supabase.from('documents').delete().eq('id', id);
    if (docError) throw docError;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/topics: Fetch all topics
app.get('/api/topics', async (req, res) => {
  try {
    const { data, error } = await supabase.from('topics').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/topics: Create a new topic
app.post('/api/topics', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const { data, error } = await supabase
      .from('topics')
      .insert([{ name, description }])
      .select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search: Semantic search using vector similarity
app.post('/api/search', async (req, res) => {
  const { query, documentId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    // 1. Embed the query
    const [queryEmbedding] = await generateEmbeddings([query]);

    // 2. Perform vector similarity search in Supabase (using RPC for pgvector)
    // Assuming a function 'match_chunks' is defined in Postgres
    const { data: chunks, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      filter_document_id: documentId // Optional filtering
    });

    if (error) throw error;

    res.json({ chunks });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quizzes: Create a new quiz
app.post('/api/quizzes', async (req, res) => {
  const { documentId, topicId, title, questions } = req.body;
  if (!documentId || !title || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Missing required fields: documentId, title, or questions (array)' });
  }

  try {
    const { data: quiz, error: qErr } = await supabase
      .from('quizzes')
      .insert([{ document_id: documentId, topic_id: topicId, title }])
      .select()
      .single();
    if (qErr) throw qErr;

    const questionData = questions.map(q => ({
      quiz_id: quiz.id,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      type: q.type || 'mcq'
    }));

    const { error: qQuestionsErr } = await supabase
      .from('quiz_questions')
      .insert(questionData);
    if (qQuestionsErr) throw qQuestionsErr;

    res.status(201).json({ id: quiz.id, title: quiz.title });
  } catch (err) {
    console.error('Quiz creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quizzes: List all quizzes
app.get('/api/quizzes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quizzes/:id: Fetch a specific quiz and its questions
app.get('/api/quizzes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: quiz, error: qErr } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();
    if (qErr) throw qErr;

    const { data: questions, error: quesErr } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', id);
    if (quesErr) throw quesErr;

    res.json({ ...quiz, questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quiz/submit: Submit an attempt and update mastery
app.post('/api/quiz/submit', async (req, res) => {
  const { quizId, userId, answers } = req.body; // answers: [{questionId, answer}]
  if (!quizId || !userId || !answers) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // 1. Get quiz and questions
    const { data: quiz, error: qErr } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    if (qErr) throw qErr;

    const { data: questions, error: quesErr } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId);
    if (quesErr) throw quesErr;

    // 2. Grade answers
    let correctCount = 0;
    const results = questions.map(q => {
      const userAnswer = answers.find(a => a.questionId === q.id)?.answer;
      const isCorrect = userAnswer === q.correct_answer;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        isCorrect,
        explanation: q.explanation
      };
    });

    const score = (correctCount / questions.length) * 100;

    // 3. Store attempt
    const { error: attErr } = await supabase.from('quiz_attempts').insert({
      quiz_id: quizId,
      user_id: userId,
      score,
      answers: JSON.stringify(answers)
    });
    if (attErr) throw attErr;

    // 4. Update mastery via RPC
    if (quiz.topic_id) {
      await supabase.rpc('update_topic_mastery', {
        p_user_id: userId,
        p_topic_id: quiz.topic_id
      });
    }

    res.json({ score, results });
  } catch (err) {
    console.error('Quiz submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attempts/:userId: Fetch a user's recent quiz attempts
app.get('/api/attempts/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*, quizzes(title, topic_id, topics(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/progress/:userId: Fetch user progress
app.get('/api/progress/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('progress')
      .select('*, topics(name)')
      .eq('user_id', userId);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flashcards/due: Fetch due flashcards for a user
app.get('/api/flashcards/due', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query parameter is required' });

  try {
    const { data, error } = await supabase.rpc('get_due_flashcards', {
      p_user_id: userId,
      p_limit: 20
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flashcards/review: Submit a flashcard review and update SM-2 schedule
app.post('/api/flashcards/review', async (req, res) => {
  const { cardId, userId, quality } = req.body;
  if (!cardId || !userId || quality === undefined) {
    return res.status(400).json({ error: 'Missing required fields: cardId, userId, quality (0-5)' });
  }

  try {
    const { error } = await supabase.rpc('sm2_update_flashcard', {
      p_flashcard_id: cardId,
      p_user_id: userId,
      p_quality: quality
    });
    if (error) throw error;

    const { data: card, error: cardErr } = await supabase
      .from('flashcards')
      .select('id, ease_factor, interval_days, repetitions, next_review')
      .eq('id', cardId)
      .single();
    if (cardErr) throw cardErr;

    res.json({ nextReviewDate: card.next_review, card });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VidyaAI server running on http://localhost:${PORT}`);
});