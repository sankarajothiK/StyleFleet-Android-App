import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_WELCOME_TOUR_SEEN = '@salon_os_welcome_tour_seen';

export const onboardingRepository = {
  async hasSeenWelcomeTour(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(STORAGE_KEY_WELCOME_TOUR_SEEN)) === '1';
    } catch {
      // If storage is unreadable, don't block the user behind the tour
      return true;
    }
  },

  async markWelcomeTourSeen(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_WELCOME_TOUR_SEEN, '1');
    } catch (e) {
      console.warn('Could not persist welcome tour flag:', e);
    }
  },
};
