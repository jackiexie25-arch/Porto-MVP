import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { Cue, ShiftNote } from '../../data/types';
import { ARI_CUES } from '../../demo/ari';
import { makeCue, makeMeaning, makeProfile } from '../../test/fixtures';
import { CueEditorPage } from './CueEditor';
import { CueLibrary } from './CueLibrary';

const saveCue = vi.fn();
const deleteCue = vi.fn();
const approveNote = vi.fn();
let cues: Cue[];
let notes: ShiftNote[];

vi.mock('../../family/FamilyDataProvider', () => ({
  MAX_PINNED: 5,
  useFamilyData: () => ({ cues, notes, profile: makeProfile(), saveCue, deleteCue, approveNote, pendingNotes: 0 }),
}));

function note(overrides: Partial<ShiftNote> = {}): ShiftNote {
  return {
    id: 'note-1',
    cue_id: null,
    cue_text: 'Flaps both hands',
    context_tags: ['camp'],
    context_text: '',
    tried: 'Gave him space',
    seemed_to_need: '',
    outcome: 'worked',
    worker_name: 'Jo',
    status: 'pending',
    resolved_to_cue_id: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
    shares: { label: 'Camp weekend' },
    ...overrides,
  };
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cues" element={<CueLibrary />} />
        <Route path="/cues/new" element={<CueEditorPage />} />
        <Route path="/cues/:id" element={<CueEditorPage />} />
        <Route path="/inbox" element={<p>Inbox page</p>} />
        <Route path="/card" element={<p>Card page</p>} />
      </Routes>
      <Link to="/card">Somewhere else</Link>
    </MemoryRouter>,
  );
}

const e = copy.cueEditor;
const f = copy.cueForm;
const l = copy.cues;
const region = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  cues = ARI_CUES;
  notes = [];
  approveNote.mockReset().mockResolvedValue(makeCue());
  saveCue.mockReset().mockImplementation(async (cue: { id?: string }) => makeCue({ id: cue.id }));
  deleteCue.mockReset().mockResolvedValue(undefined);
});

