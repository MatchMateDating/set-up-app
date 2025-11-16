import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '@env';

const questions = [
  { q: 'Do you prefer mornings or nights?', a: ['Mornings', 'Nights'] },
  { q: 'Would you rather read a book or watch a movie?', a: ['Book', 'Movie'] },
  { q: 'Do you consider yourself introverted or extroverted?', a: ['Introvert', 'Extrovert'] },
];

const PersonalityQuiz = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleAnswer = (qIndex, answer) => {
    setAnswers({ ...answers, [qIndex]: answer });
  };

  const calculateResult = async () => {
    const score = Object.values(answers).filter(
      (a) => a === 'Mornings' || a === 'Book' || a === 'Introvert'
    ).length;

    const finalResult =
      score >= 2
        ? 'You are a thoughtful and calm soul 🌱'
        : 'You are adventurous and outgoing 🌟';

    setResult(finalResult);

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/quiz/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quiz_name: 'Personality Quiz',
          quiz_version: 'v1',
          result: finalResult,
          answers,
        }),
      });

      if (res.ok) {
        Alert.alert('Success', 'Quiz result saved!');
      } else if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
        }
      } else {
        Alert.alert('Error', 'Failed to save quiz result');
      }
    } catch (err) {
      console.error('Error saving quiz result:', err);
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
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Here's my personality quiz result: ${result}`
        }),
      });

      if (res.ok || res.status === 201) {
        navigation.navigate('MatchConvo', { matchId });
      } else {
        Alert.alert('Error', 'Failed to send quiz result to match');
      }
    } catch (err) {
      console.error('Error sending quiz result:', err);
      Alert.alert('Error', 'Failed to send quiz result');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🧩 Personality Quiz</Text>
      {!result ? (
        <View style={styles.questionsContainer}>
          {questions.map((q, idx) => (
            <View key={idx} style={styles.quizCard}>
              <Text style={styles.question}>{q.q}</Text>
              <View style={styles.options}>
                {q.a.map((answer) => (
                  <TouchableOpacity
                    key={answer}
                    style={[
                      styles.option,
                      answers[idx] === answer && styles.optionSelected
                    ]}
                    onPress={() => handleAnswer(idx, answer)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        answers[idx] === answer && styles.optionTextSelected
                      ]}
                    >
                      {answer}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (Object.keys(answers).length < questions.length || saving) && styles.submitButtonDisabled
            ]}
            onPress={calculateResult}
            disabled={Object.keys(answers).length < questions.length || saving}
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
          <Text style={styles.resultTitle}>Your Result:</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f6f4fc',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 24,
    textAlign: 'center',
  },
  questionsContainer: {
    gap: 20,
  },
  quizCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginBottom: 16,
  },
  options: {
    gap: 12,
  },
  option: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e6ef',
    backgroundColor: '#fff',
  },
  optionSelected: {
    borderColor: '#6B46C1',
    backgroundColor: '#f6f4fc',
  },
  optionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#6B46C1',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6B46C1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    marginBottom: 16,
  },
  resultText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#6B46C1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PersonalityQuiz;
