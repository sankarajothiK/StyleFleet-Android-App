import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { appReviewService } from '../src/services/appReviewService';

describe('10 Bills and 10 Customers Play Store Review Prompt', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('does NOT prompt if bill count is less than 10 even if customer count >= 10', async () => {
    expect(await appReviewService.shouldPromptReview(10, 0)).toBe(false);
    expect(await appReviewService.shouldPromptReview(15, 5)).toBe(false);
    expect(await appReviewService.shouldPromptReview(20, 9)).toBe(false);
  });

  it('does NOT prompt if customer count is less than 10 even if bill count >= 10', async () => {
    expect(await appReviewService.shouldPromptReview(0, 10)).toBe(false);
    expect(await appReviewService.shouldPromptReview(5, 15)).toBe(false);
    expect(await appReviewService.shouldPromptReview(9, 20)).toBe(false);
  });

  it('prompts when BOTH customer count >= 10 AND bill count >= 10 for a fresh user', async () => {
    expect(await appReviewService.shouldPromptReview(10, 10)).toBe(true);
    expect(await appReviewService.shouldPromptReview(15, 12)).toBe(true);
  });

  it('does NOT prompt if the user has already reviewed the app', async () => {
    await appReviewService.markReviewed();
    expect(await appReviewService.hasUserReviewed()).toBe(true);
    expect(await appReviewService.shouldPromptReview(10, 10)).toBe(false);
    expect(await appReviewService.shouldPromptReview(50, 50)).toBe(false);
  });

  it('enforces 3-day cooldown when dismissed via Maybe Later', async () => {
    // 1. User reaches 10 customers and 10 bills -> prompted
    expect(await appReviewService.shouldPromptReview(10, 10)).toBe(true);

    // 2. User dismisses prompt
    await appReviewService.dismissReviewPrompt();

    // 3. User checks immediately or 1 day later -> suppressed by cooldown
    expect(await appReviewService.shouldPromptReview(10, 10)).toBe(false);
    expect(await appReviewService.shouldPromptReview(12, 12)).toBe(false);

    // 4. Fast forward 4 days in mock timestamp
    const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem('@salon_os_app_review_dismissed_at', fourDaysAgo.toString());

    // 5. Cooldown expired -> should prompt again
    expect(await appReviewService.shouldPromptReview(12, 12)).toBe(true);
  });

  it('openAppReview opens store link and marks as reviewed permanently', async () => {
    const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true as never);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    Platform.OS = 'android';
    await appReviewService.openAppReview();

    expect(openSpy).toHaveBeenCalledWith('market://details?id=com.stylefleet.app');
    expect(await appReviewService.hasUserReviewed()).toBe(true);

    // After rating, never prompt again even after 100 bills and 100 customers
    expect(await appReviewService.shouldPromptReview(100, 100)).toBe(false);
  });
});
