import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import RoleHeaderBanner from '../components/layout/components/RoleHeaderBanner';
import { getRoleAccentColor } from '../components/layout/components/RoleHeaderBanner';
import DaterDropdown from '../components/layout/daterDropdown';
import { UserContext } from '../context/UserContext';
import { API_BASE_URL } from '../env';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const { user, setUser, isProfileEditing } = useContext(UserContext);
  const role = user?.role || 'matchmaker';
  const accentColor = getRoleAccentColor(role);

  const handleOverlayDaterChange = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error('Error refreshing user after dater change:', err);
    }
  };

  return (
    <View style={styles.mainTabsContainer}>
      <View pointerEvents="box-none" style={[styles.topOverlay, { top: insets.top + 4 }]}>
        {!isProfileEditing && (
          <View pointerEvents="none" style={styles.roleBadgeOverlay}>
            <RoleHeaderBanner role={role} />
          </View>
        )}
        {role === 'matchmaker' && (
          <View style={styles.dropdownOverlay}>
            <DaterDropdown userInfo={user} onDaterChange={handleOverlayDaterChange} />
          </View>
        )}
      </View>
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
          tabBarPressColor: role === 'user' ? 'rgba(239, 77, 115, 0.12)' : 'rgba(108, 92, 231, 0.12)',
          tabBarActiveTintColor: accentColor,
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Profile" component={ProfilePage} />
        <Tab.Screen name="Matches" component={Match} />
        <Tab.Screen name="Conversations" component={Conversations} />
        <Tab.Screen name="Settings" component={Settings} />
      </Tab.Navigator>
    </View>
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

const styles = StyleSheet.create({
  mainTabsContainer: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  roleBadgeOverlay: {
    alignItems: 'flex-end',
  },
  dropdownOverlay: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
});
