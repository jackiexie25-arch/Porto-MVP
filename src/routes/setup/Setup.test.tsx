import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { Cue, Profile } from '../../data/types';
import { makeCue, makeProfile } from '../../test/fixtures';
import { resumeStep, Setup } from './Setup';

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

function renderStep(step: number) {
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

beforeEach(() => {
  profile = makeProfile({ display_name: '', setup_started_at: '2026-11-01T00:00:00Z' });
  cues = [];
  saveProfile.mockReset().mockResolvedValue(undefined);
  saveSection.mockReset().mockResolvedValue(undefined);
  addCue.mockReset().mockResolvedValue(makeCue());
});

describe('resumeStep', () => {
  it('returns to where the family left off, or the start once setup is done', () => {
    expect(resumeStep(4, false)).toBe(4);
    expect(resumeStep(9, false)).toBe(6);
    expect(resumeStep(4, true)).toBe(1);
  });
});

describe('setup steps', () => {
  it('shows progress as steps, never as a percentage', () => {
    renderStep(2);
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('step 1 saves what was typed, then moves on and records progress', async () => {
    const user = userEvent.setup();
    renderStep(1);
    await user.type(screen.getByLabelText(copy.setup.about.nameLabel), 'Ari');
    expect(screen.getByText(copy.setup.about.styleIdentity('Ari'))).toBeInTheDocument();
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
    await user.type(screen.getByLabelText(copy.sectionFields.toileting.signs.label), 'Taps the door twice');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/3'));
    expect(saveSection).toHaveBeenCalledWith('toileting', {
      details: { signs: 'Taps the door twice' },
      body: '',
    });
  });

  it('step 5 adds a half-written cue on continue only once it is complete', async () => {
    const user = userEvent.setup();
    renderStep(5);
    await user.click(screen.getByRole('button', { name: copy.setup.cues.examples[0]!.label }));
    await user.type(screen.getByLabelText(copy.cueForm.labelLabel), 'Cookie time');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));

    expect(await screen.findByText(copy.cueForm.meaningMissing)).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/setup/5');
    expect(addCue).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(copy.cueForm.meaningLabel), 'I’m hungry');
    await user.click(screen.getByRole('button', { name: copy.setup.continue }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/setup/6'));
    expect(addCue).toHaveBeenCalledWith(
      { label: 'Cookie time', cue_type: 'phrase', category: 'other' },
      expect.objectContaining({ meaning: 'I’m hungry', confidence: 'usually' }),
    );
  });

  it('step 6 can go straight to sharing', async () => {
    const user = userEvent.setup();
    profile = makeProfile({ setup_step: 6 });
    renderStep(6);
    await user.click(screen.getByRole('button', { name: copy.setup.preview.share }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/share'));
  });

  it('step 6 previews the card with a reading time and finishes setup', async () => {
    const user = userEvent.setup();
    profile = makeProfile({ setup_step: 6 });
    cues = [makeCue()];
    renderStep(6);
    expect(screen.getByText(/minute to read/)).toBeInTheDocument();
    expect(screen.getByText('Cookie time')).toBeInTheDocument();
    expect(screen.getByText(copy.layout.emergency)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.setup.preview.finish }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/card'));
    expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ setup_completed_at: expect.any(String) }));
  });
});
