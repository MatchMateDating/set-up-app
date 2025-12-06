import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { games } from '../puzzles/puzzlesPage';
import { Ionicons } from '@expo/vector-icons';

const SendPuzzle = ({ selectedPuzzleType, selectedPuzzleLink, onPuzzleChange, onClose }) => {
  return (
    <View style={styles.sendPuzzle}>
      <View style={styles.sendPuzzleRow}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedPuzzleLink}
            onValueChange={(value) => {
              const selectedGame = games.find(game => game.path === value);
              if (selectedGame) {
                onPuzzleChange(selectedGame.name, selectedGame.path);
              }
            }}
            style={styles.picker}
            itemStyle={{ height: 50 }}
          >
            {games.map((game) => (
              <Picker.Item key={game.path} label={game.name} value={game.path} />
            ))}
          </Picker>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sendPuzzle: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e6ef',
  },
  sendPuzzleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickerContainer: {
    flex: 1
  },
  picker: {
    height: 50,
  },
  closeButton: {
    padding: 8,
  },
});

export default SendPuzzle;
