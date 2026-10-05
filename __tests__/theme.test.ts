import { buildPalette, DEFAULT_ACCENT, ACCENT_SWATCHES } from '../src/theme/colors';

describe('Theme and Accent Color Calculations', () => {
  it('generates the default Dark Mode palette matching design system', () => {
    const palette = buildPalette(DEFAULT_ACCENT, true);

    expect(palette.bg).toBe('#0B1F44');
    expect(palette.surface).toBe('#1A2746');
    expect(palette.divider).toBe('#2A3858');
    expect(palette.textPrimary).toBe('#F8FAFC');
    expect(palette.accent.toUpperCase()).toBe('#D4AF37');
    expect(palette.accent100).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(palette.accent800).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(palette.isDark).toBe(true);
  });

  it('generates the Light Mode palette with high contrast', () => {
    const palette = buildPalette(DEFAULT_ACCENT, false);

    expect(palette.bg).toBe('#FAF8F3');
    expect(palette.surface).toBe('#F7F9FC');
    expect(palette.textPrimary).toBe('#1F2937');
    expect(palette.isDark).toBe(false);
  });

  it('generates customized palettes for all prototype accent swatches', () => {
    ACCENT_SWATCHES.forEach((swatch) => {
      const palette = buildPalette(swatch);
      expect(palette.accent.toUpperCase()).toBe(swatch.toUpperCase());
      expect(palette.accent100).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent200).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent700).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent800).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent900).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
