/**
 * A tiny stand-in for the Supabase client for tests.
 * It records every call and answers with whatever the test scripts, so a test can make any single
 * database call fail and check what the app does next.
 */
export interface FakeCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  filters: [string, string, unknown][];
  selected?: string;
  single?: boolean;
}

export interface FakeResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export type Responder = (call: FakeCall) => FakeResult | undefined;

const uid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export function createFakeSupabase(respond: Responder = () => undefined) {
  const calls: FakeCall[] = [];

  const defaultFor = (call: FakeCall): FakeResult => {
    if (call.op === 'insert') {
      const withId = (row: unknown) => ({ id: uid(), ...(row as object) });
      const data = Array.isArray(call.payload) ? call.payload.map(withId) : withId(call.payload);
      return { data: call.single ? data : Array.isArray(data) ? data : [data], error: null };
    }
    if (call.op === 'update' || call.op === 'delete') return { data: [{ id: uid() }], error: null };
    return call.single ? { data: null, error: null } : { data: [], count: 0, error: null };
  };

  const from = (table: string) => {
    const call: FakeCall = { table, op: 'select', filters: [] };
    let recorded = false;

    const run = (): Promise<FakeResult> => {
      if (!recorded) {
        recorded = true;
        calls.push(call);
      }
      const scripted = respond(call);
      const result = { ...defaultFor(call), ...(scripted || {}) };
      // an error never carries data
      if (result.error) result.data = null;
      return Promise.resolve(result);
    };

    const builder: any = {
      select: (cols?: string) => {
        call.selected = cols ?? '*';
        return builder;
      },
      insert: (payload: unknown) => {
        call.op = 'insert';
        call.payload = payload;
        return builder;
      },
      update: (payload: unknown) => {
        call.op = 'update';
        call.payload = payload;
        return builder;
      },
      delete: () => {
        call.op = 'delete';
        return builder;
      },
      eq: (col: string, val: unknown) => (call.filters.push(['eq', col, val]), builder),
      in: (col: string, val: unknown) => (call.filters.push(['in', col, val]), builder),
      neq: (col: string, val: unknown) => (call.filters.push(['neq', col, val]), builder),
      ilike: (col: string, val: unknown) => (call.filters.push(['ilike', col, val]), builder),
      is: (col: string, val: unknown) => (call.filters.push(['is', col, val]), builder),
      order: () => builder,
      limit: () => builder,
      single: () => {
        call.single = true;
        return builder;
      },
      maybeSingle: () => {
        call.single = true;
        return builder;
      },
      then: (onFulfilled: (r: FakeResult) => unknown, onRejected?: (e: unknown) => unknown) =>
        run().then(onFulfilled, onRejected),
    };
    return builder;
  };

  const callsTo = (table: string, op?: FakeCall['op']) =>
    calls.filter((c) => c.table === table && (!op || c.op === op));

  return { from: jest.fn(from), calls, callsTo };
}
