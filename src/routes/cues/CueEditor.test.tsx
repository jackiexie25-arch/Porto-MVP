import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { Cue } from '../../data/types';
import { ARI_CUES } from '../../demo/ari';
import { makeCue } from '../../test/fixtures';
import { CueEditorPage } from './CueEditor';
import { CueLibrary } from './CueLibrary';

const saveCue = vi.fn();
const deleteCue = vi.fn();
let cues: Cue[];

vi.mock('../../family/FamilyDataProvider', () => ({
  MAX_PINNED: 5,
  useFamilyData: () => ({ cues, saveCue, deleteCue }),
}));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cues" element={<CueLibrary />} />
        <Route path="/cues/new" element={<CueEditorPage />} />
        <Route path="/cues/:id" element={<CueEditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const e = copy.cueEditor;
const f = copy.cueForm;

beforeEach(() => {
  cues = ARI_CUES;
  saveCue.mockReset().mockResolvedValue(makeCue());
  deleteCue.mockReset().mockResolvedValue(undefined);
});

describe('cue library', () => {
  it('searches and filters the family’s cues, announcing the count', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    expect(screen.getByRole('status')).toHaveTextContent(`${ARI_CUES.length} cues`);

    await user.type(screen.getByLabelText(copy.cues.searchLabel), 'cookie!');
    expect(screen.getByRole('heading', { name: 'Cookie time' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Blue bottle' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`Showing 1 of ${ARI_CUES.length} cues`);

    await user.clear(screen.getByLabelText(copy.cues.searchLabel));
    await user.click(screen.getByRole('button', { name: copy.labels.category.overstimulation }));
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Hands over ears and humming',
      'Rocking faster than usual',
    ]);
  });

  it('shows each meaning in its own context', () => {
    renderAt('/cues');
    const cookie = screen.getByRole('heading', { name: 'Cookie time' }).closest('li')!;
    expect(within(cookie).getByText('At home or at mealtimes:')).toBeInTheDocument();
    expect(within(cookie).getByText('At school:')).toBeInTheDocument();
  });

  it('says so plainly when nothing matches, and can clear the search', async () => {
    const user = userEvent.setup();
    renderAt('/cues');
    await user.type(screen.getByLabelText(copy.cues.searchLabel), 'giraffe');
    expect(screen.getByText(copy.cues.noMatches('giraffe'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.cues.clear }));
    expect(screen.getByLabelText(copy.cues.searchLabel)).toHaveValue('');
  });

  it('has a friendly empty state', () => {
    cues = [];
    renderAt('/cues');
    expect(screen.getByRole('heading', { name: copy.cues.emptyHeading })).toBeInTheDocument();
  });
});

describe('cue editor', () => {
  it('adds a second meaning for another place and saves both together', async () => {
    const user = userEvent.setup();
    cues = [];
    renderAt('/cues/new');

    await user.type(screen.getByLabelText(f.labelLabel), 'Cookie time');
    await user.type(screen.getByLabelText(new RegExp(`^${e.aliasesLabel}`)), 'cookie, Cookies, cookie');
    const first = screen.getByRole('region', { name: e.meaningLegend(1) });
    await user.click(within(first).getByRole('button', { name: copy.labels.context.home }));
    await user.type(within(first).getByLabelText(f.meaningLabel), 'I’m hungry');

    await user.click(screen.getByRole('button', { name: e.addMeaning }));
    const second = screen.getByRole('region', { name: e.meaningLegend(2) });
    await user.click(within(second).getByRole('button', { name: copy.labels.context.school }));
    await user.type(within(second).getByLabelText(f.meaningLabel), 'I need a break');
    await user.click(within(second).getByRole('button', { name: copy.labels.confidence.sometimes }));

    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(saveCue).toHaveBeenCalledTimes(1));
    const [cue, meanings] = saveCue.mock.calls[0]!;
    expect(cue).toMatchObject({ label: 'Cookie time', aliases: ['cookie', 'Cookies'], pinned: true });
    expect(meanings).toEqual([
      expect.objectContaining({ context_tags: ['home'], meaning: 'I’m hungry', confidence: 'usually' }),
      expect.objectContaining({ context_tags: ['school'], meaning: 'I need a break', confidence: 'sometimes' }),
    ]);
    expect(await screen.findByText(copy.cues.saved)).toBeInTheDocument();
  });

  it('points to every missing piece and keeps what was typed', async () => {
    const user = userEvent.setup();
    renderAt('/cues/new');
    await user.click(screen.getByRole('button', { name: e.addMeaning }));
    const second = screen.getByRole('region', { name: e.meaningLegend(2) });
    await user.type(within(second).getByLabelText(f.todoLabel), 'Offer the quiet corner');
    await user.click(screen.getByRole('button', { name: e.save }));

    expect(screen.getByText(f.labelMissing)).toBeInTheDocument();
    expect(screen.getAllByText(f.meaningMissing)).toHaveLength(2);
    expect(screen.getByLabelText(f.labelLabel)).toHaveFocus();
    expect(within(second).getByLabelText(f.todoLabel)).toHaveValue('Offer the quiet corner');
    expect(saveCue).not.toHaveBeenCalled();
  });

  it('edits an existing cue, keeping meaning ids so they update in place', async () => {
    const user = userEvent.setup();
    renderAt('/cues/demo-cookie');
    expect(screen.getByLabelText(f.labelLabel)).toHaveValue('Cookie time');
    await user.click(within(screen.getByRole('region', { name: e.meaningLegend(2) })).getByRole('button', { name: e.removeMeaning }));
    await user.click(screen.getByRole('button', { name: e.save }));
    await waitFor(() => expect(saveCue).toHaveBeenCalled());
    const [cue, meanings] = saveCue.mock.calls[0]!;
    expect(cue.id).toBe('demo-cookie');
    expect(meanings).toHaveLength(1);
    expect(meanings[0].id).toBe(ARI_CUES[1]!.cue_meanings[0]!.id);
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
    await user.click(screen.getByLabelText(e.pinLabel));
    await user.click(screen.getByRole('button', { name: e.save }));
    expect(await screen.findByText(copy.errors.pinLimit)).toBeInTheDocument();
  });

  it('says so when a cue no longer exists', () => {
    renderAt('/cues/not-a-cue');
    expect(screen.getByText(e.notFound)).toBeInTheDocument();
  });
});
