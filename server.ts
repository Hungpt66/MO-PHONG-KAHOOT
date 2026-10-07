import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { GameRoom, Player, PlayerAnswerRecord, Quiz, LMSReport, RoomStatus } from './src/types';
import { INITIAL_QUIZZES } from './src/data/sampleQuizzes';
import { calculateKahootScore } from './src/utils/scoring';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory persistent data stores during server runtime
const quizzesStore = new Map<string, Quiz>();
INITIAL_QUIZZES.forEach((q) => quizzesStore.set(q.id, q));

const roomsStore = new Map<string, GameRoom>();
const sseClients = new Map<string, Set<Response>>(); // pin -> Set of SSE Response objects
const lmsReportsStore: LMSReport[] = [];

// Broadcast helper for real-time room sync
function broadcastRoomUpdate(pin: string) {
  const room = roomsStore.get(pin);
  if (!room) return;

  const clients = sseClients.get(pin);
  if (clients && clients.size > 0) {
    const payload = `data: ${JSON.stringify(room)}\n\n`;
    clients.forEach((client) => {
      try {
        client.write(payload);
      } catch (err) {
        console.error('SSE client write error:', err);
      }
    });
  }
}

// Generate unique 6-digit numeric PIN
function generatePIN(): string {
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  if (roomsStore.has(pin)) {
    return generatePIN();
  }
  return pin;
}

// Helper bot nicknames for simulation
const BOT_NAMES = [
  'Hải Yến (CN Hà Nội)',
  'Minh Tuấn (CN Ba Đình)',
  'Phương Anh (CN Hoàn Kiếm)',
  'Đức Thắng (CN Cầu Giấy)',
  'Khánh Linh (CN Đông Đô)',
  'Hoàng Nam (CN Sài Gòn)',
  'Thu Hà (CN Đà Nẵng)',
  'Bảo Ngọc (CN Bến Thành)',
  'Quang Dũng (CN Chợ Lớn)',
  'Ngọc Mai (CN Thăng Long)',
];

const AVATARS = ['🦁', '🦊', '🐯', '🐼', '🐨', '🦄', '🦅', '🐬', '🦉', '🚀', '⭐', '💎'];

// ----------------- API ROUTES ----------------- //

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Get all quizzes
app.get('/api/quizzes', (req, res) => {
  res.json(Array.from(quizzesStore.values()));
});

// Get single quiz by ID
app.get('/api/quizzes/:id', (req, res) => {
  const { id } = req.params;
  const quiz = quizzesStore.get(id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ câu hỏi' });
  }
  res.json(quiz);
});

// Save/create quiz
app.post('/api/quizzes', (req, res) => {
  const newQuiz = req.body as Quiz;
  if (!newQuiz.id) {
    newQuiz.id = 'quiz_' + Date.now();
  }
  newQuiz.updatedAt = new Date().toISOString();
  if (!newQuiz.createdAt) {
    newQuiz.createdAt = new Date().toISOString();
  }
  quizzesStore.set(newQuiz.id, newQuiz);
  res.json({ success: true, quiz: newQuiz });
});

// Update existing quiz and its questions
app.put('/api/quizzes/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body as Partial<Quiz>;
  const existing = quizzesStore.get(id);

  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy bộ câu hỏi để chỉnh sửa' });
  }

  const updatedQuiz: Quiz = {
    ...existing,
    ...updatedData,
    id, // preserve ID
    updatedAt: new Date().toISOString(),
  };

  quizzesStore.set(id, updatedQuiz);
  res.json({ success: true, quiz: updatedQuiz });
});

