import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { CommonActions, useNavigationState } from '@react-navigation/native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

function selectMainTabRouteName(state) {
  if (!state?.routes?.length) return null;
  const route = state.routes[state.index];
  if (route.name !== 'Main') return null;
  const tabState = route.state;
  if (!tabState?.routes?.length) return 'Profile';
  return tabState.routes[tabState.index]?.name ?? 'Profile';
}

/**
 * Hardware back (Android) and left-edge swipe (iOS) for the main tab area:
 * Settings → Conversations → Matches → Profile → double-confirm exit.
 */
export function MainTabsShell({ stackNavigation, isMainFocused, tabBarOuterHeight, children }) {
  const tabRouteName = useNavigationState(selectMainTabRouteName);
  const tabNameRef = useRef('Profile');
  const pendingExitRef = useRef(false);
  const [exitToastVisible, setExitToastVisible] = useState(false);

  useEffect(() => {
    if (tabRouteName) {
      tabNameRef.current = tabRouteName;
    }
  }, [tabRouteName]);

  useEffect(() => {
    if (!isMainFocused) {
      pendingExitRef.current = false;
      setExitToastVisible(false);
    }
  }, [isMainFocused]);

  useEffect(() => {
    if (tabRouteName && tabRouteName !== 'Profile') {
      pendingExitRef.current = false;
      setExitToastVisible(false);
    }
  }, [tabRouteName]);

  const navigateToTab = useCallback(
    (screen) => {
      stackNavigation.dispatch(
        CommonActions.navigate({
          name: 'Main',
          params: { screen },
          merge: true,
        })
      );
    },
    [stackNavigation]
  );

  const handleBack = useCallback(() => {
    if (!isMainFocused) {
      return false;
    }
    const name = tabNameRef.current;
    if (name === 'Settings') {
      navigateToTab('Conversations');
      return true;
    }
    if (name === 'Conversations') {
      navigateToTab('Matches');
      return true;
    }
    if (name === 'Matches') {
      navigateToTab('Profile');
      return true;
    }
    if (name === 'Profile') {
      if (pendingExitRef.current) {
        pendingExitRef.current = false;
        setExitToastVisible(false);
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        }
        return true;
      }
      pendingExitRef.current = true;
      setExitToastVisible(true);
      return true;
    }
    return false;
  }, [isMainFocused, navigateToTab]);

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  const runBack = useCallback(() => handleBackRef.current(), []);

  useEffect(() => {
    if (!isMainFocused || Platform.OS !== 'android') {
      return undefined;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => runBack());
    return () => sub.remove();
  }, [isMainFocused, runBack]);

  const edgeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Platform.OS === 'ios')
        .activeOffsetX(14)
        .failOffsetY([-56, 56])
        .onEnd((e) => {
          if (e.translationX > 56) {
            runOnJS(runBack)();
          }
        }),
    [runBack]
  );

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View style={styles.flex}>
        {children}
        {exitToastVisible ? (
          <View pointerEvents="none" style={[styles.exitToastWrap, { bottom: tabBarOuterHeight + 10 }]}>
            <View style={styles.exitToastPill}>
              <Text style={styles.exitToastText}>Tap again to exit</Text>
            </View>
          </View>
        ) : null}
        {Platform.OS === 'ios' && isMainFocused ? (
          <GestureDetector gesture={edgeGesture}>
            <View style={[styles.leftEdgeHitArea, { bottom: tabBarOuterHeight }]} />
          </GestureDetector>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  exitToastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2000,
  },
  exitToastPill: {
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  exitToastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  leftEdgeHitArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 28,
    zIndex: 1500,
    backgroundColor: 'transparent',
  },
});