describe('cue library', () => {
  it('sets the card’s cues apart, in card order, then the rest A to Z', () => {
    renderAt('/cues');
    const onCard = within(region(l.onCardHeading('Ari'))).getAllByRole('heading', { level: 3 });
    expect(onCard.map((h) => h.textContent)).toEqual(
      ARI_CUES.filter((c) => c.pinned).map((c) => c.label),
    );
    const others = within(region(l.othersHeading)).getAllByRole('heading', { level: 3 });
    expect(others.map((h) => h.textContent)).toEqual([
      'Blue bottle',
      'Brings you his shoes',
      'Short, low “mm-mm”',
    ]);
    expect(screen.getByText(l.onCardCount(5, 5))).toBeInTheDocument();
  });

  it('whole rows open the cue, with a spoken name that starts with the label', () => {
    renderAt('/cues');
    expect(screen.getByRole('link', { name: l.editLabel('Cookie time') })).toHaveAttribute('href', '/cues/demo-cookie');
  });

  it('searches the family’s cues, announcing the count', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    expect(screen.getByRole('status')).toHaveTextContent(`${ARI_CUES.length} cues`);
    await user.type(screen.getByLabelText(l.searchLabel), 'cookie!');
    expect(screen.getByRole('heading', { name: /^Cookie time/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Blue bottle/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: l.othersHeading })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`Showing 1 of ${ARI_CUES.length} cues`);
  });

  it('shows each meaning with its place, and states what isn’t written yet', () => {
    cues = [makeCue({ label: 'Hums', pinned: false, cue_meanings: [makeMeaning({ context_tags: ['school'], what_to_do: '' })] })];
    renderAt('/cues');
    const row = screen.getByRole('heading', { name: /^Hums/ }).closest('li')!;
    expect(within(row).getByText('At school:')).toBeInTheDocument();
    expect(within(row).getByText(l.missingDo)).toBeInTheDocument();
  });

  it('reads cues as a worker at one place would, and says plainly when nothing is written for it', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: copy.labels.context.school }));
    const cookie = screen.getByRole('heading', { name: /^Cookie time/ }).closest('li')!;
    expect(within(cookie).getByText('I need a break')).toBeInTheDocument();
    expect(within(cookie).getByText(l.alsoFor('At home or at mealtimes'))).toBeInTheDocument();
    const shoes = screen.getByRole('heading', { name: /^Brings you his shoes/ }).closest('li')!;
    expect(within(shoes).getByText(l.notWrittenFor('at school'))).toBeInTheDocument();
  });

  it('takes a cue off the card, saving only the pin', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: l.pinRemoveLabel('Cookie time') }));
    await waitFor(() => expect(saveCue).toHaveBeenCalledTimes(1));
    const [cue, meanings] = saveCue.mock.calls[0]!;
    expect(cue).toMatchObject({ id: 'demo-cookie', label: 'Cookie time', pinned: false, aliases: ['cookie', 'cookies'] });
    expect(meanings.map((m: { id: string }) => m.id)).toEqual(ARI_CUES[1]!.cue_meanings.map((m) => m.id));
    expect(await screen.findByText(l.unpinned('Cookie time'))).toBeInTheDocument();
  });

  it('with 5 on the card, adding one asks which to swap, then swaps', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: l.pinAddLabel('Blue bottle') }));
    const dialog = screen.getByRole('dialog', { name: l.swapTitle });
    expect(saveCue).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: l.swapOption('Cookie time') }));
    await waitFor(() => expect(saveCue).toHaveBeenCalledTimes(2));
    expect(saveCue.mock.calls[0]![0]).toMatchObject({ id: 'demo-cookie', pinned: false });
    expect(saveCue.mock.calls[1]![0]).toMatchObject({ id: 'demo-bottle', pinned: true });
    expect(await screen.findByText(l.swapped('Blue bottle', 'Cookie time'))).toBeInTheDocument();
  });

  it('puts the card back if a swap can’t finish', async () => {
    const user = userEvent.setup();
    saveCue.mockImplementation(async (cue: { id?: string; pinned: boolean }) => {
      if (cue.id === 'demo-bottle') throw new Error('network');
      return makeCue({ id: cue.id });
    });
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: l.pinAddLabel('Blue bottle') }));
    await user.click(screen.getByRole('button', { name: l.swapOption('Cookie time') }));
    await waitFor(() => expect(saveCue).toHaveBeenCalledTimes(3));
    expect(saveCue.mock.calls[2]![0]).toMatchObject({ id: 'demo-cookie', pinned: true });
  });

  it('says so plainly when nothing matches, and can clear the search', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.type(screen.getByLabelText(l.searchLabel), 'giraffe');
    expect(screen.getByText(l.noMatches('giraffe'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.searchField.clearLabel }));
    expect(screen.getByLabelText(l.searchLabel)).toHaveValue('');
    expect(screen.getByLabelText(l.searchLabel)).toHaveFocus();
  });

  it('has a friendly empty state', () => {
    cues = [];
    renderAt('/cues');
    expect(screen.getByRole('heading', { name: l.emptyHeading })).toBeInTheDocument();
  });
});

