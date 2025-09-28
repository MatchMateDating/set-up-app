import React, { useState } from "react";
import SideBar from '../layout/sideBar';
import { useNavigate } from "react-router-dom";

const questions = [
  { q: "Do you prefer mornings or nights?", a: ["Mornings", "Nights"] },
  { q: "Would you rather read a book or watch a movie?", a: ["Book", "Movie"] },
  { q: "Do you consider yourself introverted or extroverted?", a: ["Introvert", "Extrovert"] },
];

const PersonalityQuiz = () => {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const handleAnswer = (qIndex, answer) => {
    setAnswers({ ...answers, [qIndex]: answer });
  };

  const calculateResult = async () => {
    // Compute the result based on answers
    const score = Object.values(answers).filter(
      (a) => a === "Mornings" || a === "Book" || a === "Introvert"
    ).length;

    const finalResult =
      score >= 2
        ? "You are a thoughtful and calm soul 🌱"
        : "You are adventurous and outgoing 🌟";

    setResult(finalResult);

    // POST to backend only here
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/quiz/result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quiz_name: "Personality Quiz",
          quiz_version: "v1",
          result: finalResult,
          answers,
        }),
      });

      if (res.ok) {
        console.log("Quiz result saved!");
      } else if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === "TOKEN_EXPIRED") {
          localStorage.removeItem("token");
          window.location.href = "/";
        }
      } else {
        console.error("Failed to save quiz result");
      }
    } catch (err) {
      console.error("Error saving quiz result:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="puzzles-page">
      <SideBar />
      <div className="puzzles-container">
        <h1 className="puzzles-title">🧩 Personality Quiz</h1>
        {!result ? (
          <div className="quiz-questions">
            {questions.map((q, idx) => (
              <div key={idx} className="quiz-card">
                <p className="quiz-question">{q.q}</p>
                <div className="quiz-options">
                  {q.a.map((answer) => (
                    <button
                      key={answer}
                      onClick={() => handleAnswer(idx, answer)}
                      className={`quiz-option ${
                        answers[idx] === answer ? "quiz-option-selected" : ""
                      }`}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={calculateResult}
              className="quiz-submit"
              disabled={Object.keys(answers).length < questions.length || saving}
            >
              {saving ? "Saving..." : "See My Result"}
            </button>
          </div>
        ) : (
          <div className="quiz-result">
            <h2 className="quiz-result-title">Your Result:</h2>
            <p className="quiz-result-text">{result}</p>
            <button
              onClick={() => {
                setAnswers({});
                setResult(null);
              }}
              className="quiz-restart"
            >
              Restart Quiz
            </button>
            <button
              onClick={() => navigate("/puzzles")}
              className="quiz-return"
            >
              Return to Puzzles
            </button>
          </div>          
        )}
      </div>
    </div>
  );
};

export default PersonalityQuiz;
