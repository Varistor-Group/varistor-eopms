import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  BookOpen,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { trainingApi } from '../api/training';
import type { QuizQuestion, QuizAttempt, TrainingModuleWithStatus } from '../types';

interface Props {
  module: TrainingModuleWithStatus;
  onComplete: () => void;
  onBack: () => void;
}

// ─── Confetti ──────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  delay: number;
  size: number;
  color: string;
  duration: number;
}

function Confetti() {
  const particles: Particle[] = Array.from({ length: 48 }, (_, i) => ({
    id: i,
   
    x: Math.random() * 100,
   
    delay: Math.random() * 1.2,
   
    size: 6 + Math.random() * 8,
    color: i % 3 === 0 ? '#84cc16' : i % 3 === 1 ? '#ffffff' : '#d9f99d',
   
    duration: 1.8 + Math.random() * 1.2,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationName: 'confettiFall',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: 'ease-in',
            animationFillMode: 'forwards',
   
            transform: `rotate(${Math.random() * 360}deg)`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ─── Score gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const radius = 60;
  const circumference = Math.PI * radius; // half-circle arc
  const dashOffset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#84cc16' : '#ef4444';

  return (
    <svg width="160" height="90" viewBox="0 0 160 90">
      {/* Track */}
      <path
        d={`M 10 80 A ${radius} ${radius} 0 0 1 150 80`}
        fill="none"
        stroke="#D8DED2"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M 10 80 A ${radius} ${radius} 0 0 1 150 80`}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
      />
      {/* Score text */}
      <text x="80" y="72" textAnchor="middle" fontSize="28" fontWeight="700" fill={color} fontFamily="Inter, sans-serif">
        {score}%
      </text>
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const QuizScreen: React.FC<Props> = ({ module: mod, onComplete, onBack }) => {
  const employeeId = trainingApi.getCurrentUserId();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [latestAttempt, setLatestAttempt] = useState<QuizAttempt | null>(mod.latestAttempt);
  const [retryAllowed, setRetryAllowed] = useState(true);
  const [retryUnlocksAt, setRetryUnlocksAt] = useState<Date | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const gaugeRef = useRef(false);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, latest] = await Promise.all([
        trainingApi.fetchQuizQuestions(mod.id),
        trainingApi.getLatestAttempt(employeeId, mod.id),
      ]);
      setQuestions(qs);
      setLatestAttempt(latest);

      if (latest && !latest.passed) {
        const allowed = trainingApi.isRetryAllowed(latest);
        setRetryAllowed(allowed);
        if (!allowed) setRetryUnlocksAt(trainingApi.retryUnlocksAt(latest));
      }

      // Restore saved answers (reload safety)
      const saved = trainingApi.getSavedAnswersForModule(employeeId, mod.id);
      if (Object.keys(saved).length > 0) setAnswers(saved);
    } finally {
      setLoading(false);
    }
  }, [employeeId, mod.id]);

  useEffect(() => {
   
    loadQuiz();
  }, [loadQuiz]);

  // Trigger gauge animation after mount
  useEffect(() => {
    if (submitted && attempt && !gaugeRef.current) {
      gaugeRef.current = true;
      if (attempt.passed) {
        setTimeout(() => setShowConfetti(true), 200);
        setTimeout(() => setShowConfetti(false), 4000);
      }
    }
  }, [submitted, attempt]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    const updated = { ...answers, [questionId]: optionIndex };
    setAnswers(updated);
    trainingApi.saveAnswerForQuestion(employeeId, mod.id, questionId, optionIndex);
  };

  const handleSubmit = async () => {
    const result = await trainingApi.submitQuiz(
      employeeId,
      mod.id,
      answers,
      mod.title,
      'employee@varistor.in',
      'hr@varistor.in'
    );
    setAttempt(result);
    setSubmitted(true);
  };

  // ── Cooldown guard ─────────────────────────────────────────────────────────
  if (!loading && latestAttempt && !latestAttempt.passed && !retryAllowed) {
    const hoursLeft = retryUnlocksAt
   
      ? Math.ceil((retryUnlocksAt.getTime() - Date.now()) / (1000 * 60 * 60))
      : 24;

    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} title={mod.title} />
        <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-varistor-dangerBg flex items-center justify-center">
            <Clock size={24} strokeWidth={1.5} className="text-varistor-dangerText" />
          </div>
          <h2 className="text-lg font-bold text-varistor-dark">Retry locked for {hoursLeft}h</h2>
          <p className="text-sm text-varistor-muted max-w-sm">
            You scored <strong>{latestAttempt.score}%</strong> on your last attempt. You can retry once the 24-hour cooldown ends.
            {retryUnlocksAt && (
              <> Unlocks at <strong>{retryUnlocksAt.toLocaleString()}</strong>.</>
            )}
          </p>
          <button onClick={onBack} className="mt-2 text-sm text-varistor-lime font-semibold hover:underline">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} title={mod.title} />
        <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor p-8 flex flex-col gap-4 animate-pulse">
          <div className="h-5 bg-varistor-pageBg rounded w-3/4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-varistor-pageBg rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ── Score screen ──────────────────────────────────────────────────────────
  if (submitted && attempt) {
    return (
      <div className="space-y-4">
        {showConfetti && <Confetti />}
        <BackBar onBack={onBack} title={mod.title} />

        <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor p-8 flex flex-col items-center gap-6">
          {/* Gauge */}
          <ScoreGauge score={attempt.score} />

          {/* Result */}
          {attempt.passed ? (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2">
                  <CheckCircle size={22} strokeWidth={2} className="text-varistor-lime" />
                  <h2 className="text-xl font-bold text-varistor-dark">You passed!</h2>
                </div>
                <p className="text-sm text-varistor-muted max-w-xs">
                  Great work. The next module in this track has been unlocked. A result summary has been emailed to HR and your Reporting Manager.
                </p>
              </div>
              <button
                onClick={onComplete}
                className="bg-varistor-lime text-varistor-dark font-semibold px-8 py-3 rounded-lg hover:bg-lime-500 active:scale-[0.98] transition-all duration-150 text-sm"
              >
                Back to Training Library →
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2">
                  <XCircle size={22} strokeWidth={2} className="text-varistor-dangerText" />
                  <h2 className="text-xl font-bold text-varistor-dark">Not quite</h2>
                </div>
                <p className="text-sm text-varistor-muted max-w-xs">
                  You scored <strong>{attempt.score}%</strong>. You need at least 70% to pass. Review the answers below and retry in 24 hours.
                </p>
              </div>

              {/* Show correct answers toggle */}
              <button
                onClick={() => setShowAnswers(v => !v)}
                className="text-sm text-varistor-lime font-semibold hover:underline"
              >
                {showAnswers ? 'Hide answers' : 'Show correct answers'}
              </button>

              {showAnswers && (
                <div className="w-full space-y-3 text-left">
                  {questions.map((q, qi) => {
                    const userAnswer = answers[q.id];
                    const correct = q.correct_index;
                    const isCorrect = userAnswer === correct;
                    return (
                      <div key={q.id} className={`p-4 rounded-lg border text-sm ${isCorrect ? 'border-varistor-successBorder bg-varistor-successBg' : 'border-varistor-dangerBorder bg-varistor-dangerBg'}`}>
                        <p className="font-semibold text-varistor-dark mb-2">{qi + 1}. {q.question}</p>
                        {q.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`text-[11px] py-0.5 flex items-center gap-1.5 ${oi === correct ? 'text-varistor-successText font-semibold' : oi === userAnswer && !isCorrect ? 'text-varistor-dangerText line-through' : 'text-varistor-muted'}`}
                          >
                            {oi === correct && <CheckCircle size={11} strokeWidth={2} />}
                            {oi === userAnswer && !isCorrect && <XCircle size={11} strokeWidth={2} />}
                            {opt}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onBack}
                  className="text-sm text-varistor-muted border border-varistor-border px-5 py-2.5 rounded-lg hover:bg-varistor-pageBg transition-colors"
                >
                  Back to Library
                </button>
                <button
                  disabled
                  className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-lg bg-varistor-pageBg text-varistor-muted border border-varistor-border cursor-not-allowed"
                  title="Retry available after 24h"
                >
                  <RotateCcw size={14} strokeWidth={1.5} />
                  Retry in 24h
                </button>
              </div>
            </>
          )}

          {/* Pass details */}
          <div className="w-full flex items-center gap-2 text-[10px] text-varistor-muted border-t border-varistor-border pt-4">
            <AlertCircle size={11} strokeWidth={1.5} />
            Passing score: 70% · Results auto-emailed to HR & Reporting Manager
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz question view ────────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} title={mod.title} />
        <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor p-8 text-center text-sm text-varistor-muted">
          No questions found for this module.
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const allAnswered = questions.every(qu => answers[qu.id] !== undefined);
  const currentAnswered = answers[q.id] !== undefined;

  return (
    <div className="space-y-4">
      <BackBar onBack={onBack} title={mod.title} />

      {/* Quiz header */}
      <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen size={16} strokeWidth={1.5} className="text-varistor-lime" />
          <span className="text-sm font-semibold text-varistor-dark">Quiz · {questions.length} questions</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {questions.map((qu, i) => (
              <button
                key={qu.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all duration-150 ${
                  i === currentIndex
                    ? 'bg-varistor-lime w-4'
                    : answers[qu.id] !== undefined
                    ? 'bg-varistor-lime/50'
                    : 'bg-varistor-border'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] text-varistor-muted font-medium ml-2">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor p-6 space-y-5">
        {/* Unlocks after video notice */}
        <div className="flex items-center gap-1.5 text-[10px] text-varistor-muted">
          <Clock size={11} strokeWidth={1.5} />
          <span>Unlocks after video · Passing score: 70%</span>
        </div>

        {/* Question */}
        <p className="text-sm font-semibold text-varistor-dark leading-relaxed">
          {currentIndex + 1}. {q.question}
        </p>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((opt, oi) => {
            const isSelected = answers[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => handleSelectOption(q.id, oi)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-150 ${
                  isSelected
                    ? 'border-varistor-lime bg-varistor-limeLight text-varistor-dark font-medium'
                    : 'border-varistor-border bg-white text-varistor-dark hover:border-varistor-lime hover:bg-varistor-limeLight/40'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-bold mr-3 flex-shrink-0 ${
                  isSelected ? 'border-varistor-lime bg-varistor-lime text-white' : 'border-varistor-border text-varistor-muted'
                }`}>
                  {String.fromCharCode(65 + oi)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Navigation row */}
        <div className="flex items-center justify-between pt-2 border-t border-varistor-border">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 text-sm text-varistor-muted hover:text-varistor-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Previous
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="bg-varistor-lime text-varistor-dark text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-lime-500 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit quiz
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
              disabled={!currentAnswered}
              className="flex items-center gap-1.5 text-sm text-varistor-dark font-medium bg-varistor-lime px-4 py-2 rounded-lg hover:bg-lime-500 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Unanswered warning on last question */}
        {isLast && !allAnswered && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle size={12} strokeWidth={1.5} />
            Answer all {questions.length} questions to submit.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Shared back bar ───────────────────────────────────────────────────────────

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-varistor-muted hover:text-varistor-dark transition-colors duration-150"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Library
      </button>
      <span className="text-varistor-border">·</span>
      <span className="text-sm font-semibold text-varistor-dark truncate">{title}</span>
    </div>
  );
}

export default QuizScreen;
