import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/config', () => ({
  config: { supabaseUrl: 'https://test-ref.supabase.co', supabaseAnonKey: 'anon-key-for-tests-only', privacyContactEmail: '' },
  isSupabaseConfigured: true,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('worker api', () => {
  it('calls the worker functions anonymously, with no cookies, cache or referrer', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: 'closed' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { shareSource } = await import('./api');

    await expect(shareSource('TOKEN').getCard()).resolves.toEqual({ status: 'closed' });
    await shareSource('TOKEN').search('cookie', 'school');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://test-ref.supabase.co/rest/v1/rpc/worker_get_card');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(JSON.parse(init.body)).toEqual({ p_token: 'TOKEN' });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ p_token: 'TOKEN', p_query: 'cookie', p_context: 'school' });
  });

  it('turns a server error into an error the page can explain', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    const { shareSource } = await import('./api');
    await expect(shareSource('TOKEN').getCard()).rejects.toMatchObject({ status: 503 });
  });
});
