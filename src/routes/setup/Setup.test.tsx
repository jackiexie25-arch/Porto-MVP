import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { CardSection, Cue, Profile } from '../../data/types';
import { buildCard } from '../../lib/card';
import { makeCue, makeProfile, makeSection } from '../../test/fixtures';
import { readiness } from './ReadyStep';
import { resumeStep, Setup } from './Setup';
import { minutesLeft, nextPath, SETUP_STEPS, stepFor, stepWritten } from './steps';

const saveProfile = vi.fn();
const saveSection = vi.fn();
const addCue = vi.fn();
let profile: Profile;
let sections: CardSection[];
let cues: Cue[];

vi.mock('../../family/FamilyDataProvider', () => ({
  useFamilyData: () => ({ profile, sections, cues, saveProfile, saveSection, addCue, pendingNotes: 0 }),
}));

function Where() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderStep(step: number | 'ready') {
  render(
    <MemoryRouter initialEntries={[`/setup/${step}`]}>
      <Routes>
        <Route
          path="/setup/:step"
          element={
            <>
              <Setup />
              <Where />
            </>
          }
        />
        <Route path="/card" element={<Where />} />
        <Route path="/share" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const q = copy.setup.cues;
const toiletAsk = copy.sectionFields.toileting.signs.ask(copy.setup.yourChild);
const TOILETING = 3;
const WHO = 2;
const CUES = 6;

beforeEach(() => {
  profile = makeProfile({ display_name: '', setup_started_at: '2026-11-01T00:00:00Z', setup_completed_at: null });
  sections = [];
  cues = [];
  saveProfile.mockReset().mockResolvedValue(undefined);
  saveSection.mockReset().mockResolvedValue(undefined);
  addCue.mockReset().mockResolvedValue(makeCue());
});

describe('setup flow', () => {
  it('resumes where the family left off, or the start once setup is done', () => {
    expect(resumeStep(4, false)).toBe(4);
    expect(resumeStep(9, false)).toBe(6);
    expect(resumeStep(4, true)).toBe(1);
  });

  it('asks who to call second, then toileting, and ends on the card-ready page', () => {
    expect(SETUP_STEPS).toBe(6);
    expect(copy.setup.stepNames).toEqual(['About', 'Who to call', 'Toileting', 'Food and drink', 'Calming', 'First cues']);
    expect(stepFor('who')).toBe(WHO);
    expect(stepFor('toileting')).toBe(TOILETING);
    expect(stepFor('avoid')).toBe(5);
    expect(nextPath(5)).toBe('/setup/6');
    expect(nextPath(6)).toBe('/setup/ready');
  });

  it('counts down about 15 minutes over the six steps', () => {
    expect(minutesLeft(1)).toBe(15);
    expect(minutesLeft(6)).toBeGreaterThan(0);
    expect(minutesLeft(6)).toBeLessThan(minutesLeft(5));
  });

  it('ticks a step only when the card has words from it', () => {
    const empty = buildCard(makeProfile({ connect_note: '', communication_modes: [], languages: [] }), [], [], 'your child');
    expect(stepWritten(empty, 1)).toBe(false);
    expect(stepWritten(empty, TOILETING)).toBe(false);
    const written = buildCard(makeProfile(), [makeSection('calms', {}, 'A quiet corner.')], [], 'Ari');
    expect(stepWritten(written, 1)).toBe(true);
    expect(stepWritten(written, 5)).toBe(true);
  });
});

describe('setup steps', () => {
  it('shows progress as the six named parts and time left, never as a percentage', () => {
    renderStep(TOILETING);
    expect(screen.getByText(copy.setup.progress(TOILETING, 6, minutesLeft(TOILETING)))).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: copy.setup.progressLabel });
    expect(within(nav).getByText('Toileting, this step')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('on phones, says the step in one line: “Toileting · 3 of 6 · about 11 minutes left”', () => {
    renderStep(TOILETING);
    expect(screen.getByText(copy.setup.progressShort('Toileting', TOILETING, 6, minutesLeft(TOILETING)))).toBeInTheDocument();
  });

  it('says nothing is on the card yet above Save, rather than “0 words”', () => {
    profile = makeProfile({ display_name: '', connect_note: '', communication_modes: [], languages: [], setup_completed_at: null });
    renderStep(TOILETING);
    expect(screen.getByText(copy.setup.soFar(0))).toBeInTheDocument();
  });

  it('says what setup involves, and the tips, once on the first step only', () => {
    renderStep(1);
    expect(screen.getByText(copy.setup.start.lead)).toBeInTheDocument();
    expect(screen.getByText(copy.setup.start.tips[0])).toBeInTheDocument();
  });

  it('keeps the tips off the other steps', () => {
    renderStep(TOILETING);
    expect(screen.queryByText(copy.setup.start.tips[0])).not.toBeInTheDocument();
    renderStep(CUES);
    expect(screen.queryByText(copy.setup.start.tips[0])).not.toBeInTheDocument();
  });

  it('step 1 saves what was typed, then moves on and records progress', async () => {
    const user = userEvent.setup();
    renderStep(1);
    await user.type(screen.getByLabelText(copy.setup.about.nameLabel), 'Ari');
    // Every later question uses the name.
    expect(screen.getByText(copy.setup.about.connectLabel('Ari'))).toBeInTheDocument();
    // Languages and wording wait under "More about Ari".
    expect(screen.getByText(copy.setup.about.more('Ari'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));

    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/2'));
    expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Ari' }));
    expect(saveProfile).toHaveBeenCalledWith({ setup_step: 2 });
  });

  it('every step can be skipped', async () => {
    const user = userEvent.setup();
    renderStep(4);
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/5'));
    expect(saveSection).not.toHaveBeenCalled();
  });

  it('the toileting step saves each answer separately', async () => {
    const user = userEvent.setup();
    renderStep(TOILETING);
    await user.type(screen.getByLabelText(toiletAsk), 'Taps the door twice');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/4'));
    expect(saveSection).toHaveBeenCalledWith('toileting', {
      details: { signs: 'Taps the door twice' },
      body: '',
    });
  });

  it('an example can be tapped to start from, then made the family’s own', async () => {
    const user = userEvent.setup();
    renderStep(TOILETING);
    const example = copy.sectionFields.toileting.signs.example;
    await user.click(screen.getByRole('button', { name: new RegExp(example.slice(0, 20)) }));
    const box = screen.getByLabelText(toiletAsk);
    expect(box).toHaveValue(example);
    expect(box).toHaveFocus();
    expect(screen.getByText(copy.setup.length.good)).toBeInTheDocument();
  });

  it('counts the words when an answer is getting long, while it’s written', async () => {
    const user = userEvent.setup();
    renderStep(TOILETING);
    await user.type(screen.getByLabelText(toiletAsk), 'word '.repeat(35));
    expect(screen.getByText(copy.setup.length.long(35))).toBeInTheDocument();
  });

  it('shows the whole card as a worker will read it, as it is typed, and its reading time', async () => {
    const user = userEvent.setup();
    renderStep(TOILETING);
    // The part being written shows even while empty.
    expect(screen.getAllByText(copy.setup.preview.current).length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText(toiletAsk), 'Taps the door twice');
    expect(screen.getAllByText('Taps the door twice').length).toBeGreaterThan(0);
    expect(screen.getByText(copy.setup.soFar(1))).toBeInTheDocument();
    // No fold links inside a preview.
    const aside = screen.getByRole('complementary', { name: copy.setup.preview.heading });
    expect(within(aside).queryByText(copy.card.hide)).not.toBeInTheDocument();
  });

  it('who to call saves a whole number', async () => {
    const user = userEvent.setup();
    renderStep(WHO);
    await user.type(screen.getByLabelText(copy.card.who.nameLabel), 'Sam');
    await user.type(screen.getByLabelText(copy.card.who.phoneLabel), '0412 345 678');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/3'));
    expect(saveProfile).toHaveBeenCalledWith({ who_to_call_name: 'Sam', who_to_call_phone: '0412 345 678' });
  });

  it('who to call never drops a half-typed number: it says so, on continue or skip', async () => {
    const user = userEvent.setup();
    renderStep(WHO);
    await user.type(screen.getByLabelText(copy.card.who.phoneLabel), '0412');
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    expect(screen.getByText(copy.card.who.phoneInvalid)).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/setup/2');
    expect(saveProfile).not.toHaveBeenCalledWith(expect.objectContaining({ who_to_call_phone: '0412' }));
  });

  it('says a number can’t be rung as soon as its box is left', async () => {
    const user = userEvent.setup();
    renderStep(WHO);
    await user.type(screen.getByLabelText(copy.card.who.phoneLabel), '0412');
    expect(screen.queryByText(copy.card.who.phoneInvalid)).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByText(copy.card.who.phoneInvalid)).toBeInTheDocument();
  });

  it('never says plain “Saved.” while the typed number isn’t saved', async () => {
    const user = userEvent.setup();
    renderStep(WHO);
    await user.type(screen.getByLabelText(copy.card.who.nameLabel), 'Sam');
    await user.type(screen.getByLabelText(copy.card.who.phoneLabel), '04');
    await waitFor(() => expect(screen.getByText(copy.setup.savedNameOnly)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByText(copy.setup.saved)).not.toBeInTheDocument();
  });

  it('first cues asks what you see or hear first, with the kind under More detail', () => {
    renderStep(CUES);
    const questions = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(questions.indexOf(q.seeLabel)).toBeLessThan(questions.indexOf(q.meaningLabel));
    expect(screen.getByText(q.moreDetail)).toBeInTheDocument();
  });

  it('first cues adds a half-written cue on continue only once it is complete', async () => {
    const user = userEvent.setup();
    renderStep(CUES);
    await user.type(screen.getByLabelText(q.seeLabel), 'Cookie time');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));

    expect(await screen.findByText(copy.cueForm.meaningMissing)).toBeInTheDocument();
    expect(screen.getByLabelText(q.meaningLabel)).toHaveFocus();
    expect(screen.getByTestId('path')).toHaveTextContent('/setup/6');
    expect(addCue).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(q.meaningLabel), 'I’m hungry');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/ready'));
    expect(addCue).toHaveBeenCalledWith(
      { label: 'Cookie time', cue_type: 'phrase', category: 'other' },
      expect.objectContaining({ meaning: 'I’m hungry', context_tags: [], confidence: 'usually' }),
    );
  });

  it('first cues never loses a typed cue to Skip: it asks first', async () => {
    const user = userEvent.setup();
    renderStep(CUES);
    await user.type(screen.getByLabelText(q.seeLabel), 'Cookie time');
    await user.type(screen.getByLabelText(q.meaningLabel), 'I’m hungry');
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    expect(screen.getByText(q.keepBody('Cookie time'))).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/setup/6');
    await user.click(screen.getByRole('button', { name: q.keepAdd }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/ready'));
    expect(addCue).toHaveBeenCalled();
  });

  it('when “Add it” can’t add the cue yet, focus goes to what is missing', async () => {
    const user = userEvent.setup();
    renderStep(CUES);
    await user.type(screen.getByLabelText(q.seeLabel), 'Spins in a circle');
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    await user.click(screen.getByRole('button', { name: q.keepAdd }));
    expect(await screen.findByText(copy.cueForm.meaningMissing)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(q.meaningLabel)).toHaveFocus());
    expect(screen.getByTestId('path')).toHaveTextContent('/setup/6');
  });

  it('first cues skips straight on when nothing was typed', async () => {
    const user = userEvent.setup();
    renderStep(CUES);
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/ready'));
  });

  it('moves focus to “Added to the profile.” after adding a cue, so it isn’t lost', async () => {
    const user = userEvent.setup();
    renderStep(CUES);
    await user.type(screen.getByLabelText(q.seeLabel), 'Cookie time');
    await user.type(screen.getByLabelText(q.meaningLabel), 'I’m hungry');
    await user.click(screen.getByRole('button', { name: q.add }));
    await waitFor(() => expect(screen.getByText(copy.cueForm.added).closest('[role="status"]')).toHaveFocus());
  });
});

describe('card ready', () => {
  const r = copy.setup.ready;
  const withWho = { who_to_call_name: 'Sam', who_to_call_phone: '0412 345 678' };
  const toilet = makeSection('toileting', { signs: 'Taps the door twice.' });

  it('is never ready without someone to call, then toileting', () => {
    expect(readiness(buildCard(makeProfile(), [toilet], [], 'Ari'))).toBe('needsWho');
    expect(readiness(buildCard(makeProfile(withWho), [], [], 'Ari'))).toBe('noToileting');
    expect(readiness(buildCard(makeProfile(withWho), [toilet], [], 'Ari'))).toBe('ready');
  });

  it('finishes setup on arrival and, when ready, goes straight to sharing', async () => {
    const user = userEvent.setup();
    profile = makeProfile({ ...withWho, setup_step: 6, setup_completed_at: null });
    sections = [toilet];
    renderStep('ready');
    expect(screen.getByRole('heading', { name: r.heading('Ari'), level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ setup_completed_at: expect.any(String) })));
    await user.click(screen.getByRole('button', { name: r.share }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/share'));
  });

  it('with no one to call, asks for a number right there, with sharing anyway as a plain link', async () => {
    const user = userEvent.setup();
    profile = makeProfile({ setup_completed_at: '2026-11-01T00:00:00Z' });
    sections = [toilet];
    cues = [makeCue()];
    renderStep('ready');
    expect(screen.getByRole('heading', { name: r.headingNeedsWho('Ari'), level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: r.shareWithout })).toHaveAttribute('href', '/share');
    expect(screen.getByRole('link', { name: r.later })).toHaveAttribute('href', '/card');
    // An empty or half-typed number isn't added.
    await user.click(screen.getByRole('button', { name: r.addWho }));
    expect(screen.getByText(copy.card.who.phoneMissing)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.card.who.phoneLabel)).toHaveFocus();
    await user.type(screen.getByLabelText(copy.card.who.phoneLabel), '0412 345 678');
    await user.click(screen.getByRole('button', { name: r.addWho }));
    expect(saveProfile).toHaveBeenCalledWith({ who_to_call_name: '', who_to_call_phone: '0412 345 678' });
  });

  it('says plainly when toileting is empty, and states gaps in the card with their size', () => {
    profile = makeProfile({ ...withWho, setup_completed_at: '2026-11-01T00:00:00Z' });
    renderStep('ready');
    expect(screen.getByRole('heading', { name: r.headingNoToileting('Ari'), level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: r.addToileting })).toHaveAttribute('href', '/setup/3');
    // Sharing is still there, as a plain link beside the one primary.
    expect(within(screen.getByRole('main')).getByRole('link', { name: r.share })).toHaveAttribute('href', '/share');
    expect(screen.queryByRole('button', { name: r.share })).not.toBeInTheDocument();
    expect(screen.getByText(copy.card.gap.toileting('Ari'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.card.addLabel(copy.card.sections.food_drink) })).toHaveAttribute('href', '/setup/4');
    expect(screen.getAllByText(copy.card.size(3, 1)).length).toBeGreaterThan(0);
    expect(screen.getByText(copy.layout.emergency)).toBeInTheDocument();
  });

  it('with no one to call and no toileting, says both, and never “ready to share”', () => {
    profile = makeProfile({ setup_completed_at: '2026-11-01T00:00:00Z' });
    renderStep('ready');
    expect(screen.getByRole('heading', { name: r.headingNeedsWho('Ari'), level: 1 })).toBeInTheDocument();
    expect(screen.getByText(r.noOne)).toBeInTheDocument();
    expect(screen.getByText(r.noToiletingEither)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: r.addToileting })).toHaveAttribute('href', '/setup/3');
    expect(screen.queryByText(/ready to share/)).not.toBeInTheDocument();
    // Who to call is asked above the card, not repeated inside it.
    expect(screen.queryByText(copy.card.gap.who)).not.toBeInTheDocument();
  });

  it('with someone to call but no number typed in, asks for one before calling it ready', () => {
    profile = makeProfile({ who_to_call_name: 'Sam', who_to_call_phone: '', setup_completed_at: '2026-11-01T00:00:00Z' });
    sections = [toilet];
    renderStep('ready');
    expect(screen.getByLabelText(copy.card.who.nameLabel)).toHaveValue('Sam');
    expect(screen.queryByText(/ready to share/)).toBeInTheDocument();
  });

  it('with no name typed, the heading is short and never lower case', () => {
    profile = makeProfile({ display_name: '', setup_completed_at: '2026-11-01T00:00:00Z' });
    renderStep('ready');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The card needs someone to call');
  });

  it('says nothing is on the card yet, rather than “0 words”', () => {
    profile = makeProfile({ display_name: '', connect_note: '', communication_modes: [], languages: [], setup_completed_at: '2026-11-01T00:00:00Z' });
    renderStep('ready');
    expect(screen.getByText(copy.card.readingTime(0, 0))).toBeInTheDocument();
    expect(screen.queryByText(/0 words/)).not.toBeInTheDocument();
  });
});
