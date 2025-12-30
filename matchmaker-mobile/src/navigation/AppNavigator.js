import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../components/auth/login';
import SignUpScreen from '../components/auth/signUp';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
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

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6B46C1',
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
      <Stack.Screen name="CompleteProfile" component={CompleteProfile} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="ProfilePage" component={ProfilePage} />
      <Stack.Screen name="Preferences" component={Preferences} />
      <Stack.Screen name="MatchConvo" component={MatchConvo} />
      <Stack.Screen name="PuzzlesHub" component={PuzzlesHub} />
      <Stack.Screen name="SpiritAnimalQuiz" component={SpiritAnimalQuiz} />
      <Stack.Screen name="ZodiacQuiz" component={ZodiacQuiz} />
    </Stack.Navigator>
  );
}
