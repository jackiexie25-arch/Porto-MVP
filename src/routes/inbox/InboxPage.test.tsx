import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { ShiftNote } from '../../data/types';
import { ARI_CUES } from '../../demo/ari';
import { makeCue } from '../../test/fixtures';
import { InboxPage } from './InboxPage';

const approveNote = vi.fn();
const dismissNote = vi.fn();
let notes: ShiftNote[];

vi.mock('../../family/FamilyDataProvider', () => ({
  useFamilyData: () => ({
    notes,
    cues: ARI_CUES,
    approveNote,
    dismissNote,
    pendingNotes: notes.filter((n) => n.status === 'pending').length,
  }),
}));

const c = copy.inbox;

function note(overrides: Partial<ShiftNote> = {}): ShiftNote {
  return {
    id: 'n1',
    cue_id: 'demo-cookie',
    cue_text: '',
    context_tags: ['camp'],
    context_text: '',
    tried: 'Gave him his water bottle',
    seemed_to_need: 'A drink after swimming',
    outcome: 'worked',
    worker_name: 'Jo',
    status: 'pending',
    resolved_to_cue_id: null,
    created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    resolved_at: null,
    shares: { label: 'Camp weekend' },
    ...overrides,
  };
}

function Where() {
  const l = useLocation();
  return <p data-testid="path">{l.pathname + l.search}</p>;
}

function renderInbox() {
  render(
    <MemoryRouter initialEntries={['/inbox']}>
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/cues/*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  approveNote.mockReset().mockResolvedValue(makeCue());
  dismissNote.mockReset().mockResolvedValue(undefined);
});

describe('inbox', () => {
  it('shows each note with what happened, where, what they tried, whether it helped, who and when', () => {
    notes = [note()];
    renderInbox();
    const card = screen.getByRole('heading', { name: 'Cookie time' }).closest('li')!;
    expect(within(card).getByText('At camp')).toBeInTheDocument();
    expect(within(card).getByText('A drink after swimming')).toBeInTheDocument();
    expect(within(card).getByText('Gave him his water bottle')).toBeInTheDocument();
    expect(within(card).getByText('Yes')).toBeInTheDocument();
    expect(within(card).getByText(/^From Jo, 10 minutes ago · Camp weekend$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: c.pendingHeading(1) })).toBeInTheDocument();
  });

  it('adds a complete note to its cue in one tap, as a new meaning', async () => {
    const user = userEvent.setup();
    notes = [note()];
    renderInbox();
    await user.click(screen.getByRole('button', { name: c.addLabel('Cookie time') }));
    await waitFor(() => expect(approveNote).toHaveBeenCalledTimes(1));
    const [noteId, cue, meanings] = approveNote.mock.calls[0]!;
    expect(noteId).toBe('n1');
    expect(cue.id).toBe('demo-cookie');
    expect(meanings).toHaveLength(3);
    expect(meanings[2]).toMatchObject({
      context_tags: ['camp'],
      meaning: 'A drink after swimming',
      what_to_do: 'Gave him his water bottle',
      confidence: 'sometimes',
    });
    expect(await screen.findByText(c.added)).toBeInTheDocument();
  });

  it('sends a note about something new to a prefilled form to confirm', async () => {
    const user = userEvent.setup();
    notes = [note({ cue_id: null, cue_text: 'Flaps both hands', seemed_to_need: '' })];
    renderInbox();
    await user.click(screen.getByRole('button', { name: c.addLabel('Flaps both hands') }));
    expect(screen.getByTestId('path')).toHaveTextContent('/cues/new?note=n1');
    expect(approveNote).not.toHaveBeenCalled();
  });

  it('can edit a note before adding it', async () => {
    const user = userEvent.setup();
    notes = [note()];
    renderInbox();
    await user.click(screen.getByRole('button', { name: c.editLabel('Cookie time') }));
    expect(screen.getByTestId('path')).toHaveTextContent('/cues/demo-cookie?note=n1');
  });

  it('sets a note aside with Not now, and keeps it viewable', async () => {
    const user = userEvent.setup();
    notes = [note(), note({ id: 'n2', status: 'dismissed', cue_text: 'Hummed', cue_id: null })];
    renderInbox();
    await user.click(screen.getByRole('button', { name: c.dismissLabel('Cookie time') }));
    expect(dismissNote).toHaveBeenCalledWith('n1');
    expect(await screen.findByText(c.dismissed)).toBeInTheDocument();
    expect(screen.getByText(c.dismissedHeading(1))).toBeInTheDocument();
  });

  it('says so calmly when there is nothing new', () => {
    notes = [];
    renderInbox();
    expect(screen.getByText(c.empty)).toBeInTheDocument();
  });
});
