import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import { makeProfile } from '../../test/fixtures';
import { AccountPage } from './AccountPage';

const deleteAccount = vi.fn();
const signOut = vi.fn();

vi.mock('../../data/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/account')>()),
  deleteAccount: (confirm: string) => deleteAccount(confirm),
  buildExport: vi.fn(),
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { email: 'parent@example.com' } }, signOut }),
}));

vi.mock('../../family/FamilyDataProvider', () => ({
  useFamilyData: () => ({
    profile: makeProfile({ display_name: 'Ari' }),
    sections: [],
    cues: [],
    saveProfile: vi.fn().mockResolvedValue(undefined),
    pendingNotes: 0,
  }),
}));

const c = copy.account;

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/deleted" element={<p>Deleted page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  deleteAccount.mockReset().mockResolvedValue(undefined);
  signOut.mockReset().mockResolvedValue(undefined);
});

describe('account page', () => {
  it('shows who is signed in, the settings, download and delete', () => {
    renderPage();
    expect(screen.getByText(c.signedInAs('parent@example.com'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: c.aboutHeading('Ari') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.downloadJson })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: c.printLink })).toHaveAttribute('href', '/card/print');
  });

  it('only deletes once the child’s name is typed, then shows the deleted page', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: c.deleteOpen }));
    const dialog = screen.getByRole('dialog', { name: c.deleteTitle });

    await user.type(within(dialog).getByLabelText(c.confirmLabel('Ari')), 'Ar');
    await user.click(within(dialog).getByRole('button', { name: c.deleteConfirm }));
    expect(within(dialog).getByText(c.confirmMismatch('Ari'))).toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(c.confirmLabel('Ari')), 'i');
    await user.click(within(dialog).getByRole('button', { name: c.deleteConfirm }));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('Ari'));
    expect(await screen.findByText('Deleted page')).toBeInTheDocument();
  });

  it('can be backed out of', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: c.deleteOpen }));
    await user.click(screen.getByRole('button', { name: c.keep }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