// Clone/Duplicate a quiz
app.post('/api/quizzes/:id/clone', (req, res) => {
  const { id } = req.params;
  const sourceQuiz = quizzesStore.get(id);
  if (!sourceQuiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ đề để nhân bản' });
  }

  const clonedId = 'quiz_' + Date.now();
  const clonedQuiz: Quiz = {
    ...sourceQuiz,
    id: clonedId,
    title: `${sourceQuiz.title} (Bản sao)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPreset: false,
    questions: sourceQuiz.questions.map((q) => ({
      ...q,
      id: 'q_' + Math.random().toString(36).substring(2, 9),
    })),
  };

  quizzesStore.set(clonedId, clonedQuiz);
  res.json({ success: true, quiz: clonedQuiz });
});

// Update a specific question in a quiz
app.put('/api/quizzes/:id/questions/:questionId', (req, res) => {
  const { id, questionId } = req.params;
  const updatedQuestion = req.body;
  const quiz = quizzesStore.get(id);

  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ câu hỏi' });
  }

  const index = quiz.questions.findIndex((q) => q.id === questionId);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy câu hỏi trong đề' });
  }

  quiz.questions[index] = { ...quiz.questions[index], ...updatedQuestion, id: questionId };
  quiz.updatedAt = new Date().toISOString();
  quizzesStore.set(id, quiz);

  res.json({ success: true, question: quiz.questions[index], quiz });
});

// Add a question to an existing quiz
app.post('/api/quizzes/:id/questions', (req, res) => {
  const { id } = req.params;
  const newQuestion = req.body;
  const quiz = quizzesStore.get(id);

  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ câu hỏi' });
  }

  if (!newQuestion.id) {
    newQuestion.id = 'q_' + Date.now();
  }

  quiz.questions.push(newQuestion);
  quiz.updatedAt = new Date().toISOString();
  quizzesStore.set(id, quiz);

  res.json({ success: true, question: newQuestion, quiz });
});

// Delete a question from a quiz
app.delete('/api/quizzes/:id/questions/:questionId', (req, res) => {
  const { id, questionId } = req.params;
  const quiz = quizzesStore.get(id);

  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ câu hỏi' });
  }

  quiz.questions = quiz.questions.filter((q) => q.id !== questionId);
  quiz.updatedAt = new Date().toISOString();
  quizzesStore.set(id, quiz);

  res.json({ success: true, quiz });
});

// Reset to default sample quizzes
app.post('/api/quizzes/reset-defaults', (req, res) => {
  quizzesStore.clear();
  INITIAL_QUIZZES.forEach((q) => quizzesStore.set(q.id, JSON.parse(JSON.stringify(q))));
  res.json({ success: true, quizzes: Array.from(quizzesStore.values()) });
});

// Delete quiz
app.delete('/api/quizzes/:id', (req, res) => {
  const { id } = req.params;
  quizzesStore.delete(id);
  res.json({ success: true });
});

// Create a new Game Room
app.post('/api/rooms/create', (req, res) => {
  const { quizId, hostId = 'host_teacher' } = req.body;
  const quiz = quizzesStore.get(quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ câu hỏi' });
  }

  const pin = generatePIN();
  const room: GameRoom = {
    pin,
    quizId,
    quizTitle: quiz.title,
    hostId,
    status: 'lobby',
    currentQuestionIndex: 0,
    questionStartedAt: 0,
    timeRemaining: 0,
    players: {},
    answers: [],
    createdAt: Date.now(),
  };

  roomsStore.set(pin, room);
  res.json({ success: true, pin, room });
});

// Get room by PIN
app.get('/api/rooms/:pin', (req, res) => {
  const { pin } = req.params;
  const room = roomsStore.get(pin);
  if (!room) {
    return res.status(404).json({ error: 'Mã PIN phòng không hợp lệ hoặc đã kết thúc' });
  }
  res.json(room);
});

// SSE endpoint for live updates
app.get('/api/rooms/:pin/events', (req, res) => {
  const { pin } = req.params;
  const room = roomsStore.get(pin);
  if (!room) {
    return res.status(404).send('Room not found');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial state immediately
  res.write(`data: ${JSON.stringify(room)}\n\n`);

  if (!sseClients.has(pin)) {
    sseClients.set(pin, new Set());
  }
  sseClients.get(pin)!.add(res);

  req.on('close', () => {
    const clients = sseClients.get(pin);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(pin);
      }
    }
  });
});

// Player joins room
app.post('/api/rooms/:pin/join', (req, res) => {
  const { pin } = req.params;
  const { nickname, avatar } = req.body;

  const room = roomsStore.get(pin);
  if (!room) {
    return res.status(404).json({ error: 'Mã PIN không tồn tại' });
  }

  if (room.status !== 'lobby') {
    return res.status(400).json({ error: 'Phòng đã bắt đầu, không thể tham gia lúc này' });
  }

  const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
  const player: Player = {
    id: playerId,
    nickname: nickname?.trim() || 'Học viên ' + (Object.keys(room.players).length + 1),
    avatar: avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
    score: 0,
    streak: 0,
    joinedAt: Date.now(),
  };

  room.players[playerId] = player;
  broadcastRoomUpdate(pin);

  res.json({ success: true, playerId, player, room });
});

// Simulate bot players (For quick lecturer demo and evaluation)
app.post('/api/rooms/:pin/simulate-bots', (req, res) => {
  const { pin } = req.params;
  const { count = 5 } = req.body;

  const room = roomsStore.get(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }

  for (let i = 0; i < count; i++) {
    const botId = 'bot_' + Math.random().toString(36).substring(2, 9);
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' #' + (i + 1);
    room.players[botId] = {
      id: botId,
      nickname: name,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      score: 0,
      streak: 0,
      joinedAt: Date.now(),
      isBot: true,
    };
  }

  broadcastRoomUpdate(pin);
  res.json({ success: true, playerCount: Object.keys(room.players).length });
});

// Host updates room status
app.post('/api/rooms/:pin/status', (req, res) => {
  const { pin } = req.params;
  const { status, currentQuestionIndex } = req.body as { status: RoomStatus; currentQuestionIndex?: number };

  const room = roomsStore.get(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }

  room.status = status;
  if (typeof currentQuestionIndex === 'number') {
    room.currentQuestionIndex = currentQuestionIndex;
  }

  const quiz = quizzesStore.get(room.quizId);
  if (status === 'question' && quiz) {
    const currentQ = quiz.questions[room.currentQuestionIndex];
    room.questionStartedAt = Date.now();
    room.timeRemaining = currentQ ? currentQ.timeLimit : 20;

    const correctCount = currentQ?.options?.filter((o) => o.isCorrect).length || 1;
    room.currentQuestionMeta = currentQ ? {
      type: currentQ.type,
      title: currentQ.title,
      optionsCount: currentQ.options?.length || 0,
      correctCount,
      allowMultiSelect: currentQ.type === 'multiple_choice' && correctCount > 1,
    } : undefined;

    // Trigger auto bot answers if bots exist in room
    setTimeout(() => {
      const currentRoom = roomsStore.get(pin);
      if (!currentRoom || currentRoom.status !== 'question') return;

      Object.values(currentRoom.players).forEach((p) => {
        if (!p.isBot) return;
        // Random bot response time between 2s and 12s
        const randomDelay = 2000 + Math.random() * 8000;
        setTimeout(() => {
          if (currentRoom.status !== 'question' || currentRoom.currentQuestionIndex !== room.currentQuestionIndex) return;

          const q = quiz.questions[currentRoom.currentQuestionIndex];
          if (!q) return;

          let isCorrect = Math.random() > 0.3; // 70% bot accuracy
          let pointsEarned = 0;

          if (isCorrect) {
            p.streak = (p.streak || 0) + 1;
            const scoreCalc = calculateKahootScore(randomDelay, q.timeLimit, q.points, p.streak);
            pointsEarned = scoreCalc.points;
            p.score += pointsEarned;
          } else {
            p.streak = 0;
          }

          p.lastAnswerCorrect = isCorrect;
          p.lastPointsEarned = pointsEarned;

          // Pick bot options
          const correctOpts = q.options?.filter((o) => o.isCorrect) || [];
          const wrongOpts = q.options?.filter((o) => !o.isCorrect) || [];
          let botSelectedId = 'opt_1';
          if (isCorrect && correctOpts.length > 0) {
            botSelectedId = correctOpts[Math.floor(Math.random() * correctOpts.length)].id;
          } else if (!isCorrect && wrongOpts.length > 0) {
            botSelectedId = wrongOpts[Math.floor(Math.random() * wrongOpts.length)].id;
          } else if (q.options && q.options.length > 0) {
            botSelectedId = q.options[0].id;
          }

          currentRoom.answers.push({
            playerId: p.id,
            nickname: p.nickname,
            questionId: q.id,
            questionIndex: currentRoom.currentQuestionIndex,
            selectedOptionId: botSelectedId,
            selectedOptionIds: [botSelectedId],
            isCorrect,
            timeMs: randomDelay,
            pointsEarned,
            timestamp: Date.now(),
          });

          broadcastRoomUpdate(pin);
        }, randomDelay);
      });
    }, 500);
  }

  // Recalculate ranks if leaderboard or finished
  if (status === 'leaderboard' || status === 'finished' || status === 'question_result') {
    const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      p.rank = idx + 1;
    });
  }

  broadcastRoomUpdate(pin);
  res.json({ success: true, room });
});

// Player submits answer
app.post('/api/rooms/:pin/answer', (req, res) => {
  const { pin } = req.params;
  const { playerId, selectedOptionId, selectedOptionIds, answeredText, matchedPairs, timeElapsedMs } = req.body;

  const room = roomsStore.get(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }

  const quiz = quizzesStore.get(room.quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Bộ câu hỏi không tồn tại' });
  }

  const currentQ = quiz.questions[room.currentQuestionIndex];
  if (!currentQ) {
    return res.status(400).json({ error: 'Không tìm thấy câu hỏi hiện tại' });
  }

  const player = room.players[playerId];
  if (!player) {
    return res.status(404).json({ error: 'Học viên không tồn tại trong phòng' });
  }

  // Check if player already answered this question
  const alreadyAnswered = room.answers.some(
    (a) => a.playerId === playerId && a.questionIndex === room.currentQuestionIndex
  );
  if (alreadyAnswered) {
    return res.status(400).json({ error: 'Bạn đã nộp đáp án cho câu này rồi' });
  }

  // Grade answer
  let isCorrect = false;
  if (currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') {
    const correctOpts = currentQ.options?.filter((o) => o.isCorrect) || [];
    const correctOptIds = correctOpts.map((o) => o.id);

    if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
      // If player submitted an array of selected options
      const hasInvalidOption = selectedOptionIds.some((id) => !correctOptIds.includes(id));
      const hasAtLeastOneCorrect = selectedOptionIds.some((id) => correctOptIds.includes(id));
      isCorrect = !hasInvalidOption && hasAtLeastOneCorrect;
    } else if (selectedOptionId) {
      // If player submitted a single option: correct if that option is marked as correct
      isCorrect = correctOptIds.includes(selectedOptionId);
    }
  } else if (currentQ.type === 'fill_blank') {
    const normalizedInput = (answeredText || '').trim().toLowerCase();
    const correctAnswers = (currentQ.correctText || '').split(',').map((s) => s.trim().toLowerCase());
    isCorrect = correctAnswers.includes(normalizedInput);
  } else if (currentQ.type === 'match_pairs') {
    // All pairs must be matched correctly
    if (currentQ.pairs && matchedPairs) {
      isCorrect = currentQ.pairs.every((pair) => matchedPairs[pair.id] === pair.right);
    }
  }

  // Calculate points
  let pointsEarned = 0;
  if (isCorrect) {
    player.streak = (player.streak || 0) + 1;
    const scoreCalc = calculateKahootScore(timeElapsedMs || 3000, currentQ.timeLimit, currentQ.points, player.streak);
    pointsEarned = scoreCalc.points;
    player.score += pointsEarned;
  } else {
    player.streak = 0;
  }

  player.lastAnswerCorrect = isCorrect;
  player.lastPointsEarned = pointsEarned;

  const answerRecord: PlayerAnswerRecord = {
    playerId,
    nickname: player.nickname,
    questionId: currentQ.id,
    questionIndex: room.currentQuestionIndex,
    selectedOptionId: selectedOptionId || (selectedOptionIds?.[0]),
    selectedOptionIds: selectedOptionIds || (selectedOptionId ? [selectedOptionId] : undefined),
    answeredText,
    matchedPairs,
    isCorrect,
    timeMs: timeElapsedMs || 3000,
    pointsEarned,
    timestamp: Date.now(),
  };

  room.answers.push(answerRecord);

  // Recalculate rank
  const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
  sorted.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  broadcastRoomUpdate(pin);

  res.json({
    success: true,
    isCorrect,
    pointsEarned,
    totalScore: player.score,
    streak: player.streak,
    rank: player.rank,
  });
});

// External game completion endpoint (Google AI Studio HTML embed postMessage bridge)
app.post('/api/rooms/:pin/external-result', (req, res) => {
  const { pin } = req.params;
  const { playerId, score, details } = req.body;

  const room = roomsStore.get(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }

  const player = room.players[playerId];
  if (player) {
    const points = Math.min(1000, Math.max(0, Number(score) || 0));
    player.score += points;
    player.lastAnswerCorrect = points > 0;
    player.lastPointsEarned = points;

    room.answers.push({
      playerId,
      nickname: player.nickname,
      questionId: 'external_round_' + room.currentQuestionIndex,
      questionIndex: room.currentQuestionIndex,
      isCorrect: points > 0,
      timeMs: 15000,
      pointsEarned: points,
      timestamp: Date.now(),
    });

    const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    broadcastRoomUpdate(pin);
    return res.json({ success: true, totalScore: player.score, rank: player.rank });
  }

  res.json({ success: true });
});

// AI Quiz Generation using Gemini API
app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const { topic = 'Ngân hàng số BIDV & Bảo mật giao dịch', questionCount = 4 } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập trong Secrets của AI Studio.',
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Bạn là chuyên gia đào tạo và ra đề thi trắc nghiệm trực tuyến cho Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV).
Hãy tạo một bộ câu hỏi hoàn toàn là câu hỏi trắc nghiệm gồm ${questionCount} câu hỏi về chủ đề: "${topic}".
Toàn bộ câu hỏi phải là hình thức trắc nghiệm: trắc nghiệm 4 lựa chọn (multiple_choice) hoặc trắc nghiệm Đúng/Sai (true_false). TUYỆT ĐỐI KHÔNG dùng câu hỏi điền từ.

Trả về ĐÚNG định dạng JSON hợp lệ (không kèm markdown, không thêm text ngoài JSON) theo cấu trúc:
{
  "title": "Tên bộ câu hỏi trắc nghiệm",
  "description": "Mô tả ngắn gọn",
  "category": "Danh mục nghiệp vụ",
  "questions": [
    {
      "id": "q_1",
      "type": "multiple_choice",
      "title": "Nội dung câu hỏi trắc nghiệm...",
      "timeLimit": 20,
      "points": 1000,
      "options": [
        { "id": "opt_1", "text": "Phương án A", "isCorrect": false },
        { "id": "opt_2", "text": "Phương án B (Chính xác)", "isCorrect": true },
        { "id": "opt_3", "text": "Phương án C", "isCorrect": false },
        { "id": "opt_4", "text": "Phương án D", "isCorrect": false }
      ]
    },
    {
      "id": "q_2",
      "type": "true_false",
      "title": "Nhận định sau đây là Đúng hay Sai...",
      "timeLimit": 15,
      "points": 1000,
      "options": [
        { "id": "tf_1", "text": "Đúng", "isCorrect": true },
        { "id": "tf_2", "text": "Sai", "isCorrect": false }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);

    const newQuiz: Quiz = {
      id: 'quiz_ai_' + Date.now(),
      title: parsedData.title || `Trắc nghiệm ${topic}`,
      description: parsedData.description || `Bộ câu hỏi do AI tạo tự động về ${topic}`,
      category: parsedData.category || 'Tài chính Ngân hàng',
      coverImage: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: parsedData.questions || [],
    };

    quizzesStore.set(newQuiz.id, newQuiz);
    res.json({ success: true, quiz: newQuiz });
  } catch (error: any) {
    console.error('AI generate error:', error);
    res.status(500).json({ error: 'Lỗi khi tạo câu hỏi qua Gemini: ' + (error.message || error) });
  }
});

// LMS Integration: Save session report into LMS Gradebook
app.post('/api/lms/save-report', (req, res) => {
  const report = req.body as LMSReport;
  report.id = 'lms_report_' + Date.now();
  report.completedAt = new Date().toISOString();
  lmsReportsStore.unshift(report);
  res.json({ success: true, reportId: report.id });
});

// LMS Integration: Get saved reports
app.get('/api/lms/reports', (req, res) => {
  res.json(lmsReportsStore);
});

// ----------------- VITE / STATIC SERVING ----------------- //

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BIDV EduPlay] Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
