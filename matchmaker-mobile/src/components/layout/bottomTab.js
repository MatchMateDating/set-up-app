import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const BottomTab = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const tabs = [
    { icon: 'person-outline', activeIcon: 'person', path: 'Profile' },
    { icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', path: 'Conversations' },
    { icon: 'heart-outline', activeIcon: 'heart', path: 'Matches' },
  ];

  const isActive = (tabPath) => {
    const routeName = route.name;
    return routeName === tabPath || (tabPath === 'Profile' && routeName === 'ProfilePage');
  };

  return (
    <View style={styles.bottomTab}>
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <TouchableOpacity
            key={tab.path}
            style={[styles.tabButton, active && styles.tabButtonActive]}
            onPress={() => navigation.navigate(tab.path)}
          >
            <Ionicons
              name={active ? tab.activeIcon : tab.icon}
              size={24}
              color={active ? '#6B46C1' : '#999'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomTab: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e6ef',
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  tabButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    // Active styling handled by icon color
  },
});

export default BottomTab;