describe('cue editor', () => {
  it('titles each meaning by its place, and adds another place as a focused new section', async () => {
    const user = userEvent.setup();
    cues = [];
    renderAt('/cues/new');

    await user.type(screen.getByLabelText(f.labelLabel), 'Cookie time');
    await user.type(screen.getByLabelText(new RegExp(`^${e.aliasesLabel}`)), 'cookie, Cookies, cookie');
    const first = region(e.anywhere);
    await user.click(within(first).getByRole('button', { name: copy.labels.context.home }));
    const home = region('At home');
    await user.type(within(home).getByLabelText(f.meaningLabel), 'I’m hungry');

    await user.click(screen.getByRole('button', { name: e.addMeaning }));
    const second = region(e.anywhere);
    expect(within(second).getByRole('heading', { level: 3 })).toHaveFocus();
    await user.click(within(second).getByRole('button', { name: copy.labels.context.school }));
    const school = region('At school');
    await user.type(within(school).getByLabelText(f.meaningLabel), 'I need a break');
    await user.click(within(school).getByRole('button', { name: copy.labels.confidence.sometimes }));

    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(saveCue).toHaveBeenCalledTimes(1));
    const [cue, meanings] = saveCue.mock.calls[0]!;
    expect(cue).toMatchObject({ label: 'Cookie time', aliases: ['cookie', 'Cookies'], pinned: true });
    expect(meanings).toEqual([
      expect.objectContaining({ context_tags: ['home'], meaning: 'I’m hungry', confidence: 'usually' }),
      expect.objectContaining({ context_tags: ['school'], meaning: 'I need a break', confidence: 'sometimes' }),
    ]);
    expect(await screen.findByText(l.saved)).toBeInTheDocument();
  });

  it('opens a saved cue with each meaning reading as a worker sees it, one Change away', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-cookie');
    const school = region('At school');
    expect(within(school).getByText('I need a break')).toBeInTheDocument();
    expect(within(school).queryByLabelText(f.meaningLabel)).not.toBeInTheDocument();
    await user.click(within(school).getByRole('button', { name: e.changeLabel('At school') }));
    await user.clear(within(region('At school')).getByLabelText(f.meaningLabel));
    await user.type(within(region('At school')).getByLabelText(f.meaningLabel), 'I need a quiet minute');
    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(saveCue).toHaveBeenCalled());
    const [, meanings] = saveCue.mock.calls[0]!;
    expect(meanings[1]).toMatchObject({ id: ARI_CUES[1]!.cue_meanings[1]!.id, meaning: 'I need a quiet minute' });
  });

  it('"Anywhere" clears the place', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-shoes');
    await user.click(screen.getByRole('button', { name: e.changeLabel('At home') }));
    await user.click(within(region('At home')).getByRole('button', { name: e.anywhere }));
    expect(region(e.anywhere)).toBeInTheDocument();
  });

  it('points to every missing piece, opening the meanings that need it, and keeps what was typed', async () => {
    const user = userEvent.setup();
    renderAt('/cues/new');
    await user.click(screen.getByRole('button', { name: e.addMeaning }));
    const [, second] = screen.getAllByRole('region', { name: e.anywhere });
    await user.type(within(second!).getByLabelText(f.todoLabel), 'Offer the quiet corner');
    await user.click(within(second!).getByRole('button', { name: e.doneLabel(e.anywhere) }));
    await user.click(screen.getByRole('button', { name: e.save }));

    expect(screen.getByText(f.labelMissing)).toBeInTheDocument();
    expect(screen.getAllByText(f.meaningMissing)).toHaveLength(2);
    expect(screen.getByLabelText(f.labelLabel)).toHaveFocus();
    expect(screen.getAllByLabelText(f.todoLabel)[1]).toHaveValue('Offer the quiet corner');
    expect(saveCue).not.toHaveBeenCalled();
  });

  it('removes a meaning, keeping the other’s id so it updates in place', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-cookie');
    await user.click(screen.getByRole('button', { name: e.changeLabel('At school') }));
    await user.click(screen.getByRole('button', { name: e.removeMeaningLabel('At school') }));
    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(saveCue).toHaveBeenCalled());
    const [cue, meanings] = saveCue.mock.calls[0]!;
    expect(cue.id).toBe('demo-cookie');
    expect(meanings).toHaveLength(1);
    expect(meanings[0].id).toBe(ARI_CUES[1]!.cue_meanings[0]!.id);
  });

  it('leaves straight away when nothing has changed', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-cookie');
    await user.click(screen.getByRole('link', { name: 'Somewhere else' }));
    expect(await screen.findByText('Card page')).toBeInTheDocument();
  });

  it('holds a link while something is unsaved', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-cookie');
    await user.type(screen.getByLabelText(f.labelLabel), '!');
    await user.click(screen.getByRole('link', { name: 'Somewhere else' }));
    const dialog = screen.getByRole('dialog', { name: e.leaveTitle });
    await user.click(within(dialog).getByRole('button', { name: e.leaveStay }));
    expect(screen.getByLabelText(f.labelLabel)).toHaveValue('Cookie time!');
    await user.click(screen.getByRole('link', { name: 'Somewhere else' }));
    await user.click(screen.getByRole('button', { name: e.leaveGo }));
    expect(await screen.findByText('Card page')).toBeInTheDocument();
  });

  it('asks before deleting, then deletes', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-wave');
    await user.click(screen.getByRole('button', { name: e.delete }));
    const dialog = screen.getByRole('dialog', { name: e.deleteTitle('Flat-hand wave near his face') });
    expect(deleteCue).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: e.deleteConfirm }));
    await waitFor(() => expect(deleteCue).toHaveBeenCalledWith('demo-wave'));
  });

  it('explains when the card already has 5 cues', async () => {
    const user = userEvent.setup();
    saveCue.mockRejectedValue({ message: 'pin_limit' });
    renderAt('/cues/demo-shoes');
    await user.click(screen.getByLabelText(e.pinLabel('Ari')));
    await user.click(screen.getByRole('button', { name: e.save }));
    expect(await screen.findByText(copy.errors.pinLimit)).toBeInTheDocument();
  });

  it('says so when a cue no longer exists', () => {
    renderAt('/cues/not-a-cue');
    expect(screen.getByText(e.notFound)).toBeInTheDocument();
  });
});

