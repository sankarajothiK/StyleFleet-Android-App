/**
 * Salon OS Design System Color Tokens & Themes
 * Supports Dark Mode (Default) and Light Mode (User Selectable)
 * Source of truth: AGENTS.md, DESIGN_SYSTEM.md, and Production Theme Specification
 */

export const DEFAULT_ACCENT = '#D4AF37';

export const ACCENT_SWATCHES = [
  '#D4AF37',
  '#E0C068',
  '#B8863B',
  '#8C6239',
] as const;

export type AccentColor = (typeof ACCENT_SWATCHES)[number] | string;

export interface SemanticTokens {
  background: {
    primary: string;
    secondary: string;
  };
  surface: {
    primary: string;
    card: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    subtle: string;
  };
  border: {
    primary: string;
  };
  accent: {
    primary: string;
    hover: string;
  };
  status: {
    success: string;
    error: string;
    warning: string;
  };
}

export interface ColorPalette {
  // Flat properties for full backward and forward compatibility
  bg: string;
  bgSecondary: string;
  surface: string;
  card: string;
  elevated: string;
  divider: string;
  border: string;
  text: string;
  textPrimary: string;
  textMuted: string;
  textSecondary: string;
  textDim: string;
  textSubtle: string;
  placeholder: string;
  trackBg: string;

  accent: string;
  primaryGold: string;
  buttonGold: string;
  goldPressed: string;

  accent100: string;
  accent200: string;
  accent300: string;
  accent600: string;
  accent700: string;
  accent800: string;
  accent900: string;

  neutral200: string;
  neutral400: string;
  neutral600: string;
  neutral700: string;
  neutral800: string;
  neutral900: string;

  error: string;
  success: string;
  warning: string;

  isDark: boolean;

  // Semantic groups
  semantic: SemanticTokens;
  tokens: SemanticTokens;
}

/**
 * Mix two hex colors by percentage (0 to 1)
 */
