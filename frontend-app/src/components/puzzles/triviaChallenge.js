import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../layout/AppShell';
import QuizQuestionFlow from './quizQuestionFlow';
import { useQuizForName } from './useQuizForName';
import './quizResult.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const questions = [
  {
    q: 'What planet is known as the Red Planet?',
    a: [
      { text: 'Mars', correct: true },
      { text: 'Venus', correct: false },
      { text: 'Jupiter', correct: false },
    ],
  },
  {
    q: 'Who painted the Mona Lisa?',
    a: [
      { text: 'Vincent van Gogh', correct: false },
      { text: 'Leonardo da Vinci', correct: true },
      { text: 'Pablo Picasso', correct: false },
    ],
  },
  {
    q: 'What is the capital of Japan?',
    a: [
      { text: 'Kyoto', correct: false },
      { text: 'Seoul', correct: false },
      { text: 'Tokyo', correct: true },
    ],
  },
  {
    q: 'How many continents are there?',
    a: [
      { text: '5', correct: false },
      { text: '6', correct: false },
      { text: '7', correct: true },
    ],
  },
  {
    q: 'What gas do plants absorb from the atmosphere?',
    a: [
      { text: 'Oxygen', correct: false },
      { text: 'Carbon Dioxide', correct: true },
      { text: 'Nitrogen', correct: false },
    ],
  },
  {
    q: 'Which ocean is the largest?',
    a: [
      { text: 'Atlantic Ocean', correct: false },
      { text: 'Indian Ocean', correct: false },
      { text: 'Pacific Ocean', correct: true },
    ],
  },
  {
    q: 'What year did the first man land on the moon?',
    a: [
      { text: '1965', correct: false },
      { text: '1969', correct: true },
      { text: '1972', correct: false },
    ],
  },
  {
    q: 'What is the smallest prime number?',
    a: [
      { text: '0', correct: false },
      { text: '1', correct: false },
      { text: '2', correct: true },
    ],
  },
  {
    q: 'Which country invented paper?',
    a: [
      { text: 'Egypt', correct: false },
      { text: 'China', correct: true },
      { text: 'Greece', correct: false },
    ],
  },
  {
    q: 'What is the hardest natural substance on Earth?',
    a: [
      { text: 'Gold', correct: false },
      { text: 'Iron', correct: false },
      { text: 'Diamond', correct: true },
    ],
  },
];

const getResultBlurb = (score, total) => {
  const percent = (score / total) * 100;

  if (percent === 100) {
    return 'Perfect score! 🧠🔥 You absolutely crushed it.';
  }
  if (percent >= 80) {
    return 'Great job! 👏 You really know your stuff.';
  }
  if (percent >= 50) {
    return 'Not bad! 🙂 A solid effort with room to improve.';
  }
  return 'Oof 😅 That one was tough — better luck next time!';
};

const TriviaChallenge = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forName = useQuizForName();

  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  const handleAnswer = (questionIndex, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const calculateResult = async () => {
    let correctCount = 0;

    Object.values(answers).forEach((answer) => {
      if (answer.correct) correctCount += 1;
    });

    setScore(correctCount);

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`${API_BASE_URL}/quiz/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quiz_name: 'Trivia Quiz',
          quiz_version: 'v1',
          score: correctCount,
          total: questions.length,
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
          message: `I scored ${score}/${questions.length} on the trivia quiz! 🧠`,
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
    navigate('/puzzles');
  };

  if (score === null) {
    return (
      <AppShell showTabs={false}>
        <QuizQuestionFlow
          key={flowKey}
          title="Trivia Challenge"
          icon="🏆"
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
        <h1 className="quiz-result-page-title">Trivia Challenge</h1>
        <div className="quiz-result-card">
          <h2 className="quiz-result-heading">Your Score</h2>
          <p className="quiz-result-score">
            {score} / {questions.length}
          </p>
          <p className="quiz-result-body">{getResultBlurb(score, questions.length)}</p>

          <div className="quiz-result-actions">
            <button
              type="button"
              className="quiz-result-btn"
              onClick={() => {
                setAnswers({});
                setScore(null);
                setFlowKey((k) => k + 1);
              }}
            >
              Retry Quiz
            </button>

            <button
              type="button"
              className="quiz-result-btn is-send"
              onClick={sendResultToMatch}
              disabled={saving}
            >
              {saving ? 'Sending…' : 'Send to Match'}
            </button>

            <button
              type="button"
              className="quiz-result-btn is-muted"
              onClick={() => navigate('/puzzles')}
            >
              Return to Puzzles
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default TriviaChallenge;
