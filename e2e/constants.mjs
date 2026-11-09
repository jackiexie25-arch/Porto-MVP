/** Shared by the test stand-in for Supabase and the Playwright config. Test-only values. */

export const MINI_SUPABASE_PORT = 54329;
export const MINI_SUPABASE_URL = `http://127.0.0.1:${MINI_SUPABASE_PORT}`;
export const APP_PORT = 4173;
export const APP_URL = `http://127.0.0.1:${APP_PORT}`;

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** An unsigned JWT-shaped token. The stand-in trusts it; real Supabase never would. */
export function makeJwt(payload) {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${Buffer.from('test-only-signature').toString('base64url')}`;
}

export function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export const ANON_KEY = makeJwt({ iss: 'porto-e2e', role: 'anon', iat: 1794000000, exp: 2109600000 });
