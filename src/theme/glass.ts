import { ViewStyle } from 'react-native';

/**
 * Glassmorphism surface tokens.
 * Translucent fill + light edge, meant to sit over GlassBackdrop's soft colour glows.
 * No elevation on purpose: Android elevation paints an opaque shadow through translucent fills.
 */
export interface GlassTokens {
  /** Cards and panels */
  card: ViewStyle;
  /** Small round buttons and pills (fill only, caller keeps its own border) */
  pill: ViewStyle;
  /** Spatial depth: a surface that floats above the page (lit top edge, dark bottom edge, soft shadow) */
  raised: ViewStyle;
  /** Spatial depth: a pressed-in surface for inputs, switches and segmented controls */
  inset: ViewStyle;
  /** Colour of the glows behind the glass */
  glowGold: string;
  glowBlue: string;
}

export function getGlass(isDark: boolean): GlassTokens {
  if (isDark) {
    return {
      card: {
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderColor: 'rgba(255, 255, 255, 0.16)',
      },
      pill: { backgroundColor: 'rgba(255, 255, 255, 0.09)' },
      raised: {
        backgroundColor: 'rgba(255, 255, 255, 0.09)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderTopColor: 'rgba(255, 255, 255, 0.34)',
        borderBottomColor: 'rgba(0, 0, 0, 0.28)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      inset: {
        backgroundColor: 'rgba(0, 0, 0, 0.28)',
        borderColor: 'rgba(255, 255, 255, 0.07)',
        borderTopColor: 'rgba(0, 0, 0, 0.55)',
      },
      glowGold: '#D4AF37',
      glowBlue: '#4F7CFF',
    };
  }
  return {
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.62)',
      borderColor: 'rgba(255, 255, 255, 0.95)',
    },
    pill: { backgroundColor: 'rgba(255, 255, 255, 0.7)' },
    raised: {
      backgroundColor: 'rgba(255, 255, 255, 0.78)',
      borderColor: 'rgba(255, 255, 255, 0.9)',
      borderTopColor: '#FFFFFF',
      borderBottomColor: 'rgba(15, 23, 42, 0.08)',
      shadowColor: '#6B7A99',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
    },
    inset: {
      backgroundColor: 'rgba(15, 23, 42, 0.06)',
      borderColor: 'rgba(255, 255, 255, 0.85)',
      borderTopColor: 'rgba(15, 23, 42, 0.14)',
    },
    glowGold: '#E8C766',
    glowBlue: '#9DB7FF',
  };
}
