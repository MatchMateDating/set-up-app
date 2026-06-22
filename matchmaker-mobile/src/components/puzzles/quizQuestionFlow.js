import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const PINK = '#ef4d73';
const PINK_LIGHT = '#FFF0F4';
const BG = '#FFF8FA';

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
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);

  const question = questions[currentIndex];
  const total = questions.length;
  const isLast = currentIndex === total - 1;
  const currentAnswer = answers[currentIndex];
  const hasSelection = currentAnswer != null;
  const bottomPadding = Platform.OS === 'android' ? 16 + insets.bottom : 12 + insets.bottom;

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color="#374151" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <View style={styles.headerContent}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.progressRow}>
        {questions.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.progressSegment,
              idx <= currentIndex ? styles.progressSegmentFilled : styles.progressSegmentEmpty,
            ]}
          />
        ))}
      </View>

      <View style={styles.body}>
        <Text style={styles.question}>{question.q}</Text>

        <View style={styles.options}>
          {question.a.map((answer, aIdx) => {
            const selected =
              currentAnswer != null && getAnswerKey(currentAnswer) === getAnswerKey(answer);

            return (
              <TouchableOpacity
                key={aIdx}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => onAnswer(currentIndex, answer)}
                activeOpacity={0.75}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {answer.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity
          style={[styles.nextButton, (!hasSelection || saving) && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!hasSelection || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>{isLast ? 'FINISH QUIZ' : 'NEXT'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 36,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 28,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressSegmentFilled: {
    backgroundColor: PINK,
  },
  progressSegmentEmpty: {
    backgroundColor: '#E5E7EB',
  },
  body: {
    flex: 1,
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
    lineHeight: 28,
  },
  options: {
    gap: 12,
  },
  option: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    borderColor: PINK,
    backgroundColor: PINK_LIGHT,
  },
  optionText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 22,
  },
  optionTextSelected: {
    color: PINK,
    fontWeight: '600',
  },
  footer: {
    paddingTop: 12,
  },
  nextButton: {
    backgroundColor: PINK,
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.45,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default QuizQuestionFlow;