function mixColors(color1: string, color2: string, weight: number): string {
  const c1 = color1.replace('#', '');
  const c2 = color2.replace('#', '');

  const r1 = parseInt(c1.substring(0, 2), 16);
  const g1 = parseInt(c1.substring(2, 4), 16);
  const b1 = parseInt(c1.substring(4, 6), 16);

  const r2 = parseInt(c2.substring(0, 2), 16);
  const g2 = parseInt(c2.substring(2, 4), 16);
  const b2 = parseInt(c2.substring(4, 6), 16);

  const r = Math.round(r1 * weight + r2 * (1 - weight));
  const g = Math.round(g1 * weight + g2 * (1 - weight));
  const b = Math.round(b1 * weight + b2 * (1 - weight));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Build ColorPalette for Dark Mode or Light Mode
 */
export function buildPalette(
  accent: string = DEFAULT_ACCENT,
  isDark: boolean = true
): ColorPalette {
  const normAccent = accent.startsWith('#') ? accent : `#${accent}`;

  if (isDark) {
    // ----------------------------------------------------
    // 🌙 DARK MODE (DEFAULT PALETTE)
    // ----------------------------------------------------
    const bg = '#0B1F44'; // Deep Navy Blue
    const bgSecondary = '#112A5B'; // Deep Royal Blue
    const card = '#121B33';
    const surface = '#1A2746';
    const elevated = '#202D4D';
    const border = '#2A3858';
    const primaryGold = '#D4AF37';
    const buttonGold = '#D4AF37';
    const goldPressed = '#E0B84A';
    const textPrimary = '#F8FAFC';
    const textSecondary = '#A7B0C3';
    const textDim = '#737D92';
    const textSubtle = 'rgba(248, 250, 252, 0.38)';
    const placeholder = '#737D92';
    const trackBg = 'rgba(255, 255, 255, 0.08)';
    const success = '#22C55E';
    const error = '#EF4444';
    const warning = '#F59E0B';

    const semantic: SemanticTokens = {
      background: {
        primary: bg,
        secondary: bgSecondary,
      },
      surface: {
        primary: surface,
        card: card,
        elevated: elevated,
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
        muted: textDim,
        subtle: textSubtle,
      },
      border: {
        primary: border,
      },
      accent: {
        primary: primaryGold,
        hover: goldPressed,
      },
      status: {
        success,
        error,
        warning,
      },
    };

    return {
      bg,
      bgSecondary,
      surface,
      card,
      elevated,
      divider: border,
      border,
      text: textPrimary,
      textPrimary,
      textMuted: textSecondary,
      textSecondary,
      textDim,
      textSubtle,
      placeholder,
      trackBg,
      accent: normAccent,
      primaryGold,
      buttonGold,
      goldPressed,
      // Accent tints mixed with #F6F5FF
      accent100: mixColors(normAccent, '#F6F5FF', 0.22),
      accent200: mixColors(normAccent, '#F6F5FF', 0.45),
      accent300: mixColors(normAccent, '#F6F5FF', 0.72),
      // Accent shades mixed with dark background
      accent600: mixColors(normAccent, bg, 0.80),
      accent700: mixColors(normAccent, bg, 0.62),
      accent800: mixColors(normAccent, bg, 0.38),
      accent900: mixColors(normAccent, bg, 0.20),
      // Neutrals
      neutral200: '#E2E8F0',
      neutral400: '#94A3B8',
      neutral600: '#475569',
      neutral700: '#334155',
      neutral800: '#1E293B',
      neutral900: '#0F172A',
      error,
      success,
      warning,
      isDark: true,
      semantic,
      tokens: semantic,
    };
  }

  // ----------------------------------------------------
  // ☀️ LIGHT MODE (PREMIUM CREAM & WHITE PALETTE)
  // ----------------------------------------------------
  const bg = '#FAF8F3'; // Warm Cream White
  const bgSecondary = '#F3EADD'; // Soft Beige
  const card = '#FFFFFF';
  const surface = '#F7F9FC';
  const elevated = '#FFFFFF';
  const border = '#E2E8F0';
  const primaryGold = '#D4AF37';
  const buttonGold = '#D4AF37';
  const goldPressed = '#C89F2D';
  const textPrimary = '#1F2937'; // Dark Charcoal Black
  const textSecondary = '#374151'; // Dark Charcoal Slate (high intensity & readable)
  const textMuted = '#374151'; // Dark Slate (visible and crisp)
  const textDim = '#4B5563'; // Dark Slate (clearly visible, no washed out grey)
  const textSubtle = '#4B5563'; // Solid Dark Slate
  const placeholder = '#4B5563'; // Clearly visible dark placeholder
  const trackBg = 'rgba(0, 0, 0, 0.06)';
  const success = '#16A34A';
  const error = '#DC2626';
  const warning = '#D97706';

  const semantic: SemanticTokens = {
    background: {
      primary: bg,
      secondary: bgSecondary,
    },
    surface: {
      primary: surface,
      card: card,
      elevated: elevated,
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
      muted: textDim,
      subtle: textSubtle,
    },
    border: {
      primary: border,
    },
    accent: {
      primary: primaryGold,
      hover: goldPressed,
    },
    status: {
      success,
      error,
      warning,
    },
  };

  return {
    bg,
    bgSecondary,
    surface,
    card,
    elevated,
    divider: border,
    border,
    text: textPrimary,
    textPrimary,
    textMuted,
    textSecondary,
    textDim,
    textSubtle,
    placeholder,
    trackBg,
    accent: normAccent,
    primaryGold,
    buttonGold,
    goldPressed,
    // Contrast-aware tints and shades for Light Mode
    accent100: '#5B2500', // Rich dark amber for high contrast text on gold
    accent200: '#78350F',
    accent300: '#92400E',
    accent600: '#D97706',
    accent700: '#F59E0B',
    accent800: '#FEF3C7', // Soft warm gold chip / badge container
    accent900: '#FDE68A', // Warm golden highlight surface
    // Neutrals (Dark & High-Intensity in Light Mode)
    neutral200: '#1F2937',
    neutral400: '#374151',
    neutral600: '#4B5563',
    neutral700: '#6B7280',
    neutral800: '#E2E8F0',
    neutral900: '#F1F5F9',
    error,
    success,
    warning,
    isDark: false,
    semantic,
    tokens: semantic,
  };
}
