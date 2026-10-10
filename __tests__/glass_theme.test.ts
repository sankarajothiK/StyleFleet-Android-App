import { getGlass } from '../src/theme/glass';

const alphaOf = (rgba: string | undefined): number => {
  const m = (rgba || '').match(/rgba\([^)]*,\s*([0-9.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
};

describe('glass tokens', () => {
  for (const isDark of [true, false]) {
    const name = isDark ? 'dark' : 'light';
    it(`keeps card and pill fills translucent in ${name} mode`, () => {
      const g = getGlass(isDark);
      expect(alphaOf(g.card.backgroundColor as string)).toBeGreaterThan(0);
      expect(alphaOf(g.card.backgroundColor as string)).toBeLessThan(0.9);
      expect(alphaOf(g.pill.backgroundColor as string)).toBeLessThan(0.9);
    });

    it(`has a visible light edge in ${name} mode`, () => {
      const g = getGlass(isDark);
      expect(alphaOf(g.card.borderColor as string)).toBeGreaterThan(0.1);
    });

    it(`never uses elevation or shadow on glass cards in ${name} mode`, () => {
      const g = getGlass(isDark);
      expect((g.card as any).elevation).toBeUndefined();
      expect((g.card as any).shadowOpacity).toBeUndefined();
    });
  }
});
