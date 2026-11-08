import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { ShareRow } from '../../lib/share';
import { SharePage } from './SharePage';

const listShares = vi.fn();
const createShare = vi.fn();
const revokeShare = vi.fn();

vi.mock('../../data/shares', () => ({
  listShares: () => listShares(),
  createShare: (input: unknown) => createShare(input),
  revokeShare: (id: string) => revokeShare(id),
}));

vi.mock('../../family/FamilyDataProvider', () => ({
  useFamilyData: () => ({ pendingNotes: 0 }),
}));

vi.mock('../../family/useCardModel', () => ({
  useCardModel: () => ({ model: { name: 'Ari' } }),
}));

const c = copy.share;
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';

function row(overrides: Partial<ShareRow> = {}): ShareRow {
  return {
    id: 's1',
    label: 'Camp weekend',
    worker_name: 'Jo',
    scope: 'card_search_log',
    expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
    revoked_at: null,
    first_opened_at: null,
    last_opened_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <SharePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listShares.mockReset().mockResolvedValue([]);
  createShare.mockReset().mockResolvedValue({ id: 's2', token: TOKEN, expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString() });
  revokeShare.mockReset().mockResolvedValue(undefined);
});

describe('share page', () => {
  it('needs a name for the link and keeps the other choices', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByLabelText(c.durations.days3));
    await user.click(screen.getByRole('button', { name: c.submit }));
    expect(screen.getByText(c.labelMissing)).toBeInTheDocument();
    expect(screen.getByLabelText(c.labelLabel)).toHaveFocus();
    expect(screen.getByLabelText(c.durations.days3)).toBeChecked();
    expect(createShare).not.toHaveBeenCalled();
  });

  it('defaults to this shift with card, search and notes, then shows the link and QR code once', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByLabelText(c.durations.shift)).toBeChecked();
    expect(screen.getByLabelText(c.scopes.card_search_log)).toBeChecked();

    await user.type(screen.getByLabelText(c.labelLabel), 'Camp weekend');
    await user.click(screen.getByRole('button', { name: c.submit }));

    expect(createShare).toHaveBeenCalledWith({ label: 'Camp weekend', workerName: '', hours: 8, scope: 'card_search_log' });
    expect(await screen.findByRole('heading', { name: c.readyHeading })).toHaveFocus();
    expect(screen.getByRole('img', { name: c.qrLabel })).toBeInTheDocument();
    expect(screen.getByLabelText(c.linkLabel)).toHaveValue(`${window.location.origin}/s/${TOKEN}`);
    expect(screen.getByText(c.once)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: c.done }));
    expect(screen.queryByText(TOKEN, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(new RegExp(TOKEN))).not.toBeInTheDocument();
  });

  it('copies the link', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderPage();
    await user.type(screen.getByLabelText(c.labelLabel), 'Tuesday');
    await user.click(screen.getByRole('button', { name: c.submit }));
    await user.click(await screen.findByRole('button', { name: c.copy }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/${TOKEN}`);
    expect(await screen.findByText(c.copied)).toBeInTheDocument();
  });

  it('lists links with their status and closes one in one tap', async () => {
    const user = userEvent.setup();
    listShares
      .mockResolvedValueOnce([row(), row({ id: 's0', label: 'Old link', revoked_at: new Date().toISOString() })])
      .mockResolvedValue([row({ revoked_at: new Date().toISOString() })]);
    renderPage();

    const open = (await screen.findByRole('heading', { name: 'Camp weekend' })).closest('li')!;
    expect(within(open).getByText(/^Not opened yet · Open until/)).toBeInTheDocument();
    expect(within(open).getByText(c.forWorker('Jo'))).toBeInTheDocument();
    const old = screen.getByRole('heading', { name: 'Old link' }).closest('li')!;
    expect(within(old).getByText(c.status.closed)).toBeInTheDocument();
    expect(within(old).queryByRole('button', { name: c.closeLabel('Old link') })).not.toBeInTheDocument();

    await user.click(within(open).getByRole('button', { name: c.closeLabel('Camp weekend') }));
    expect(revokeShare).toHaveBeenCalledWith('s1');
    expect(await screen.findByText(c.closed)).toBeInTheDocument();
  });

  it('shares again with a new link, filling in the old details', async () => {
    const user = userEvent.setup();
    listShares.mockResolvedValue([row({ scope: 'card', revoked_at: new Date().toISOString() })]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: c.againLabel('Camp weekend') }));
    expect(screen.getByLabelText(c.labelLabel)).toHaveValue('Camp weekend');
    expect(screen.getByLabelText(c.scopes.card)).toBeChecked();
    await user.click(screen.getByRole('button', { name: c.submit }));
    await waitFor(() => expect(createShare).toHaveBeenCalledWith(expect.objectContaining({ label: 'Camp weekend', scope: 'card' })));
  });
});
