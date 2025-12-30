import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';

const questions = [
  {
    q: 'Your ideal weekend looks like...',
    a: [
      {
        text: 'Packed with plans',
        score: { energy: 2, pace: 1 },
      },
      {
        text: 'One main plan + chill time',
        score: { energy: 1, balance: 1 },
      },
      {
        text: 'No plans at all',
        score: { energy: -1, pace: -1 },
      },
    ],
  },
  {
    q: 'How spontaneous are you?',
    a: [
      {
        text: 'Very — last-minute plans are my thing',
        score: { pace: 2 },
      },
      {
        text: 'Somewhat',
        score: { pace: 1 },
      },
      {
        text: 'I like to plan ahead',
        score: { pace: -2 },
      },
    ],
  },
  {
    q: 'After a long day, you recharge by…',
    a: [
      {
        text: 'Being around people',
        score: { energy: 2 },
      },
      {
        text: 'Doing something solo',
        score: { energy: -2 },
      },
      {
        text: 'A mix of both',
        score: { balance: 1 },
      },
    ],
  },
  {
    q: 'What matters more in a relationship?',
    a: [
      {
        text: 'Deep emotional connection',
        score: { depth: 2 },
      },
      {
        text: 'Shared experiences',
        score: { depth: 1, energy: 1 },
      },
      {
        text: 'Stability & reliability',
        score: { depth: -1, pace: -1 },
      },
    ],
  },
  {
    q: 'On a first date, you’d rather…',
    a: [
      {
        text: 'Do an activity',
        score: { energy: 1 },
      },
      {
        text: 'Have deep conversation',
        score: { depth: 2 },
      },
      {
        text: 'Keep it light & fun',
        score: { energy: 2, depth: -1 },
      },
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
  const navigation = useNavigation();

  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

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
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
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
      Alert.alert('Error', 'Failed to save quiz result');
    } finally {
      setSaving(false);
    }
  };

  const sendResultToMatch = async () => {
    try {
      const matchId = await AsyncStorage.getItem('activeMatchId');
      if (!matchId) {
        Alert.alert('Error', 'No active match found');
        return;
      }

      setSaving(true);
      const token = await AsyncStorage.getItem('token');
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

      navigation.navigate('MatchConvo', { matchId });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send result');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Spirit Animal Quiz</Text>

      {!result ? (
        <View style={styles.questionsContainer}>
          {questions.map((q, qIdx) => (
            <View key={qIdx} style={styles.quizCard}>
              <Text style={styles.question}>{q.q}</Text>

              <View style={styles.options}>
                {q.a.map((answer, aIdx) => {
                  const selected = answers[qIdx]?.text === answer.text;

                  return (
                    <TouchableOpacity
                      key={aIdx}
                      style={[
                        styles.option,
                        selected && styles.optionSelected,
                      ]}
                      onPress={() => handleAnswer(qIdx, answer)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {answer.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (Object.keys(answers).length < questions.length || saving) &&
                styles.submitButtonDisabled,
            ]}
            onPress={calculateResult}
            disabled={
              Object.keys(answers).length < questions.length || saving
            }
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>See My Result</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Your Result</Text>
          <Text style={styles.resultText}>{result}</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setAnswers({});
              setResult(null);
            }}
          >
            <Text style={styles.actionButtonText}>Restart Quiz</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PuzzlesHub')}
          >
            <Text style={styles.actionButtonText}>Return to Puzzles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.sendButton]}
            onPress={sendResultToMatch}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Send to Match</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f4fc', paddingTop: 30 },
  content: { padding: 20 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  questionsContainer: { gap: 20 },
  quizCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
  },
  question: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  options: { gap: 12 },
  option: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e6ef',
  },
  optionSelected: {
    borderColor: '#6B46C1',
    backgroundColor: '#f6f4fc',
  },
  optionText: { fontSize: 16, textAlign: 'center', color: '#666' },
  optionTextSelected: { color: '#6B46C1', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#6B46C1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: { backgroundColor: '#ccc', opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  resultTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  resultText: { fontSize: 18, textAlign: 'center', marginBottom: 24 },
  actionButton: {
    backgroundColor: '#6B46C1',
    padding: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  sendButton: { backgroundColor: '#10b981' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default SpiritAnimalQuiz;
