import { buildPalette } from '../src/theme/colors';

describe('Professional Theme System (Dark Mode + Light Mode)', () => {
  describe('1. Dark Mode (Default Theme)', () => {
    const darkPalette = buildPalette('#D4AF37', true);

    it('has correct primary & secondary background colors', () => {
      expect(darkPalette.bg).toBe('#0B1F44');
      expect(darkPalette.bgSecondary).toBe('#112A5B');
      expect(darkPalette.semantic.background.primary).toBe('#0B1F44');
      expect(darkPalette.semantic.background.secondary).toBe('#112A5B');
    });

    it('has correct card, surface, and elevated surfaces', () => {
      expect(darkPalette.card).toBe('#121B33');
      expect(darkPalette.surface).toBe('#1A2746');
      expect(darkPalette.elevated).toBe('#202D4D');
      expect(darkPalette.semantic.surface.card).toBe('#121B33');
      expect(darkPalette.semantic.surface.primary).toBe('#1A2746');
      expect(darkPalette.semantic.surface.elevated).toBe('#202D4D');
    });

    it('has correct gold accents & hover states', () => {
      expect(darkPalette.primaryGold).toBe('#D4AF37');
      expect(darkPalette.buttonGold).toBe('#D4AF37');
      expect(darkPalette.goldPressed).toBe('#E0B84A');
      expect(darkPalette.semantic.accent.primary).toBe('#D4AF37');
      expect(darkPalette.semantic.accent.hover).toBe('#E0B84A');
    });

    it('has correct text colors (primary, secondary, muted, border)', () => {
      expect(darkPalette.text).toBe('#F8FAFC');
      expect(darkPalette.textPrimary).toBe('#F8FAFC');
      expect(darkPalette.textMuted).toBe('#A7B0C3');
      expect(darkPalette.textSecondary).toBe('#A7B0C3');
      expect(darkPalette.textDim).toBe('#737D92');
      expect(darkPalette.border).toBe('#2A3858');
      expect(darkPalette.divider).toBe('#2A3858');
      expect(darkPalette.semantic.text.primary).toBe('#F8FAFC');
      expect(darkPalette.semantic.text.secondary).toBe('#A7B0C3');
      expect(darkPalette.semantic.text.muted).toBe('#737D92');
      expect(darkPalette.semantic.border.primary).toBe('#2A3858');
    });

    it('has correct status colors', () => {
      expect(darkPalette.success).toBe('#22C55E');
      expect(darkPalette.error).toBe('#EF4444');
      expect(darkPalette.warning).toBe('#F59E0B');
      expect(darkPalette.semantic.status.success).toBe('#22C55E');
      expect(darkPalette.semantic.status.error).toBe('#EF4444');
      expect(darkPalette.semantic.status.warning).toBe('#F59E0B');
    });

    it('has isDark set to true', () => {
      expect(darkPalette.isDark).toBe(true);
    });
  });

  describe('2. Light Mode (User Selectable)', () => {
    const lightPalette = buildPalette('#D4AF37', false);

    it('has correct warm cream & soft beige backgrounds', () => {
      expect(lightPalette.bg).toBe('#FAF8F3');
      expect(lightPalette.bgSecondary).toBe('#F3EADD');
      expect(lightPalette.semantic.background.primary).toBe('#FAF8F3');
      expect(lightPalette.semantic.background.secondary).toBe('#F3EADD');
    });

    it('has correct card, surface, and elevated surfaces', () => {
      expect(lightPalette.card).toBe('#FFFFFF');
      expect(lightPalette.surface).toBe('#F7F9FC');
      expect(lightPalette.elevated).toBe('#FFFFFF');
      expect(lightPalette.semantic.surface.card).toBe('#FFFFFF');
      expect(lightPalette.semantic.surface.primary).toBe('#F7F9FC');
      expect(lightPalette.semantic.surface.elevated).toBe('#FFFFFF');
    });

    it('has correct gold accents & hover states', () => {
      expect(lightPalette.primaryGold).toBe('#D4AF37');
      expect(lightPalette.buttonGold).toBe('#D4AF37');
      expect(lightPalette.goldPressed).toBe('#C89F2D');
      expect(lightPalette.semantic.accent.primary).toBe('#D4AF37');
      expect(lightPalette.semantic.accent.hover).toBe('#C89F2D');
    });

    it('inverts text properly from dark to light palette', () => {
      // Primary text must never be white in Light Mode
      expect(lightPalette.text).toBe('#1F2937');
      expect(lightPalette.textPrimary).toBe('#1F2937');
      expect(lightPalette.textMuted).toBe('#374151');
      expect(lightPalette.textSecondary).toBe('#374151');
      expect(lightPalette.textDim).toBe('#4B5563');
      expect(lightPalette.border).toBe('#E2E8F0');
      expect(lightPalette.divider).toBe('#E2E8F0');
      expect(lightPalette.semantic.text.primary).toBe('#1F2937');
      expect(lightPalette.semantic.text.secondary).toBe('#374151');
      expect(lightPalette.semantic.text.muted).toBe('#4B5563');
      expect(lightPalette.semantic.border.primary).toBe('#E2E8F0');
    });

    it('has correct light status colors', () => {
      expect(lightPalette.success).toBe('#16A34A');
      expect(lightPalette.error).toBe('#DC2626');
      expect(lightPalette.warning).toBe('#D97706');
      expect(lightPalette.semantic.status.success).toBe('#16A34A');
      expect(lightPalette.semantic.status.error).toBe('#DC2626');
      expect(lightPalette.semantic.status.warning).toBe('#D97706');
    });

    it('has isDark set to false', () => {
      expect(lightPalette.isDark).toBe(false);
    });
  });

  describe('3. Contrast Safety Verification', () => {
    it('ensures placeholder color is readable in both themes', () => {
      const dark = buildPalette('#D4AF37', true);
      const light = buildPalette('#D4AF37', false);

      expect(dark.placeholder).toBe('#737D92');
      expect(light.placeholder).toBe('#4B5563');
    });

    it('ensures trackBg differs appropriately between dark and light', () => {
      const dark = buildPalette('#D4AF37', true);
      const light = buildPalette('#D4AF37', false);

      expect(dark.trackBg).toBe('rgba(255, 255, 255, 0.08)');
      expect(light.trackBg).toBe('rgba(0, 0, 0, 0.06)');
    });
  });
});
