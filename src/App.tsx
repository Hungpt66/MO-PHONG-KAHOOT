import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { LiveHostView } from './components/LiveHostView';
import { PlayerView } from './components/PlayerView';
import { AsyncSelfPacedView } from './components/AsyncSelfPacedView';
import { QuizBuilderView } from './components/QuizBuilderView';
import { LMSReportsView } from './components/LMSReportsView';
import { DualScreenContainer } from './components/DualScreenContainer';
import { GameRoom, Quiz } from './types';
import { INITIAL_QUIZZES } from './data/sampleQuizzes';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('host');
  const [isDualView, setIsDualView] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>(INITIAL_QUIZZES);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [playerInitialPin, setPlayerInitialPin] = useState<string>('');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  // Fetch quizzes from server
  useEffect(() => {
    fetch('/api/quizzes')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setQuizzes(data);
        }
      })
      .catch((err) => console.error('Error fetching quizzes:', err));

    // Check URL params for pin (e.g. ?pin=582194)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const pinParam = urlParams.get('pin');
      if (pinParam) {
        setPlayerInitialPin(pinParam);
        setActiveTab('player');
      }
    }
  }, []);

  // Listen to SSE updates if an active room exists for the host
  useEffect(() => {
    if (!activeRoom?.pin) return;

    const eventSource = new EventSource(`/api/rooms/${activeRoom.pin}/events`);

    eventSource.onmessage = (event) => {
      try {
        const updatedRoom: GameRoom = JSON.parse(event.data);
        setActiveRoom(updatedRoom);
      } catch (err) {
        console.error('Host SSE parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeRoom?.pin]);

  const handleQuizCreated = (newQuiz: Quiz) => {
    setQuizzes((prev) => [newQuiz, ...prev.filter((q) => q.id !== newQuiz.id)]);
    setEditingQuizId(newQuiz.id);
  };

  const handleQuizUpdated = (updatedQuiz: Quiz) => {
    setQuizzes((prev) => prev.map((q) => (q.id === updatedQuiz.id ? updatedQuiz : q)));
  };

  const handleQuizDeleted = (deletedQuizId: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== deletedQuizId));
    if (editingQuizId === deletedQuizId) {
      setEditingQuizId(null);
    }
  };

  const handleResetDefaults = (resetQuizzes: Quiz[]) => {
    setQuizzes(resetQuizzes);
    if (resetQuizzes.length > 0) {
      setEditingQuizId(resetQuizzes[0].id);
    }
  };

  const handleOpenAdminEditor = (quizId?: string) => {
    if (quizId) {
      setEditingQuizId(quizId);
    }
    setActiveTab('builder');
  };

  const handleOpenPlayerWithPin = (pin: string) => {
    setPlayerInitialPin(pin);
    setActiveTab('player');
  };

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-slate-800 flex flex-col">
      {/* Top Brand & Navigation Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (isDualView && (tab === 'async' || tab === 'builder' || tab === 'reports')) {
            setIsDualView(false);
          }
        }}
        isDualView={isDualView}
        onToggleDualView={() => setIsDualView(!isDualView)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {isDualView ? (
          <DualScreenContainer
            quizzes={quizzes}
            activeRoom={activeRoom}
            onRoomCreated={(room) => {
              setActiveRoom(room);
              setPlayerInitialPin(room.pin);
            }}
            onRoomUpdated={(room) => setActiveRoom(room)}
            onCloseDualView={() => setIsDualView(false)}
          />
        ) : (
          <>
            {activeTab === 'host' && (
              <LiveHostView
                quizzes={quizzes}
                activeRoom={activeRoom}
                onRoomCreated={(room) => {
                  setActiveRoom(room);
                  setPlayerInitialPin(room.pin);
                }}
                onRoomUpdated={(room) => setActiveRoom(room)}
                onOpenPlayerWithPin={handleOpenPlayerWithPin}
                onEditQuiz={handleOpenAdminEditor}
              />
            )}

            {activeTab === 'player' && (
              <PlayerView
                initialPin={playerInitialPin || activeRoom?.pin || ''}
                onExit={() => setActiveTab('host')}
              />
            )}

            {activeTab === 'async' && (
              <AsyncSelfPacedView
                quizzes={quizzes}
                onEditQuiz={handleOpenAdminEditor}
              />
            )}

            {activeTab === 'builder' && (
              <QuizBuilderView
                initialQuizId={editingQuizId}
                onQuizCreated={handleQuizCreated}
                onQuizUpdated={handleQuizUpdated}
                onQuizDeleted={handleQuizDeleted}
                onResetDefaults={handleResetDefaults}
                existingQuizzes={quizzes}
                onLaunchLiveHost={(quizId) => {
                  setActiveTab('host');
                }}
              />
            )}

            {activeTab === 'reports' && <LMSReportsView />}
          </>
        )}
      </main>
    </div>
  );
}
