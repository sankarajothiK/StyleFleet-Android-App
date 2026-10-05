import fs from 'fs';
import path from 'path';
import { typography, fontFamilies, getFont } from '../src/theme/typography';
import { fontAssets, applyGlobalFontDefaults, areFontsLoaded } from '../src/theme/initFonts';

describe('Plus Jakarta Sans Typography System', () => {
  it('bundles all required Plus Jakarta Sans TTF font files in assets/fonts', () => {
    const fontsDir = path.resolve(__dirname, '../assets/fonts');
    const requiredFontFiles = [
      'PlusJakartaSans_400Regular.ttf',
      'PlusJakartaSans_500Medium.ttf',
      'PlusJakartaSans_600SemiBold.ttf',
      'PlusJakartaSans_700Bold.ttf',
      'PlusJakartaSans_800ExtraBold.ttf',
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
    expect(fontFamilies.regular).toBe('PlusJakartaSans-Regular');
    expect(fontFamilies.medium).toBe('PlusJakartaSans-Medium');
    expect(fontFamilies.semiBold).toBe('PlusJakartaSans-SemiBold');
    expect(fontFamilies.bold).toBe('PlusJakartaSans-Bold');
    expect(fontFamilies.extraBold).toBe('PlusJakartaSans-ExtraBold');
  });

  it('resolves the correct font and weight via getFont helper', () => {
    expect(getFont('400')).toEqual({
      fontFamily: 'PlusJakartaSans-Regular',
      fontWeight: '400',
    });
    expect(getFont('normal')).toEqual({
      fontFamily: 'PlusJakartaSans-Regular',
      fontWeight: '400',
    });
    expect(getFont('500')).toEqual({
      fontFamily: 'PlusJakartaSans-Medium',
      fontWeight: '500',
    });
    expect(getFont('600')).toEqual({
      fontFamily: 'PlusJakartaSans-SemiBold',
      fontWeight: '600',
    });
    expect(getFont('700')).toEqual({
      fontFamily: 'PlusJakartaSans-Bold',
      fontWeight: '700',
    });
    expect(getFont('bold')).toEqual({
      fontFamily: 'PlusJakartaSans-Bold',
      fontWeight: '700',
    });
    expect(getFont('800')).toEqual({
      fontFamily: 'PlusJakartaSans-ExtraBold',
      fontWeight: '800',
    });
    // Default fallback
    expect(getFont()).toEqual({
      fontFamily: 'PlusJakartaSans-Regular',
      fontWeight: '400',
    });
  });

  it('provides all semantic presets strictly using Plus Jakarta Sans', () => {
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
      expect(preset.fontFamily).toMatch(/^PlusJakartaSans/);
      expect(preset.fontSize).toBeGreaterThan(0);
      expect(preset.fontWeight).toBeDefined();
    });
  });

  it('configures asset map with both explicit and standard Expo Google Fonts keys', () => {
    expect(fontAssets['PlusJakartaSans-Regular']).toBeDefined();
    expect(fontAssets['PlusJakartaSans-Medium']).toBeDefined();
    expect(fontAssets['PlusJakartaSans-SemiBold']).toBeDefined();
    expect(fontAssets['PlusJakartaSans-Bold']).toBeDefined();
    expect(fontAssets['PlusJakartaSans-ExtraBold']).toBeDefined();

    expect(fontAssets['PlusJakartaSans_400Regular']).toBeDefined();
    expect(fontAssets['PlusJakartaSans_500Medium']).toBeDefined();
    expect(fontAssets['PlusJakartaSans_600SemiBold']).toBeDefined();
    expect(fontAssets['PlusJakartaSans_700Bold']).toBeDefined();
    expect(fontAssets['PlusJakartaSans_800ExtraBold']).toBeDefined();

    expect(fontAssets['PlusJakartaSans']).toBeDefined();
  });

  it('runs applyGlobalFontDefaults without exceptions', () => {
    expect(() => applyGlobalFontDefaults()).not.toThrow();
  });
});
