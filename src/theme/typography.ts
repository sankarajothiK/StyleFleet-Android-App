import { TextStyle } from 'react-native';

/**
 * Salon OS Typography Tokens
 * Single source of truth: Nunito bundled typography
 */

export const fontFamilies = {
  regular: 'Nunito-Regular',
  medium: 'Nunito-Medium',
  semiBold: 'Nunito-SemiBold',
  bold: 'Nunito-Bold',
  extraBold: 'Nunito-ExtraBold',
} as const;

export type AppFontWeight =
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | 'normal'
  | 'bold';

/**
 * Resolves font family and weight token for Nunito
 */
export const getFont = (weight: AppFontWeight = '400'): { fontFamily: string; fontWeight: TextStyle['fontWeight'] } => {
  switch (weight) {
    case '500':
      return { fontFamily: fontFamilies.medium, fontWeight: '500' };
    case '600':
      return { fontFamily: fontFamilies.semiBold, fontWeight: '600' };
    case '700':
    case 'bold':
      return { fontFamily: fontFamilies.bold, fontWeight: '700' };
    case '800':
      return { fontFamily: fontFamilies.extraBold, fontWeight: '800' };
    case '400':
    case 'normal':
    default:
      return { fontFamily: fontFamilies.regular, fontWeight: '400' };
  }
};

export const typography = {
  fontFamilies,
  getFont,
  fontSizes: {
    xs: 11,
    sm: 12.5,
    base: 14,
    md: 15,
    lg: 17,
    xl: 19,
    xxl: 23,
    xxxl: 27,
    display: 35,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
  lineHeights: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6,
  },
  letterSpacings: {
    tighter: -0.5,
    tight: -0.2,
    normal: 0,
    wide: 0.5,
    uppercase: 1.1,
  },

  // Semantic Typography Presets
  presets: {
    display: {
      fontFamily: fontFamilies.bold,
      fontSize: 35,
      fontWeight: '700',
      letterSpacing: -0.5,
    } as TextStyle,
    heading1: {
      fontFamily: fontFamilies.bold,
      fontSize: 27,
      fontWeight: '700',
      letterSpacing: -0.2,
    } as TextStyle,
    heading2: {
      fontFamily: fontFamilies.bold,
      fontSize: 23,
      fontWeight: '700',
      letterSpacing: -0.2,
    } as TextStyle,
    heading3: {
      fontFamily: fontFamilies.semiBold,
      fontSize: 19,
      fontWeight: '600',
      letterSpacing: 0,
    } as TextStyle,
    cardTitle: {
      fontFamily: fontFamilies.semiBold,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: 0,
    } as TextStyle,
    body: {
      fontFamily: fontFamilies.regular,
      fontSize: 14,
      fontWeight: '400',
      letterSpacing: 0,
    } as TextStyle,
    bodyMedium: {
      fontFamily: fontFamilies.medium,
      fontSize: 14,
      fontWeight: '500',
      letterSpacing: 0,
    } as TextStyle,
    label: {
      fontFamily: fontFamilies.semiBold,
      fontSize: 12.5,
      fontWeight: '600',
      letterSpacing: 0.5,
    } as TextStyle,
    button: {
      fontFamily: fontFamilies.semiBold,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.2,
    } as TextStyle,
    caption: {
      fontFamily: fontFamilies.regular,
      fontSize: 11,
      fontWeight: '400',
      letterSpacing: 0,
    } as TextStyle,
    stat: {
      fontFamily: fontFamilies.bold,
      fontSize: 23,
      fontWeight: '700',
      letterSpacing: -0.2,
    } as TextStyle,
    badge: {
      fontFamily: fontFamilies.bold,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    } as TextStyle,
    navLabel: {
      fontFamily: fontFamilies.medium,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0,
    } as TextStyle,
    tab: {
      fontFamily: fontFamilies.semiBold,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0,
    } as TextStyle,
    input: {
      fontFamily: fontFamilies.regular,
      fontSize: 14,
      fontWeight: '400',
      letterSpacing: 0,
    } as TextStyle,
  },
};
