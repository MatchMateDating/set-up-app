import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoginScreen from '../components/auth/login';
import SignUpScreen from '../components/auth/signUp';
import EmailVerificationScreen from '../components/auth/emailVerification';
import ForgotPasswordScreen from '../components/auth/forgotPassword';
import ProfilePage from '../components/profile/profilePage';
import Conversations from '../components/conversations/conversations';
import Match from '../components/matches/match';
import CompleteProfile from '../components/profile/completeProfile';
import Settings from '../components/settings/settings';
import Preferences from '../components/preferences/preferences';
import MatchConvo from '../components/conversations/matchConvo';
import PuzzlesHub from '../components/puzzles/puzzlesPage';
import SpiritAnimalQuiz from '../components/puzzles/spiritAnimalQuiz';
import ZodiacQuiz from '../components/puzzles/zodiacQuiz';
import TriviaChallenge from '../components/puzzles/triviaChallenge';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={({ route }) => ({
        swipeEnabled: true,
        animationEnabled: true,
        tabBarIcon: ({ focused, color }) => {
          let iconName;

          if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Matches') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Conversations') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={20} color={color} />;
        },
        tabBarShowIcon: true,
        tabBarShowLabel: false,
        tabBarIndicatorStyle: { height: 0 },
        tabBarItemStyle: { justifyContent: 'center', alignItems: 'center' },
        tabBarStyle: {
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
        },
        tabBarPressColor: 'rgba(108, 92, 231, 0.12)',
        tabBarActiveTintColor: '#6c5ce7',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Profile" component={ProfilePage} />
      <Tab.Screen name="Matches" component={Match} />
      <Tab.Screen name="Conversations" component={Conversations} />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfile} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="ProfilePage" component={ProfilePage} />
      <Stack.Screen name="Preferences" component={Preferences} />
      <Stack.Screen name="MatchConvo" component={MatchConvo} />
      <Stack.Screen name="PuzzlesHub" component={PuzzlesHub} />
      <Stack.Screen name="SpiritAnimalQuiz" component={SpiritAnimalQuiz} />
      <Stack.Screen name="ZodiacQuiz" component={ZodiacQuiz} />
      <Stack.Screen name="TriviaChallenge" component={TriviaChallenge} />
    </Stack.Navigator>
  );
}
