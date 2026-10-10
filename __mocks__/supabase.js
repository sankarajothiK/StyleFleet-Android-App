// Default Supabase client for tests: behaves like a database that cannot be reached.
// Tests must never read or write the live project. A test that needs scripted answers
// replaces this with jest.mock('../src/lib/supabase', ...) (see __tests__/helpers/fakeSupabase.ts).
const unreachable = () => ({
  data: null,
  count: null,
  error: { message: 'Network request failed (tests run without a database)' },
});

const query = () => {
  const q = {};
  [
    'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is',
    'like', 'ilike', 'or', 'and', 'not', 'order', 'limit', 'range', 'single', 'maybeSingle', 'match', 'filter',
  ].forEach((name) => {
    q[name] = () => q;
  });
  q.then = (resolve, reject) => Promise.resolve(unreachable()).then(resolve, reject);
  return q;
};

const channel = () => {
  const c = { on: () => c, subscribe: () => c, unsubscribe: () => {} };
  return c;
};

module.exports = {
  supabase: {
    from: () => query(),
    rpc: async () => unreachable(),
    functions: { invoke: async () => unreachable() },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signUp: async () => unreachable(),
      signInWithPassword: async () => unreachable(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => unreachable(),
        download: async () => unreachable(),
        remove: async () => unreachable(),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    channel,
    removeChannel: () => {},
  },
};
