import { cleanAmountInput } from '../src/utils/amountInput';

describe('expense amount input', () => {
  it('keeps plain numbers as typed', () => {
    expect(cleanAmountInput('1500')).toBe('1500');
    expect(cleanAmountInput('')).toBe('');
  });

  it('keeps one decimal point with at most two decimals', () => {
    expect(cleanAmountInput('99.5')).toBe('99.5');
    expect(cleanAmountInput('99.567')).toBe('99.56');
    expect(cleanAmountInput('1.2.3')).toBe('1.23');
    expect(cleanAmountInput('.')).toBe('.');
  });

  it('drops anything that is not a digit', () => {
    expect(cleanAmountInput('₹ 1,200')).toBe('1200');
    expect(cleanAmountInput('12 34')).toBe('1234');
    expect(cleanAmountInput('abc')).toBe('');
    expect(cleanAmountInput('-50')).toBe('50');
  });
});
