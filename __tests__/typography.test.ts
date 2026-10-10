import fs from 'fs';
import path from 'path';
import { typography, fontFamilies, getFont } from '../src/theme/typography';
import { fontAssets, applyGlobalFontDefaults, areFontsLoaded } from '../src/theme/initFonts';

describe('Nunito Typography System', () => {
  it('bundles all required Nunito TTF font files in assets/fonts', () => {
    const fontsDir = path.resolve(__dirname, '../assets/fonts');
    const requiredFontFiles = [
      'Nunito_400Regular.ttf',
      'Nunito_500Medium.ttf',
      'Nunito_600SemiBold.ttf',
      'Nunito_700Bold.ttf',
      'Nunito_800ExtraBold.ttf',
    ];

    expect(fs.existsSync(fontsDir)).toBe(true);

    requiredFontFiles.forEach((file) => {
      const fullPath = path.join(fontsDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(50000); // verify non-empty valid font binary
    });
  });

  it('exposes centralized font family mappings for all required weights', () => {
    expect(fontFamilies.regular).toBe('Nunito-Regular');
    expect(fontFamilies.medium).toBe('Nunito-Medium');
    expect(fontFamilies.semiBold).toBe('Nunito-SemiBold');
    expect(fontFamilies.bold).toBe('Nunito-Bold');
    expect(fontFamilies.extraBold).toBe('Nunito-ExtraBold');
  });

  it('resolves the correct font and weight via getFont helper', () => {
    expect(getFont('400')).toEqual({
      fontFamily: 'Nunito-Regular',
      fontWeight: '400',
    });
    expect(getFont('normal')).toEqual({
      fontFamily: 'Nunito-Regular',
      fontWeight: '400',
    });
    expect(getFont('500')).toEqual({
      fontFamily: 'Nunito-Medium',
      fontWeight: '500',
    });
    expect(getFont('600')).toEqual({
      fontFamily: 'Nunito-SemiBold',
      fontWeight: '600',
    });
    expect(getFont('700')).toEqual({
      fontFamily: 'Nunito-Bold',
      fontWeight: '700',
    });
    expect(getFont('bold')).toEqual({
      fontFamily: 'Nunito-Bold',
      fontWeight: '700',
    });
    expect(getFont('800')).toEqual({
      fontFamily: 'Nunito-ExtraBold',
      fontWeight: '800',
    });
    // Default fallback
    expect(getFont()).toEqual({
      fontFamily: 'Nunito-Regular',
      fontWeight: '400',
    });
  });

  it('provides all semantic presets strictly using Nunito', () => {
    const { presets } = typography;
    const presetKeys = [
      'display',
      'heading1',
      'heading2',
      'heading3',
      'cardTitle',
      'body',
      'bodyMedium',
      'label',
      'button',
      'caption',
      'stat',
      'badge',
      'navLabel',
      'tab',
      'input',
    ] as const;

    presetKeys.forEach((key) => {
      const preset = presets[key];
      expect(preset).toBeDefined();
      expect(preset.fontFamily).toMatch(/^Nunito/);
      expect(preset.fontSize).toBeGreaterThan(0);
      expect(preset.fontWeight).toBeDefined();
    });
  });

  it('configures asset map with both explicit and standard Expo Google Fonts keys', () => {
    expect(fontAssets['Nunito-Regular']).toBeDefined();
    expect(fontAssets['Nunito-Medium']).toBeDefined();
    expect(fontAssets['Nunito-SemiBold']).toBeDefined();
    expect(fontAssets['Nunito-Bold']).toBeDefined();
    expect(fontAssets['Nunito-ExtraBold']).toBeDefined();

    expect(fontAssets['Nunito_400Regular']).toBeDefined();
    expect(fontAssets['Nunito_500Medium']).toBeDefined();
    expect(fontAssets['Nunito_600SemiBold']).toBeDefined();
    expect(fontAssets['Nunito_700Bold']).toBeDefined();
    expect(fontAssets['Nunito_800ExtraBold']).toBeDefined();

    expect(fontAssets['Nunito']).toBeDefined();
  });

  it('runs applyGlobalFontDefaults without exceptions', () => {
    expect(() => applyGlobalFontDefaults()).not.toThrow();
  });
});