describe('confirming a worker’s note', () => {
  it('prefills a new cue from the note and asks for the missing meaning', async () => {
    const user = userEvent.setup();
    notes = [note()];
    renderAt('/cues/new?note=note-1');
    expect(screen.getByText(/From a worker’s note/)).toHaveTextContent(copy.inbox.needsMeaning);
    expect(screen.getByLabelText(f.labelLabel)).toHaveValue('Flaps both hands');
    const meaning = region('At camp');
    expect(within(meaning).getByLabelText(f.todoLabel)).toHaveValue('Gave him space');
    expect(within(meaning).getByRole('button', { name: copy.labels.context.camp })).toHaveAttribute('aria-pressed', 'true');

    await user.type(within(meaning).getByLabelText(f.meaningLabel), 'I’m excited');
    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(approveNote).toHaveBeenCalledTimes(1));
    expect(approveNote.mock.calls[0]![0]).toBe('note-1');
    expect(approveNote.mock.calls[0]![2]).toEqual([
      expect.objectContaining({ meaning: 'I’m excited', what_to_do: 'Gave him space', confidence: 'sometimes' }),
    ]);
    expect(saveCue).not.toHaveBeenCalled();
    expect(await screen.findByText('Inbox page')).toBeInTheDocument();
  });

  it('adds the note as another meaning on an existing cue, open, and hides delete', () => {
    notes = [note({ cue_id: 'demo-cookie', seemed_to_need: 'A drink', outcome: 'no', tried: 'Offered a biscuit' })];
    renderAt('/cues/demo-cookie?note=note-1');
    const camp = region('At camp');
    expect(within(camp).getByLabelText(f.meaningLabel)).toHaveValue('A drink');
    expect(within(camp).getByLabelText(/^What to avoid/)).toHaveValue('Offered a biscuit');
    expect(within(region('At school')).queryByLabelText(f.meaningLabel)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: e.delete })).not.toBeInTheDocument();
  });

  it('ignores a note that has already been dealt with', () => {
    notes = [note({ status: 'approved' })];
    renderAt('/cues/new?note=note-1');
    expect(screen.getByLabelText(f.labelLabel)).toHaveValue('');
  });
});
