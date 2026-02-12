import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export const games = [
  { name: 'Spirit Animal Quiz', path: 'SpiritAnimalQuiz' },
  { name: 'Zodiac Sign Quiz', path: 'ZodiacQuiz' },
  { name: 'Trivia Challenge', path: 'TriviaChallenge' }
];

const PuzzlesHub = () => {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Main')}>
        <Ionicons name="arrow-back" size={20} color="#6c5ce7" />
        <Text style={styles.backBtnText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>🎮 Puzzles Hub</Text>
      <View style={styles.puzzlesGrid}>
        {games.map((game) => (
          <TouchableOpacity
            key={game.path}
            style={styles.puzzleButton}
            onPress={() => navigation.navigate(game.path)}
          >
            <Text style={styles.puzzleButtonText}>{game.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  content: {
    padding: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  backBtnText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 24,
    textAlign: 'center',
  },
  puzzlesGrid: {
    gap: 16,
  },
  puzzleButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  puzzleButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6c5ce7',
  },
});

export default PuzzlesHub;
