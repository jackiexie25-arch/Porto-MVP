import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function tree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cues" element={<CueLibrary />} />
        <Route path="/cues/new" element={<CueEditorPage />} />
        <Route path="/cues/:id" element={<CueEditorPage />} />
        <Route path="/inbox" element={<p>Inbox page</p>} />
        <Route path="/card" element={<p>Card page</p>} />
      </Routes>
      <Link to="/card">Somewhere else</Link>
    </MemoryRouter>
  );
}

function renderAt(path: string) {
  return render(tree(path));
}

const e = copy.cueEditor;
const f = copy.cueForm;
const l = copy.cues;
const region = (name: string | RegExp) => screen.getByRole('region', { name });
/** A closed meaning is named by its place line, "At school · usually". */
const closed = (place: string) => region(new RegExp('^' + place + ' · '));

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
    const onCard = within(region(new RegExp('^' + l.onCardHeading('Ari')))).getAllByRole('heading', { level: 3 });
    expect(onCard.map((h) => h.textContent)).toEqual(
      ARI_CUES.filter((c) => c.pinned).map((c) => c.label),
    );
    const others = within(region(new RegExp('^' + l.othersHeading))).getAllByRole('heading', { level: 3 });
    expect(others.map((h) => h.textContent)).toEqual([
      'Blue bottle',
      'Brings you his shoes',
      'Short, low “mm-mm”',
    ]);
    expect(screen.getAllByText(l.onCardCount(5, 5)).length).toBeGreaterThan(0);
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
    expect(screen.queryByRole('region', { name: new RegExp('^' + l.othersHeading) })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`Showing 1 of ${ARI_CUES.length} cues`);
  });

  it('shows each meaning with its place first, and states plainly what isn’t written yet', () => {
    cues = [makeCue({ label: 'Hums', pinned: false, cue_meanings: [makeMeaning({ context_tags: ['school'], what_to_do: '' })] })];
    renderAt('/cues');
    const row = screen.getByRole('heading', { name: /^Hums/ }).closest('li')!;
    expect(within(row).getByText('At school · usually')).toBeInTheDocument();
    expect(within(row).getByText(l.missingDo)).toBeInTheDocument();
    expect(within(row).getByText(l.notWrittenFor('home, camp or out and about'))).toBeInTheDocument();
  });

  it('says nothing is missing when a meaning holds anywhere', () => {
    renderAt('/cues');
    const wave = screen.getByRole('heading', { name: /^Flat-hand wave/ }).closest('li')!;
    expect(within(wave).queryByText(/^Not written for/)).not.toBeInTheDocument();
  });

  it('links each meaning line straight to that meaning in the editor', () => {
    renderAt('/cues');
    const school = ARI_CUES[1]!.cue_meanings[1]!;
    expect(screen.getByRole('link', { name: /^At school · usually I need a break/ })).toHaveAttribute(
      'href',
      `/cues/demo-cookie#meaning-${school.id}`,
    );
  });

  it('with a place chosen, lists what isn’t written there first, each with a way to add it', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: copy.labels.context.camp }));
    const gaps = region(new RegExp('^' + l.gapsHeading('at camp')));
    const names = within(gaps).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Cookie time', 'Brings you his shoes']);
    expect(within(gaps).getByRole('link', { name: l.addForLabel('at camp', 'Cookie time') })).toHaveAttribute(
      'href',
      '/cues/demo-cookie?add=camp',
    );
    // Cues written for anywhere are written for camp too.
    const written = region(new RegExp('^' + l.writtenHeading('at camp')));
    expect(within(written).getByRole('heading', { name: /^Blue bottle/ })).toBeInTheDocument();
  });

  it('with a place chosen, a written cue leads with the meaning for there', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: copy.labels.context.school }));
    const cookie = screen.getByRole('heading', { name: /^Cookie time/ }).closest('li')!;
    expect(within(cookie).getByText('I need a break')).toBeInTheDocument();
    expect(within(cookie).queryByText('I’m hungry')).not.toBeInTheDocument();
    expect(within(cookie).getByText(l.alsoFor('At home or at mealtimes'))).toBeInTheDocument();
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
    await user.click(within(dialog).getByRole('button', { name: /^Cookie time/ }));
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
    await user.click(screen.getByRole('button', { name: /^Cookie time/ }));
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

    await user.type(screen.getByLabelText(e.seeHearQuestion), 'Cookie time');
    await user.type(screen.getByLabelText(new RegExp(`^${e.aliasesLabel}`)), 'cookie, Cookies, cookie');
    // The interview asks where first: no place heading, no meaning fields yet.
    const first = region(e.placeLegend);
    expect(within(first).queryByLabelText(f.meaningLabel)).not.toBeInTheDocument();
    expect(within(first).getByRole('button', { name: e.anywhere })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: e.addMeaning })).not.toBeInTheDocument();
    await user.click(within(first).getByRole('button', { name: copy.labels.context.home }));
    const home = region('At home');
    await user.type(within(home).getByLabelText(f.meaningLabel), 'I’m hungry');

    await user.click(screen.getByRole('button', { name: e.addMeaning }));
    const second = region(e.placeLegend);
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
    const school = closed('At school');
    expect(within(school).getByText('I need a break')).toBeInTheDocument();
    expect(within(school).queryByLabelText(f.meaningLabel)).not.toBeInTheDocument();
    await user.click(within(school).getByRole('button', { name: e.changeLabel('At school') }));
    // Open: the words lead; the saved place waits behind "Change where".
    expect(within(region('At school')).queryByRole('button', { name: copy.labels.context.home })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: e.changeWhereLabel('At home') }));
    await user.click(within(region('At home')).getByRole('button', { name: e.anywhere }));
    expect(region(e.anywhere)).toBeInTheDocument();
  });

  it('asks where with the common places first, the rest behind “More places”', async () => {
    const user = userEvent.setup();
    renderAt('/cues/new');
    const place = region(e.placeLegend);
    expect(within(place).getByRole('button', { name: copy.labels.context.school })).toBeInTheDocument();
    expect(within(place).queryByRole('button', { name: copy.labels.context.transport })).not.toBeInTheDocument();
    await user.click(within(place).getByRole('button', { name: e.morePlaces }));
    await user.click(within(place).getByRole('button', { name: copy.labels.context.transport }));
    expect(region('When travelling')).toBeInTheDocument();
  });

  it('opens on the meaning chosen in the library, its heading focused', () => {
    const school = ARI_CUES[1]!.cue_meanings[1]!;
    renderAt(`/cues/demo-cookie#meaning-${school.id}`);
    expect(screen.getByRole('heading', { level: 3, name: 'At school' })).toHaveFocus();
    expect(within(region('At school')).getByLabelText(f.meaningLabel)).toHaveValue('I need a break');
    // The others stay closed, reading as a worker sees them.
    expect(within(closed('At home or at mealtimes')).queryByLabelText(f.meaningLabel)).not.toBeInTheDocument();
  });

  it('“Add what it means at camp” opens a new meaning already set to camp', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-shoes?add=camp');
    expect(screen.getByRole('heading', { level: 3, name: 'At camp' })).toHaveFocus();
    await user.type(within(region('At camp')).getByLabelText(f.meaningLabel), 'I want to go to the lake');
    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(saveCue).toHaveBeenCalled());
    expect(saveCue.mock.calls[0]![1]).toEqual([
      expect.objectContaining({ context_tags: ['home'] }),
      expect.objectContaining({ context_tags: ['camp'], meaning: 'I want to go to the lake' }),
    ]);
  });

  it('adds another place as a quiet text action', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-cookie');
    await user.click(screen.getByRole('button', { name: e.addMeaning }));
    expect(within(region(e.placeLegend)).getByRole('heading', { level: 3 })).toHaveFocus();
  });

  it('points to every missing piece, opening the meanings that need it, and keeps what was typed', async () => {
    const user = userEvent.setup();
    renderAt('/cues/new');
    await user.click(within(region(e.placeLegend)).getByRole('button', { name: e.anywhere }));
    await user.click(screen.getByRole('button', { name: e.addMeaning }));
    await user.click(within(region(e.placeLegend)).getByRole('button', { name: copy.labels.context.school }));
    await user.type(within(region('At school')).getByLabelText(f.todoLabel), 'Offer the quiet corner');
    await user.click(within(region('At school')).getByRole('button', { name: e.doneLabel('At school') }));
    await user.click(screen.getByRole('button', { name: e.save }));

    expect(screen.getByText(f.labelMissing)).toBeInTheDocument();
    expect(screen.getAllByText(f.meaningMissing)).toHaveLength(2);
    expect(screen.getByLabelText(e.seeHearQuestion)).toHaveFocus();
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

  it('at 5 of 5, ticking the card asks which cue to swap out, and swaps on save', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-shoes');
    expect(screen.getByText(e.pinFull)).toBeInTheDocument();
    await user.click(screen.getByLabelText(e.pinLabel('Ari')));
    const dialog = screen.getByRole('dialog', { name: l.swapTitle });
    await user.click(within(dialog).getByRole('button', { name: /^Cookie time/ }));
    expect(screen.getByLabelText(e.pinLabel('Ari'))).toBeChecked();
    expect(screen.getByText(e.swapPending('Cookie time'))).toBeInTheDocument();
    expect(screen.queryByText(/6 of 5/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(saveCue).toHaveBeenCalledTimes(2));
    expect(saveCue.mock.calls[0]![0]).toMatchObject({ id: 'demo-cookie', pinned: false });
    expect(saveCue.mock.calls[1]![0]).toMatchObject({ id: 'demo-shoes', pinned: true });
  });

  it('keeps the card as it is when the swap is cancelled', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-shoes');
    await user.click(screen.getByLabelText(e.pinLabel('Ari')));
    await user.click(screen.getByRole('button', { name: l.swapKeep }));
    expect(screen.getByLabelText(e.pinLabel('Ari'))).not.toBeChecked();
  });

  it('explains when saving fails because the card is full', async () => {
    const user = userEvent.setup();
    saveCue.mockRejectedValue({ message: 'pin_limit' });
    cues = ARI_CUES.map((c) => (c.id === 'demo-rocking' ? { ...c, pinned: false, pin_order: null } : c));
    renderAt('/cues/demo-shoes');
    await user.click(screen.getByLabelText(e.pinLabel('Ari')));
    expect(screen.getByText(e.pinHint(5))).toBeInTheDocument();
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
    // No banner: the worker's quote stands alone, and the meaning says what's missing.
    expect(screen.queryByText(/From a worker’s note/)).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(copy.inbox.needsMeaning))).toBeInTheDocument();
    expect(screen.getByLabelText(f.labelLabel)).toHaveValue('Flaps both hands');
    const meaning = region('At camp');
    expect(within(meaning).getByText(new RegExp('^' + e.fromNote('Jo').replace(/[.?]/g, '\\$&')))).toBeInTheDocument();
    expect(within(meaning).getByLabelText(f.todoLabel)).toHaveValue('Gave him space');
    // The worker's words, quoted above the form.
    const quote = screen.getByText(e.quoteHeading('Jo')).closest('figure')!;
    expect(within(quote).getByText('Flaps both hands')).toBeInTheDocument();
    expect(within(quote).getByText('Gave him space')).toBeInTheDocument();
    expect(within(quote).getByText(copy.inbox.outcomes.worked)).toBeInTheDocument();

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
    // The note's meaning comes first, open.
    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('At camp');
    expect(within(camp).getByLabelText(f.meaningLabel)).toHaveValue('A drink');
    expect(within(camp).getByLabelText(/^What to avoid/)).toHaveValue('Offered a biscuit');
    expect(within(closed('At school')).queryByLabelText(f.meaningLabel)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: e.delete })).not.toBeInTheDocument();
  });

  it('ignores a note that has already been dealt with', () => {
    notes = [note({ status: 'approved' })];
    renderAt('/cues/new?note=note-1');
    expect(screen.getByLabelText(e.seeHearQuestion)).toHaveValue('');
  });
});

