import React, { useState } from 'react';
import './quizQuestionFlow.css';

const QuizQuestionFlow = ({
  title,
  icon,
  questions,
  forName,
  answers,
  onAnswer,
  onFinish,
  onClose,
  saving = false,
  getAnswerKey = (answer) => answer.text,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const question = questions[currentIndex];
  const total = questions.length;
  const isLast = currentIndex === total - 1;
  const currentAnswer = answers[currentIndex];
  const hasSelection = currentAnswer != null;

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      onClose?.();
    }
  };

  const handleNext = () => {
    if (!hasSelection || saving) return;
    if (isLast) {
      onFinish?.();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const subtitle = forName
    ? `Question ${currentIndex + 1} of ${total} · for ${forName}`
    : `Question ${currentIndex + 1} of ${total}`;

  return (
    <div className="qqf">
      <div className="qqf-header-row">
        <button type="button" className="qqf-header-btn" onClick={handleBack} aria-label="Back">
          ‹
        </button>
        <button type="button" className="qqf-header-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="qqf-header-content">
        {icon ? <span className="qqf-icon">{icon}</span> : null}
        <h1 className="qqf-title">{title}</h1>
        <p className="qqf-subtitle">{subtitle}</p>
      </div>

      <div className="qqf-progress" aria-hidden="true">
        {questions.map((_, idx) => (
          <div
            key={idx}
            className={`qqf-progress-segment${idx <= currentIndex ? ' is-filled' : ''}`}
          />
        ))}
      </div>

      <div className="qqf-body">
        <p className="qqf-question">{question.q}</p>

        <div className="qqf-options">
          {question.a.map((answer, aIdx) => {
            const selected =
              currentAnswer != null && getAnswerKey(currentAnswer) === getAnswerKey(answer);

            return (
              <button
                key={aIdx}
                type="button"
                className={`qqf-option${selected ? ' is-selected' : ''}`}
                onClick={() => onAnswer(currentIndex, answer)}
              >
                {answer.text}
              </button>
            );
          })}
        </div>
      </div>

      <div className="qqf-footer">
        <button
          type="button"
          className="qqf-next"
          onClick={handleNext}
          disabled={!hasSelection || saving}
        >
          {saving ? 'Saving…' : isLast ? 'FINISH QUIZ' : 'NEXT'}
        </button>
      </div>
    </div>
  );
};

export default QuizQuestionFlow;
