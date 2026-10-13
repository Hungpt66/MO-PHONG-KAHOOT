import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Sparkles,
  Layers,
  Code2,
  HelpCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Eye,
  Check,
} from 'lucide-react';
import { Quiz, Question, QuestionType, OptionItem } from '../types';
import { SAMPLE_EXTERNAL_MINI_GAME_HTML } from '../data/sampleQuizzes';

interface QuizBuilderViewProps {
  onQuizCreated: (quiz: Quiz) => void;
  existingQuizzes: Quiz[];
}

export const QuizBuilderView: React.FC<QuizBuilderViewProps> = ({ onQuizCreated, existingQuizzes }) => {
  const [activeMode, setActiveMode] = useState<'native' | 'external' | 'ai'>('native');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Nghiệp vụ BIDV');
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q_' + Date.now(),
      type: 'multiple_choice',
      title: 'Câu hỏi trắc nghiệm mẫu của bạn...',
      timeLimit: 20,
      points: 1000,
      options: [
        { id: 'opt_1', text: 'Lựa chọn A (Chính xác)', isCorrect: true },
        { id: 'opt_2', text: 'Lựa chọn B', isCorrect: false },
        { id: 'opt_3', text: 'Lựa chọn C', isCorrect: false },
        { id: 'opt_4', text: 'Lựa chọn D', isCorrect: false },
      ],
    },
  ]);

  // External Import state (Hướng B)
  const [embedHtml, setEmbedHtml] = useState(SAMPLE_EXTERNAL_MINI_GAME_HTML);
  const [externalTitle, setExternalTitle] = useState('Thử Thách Tương Tác Google AI Studio');

  // AI Prompt state
  const [aiTopic, setAiTopic] = useState('Bảo mật thẻ tín dụng và thanh toán không tiếp xúc Contactless BIDV');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Add question
  const handleAddQuestion = (type: QuestionType = 'multiple_choice') => {
    const newQ: Question = {
      id: 'q_' + Date.now(),
      type,
      title: type === 'external_embed' ? 'Vòng Chơi Mini-Game Nhúng' : 'Nhập nội dung câu hỏi mới...',
      timeLimit: type === 'external_embed' ? 45 : 20,
      points: 1000,
      options:
        type === 'multiple_choice'
          ? [
              { id: 'opt_1', text: 'Phương án 1 (Đúng)', isCorrect: true },
              { id: 'opt_2', text: 'Phương án 2', isCorrect: false },
              { id: 'opt_3', text: 'Phương án 3', isCorrect: false },
              { id: 'opt_4', text: 'Phương án 4', isCorrect: false },
            ]
          : type === 'true_false'
          ? [
              { id: 'tf_1', text: 'Đúng', isCorrect: true },
              { id: 'tf_2', text: 'Sai', isCorrect: false },
            ]
          : undefined,
      externalGameConfig:
        type === 'external_embed'
          ? {
              sourceType: 'ai_studio_html',
              embedHtml: embedHtml,
              title: 'Mini-Game AI Studio',
              instruction: 'Tương tác trực tiếp trên khung game để nộp điểm',
              maxScore: 1000,
              timeLimitSeconds: 45,
            }
          : undefined,
    };

    setQuestions([...questions, newQ]);
  };

  // Delete question
  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, idx) => idx !== index));
  };

  // Update option
  const handleUpdateOption = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options![optIdx].text = text;
      setQuestions(updated);
    }
  };

  // Toggle correct option
  const handleSetCorrectOption = (qIdx: number, optIdx: number) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options!.forEach((opt, idx) => {
        opt.isCorrect = idx === optIdx;
      });
      setQuestions(updated);
    }
  };

  // Save Quiz to backend
  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề bộ câu hỏi');
      return;
    }

    const newQuiz: Quiz = {
      id: 'quiz_' + Date.now(),
      title: title.trim(),
      description: description.trim() || 'Bộ câu hỏi đào tạo nghiệp vụ BIDV',
      category: category.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions,
    };

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuiz),
      });
      const data = await res.json();
      if (data.success) {
        onQuizCreated(data.quiz);
        setSaveSuccessMsg('Đã lưu thành công bộ câu hỏi vào LMS!');
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error saving quiz:', err);
    }
  };

  // AI Generation with Gemini
  const handleGenerateAiQuiz = async () => {
    if (!aiTopic.trim()) return;
    setIsAiGenerating(true);

    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), questionCount: 4 }),
      });
      const data = await res.json();
      if (data.success && data.quiz) {
        setTitle(data.quiz.title);
        setDescription(data.quiz.description);
        setCategory(data.quiz.category);
        setQuestions(data.quiz.questions);
        setActiveMode('native');
        onQuizCreated(data.quiz);
        setSaveSuccessMsg('Đã sinh thành công bộ câu hỏi bằng Gemini AI!');
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      } else {
        alert(data.error || 'Lỗi khi tạo câu hỏi');
      }
    } catch (err) {
      console.error('AI quiz generation error:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Top Selector: 2 Creation Directions + AI Assistant */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-6">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#004D2C] text-[#FFCC00]">
              Quản Lý Đề Thi & Trò Chơi
            </span>
            <h1 className="text-2xl font-black text-[#004D2C] mt-1">
              Trung Tâm Soạn Thảo & Nhúng Game
            </h1>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveMode('native')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'native'
                  ? 'bg-[#008049] text-white shadow'
                  : 'text-gray-600 hover:text-[#008049]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Hướng A: Native Builder</span>
            </button>

            <button
              onClick={() => setActiveMode('external')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'external'
                  ? 'bg-[#008049] text-white shadow'
                  : 'text-gray-600 hover:text-[#008049]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Hướng B: Nhúng AI Studio</span>
            </button>

            <button
              onClick={() => setActiveMode('ai')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'ai'
                  ? 'bg-[#FFCC00] text-[#004D2C] shadow font-black'
                  : 'text-gray-600 hover:text-[#008049]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Trợ Lý AI Gemini</span>
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="mb-4 bg-emerald-50 text-[#008049] font-bold text-xs p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* MODE: AI ASSISTANT */}
        {activeMode === 'ai' && (
          <div className="bg-amber-50/70 rounded-2xl p-6 border border-amber-200 mb-6">
            <div className="flex items-center gap-2 mb-2 text-[#004D2C]">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-base">Tạo bộ câu hỏi tức thì với Gemini AI</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              Nhập bất kỳ chủ đề nghiệp vụ ngân hàng hoặc kỹ năng nào của BIDV, AI sẽ tự động phân tích và tạo bộ trắc nghiệm đa dạng câu hỏi có tính điểm tốc độ.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="VD: Nhận diện rủi ro lừa đảo công nghệ cao và bảo vệ mã OTP"
                className="flex-1 px-4 py-3 bg-white rounded-xl border border-amber-300 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                disabled={isAiGenerating}
                onClick={handleGenerateAiQuiz}
                className="bg-[#008049] hover:bg-[#006037] text-white px-6 py-3 rounded-xl font-black text-sm shadow flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                <span>{isAiGenerating ? 'Đang tạo câu hỏi...' : 'Tạo Đề Bằng AI'}</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE: EXTERNAL IMPORT (HƯỚNG B) */}
        {activeMode === 'external' && (
          <div className="bg-emerald-50/60 rounded-2xl p-6 border border-emerald-200 mb-6">
            <div className="flex items-center gap-2 mb-2 text-[#004D2C]">
              <Code2 className="w-5 h-5 text-[#008049]" />
              <h3 className="font-black text-base">
                Hướng B: Nhúng Mini-Game từ Google AI Studio (HTML Export)
              </h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              Dán mã nguồn HTML của mini-game xuất từ Google AI Studio. Game sẽ chạy trong sandbox iframe an toàn và gửi kết quả về LMS qua giao thức <code>postMessage</code>:
              <br />
              <code className="text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200 mt-1 inline-block text-[#004D2C]">
                window.parent.postMessage({`{ type: "game_complete", score: 1000 }`}, '*')
              </code>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tên vòng chơi nhúng:</label>
                <input
                  type="text"
                  value={externalTitle}
                  onChange={(e) => setExternalTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white rounded-xl border border-gray-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mã nguồn HTML Game (Đã có sẵn code thử nghiệm mẫu):
                </label>
                <textarea
                  rows={6}
                  value={embedHtml}
                  onChange={(e) => setEmbedHtml(e.target.value)}
                  className="w-full font-mono text-xs p-3 bg-slate-900 text-emerald-400 rounded-xl border border-gray-300"
                />
              </div>

              <button
                onClick={() => handleAddQuestion('external_embed')}
                className="flex items-center gap-1.5 bg-[#008049] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow hover:bg-[#006037] transition-all"
              >
                <Plus className="w-4 h-4 text-[#FFCC00]" />
                <span>Thêm vòng chơi này vào bộ đề</span>
              </button>
            </div>
          </div>
        )}

        {/* QUIZ GENERAL INFO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-black uppercase text-gray-600 mb-1 tracking-wider">
              TÊN BỘ CÂU HỎI
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kiểm Tra Nghiệp Vụ Thanh Toán Quốc Tế BIDV 2026"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-300 font-bold text-base focus:border-[#008049] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-gray-600 mb-1 tracking-wider">
              DANH MỤC
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-300 font-bold text-sm bg-white focus:border-[#008049] outline-none"
            >
              <option value="Nghiệp vụ BIDV">Nghiệp vụ BIDV</option>
              <option value="Ngân hàng số BIDV">Ngân hàng số BIDV</option>
              <option value="Bảo mật & Tuân thủ">Bảo mật & Tuân thủ</option>
              <option value="Văn hóa & Tác phong">Văn hóa & Tác phong</option>
            </select>
          </div>
        </div>

        {/* QUESTIONS LIST */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="font-extrabold text-lg text-[#004D2C] flex items-center gap-2">
              <span>Danh sách câu hỏi ({questions.length})</span>
            </h2>

            {/* Add question types */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleAddQuestion('multiple_choice')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-[#008049] text-[#008049] hover:text-white text-xs font-bold border border-emerald-200 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Trắc nghiệm 4 đáp án</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('true_false')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white text-xs font-bold border border-amber-200 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Đúng / Sai</span>
              </button>
            </div>
          </div>

          {/* Question cards */}
          {questions.map((q, qIdx) => (
            <div key={q.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#004D2C] text-[#FFCC00] font-black text-xs flex items-center justify-center">
                    {qIdx + 1}
                  </span>
                  <span className="text-xs font-extrabold text-gray-700 uppercase">
                    {q.type === 'multiple_choice'
                      ? 'Trắc nghiệm 4 lựa chọn'
                      : q.type === 'true_false'
                      ? 'Câu hỏi Đúng / Sai'
                      : 'Vòng chơi nhúng Google AI Studio'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Time limit select */}
                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-xs">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={q.timeLimit}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[qIdx].timeLimit = Number(e.target.value);
                        setQuestions(updated);
                      }}
                      className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer"
                    >
                      <option value={10}>10 giây</option>
                      <option value={15}>15 giây</option>
                      <option value={20}>20 giây</option>
                      <option value={30}>30 giây</option>
                      <option value={45}>45 giây</option>
                      <option value={60}>60 giây</option>
                    </select>
                  </div>

                  {/* Delete button */}
                  {questions.length > 1 && (
                    <button
                      onClick={() => handleDeleteQuestion(qIdx)}
                      className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                      title="Xóa câu hỏi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Title input */}
              <input
                type="text"
                value={q.title}
                onChange={(e) => {
                  const updated = [...questions];
                  updated[qIdx].title = e.target.value;
                  setQuestions(updated);
                }}
                className="w-full bg-white px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-sm focus:border-[#008049] outline-none"
                placeholder="Nhập nội dung câu hỏi..."
              />

              {/* Multiple Choice Options */}
              {q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2 p-2.5 rounded-xl bg-white border-2 transition-all ${
                        opt.isCorrect ? 'border-[#008049] bg-emerald-50/40 ring-1 ring-[#008049]' : 'border-gray-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSetCorrectOption(qIdx, optIdx)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                          opt.isCorrect ? 'bg-[#008049] text-white' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                        }`}
                        title="Đánh dấu đáp án chính xác"
                      >
                        ✓
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                        className="flex-1 font-bold text-xs bg-transparent outline-none"
                        placeholder={`Phương án ${optIdx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Save button */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
          <button
            id="save-quiz-btn"
            onClick={handleSaveQuiz}
            className="flex items-center gap-2 bg-[#008049] hover:bg-[#006037] text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            <Save className="w-5 h-5 text-[#FFCC00]" />
            <span>LƯU BỘ CÂU HỎI VÀO LMS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