describe('round 3', () => {
  it('keeps the note’s meaning first and marked when the page renders again', () => {
    notes = [note({ cue_id: 'demo-cookie', seemed_to_need: 'A drink' })];
    const view = renderAt('/cues/demo-cookie?note=note-1');
    // A later render builds a new draft with new keys; the editor must keep its own.
    view.rerender(tree('/cues/demo-cookie?note=note-1'));
    view.rerender(tree('/cues/demo-cookie?note=note-1'));
    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('At camp');
    expect(within(region('At camp')).getByText(/^New, from Jo’s note/)).toBeInTheDocument();
    expect(within(region('At camp')).getByLabelText(f.meaningLabel)).toHaveValue('A drink');
  });

  it('quotes what the worker saw, even when they picked a cue from the profile', () => {
    notes = [note({ cue_id: 'demo-cookie', cue_text: '', seemed_to_need: 'A drink' })];
    renderAt('/cues/demo-cookie?note=note-1');
    const quote = screen.getByText(e.quoteHeading('Jo')).closest('figure')!;
    expect(within(quote).getByText(e.quoteSaw)).toBeInTheDocument();
    expect(within(quote).getByText('Cookie time')).toBeInTheDocument();
  });

  it('returns focus to the cue that was saved', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-cookie');
    await user.type(screen.getByLabelText(f.labelLabel), '!');
    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(screen.getByRole('link', { name: l.editLabel('Cookie time') })).toHaveFocus());
  });

  it('a place gap row has one action and no card control, under a plain line', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: copy.labels.context.camp }));
    const gaps = region(new RegExp('^' + l.gapsHeading('at camp')));
    expect(within(gaps).getByText(l.gapsHint)).toBeInTheDocument();
    expect(within(gaps).queryByRole('button', { name: /card/ })).not.toBeInTheDocument();
    expect(within(gaps).getAllByRole('link', { name: /^Add what it means at camp/ })).toHaveLength(2);
  });

  it('numbers the swap list in card order', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.click(screen.getByRole('button', { name: l.pinAddLabel('Blue bottle') }));
    const dialog = screen.getByRole('dialog', { name: l.swapTitle });
    const options = within(dialog).getAllByRole('button', { name: /Take off$/ });
    expect(options.map((o) => o.textContent)).toEqual(
      ARI_CUES.filter((x) => x.pinned).map((x, i) => `${i + 1}${x.label}${l.takeOff}`),
    );
  });

  it('“Keep it on” undoes a swap chosen from the editor', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-shoes');
    await user.click(screen.getByLabelText(e.pinLabel('Ari')));
    await user.click(within(screen.getByRole('dialog', { name: l.swapTitle })).getByRole('button', { name: /^Cookie time/ }));
    await user.click(screen.getByRole('button', { name: e.swapUndoLabel('Cookie time') }));
    expect(screen.getByLabelText(e.pinLabel('Ari'))).not.toBeChecked();
    expect(screen.getByText(e.pinFull)).toBeInTheDocument();
  });

  describe('on a wide screen', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('min-width: 1024px'),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('keeps the card in the side column and lists every cue A to Z once', () => {
      renderAt('/cues');
      const card = region(new RegExp('^' + l.onCardHeading('Ari')));
      expect(within(card).getAllByRole('listitem')).toHaveLength(5);
      expect(within(card).getByRole('button', { name: l.pinRemoveLabel('Cookie time') })).toHaveTextContent(l.takeOff);
      const all = region(new RegExp('^' + l.allHeading));
      const names = within(all).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(names).toEqual([...names].sort((a, b) => a!.localeCompare(b!, 'en-AU', { sensitivity: 'base' })));
      expect(names).toHaveLength(ARI_CUES.length);
      // Pinned rows state the fact; only unpinned rows offer "Add to card".
      expect(within(all).queryByRole('button', { name: /^Take off card/ })).not.toBeInTheDocument();
      expect(within(all).getAllByText(l.onCardFact)).toHaveLength(5);
      expect(within(all).getAllByRole('button', { name: /^Add to card/ })).toHaveLength(3);
    });
  });
});
