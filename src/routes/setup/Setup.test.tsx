import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { Cue, Profile } from '../../data/types';
import { buildCard } from '../../lib/card';
import { makeCue, makeProfile } from '../../test/fixtures';
import { missingParts } from './ReadyStep';
import { resumeStep, Setup } from './Setup';
import { minutesLeft, SETUP_STEPS } from './SetupFrame';
import { nextPath } from './useStepNav';

const saveProfile = vi.fn();
const saveSection = vi.fn();
const addCue = vi.fn();
let profile: Profile;
let cues: Cue[];

vi.mock('../../family/FamilyDataProvider', () => ({
  useFamilyData: () => ({ profile, sections: [], cues, saveProfile, saveSection, addCue }),
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

beforeEach(() => {
  profile = makeProfile({ display_name: '', setup_started_at: '2026-11-01T00:00:00Z', setup_completed_at: null });
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

  it('has six steps, then the card-ready page', () => {
    expect(SETUP_STEPS).toBe(6);
    expect(copy.setup.stepNames).toHaveLength(SETUP_STEPS);
    expect(nextPath(5)).toBe('/setup/6');
    expect(nextPath(6)).toBe('/setup/ready');
  });

  it('counts down about 15 minutes over the six steps', () => {
    expect(minutesLeft(1)).toBe(15);
    expect(minutesLeft(6)).toBeGreaterThan(0);
    expect(minutesLeft(6)).toBeLessThan(minutesLeft(5));
  });
});

describe('setup steps', () => {
  it('shows progress as named steps and time left, never as a percentage', () => {
    renderStep(2);
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
    expect(screen.getByText(copy.setup.minutesLeft(minutesLeft(2)))).toBeInTheDocument();
    expect(screen.getByText(/Toileting, this step/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('says what setup involves, and the tips, once on the first step only', () => {
    renderStep(1);
    expect(screen.getByText(copy.setup.start.lead)).toBeInTheDocument();
    expect(screen.getByText(copy.setup.start.tips[0])).toBeInTheDocument();
  });

  it('keeps the tips off the writing steps', () => {
    renderStep(2);
    expect(screen.queryByText(copy.setup.start.tips[0])).not.toBeInTheDocument();
  });

  it('step 1 saves what was typed, then moves on and records progress', async () => {
    const user = userEvent.setup();
    renderStep(1);
    await user.type(screen.getByLabelText(copy.setup.about.nameLabel), 'Ari');
    expect(screen.getByText(copy.setup.about.styleIdentity('Ari'))).toBeInTheDocument();
    // Every later question uses the name.
    expect(screen.getByText(copy.setup.about.connectLabel('Ari'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));

    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/2'));
    expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Ari' }));
    expect(saveProfile).toHaveBeenCalledWith({ setup_step: 2 });
  });

  it('every step can be skipped', async () => {
    const user = userEvent.setup();
    renderStep(3);
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/4'));
    expect(saveSection).not.toHaveBeenCalled();
  });

  it('step 2 saves each toileting answer separately', async () => {
    const user = userEvent.setup();
    renderStep(2);
    await user.type(screen.getByLabelText(toiletAsk), 'Taps the door twice');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/3'));
    expect(saveSection).toHaveBeenCalledWith('toileting', {
      details: { signs: 'Taps the door twice' },
      body: '',
    });
  });

  it('an example can be tapped to start from, then made the family’s own', async () => {
    const user = userEvent.setup();
    renderStep(2);
    const example = copy.sectionFields.toileting.signs.example;
    await user.click(screen.getByRole('button', { name: new RegExp(example.slice(0, 20)) }));
    const box = screen.getByLabelText(toiletAsk);
    expect(box).toHaveValue(example);
    expect(box).toHaveFocus();
    expect(screen.getByText(copy.setup.length.good)).toBeInTheDocument();
  });

  it('says plainly when an answer is getting long, while it’s written', async () => {
    const user = userEvent.setup();
    renderStep(2);
    await user.type(screen.getByLabelText(toiletAsk), 'word '.repeat(35));
    expect(screen.getByText(copy.setup.length.long)).toBeInTheDocument();
  });

  it('shows the section as a worker will read it, as it is typed', async () => {
    const user = userEvent.setup();
    renderStep(2);
    expect(screen.getAllByText(copy.setup.preview.empty).length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText(toiletAsk), 'Taps the door twice');
    expect(screen.getAllByText('Taps the door twice').length).toBeGreaterThan(0);
  });

  it('step 5 asks who to call and saves a whole number', async () => {
    const user = userEvent.setup();
    renderStep(5);
    await user.type(screen.getByLabelText(copy.card.who.nameLabel), 'Sam');
    await user.type(screen.getByLabelText(copy.card.who.phoneLabel), '0412 345 678');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/6'));
    expect(saveProfile).toHaveBeenCalledWith({ who_to_call_name: 'Sam', who_to_call_phone: '0412 345 678' });
  });

  it('step 5 stays put and says so when the number is half typed', async () => {
    const user = userEvent.setup();
    renderStep(5);
    await user.type(screen.getByLabelText(copy.card.who.phoneLabel), '0412');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    expect(screen.getByText(copy.card.who.phoneInvalid)).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/setup/5');
  });

  it('step 6 adds a half-written cue on continue only once it is complete', async () => {
    const user = userEvent.setup();
    renderStep(6);
    await user.type(screen.getByLabelText(q.seeLabel), 'Cookie time');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));

    expect(await screen.findByText(copy.cueForm.meaningMissing)).toBeInTheDocument();
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

  it('step 6 never loses a typed cue to Skip: it asks first', async () => {
    const user = userEvent.setup();
    renderStep(6);
    await user.type(screen.getByLabelText(q.seeLabel), 'Cookie time');
    await user.type(screen.getByLabelText(q.meaningLabel), 'I’m hungry');
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    expect(screen.getByText(q.keepBody('Cookie time'))).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/setup/6');
    await user.click(screen.getByRole('button', { name: q.keepAdd }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/ready'));
    expect(addCue).toHaveBeenCalled();
  });

  it('step 6 skips straight on when nothing was typed', async () => {
    const user = userEvent.setup();
    renderStep(6);
    await user.click(screen.getByRole('button', { name: copy.setup.skip }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/ready'));
  });

  it('step 6 moves focus to “Added to the profile.” after adding a cue, so it isn’t lost', async () => {
    const user = userEvent.setup();
    renderStep(6);
    await user.type(screen.getByLabelText(q.seeLabel), 'Cookie time');
    await user.type(screen.getByLabelText(q.meaningLabel), 'I’m hungry');
    await user.click(screen.getByRole('button', { name: q.add }));
    await waitFor(() => expect(screen.getByText(copy.cueForm.added).closest('[role="status"]')).toHaveFocus());
  });
});

describe('card ready', () => {
  it('finishes setup on arrival and can go straight to sharing', async () => {
    const user = userEvent.setup();
    profile = makeProfile({ setup_step: 6, setup_completed_at: null });
    renderStep('ready');
    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ setup_completed_at: expect.any(String) })));
    await user.click(screen.getByRole('button', { name: copy.setup.ready.share }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/share'));
  });

  it('shows the card with a reading time, and only says ready when someone can be called', () => {
    profile = makeProfile({ display_name: 'Ari', who_to_call_phone: '', setup_completed_at: '2026-11-01T00:00:00Z' });
    cues = [makeCue()];
    renderStep('ready');
    expect(screen.getByRole('heading', { name: copy.setup.ready.headingNearly('Ari') })).toBeInTheDocument();
    expect(screen.getByText(copy.setup.ready.missing.who)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.setup.ready.addLabel(copy.setup.ready.missing.who) })).toHaveAttribute('href', '/setup/5');
    expect(screen.getByText(/minute to read/)).toBeInTheDocument();
    expect(screen.getByText(copy.layout.emergency)).toBeInTheDocument();
  });

  it('lists what is missing as plain facts, who to call first', () => {
    const empty = buildCard(makeProfile({ connect_note: '', communication_modes: [], languages: [], who_to_call_phone: '' }), [], [], 'your child');
    const missing = missingParts(empty, false).map((m) => m.part);
    expect(missing[0]).toBe('who');
    expect(missing).toContain('toileting');
    expect(missing).toContain('cues');
    // Cues written but none on the card are chosen in the library.
    expect(missingParts(empty, true).find((m) => m.part === 'cues')?.to).toBe('/cues');
  });
});
