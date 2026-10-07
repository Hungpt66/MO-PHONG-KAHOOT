import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, XCircle, Trophy, Flame, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';
import { GameRoom, Player, Question } from '../types';
import { sound } from '../utils/audio';

const AVATAR_OPTIONS = ['🦁', '🦊', '🐯', '🐼', '🐨', '🦄', '🦅', '🐬', '🦉', '🚀', '⭐', '💎'];

interface PlayerViewProps {
  initialPin?: string;
  onExit?: () => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ initialPin = '', onExit }) => {
  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Player session
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [hasAnsweredCurrentQ, setHasAnsweredCurrentQ] = useState(false);
  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    streak: number;
    rank?: number;
  } | null>(null);

  // Fill in blank state
  const [fillText, setFillText] = useState('');

  // External game postMessage handler ref
  const questionStartTimeRef = useRef<number>(Date.now());

  // Update PIN if initialPin changes
  useEffect(() => {
    if (initialPin) {
      setPin(initialPin);
    }
  }, [initialPin]);

  // Connect to SSE stream for live updates once joined
  useEffect(() => {
    if (!pin || !currentPlayer) return;

    const eventSource = new EventSource(`/api/rooms/${pin}/events`);

    eventSource.onmessage = (event) => {
      try {
        const roomData: GameRoom = JSON.parse(event.data);
        setCurrentRoom(roomData);

        // Update current player data from room
        if (currentPlayer && roomData.players[currentPlayer.id]) {
          setCurrentPlayer(roomData.players[currentPlayer.id]);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
    };

    return () => {
      eventSource.close();
    };
  }, [pin, currentPlayer?.id]);

  // Reset answer status on new question
  useEffect(() => {
    if (currentRoom?.status === 'question') {
      setHasAnsweredCurrentQ(false);
      setLastResult(null);
      setFillText('');
      questionStartTimeRef.current = Date.now();
    }
  }, [currentRoom?.status, currentRoom?.currentQuestionIndex]);

  // Handle postMessage from external iframe (Google AI Studio mini-game)
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      if (e.data && e.data.type === 'game_complete') {
        const score = e.data.score || 0;
        sound.playCorrect();
        setHasAnsweredCurrentQ(true);

        try {
          await fetch(`/api/rooms/${pin}/external-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: currentPlayer?.id,
              score,
              details: e.data.details,
            }),
          });
        } catch (err) {
          console.error('Submit external result error:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pin, currentPlayer?.id]);

  // Submit join form
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Vui lòng nhập mã PIN 6 số');
      return;
    }
    if (!nickname.trim()) {
      setErrorMsg('Vui lòng nhập biệt danh (tên học viên)');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/rooms/${pin.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatar: selectedAvatar,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentPlayer(data.player);
        setCurrentRoom(data.room);
      } else {
        setErrorMsg(data.error || 'Không thể tham gia phòng');
      }
    } catch (err) {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Answer for standard questions
  const handleSubmitAnswer = async (payload: {
    selectedOptionId?: string;
    answeredText?: string;
    matchedPairs?: Record<string, string>;
  }) => {
    if (!currentPlayer || !pin || hasAnsweredCurrentQ) return;

    setHasAnsweredCurrentQ(true);
    const elapsedMs = Date.now() - questionStartTimeRef.current;

    try {
      const res = await fetch(`/api/rooms/${pin}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          timeElapsedMs: elapsedMs,
          ...payload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.isCorrect) {
          sound.playCorrect();
          if (data.streak > 1) {
            setTimeout(() => sound.playStreak(), 400);
          }
        } else {
          sound.playWrong();
        }

        setLastResult({
          isCorrect: data.isCorrect,
          pointsEarned: data.pointsEarned,
          streak: data.streak,
          rank: data.rank,
        });
      }
    } catch (err) {
      console.error('Answer submit error:', err);
    }
  };

  // Kahoot option colors and symbols for mobile buttons
  const KAHOOT_BUTTONS = [
    { bg: 'bg-[#E03E36] active:bg-[#C02620]', shape: '▲', label: 'Tam giác đỏ' },
    { bg: 'bg-[#FFCC00] text-[#004D2C] active:bg-[#E5B800]', shape: '◆', label: 'Hình thoi vàng' },
    { bg: 'bg-[#008049] active:bg-[#006037]', shape: '●', label: 'Hình tròn xanh lục' },
    { bg: 'bg-[#0A66C2] active:bg-[#084e96]', shape: '■', label: 'Hình vuông xanh dương' },
  ];

  // 1. JOIN SCREEN (GE-9)
  if (!currentPlayer) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-b from-[#004D2C] to-[#008049]">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border-4 border-[#FFCC00]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#008049] rounded-2xl mx-auto flex items-center justify-center border-2 border-[#FFCC00] shadow-md mb-3">
              <span className="text-2xl text-[#FFCC00]">★</span>
            </div>
            <h1 className="text-2xl font-black text-[#004D2C]">BIDV EduPlay</h1>
            <p className="text-xs text-gray-500 font-semibold mt-1">
              Nhập mã PIN để tham gia buổi học tương tác
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 text-xs font-bold p-3 rounded-xl mb-4 border border-red-200 text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            {/* PIN Input */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider">
                MÃ PIN 6 SỐ
              </label>
              <input
                id="join-pin-input"
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ví dụ: 582194"
                className="w-full text-center text-3xl font-black tracking-widest px-4 py-3 rounded-2xl border-2 border-gray-300 focus:border-[#008049] focus:ring-4 focus:ring-emerald-100 outline-none text-[#004D2C]"
                required
              />
            </div>

            {/* Nickname Input */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider">
                BIỆT DANH / TÊN HỌC VIÊN
              </label>
              <input
                id="join-nickname-input"
                type="text"
                maxLength={24}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="VD: Nguyễn Văn A (CN Hà Nội)"
                className="w-full text-center font-bold text-base px-4 py-3 rounded-2xl border-2 border-gray-300 focus:border-[#008049] focus:ring-4 focus:ring-emerald-100 outline-none"
                required
              />
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider text-center">
                CHỌN AVATAR
              </label>
              <div className="grid grid-cols-6 gap-2 bg-gray-50 p-2.5 rounded-2xl border border-gray-200">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`text-2xl p-1 rounded-xl transition-all ${
                      selectedAvatar === emoji
                        ? 'bg-[#FFCC00] scale-110 shadow ring-2 ring-[#008049]'
                        : 'hover:bg-gray-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="join-room-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-[#008049] hover:bg-[#00683a] text-white font-black text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Đang vào phòng...' : 'VÀO PHÒNG CHƠI'}</span>
              <ArrowRight className="w-5 h-5 text-[#FFCC00]" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. LOBBY WAITING SCREEN
  if (currentRoom?.status === 'lobby') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#004D2C] to-[#008049] text-white text-center">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-[#FFCC00] mx-auto flex items-center justify-center text-5xl shadow-xl mb-4 animate-bounce">
            {currentPlayer.avatar}
          </div>
          <h2 className="text-2xl font-black text-white">{currentPlayer.nickname}</h2>
          <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-[#FFCC00] text-[#004D2C]">
            Phòng PIN: {pin}
          </span>

          <div className="mt-6 pt-6 border-t border-white/10 text-emerald-100 text-sm font-medium">
            <p className="animate-pulse">✨ Bạn đã sẵn sàng!</p>
            <p className="text-xs text-white/70 mt-2">
              Hãy nhìn lên màn hình của Giảng viên để theo dõi câu hỏi khi bắt đầu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. QUESTION SCREEN - MOBILE-FIRST TOUCH BUTTONS (GE-10, GE-11)
  if (currentRoom?.status === 'question') {
    // If player already answered, show "Waiting for results" feedback
    if (hasAnsweredCurrentQ && lastResult) {
      return (
        <div
          className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-white text-center ${
            lastResult.isCorrect ? 'bg-[#008049]' : 'bg-[#E03E36]'
          }`}
        >
          <div className="max-w-sm w-full bg-black/20 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl">
            {lastResult.isCorrect ? (
              <>
                <CheckCircle2 className="w-20 h-20 text-[#FFCC00] mx-auto mb-3" />
                <h2 className="text-3xl font-black">CHÍNH XÁC!</h2>
                <div className="text-4xl font-black text-[#FFCC00] my-3">
                  +{lastResult.pointsEarned.toLocaleString()}
                </div>
                {lastResult.streak > 1 && (
                  <div className="inline-flex items-center gap-1 bg-[#FFCC00] text-[#004D2C] px-3 py-1 rounded-full text-xs font-black mb-2">
                    <Flame className="w-4 h-4 fill-current text-orange-600" />
                    <span>Chuỗi {lastResult.streak} câu đúng</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 text-white mx-auto mb-3 opacity-90" />
                <h2 className="text-3xl font-black">CHƯA ĐÚNG!</h2>
                <p className="text-sm text-white/80 mt-2">Cố gắng ở câu hỏi tiếp theo nhé!</p>
              </>
            )}

            <div className="mt-6 pt-4 border-t border-white/20 text-xs font-semibold text-white/80">
              Đang đợi các học viên khác trả lời...
            </div>
          </div>
        </div>
      );
    }

    // Question Answering Mode:
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-100 flex flex-col justify-between p-3 sm:p-4">
        {/* Top Mini-status bar */}
        <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-gray-200 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentPlayer.avatar}</span>
            <span className="text-xs font-bold text-gray-700 truncate max-w-[120px]">
              {currentPlayer.nickname}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-gray-500 block">ĐIỂM SỐ</span>
            <span className="text-sm font-black text-[#008049]">
              {currentPlayer.score.toLocaleString()} đ
            </span>
          </div>
        </div>

        {/* Kahoot 4-block layout on mobile */}
        <div className="flex-1 grid grid-cols-2 gap-3 pb-2">
          {KAHOOT_BUTTONS.map((btn, idx) => (
            <button
              key={idx}
              id={`player-opt-${idx}-btn`}
              onClick={() => handleSubmitAnswer({ selectedOptionId: `opt_${idx + 1}` })}
              className={`${btn.bg} rounded-3xl flex flex-col items-center justify-center text-white shadow-lg transition-transform active:scale-95 touch-manipulation`}
            >
              <span className="text-5xl sm:text-6xl font-black drop-shadow-md select-none">{btn.shape}</span>
            </button>
          ))}
        </div>

        <p className="text-center text-xs font-bold text-gray-500 py-1">
          Nhìn câu hỏi trên màn hình Giảng viên và chọn hình tương ứng
        </p>
      </div>
    );
  }

  // 4. RESULTS & LEADERBOARD WAIT STATE
  if (currentRoom?.status === 'question_result' || currentRoom?.status === 'leaderboard') {
    const sorted = Object.values(currentRoom.players || {}).sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === currentPlayer.id) + 1;

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#004D2C] to-[#008049] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <span className="text-xs font-bold text-[#FFCC00] uppercase tracking-widest block mb-2">
            VỊ TRÍ CỦA BẠN
          </span>
          <div className="text-6xl font-black text-[#FFCC00] mb-2">#{myRank || 1}</div>
          <p className="text-sm font-bold text-white mb-4">
            Tổng điểm: <span className="text-[#FFCC00] text-lg font-black">{currentPlayer.score.toLocaleString()}</span>
          </p>

          <div className="p-4 bg-black/20 rounded-2xl text-xs text-emerald-100">
            Hãy nhìn lên màn hình lớn để xem thống kê đáp án và bảng xếp hạng của cả lớp!
          </div>
        </div>
      </div>
    );
  }

  // 5. FINISHED CELEBRATION
  if (currentRoom?.status === 'finished') {
    const sorted = Object.values(currentRoom.players || {}).sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === currentPlayer.id) + 1;

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#004D2C] to-[#008049] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <Trophy className="w-16 h-16 text-[#FFCC00] mx-auto mb-3 animate-bounce" />
          <h2 className="text-2xl font-black">HOÀN THÀNH BUỔI HỌC!</h2>
          <div className="text-5xl font-black text-[#FFCC00] my-3">#{myRank}</div>
          <p className="text-base font-bold mb-4">
            Tổng điểm: <span className="text-[#FFCC00]">{currentPlayer.score.toLocaleString()}</span>
          </p>

          <div className="p-4 bg-black/20 rounded-2xl text-xs text-emerald-100 leading-relaxed">
            Kết quả của bạn đã được ghi nhận tự động vào sổ điểm LMS BIDV. Chúc mừng bạn đã hoàn thành xuất sắc!
          </div>
        </div>
      </div>
    );
  }

  return null;
};
