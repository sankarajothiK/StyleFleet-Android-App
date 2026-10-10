import React from 'react';
import * as Font from 'expo-font';
import { Text, TextInput, StyleSheet } from 'react-native';

/**
 * Font Asset Mapping for Nunito
 * Bundled directly in assets/fonts/ to guarantee 100% offline, cross-platform
 * consistency without ever falling back to device or system font settings.
 */
export const fontAssets = {
  // Explicit semantic font names
  'Nunito-Regular': require('../../assets/fonts/Nunito_400Regular.ttf'),
  'Nunito-Medium': require('../../assets/fonts/Nunito_500Medium.ttf'),
  'Nunito-SemiBold': require('../../assets/fonts/Nunito_600SemiBold.ttf'),
  'Nunito-Bold': require('../../assets/fonts/Nunito_700Bold.ttf'),
  'Nunito-ExtraBold': require('../../assets/fonts/Nunito_800ExtraBold.ttf'),

  // Expo Google Fonts canonical names
  'Nunito_400Regular': require('../../assets/fonts/Nunito_400Regular.ttf'),
  'Nunito_500Medium': require('../../assets/fonts/Nunito_500Medium.ttf'),
  'Nunito_600SemiBold': require('../../assets/fonts/Nunito_600SemiBold.ttf'),
  'Nunito_700Bold': require('../../assets/fonts/Nunito_700Bold.ttf'),
  'Nunito_800ExtraBold': require('../../assets/fonts/Nunito_800ExtraBold.ttf'),

  // Base family name fallback
  'Nunito': require('../../assets/fonts/Nunito_400Regular.ttf'),
};

let fontsLoaded = false;

/**
 * Resolves the appropriate Nunito font family variant based on style fontWeight.
 * Guarantees that system fonts (e.g. Samsung One, Roboto, Choco) cannot override the app font.
 */
export function resolveNunitoFont(style: any): string {
  if (!style) return 'Nunito-Regular';
  const flattened = StyleSheet.flatten(style) || {};
  const weight = String(flattened.fontWeight || '400');
  if (
    flattened.fontFamily &&
    typeof flattened.fontFamily === 'string' &&
    flattened.fontFamily.startsWith('Nunito')
  ) {
    return flattened.fontFamily;
  }
  if (weight === '800' || weight === '900' || weight === 'extraBold' || weight === 'black') {
    return 'Nunito-ExtraBold';
  }
  if (weight === '700' || weight === 'bold') {
    return 'Nunito-Bold';
  }
  if (weight === '600' || weight === 'semibold') {
    return 'Nunito-SemiBold';
  }
  if (weight === '500' || weight === 'medium') {
    return 'Nunito-Medium';
  }
  return 'Nunito-Regular';
}

/**
 * Applies global default font family to React Native Text and TextInput components.
 * Monkey-patches render to permanently lock the font to Nunito regardless
 * of Android phone font settings.
 */
export function applyGlobalFontDefaults() {
  const defaultFont = 'Nunito-Regular';

  try {
    const textComp = Text as any;
    if (!textComp.defaultProps) {
      textComp.defaultProps = {};
    }
    textComp.defaultProps.maxFontSizeMultiplier = textComp.defaultProps.maxFontSizeMultiplier ?? 1.3;
    const existingTextStyle = textComp.defaultProps.style;
    textComp.defaultProps.style = Array.isArray(existingTextStyle)
      ? [{ fontFamily: defaultFont }, ...existingTextStyle]
      : existingTextStyle
      ? [{ fontFamily: defaultFont }, existingTextStyle]
      : { fontFamily: defaultFont };

    const origTextRender = textComp.render;
    if (origTextRender && !textComp.__pjsPatched) {
      textComp.__pjsPatched = true;
      textComp.render = function (...args: any[]) {
        const origin = origTextRender.apply(this, args);
        if (!origin || !React.isValidElement(origin)) return origin;
        const font = resolveNunitoFont((origin.props as any)?.style);
        return React.cloneElement(origin, {
          style: [{ fontFamily: font }, (origin.props as any)?.style, { fontFamily: font }],
        } as any);
      };
    }
  } catch (e) {
    // Graceful fallback if defaultProps/render is read-only
  }

  try {
    const textInputComp = TextInput as any;
    if (!textInputComp.defaultProps) {
      textInputComp.defaultProps = {};
    }
    textInputComp.defaultProps.maxFontSizeMultiplier = textInputComp.defaultProps.maxFontSizeMultiplier ?? 1.3;
    const existingInputStyle = textInputComp.defaultProps.style;
    textInputComp.defaultProps.style = Array.isArray(existingInputStyle)
      ? [{ fontFamily: defaultFont }, ...existingInputStyle]
      : existingInputStyle
      ? [{ fontFamily: defaultFont }, existingInputStyle]
      : { fontFamily: defaultFont };

    const origInputRender = textInputComp.render;
    if (origInputRender && !textInputComp.__pjsPatched) {
      textInputComp.__pjsPatched = true;
      textInputComp.render = function (...args: any[]) {
        const origin = origInputRender.apply(this, args);
        if (!origin || !React.isValidElement(origin)) return origin;
        const font = resolveNunitoFont((origin.props as any)?.style);
        return React.cloneElement(origin, {
          style: [{ fontFamily: font }, (origin.props as any)?.style, { fontFamily: font }],
        } as any);
      };
    }
  } catch (e) {
    // Graceful fallback
  }
}

/**
 * Loads Nunito font files synchronously during app initialization.
 */
export async function loadAppFonts(): Promise<boolean> {
  if (fontsLoaded) return true;
  try {
    await Font.loadAsync(fontAssets);
    applyGlobalFontDefaults();
    fontsLoaded = true;
    return true;
  } catch (error) {
    console.warn('Notice: Nunito font loading warning:', error);
    applyGlobalFontDefaults();
    return false;
  }
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}

// Apply defaults immediately on module evaluation
applyGlobalFontDefaults();
