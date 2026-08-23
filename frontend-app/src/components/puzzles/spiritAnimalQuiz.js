import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../layout/AppShell';
import QuizQuestionFlow from './quizQuestionFlow';
import { useQuizForName } from './useQuizForName';
import './quizResult.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const questions = [
  {
    q: 'Your ideal weekend looks like...',
    a: [
      { text: 'Packed with plans', score: { energy: 2, pace: 1 } },
      { text: 'One main plan + chill time', score: { energy: 1, balance: 1 } },
      { text: 'No plans at all', score: { energy: -1, pace: -1 } },
    ],
  },
  {
    q: 'How spontaneous are you?',
    a: [
      { text: 'Very — last-minute plans are my thing', score: { pace: 2 } },
      { text: 'Somewhat', score: { pace: 1 } },
      { text: 'I like to plan ahead', score: { pace: -2 } },
    ],
  },
  {
    q: 'After a long day, you recharge by…',
    a: [
      { text: 'Being around people', score: { energy: 2 } },
      { text: 'Doing something solo', score: { energy: -2 } },
      { text: 'A mix of both', score: { balance: 1 } },
    ],
  },
  {
    q: 'What matters more in a relationship?',
    a: [
      { text: 'Deep emotional connection', score: { depth: 2 } },
      { text: 'Shared experiences', score: { depth: 1, energy: 1 } },
      { text: 'Stability & reliability', score: { depth: -1, pace: -1 } },
    ],
  },
  {
    q: 'On a first date, you’d rather…',
    a: [
      { text: 'Do an activity', score: { energy: 1 } },
      { text: 'Have deep conversation', score: { depth: 2 } },
      { text: 'Keep it light & fun', score: { energy: 2, depth: -1 } },
    ],
  },
];

const calculateScores = (answers) => {
  const totals = { energy: 0, pace: 0, depth: 0, balance: 0 };

  Object.values(answers).forEach((answer) => {
    Object.entries(answer.score).forEach(([trait, value]) => {
      totals[trait] += value;
    });
  });

  return totals;
};

const getFinalResult = (scores) => {
  const { energy, pace, depth } = scores;

  if (depth >= 3 && energy <= 0) {
    return 'Owl — You’re thoughtful, emotionally grounded, and value deep connection 🌱';
  }

  if (energy >= 3 && pace >= 2) {
    return 'Dog - You’re energetic, spontaneous, and love shared experiences 🌟';
  }

  if (depth >= 2 && energy >= 1) {
    return 'Elephant - You’re warm, engaging, and value both fun and meaningful connection ✨';
  }

  return 'Turtle - You’re balanced, adaptable, and easy to connect with 💫';
};

const SpiritAnimalQuiz = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forName = useQuizForName();

  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  const handleAnswer = (questionIndex, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const calculateResult = async () => {
    const scores = calculateScores(answers);
    const finalResult = getFinalResult(scores);
    setResult(finalResult);

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/');
        return;
      }

      await fetch(`${API_BASE_URL}/quiz/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quiz_name: 'Spirit Animal Quiz',
          quiz_version: 'v1',
          result: finalResult,
          scores,
          answers,
        }),
      });
    } catch (err) {
      console.error(err);
      window.alert('Failed to save quiz result');
    } finally {
      setSaving(false);
    }
  };

  const sendResultToMatch = async () => {
    try {
      const matchId =
        searchParams.get('matchId') || localStorage.getItem('activeMatchId');

      if (!matchId) {
        window.alert(
          'No active match. Open a conversation with a match first, or navigate to puzzles from within a conversation.'
        );
        return;
      }

      setSaving(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Here's my spirit animal quiz result: ${result}`,
        }),
      });

      navigate(`/conversation/${matchId}`);
    } catch (err) {
      console.error(err);
      window.alert('Failed to send result');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    const matchId =
      searchParams.get('matchId') || localStorage.getItem('activeMatchId');
    if (matchId) {
      navigate(`/conversation/${matchId}`);
      return;
    }
    navigate(-1);
  };

  if (!result) {
    return (
      <AppShell showTabs={false}>
        <QuizQuestionFlow
          key={flowKey}
          title="Spirit Animal Quiz"
          icon="🦊"
          questions={questions}
          forName={forName}
          answers={answers}
          onAnswer={handleAnswer}
          onFinish={calculateResult}
          onClose={handleClose}
          saving={saving}
        />
      </AppShell>
    );
  }

  return (
    <AppShell showTabs={false}>
      <div className="quiz-result-page">
        <h1 className="quiz-result-page-title">Spirit Animal Quiz</h1>
        <div className="quiz-result-card">
          <h2 className="quiz-result-heading">Your Result</h2>
          <p className="quiz-result-body">{result}</p>

          <div className="quiz-result-actions">
            <button
              type="button"
              className="quiz-result-btn"
              onClick={() => {
                setAnswers({});
                setResult(null);
                setFlowKey((k) => k + 1);
              }}
            >
              Restart Quiz
            </button>

            <button
              type="button"
              className="quiz-result-btn is-muted"
              onClick={() => navigate('/puzzles')}
            >
              Return to Puzzles
            </button>

            <button
              type="button"
              className="quiz-result-btn is-send"
              onClick={sendResultToMatch}
              disabled={saving}
            >
              {saving ? 'Sending…' : 'Send to Match'}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default SpiritAnimalQuiz;
