import { assertSaved, friendlyDbMessage, isRemoteShop } from '../src/utils/persist';

describe('save error messages', () => {
  it('tells the owner about the internet instead of showing a raw error', () => {
    for (const raw of ['Failed to fetch', 'TypeError: Network request failed', 'timeout of 10000ms exceeded']) {
      expect(friendlyDbMessage({ message: raw }, 'the bill')).toBe(
        'No internet connection, so the bill was not saved. Please check your connection and try again.'
      );
    }
  });

  it('explains a permission problem', () => {
    expect(friendlyDbMessage({ code: '42501', message: 'x' }, 'the bill')).toBe('You do not have permission to save the bill.');
    expect(friendlyDbMessage({ message: 'new row violates row-level security policy' }, 'the bill')).toContain('permission');
  });

  it('starts a sentence with a capital letter and keeps the database reason', () => {
    expect(friendlyDbMessage({ message: 'duplicate key' }, 'the bill items')).toBe('The bill items could not be saved: duplicate key');
    expect(friendlyDbMessage({}, 'the payment')).toBe('The payment could not be saved. Please try again.');
    expect(friendlyDbMessage(null, 'the payment')).toBe('The payment could not be saved. Please try again.');
  });

  it('assertSaved throws only when there is an error', () => {
    expect(() => assertSaved({ error: null }, 'the bill')).not.toThrow();
    expect(() => assertSaved(undefined, 'the bill')).not.toThrow();
    expect(() => assertSaved({ error: { message: 'boom' } }, 'the bill')).toThrow('The bill could not be saved: boom');
  });

  it('only shops with a real database id are saved remotely', () => {
    expect(isRemoteShop('00000000-0000-4000-8000-0000000000f1')).toBe(true);
    expect(isRemoteShop('demo_shop')).toBe(false);
    expect(isRemoteShop('')).toBe(false);
  });
});
