import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.stylefleet.app';
const PLAY_STORE_MARKET_URI = 'market://details?id=com.stylefleet.app';
const APP_STORE_URL = 'https://apps.apple.com/app/id6742398471';
const APP_STORE_REVIEW_URI = 'itms-apps://itunes.apple.com/app/viewContentsUserReviews/id6742398471?action=write-review';

const STORAGE_KEY_REVIEWED = '@salon_os_app_reviewed';
const STORAGE_KEY_DISMISSED_AT = '@salon_os_app_review_dismissed_at';
const REMIND_LATER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export class AppReviewService {
  /**
   * Checks whether the user has already submitted or tapped to review.
   */
  async hasUserReviewed(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEY_REVIEWED);
      return val === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Marks that the user has reviewed the app, permanently silencing prompts.
   */
  async markReviewed(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_REVIEWED, 'true');
    } catch {}
  }

  /**
   * Dismisses the prompt temporarily ('Maybe Later').
   */
  async dismissReviewPrompt(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED_AT, Date.now().toString());
    } catch {}
  }

  /**
   * Determines if the review prompt should be shown.
   * Trigger conditions (BOTH must be satisfied):
   * 1. User has imported/registered 10 or more customers.
   * 2. User has completed 10 or more bills/sales.
   * 3. User has not already reviewed.
   * 4. Prompt was not dismissed within the cooldown window (3 days).
   */
  async shouldPromptReview(importedCustomersCount: number, completedBillsCount: number): Promise<boolean> {
    if (importedCustomersCount < 10 || completedBillsCount < 10) {
      return false;
    }

    try {
      const alreadyReviewed = await this.hasUserReviewed();
      if (alreadyReviewed) {
        return false;
      }

      const dismissedAtStr = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED_AT);
      if (dismissedAtStr) {
        const dismissedAt = parseInt(dismissedAtStr, 10);
        if (!isNaN(dismissedAt) && Date.now() - dismissedAt < REMIND_LATER_COOLDOWN_MS) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Opens native Store review flow where available, with browser fallback.
   * Automatically marks the app as reviewed.
   */
  async openAppReview(): Promise<void> {
    await this.markReviewed();

    if (Platform.OS === 'android') {
      try {
        const canMarket = await Linking.canOpenURL(PLAY_STORE_MARKET_URI);
        if (canMarket) {
          await Linking.openURL(PLAY_STORE_MARKET_URI);
          return;
        }
      } catch {
        // Fallback to web
      }
      await Linking.openURL(PLAY_STORE_URL);
    } else if (Platform.OS === 'ios') {
      try {
        const canReview = await Linking.canOpenURL(APP_STORE_REVIEW_URI);
        if (canReview) {
          await Linking.openURL(APP_STORE_REVIEW_URI);
          return;
        }
      } catch {
        // Fallback to web
      }
      await Linking.openURL(APP_STORE_URL);
    } else {
      await Linking.openURL(PLAY_STORE_URL);
    }
  }
}

export const appReviewService = new AppReviewService();
