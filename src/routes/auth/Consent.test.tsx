import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import { CONSENT_VERSION } from '../../lib/consent';
import type { FamilyStatus } from '../../lib/family';
import { Consent } from './Consent';

const insert = vi.fn();
const refresh = vi.fn();
let status: FamilyStatus;

vi.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ from: () => ({ insert }) }),
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } }, status, refresh }),
}));

const c = copy.consent;

function renderConsent() {
  render(
    <MemoryRouter initialEntries={['/consent']}>
      <Routes>
        <Route path="/consent" element={<Consent />} />
        <Route path="/start" element={<p>Start page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  refresh.mockReset().mockResolvedValue(undefined);
  status = { signedIn: true, consented: false, profileId: null };
});

describe('consent', () => {
  it('names the services that help run Porto', () => {
    renderConsent();
    expect(screen.getByText(/Supabase servers in Sydney/)).toBeInTheDocument();
    expect(screen.getByText(/Sign-in emails are sent by Resend/)).toBeInTheDocument();
    expect(screen.getByText(/delivered by Netlify/)).toBeInTheDocument();
  });

  it('does not show a "what changed" note to a new family', () => {
    renderConsent();
    expect(screen.queryByText(new RegExp(c.updatedHeading))).not.toBeInTheDocument();
  });

  it('tells a returning family what changed, and records the new version', async () => {
    const user = userEvent.setup();
    status = { signedIn: true, consented: false, profileId: 'p1' };
    renderConsent();
    expect(screen.getByText(new RegExp(c.updatedHeading))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: c.submit }));
    expect(screen.getByText(c.agreeMissing)).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(c.agreeLabel));
    await user.click(screen.getByRole('button', { name: c.submit }));
    await waitFor(() => expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', version: CONSENT_VERSION }));
    expect(await screen.findByText('Start page')).toBeInTheDocument();
  });
});
