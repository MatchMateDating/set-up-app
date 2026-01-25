import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../../env';

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
    const navigation = useNavigation();
    const route = useRoute();

    const [answers, setAnswers] = useState({});
    const [score, setScore] = useState(null);
    const [saving, setSaving] = useState(false);

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
            const token = await AsyncStorage.getItem('token');
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
            Alert.alert('Error', 'Failed to save quiz result');
        } finally {
            setSaving(false);
        }
    };

    const sendResultToMatch = async () => {
        try {
            // Try to get matchId from route params first, then AsyncStorage
            const routeMatchId = route.params?.matchId;
            const storedMatchId = await AsyncStorage.getItem('activeMatchId');
            const matchId = routeMatchId || storedMatchId;
            
            if (!matchId) {
                Alert.alert(
                    'No Active Match',
                    'Please open a conversation with a match first, or navigate to puzzles from within a conversation.',
                    [{ text: 'OK' }]
                );
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
                    message: `I scored ${score}/${questions.length} on the trivia quiz! 🧠`,
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
            <Text style={styles.title}>Trivia Quiz</Text>

            {score === null ? (
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
                            <Text style={styles.submitButtonText}>See My Score</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultTitle}>Your Score</Text>
                    <Text style={styles.scoreText}>
                        {score} / {questions.length}
                    </Text>
                    <Text style={styles.resultText}>
                        {getResultBlurb(score, questions.length)}
                    </Text>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                            setAnswers({});
                            setScore(null);
                        }}
                    >
                        <Text style={styles.actionButtonText}>Retry Quiz</Text>
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
    resultTitle: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
    scoreText: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
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

export default TriviaChallenge;
