import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import { SignUp } from './SignUp';

const rpc = vi.fn();
const signInWithOtp = vi.fn();

vi.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ rpc, auth: { signInWithOtp } }),
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ loading: false, status: { signedIn: false, consented: false, profileId: null } }),
}));

function renderSignUp() {
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/check-email" element={<p>Check email page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const c = copy.signUp;

beforeEach(() => {
  rpc.mockReset();
  signInWithOtp.mockReset();
});

describe('SignUp', () => {
  it('asks for missing details, focuses the first one and sends nothing', async () => {
    const user = userEvent.setup();
    renderSignUp();
    await user.click(screen.getByRole('button', { name: c.submit }));
    expect(screen.getByText(c.emailMissing)).toBeInTheDocument();
    expect(screen.getByText(c.codeMissing)).toBeInTheDocument();
    expect(screen.getByLabelText(c.emailLabel)).toHaveFocus();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps what was typed when the invite code is not valid', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: false, error: null });
    renderSignUp();
    await user.type(screen.getByLabelText(c.emailLabel), 'parent@example.com');
    await user.type(screen.getByLabelText(c.codeLabel), 'wrong code');
    await user.click(screen.getByRole('button', { name: c.submit }));

    expect(await screen.findByText(copy.errors.inviteCode)).toBeInTheDocument();
    expect(screen.getByLabelText(c.emailLabel)).toHaveValue('parent@example.com');
    expect(screen.getByLabelText(c.codeLabel)).toHaveValue('wrong code');
    expect(rpc).toHaveBeenCalledWith('check_invite_code', { p_code: 'WRONGCODE' });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends a magic link carrying the normalised invite code', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: true, error: null });
    signInWithOtp.mockResolvedValue({ error: null });
    renderSignUp();
    await user.type(screen.getByLabelText(c.emailLabel), ' parent@example.com ');
    await user.type(screen.getByLabelText(c.codeLabel), 'porto-7kqm-x4td');
    await user.click(screen.getByRole('button', { name: c.submit }));

    expect(await screen.findByText('Check email page')).toBeInTheDocument();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      options: expect.objectContaining({
        shouldCreateUser: true,
        data: { invite_code: 'PORTO-7KQM-X4TD' },
        emailRedirectTo: expect.stringMatching(/\/auth\/callback$/),
      }),
    });
  });

  it('shows a calm message when Supabase is busy', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: true, error: null });
    signInWithOtp.mockResolvedValue({ error: { status: 429, message: 'Email rate limit exceeded' } });
    renderSignUp();
    await user.type(screen.getByLabelText(c.emailLabel), 'parent@example.com');
    await user.type(screen.getByLabelText(c.codeLabel), 'PORTO-7KQM-X4TD');
    await user.click(screen.getByRole('button', { name: c.submit }));
    expect(await screen.findByText(copy.common.tryAgainSoon)).toBeInTheDocument();
  });
});
