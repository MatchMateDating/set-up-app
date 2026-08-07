import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../layout/AppShell';
import {
  calculateAge,
  getZodiacSign,
  zodiacInfo,
} from '../profile/utils/profileUtils';
import './quizResult.css';

// NOTE: getZodiacSign + zodiacInfo are imported from profileUtils —
// parent agent should add those exports if they are not present yet.

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ZodiacQuiz = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        window.alert('Please log in');
        navigate('/');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          navigate('/');
          return;
        }
      }

      if (!res.ok) throw new Error('Failed to fetch profile');

      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error('Error loading profile:', err);
      window.alert('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendResultToMatch = async (zodiacSign, age, zodiacDetails) => {
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

      const message = `My zodiac sign is ${zodiacSign} (age ${age}) 🪐
      
Traits: ${zodiacDetails.traits.join(', ')}
Pros: ${zodiacDetails.pros.join(', ')}
Cons: ${zodiacDetails.cons.join(', ')}
Compatible signs: ${zodiacDetails.compatible.join(', ')}`;

      await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      navigate(`/conversation/${matchId}`);
    } catch (err) {
      console.error(err);
      window.alert('Failed to send zodiac info');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell showTabs={false}>
        <div className="quiz-result-page">
          <div className="quiz-result-loading">
            <span>Loading your zodiac info…</span>
          </div>
        </div>
      </AppShell>
    );
  }

  const age = calculateAge(user?.birthdate);
  const zodiacSign = getZodiacSign(user?.birthdate);
  const zodiacDetails = zodiacInfo(zodiacSign);

  return (
    <AppShell showTabs={false}>
      <div className="quiz-result-page">
        <h1 className="quiz-result-page-title">Your Zodiac Sign</h1>

        <div className="quiz-result-card">
          <p className="quiz-zodiac-sign">{zodiacSign || '—'}</p>
          <p className="quiz-zodiac-age">Age: {age || '—'}</p>

          <div className="quiz-zodiac-section">
            <p className="quiz-zodiac-label">Traits:</p>
            <p className="quiz-zodiac-text">{zodiacDetails.traits.join(', ')}</p>
          </div>

          <div className="quiz-zodiac-section">
            <p className="quiz-zodiac-label">Pros:</p>
            <p className="quiz-zodiac-text">{zodiacDetails.pros.join(', ')}</p>
          </div>

          <div className="quiz-zodiac-section">
            <p className="quiz-zodiac-label">Cons:</p>
            <p className="quiz-zodiac-text">{zodiacDetails.cons.join(', ')}</p>
          </div>

          <div className="quiz-zodiac-section">
            <p className="quiz-zodiac-label">Compatible Signs:</p>
            <p className="quiz-zodiac-text">{zodiacDetails.compatible.join(', ')}</p>
          </div>

          <div className="quiz-result-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="quiz-result-btn is-send"
              onClick={() => sendResultToMatch(zodiacSign, age, zodiacDetails)}
              disabled={saving}
            >
              {saving ? 'Sending…' : 'Send to Match'}
            </button>

            <button type="button" className="quiz-result-btn" onClick={fetchProfile}>
              Refresh
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

export default ZodiacQuiz;
