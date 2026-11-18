import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { FamilyStatus } from '../../lib/family';
import { AuthCallback, linkToken } from './AuthCallback';

const verifyOtp = vi.fn();
let loading: boolean;
let status: FamilyStatus;

vi.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ auth: { verifyOtp } }),
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ loading, status }),
}));

const c = copy.authCallback;

function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  render(
    <MemoryRouter>
      <AuthCallback />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  verifyOtp.mockReset();
  loading = false;
  status = { signedIn: false, consented: false, profileId: null };
});

describe('linkToken', () => {
  it('reads the token hash and type from a link on our own site', () => {
    expect(linkToken('?token_hash=abc&type=email')).toEqual({ token_hash: 'abc', type: 'email' });
    expect(linkToken('?token_hash=abc&type=signup')).toEqual({ token_hash: 'abc', type: 'signup' });
  });

  it('falls back to "email" for a missing or unexpected type', () => {
    expect(linkToken('?token_hash=abc')).toEqual({ token_hash: 'abc', type: 'email' });
    expect(linkToken('?token_hash=abc&type=recovery')).toEqual({ token_hash: 'abc', type: 'email' });
  });

  it('returns null for the older Supabase-hosted links', () => {
    expect(linkToken('')).toBeNull();
    expect(linkToken('?foo=bar')).toBeNull();
  });
});

describe('auth callback', () => {
  it('exchanges the token, strips it from the address bar and waits to sign in', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    renderAt('/auth/callback?token_hash=abc&type=email');
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' }));
    expect(window.location.search).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent(c.signingIn);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('shows the calm closed message when the token has been used or has expired', async () => {
    verifyOtp.mockResolvedValue({ error: { status: 403, message: 'Email link is invalid or has expired' } });
    renderAt('/auth/callback?token_hash=used&type=email');
    expect(await screen.findByRole('heading', { name: c.expiredHeading })).toBeInTheDocument();
  });

  it('still shows the closed message for an older link that came back with an error', () => {
    renderAt('/auth/callback#error=access_denied&error_code=otp_expired');
    expect(screen.getByRole('heading', { name: c.expiredHeading })).toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
