import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy/en-AU';
import type { CardSection, Profile } from '../../data/types';
import { makeProfile, makeSection } from '../../test/fixtures';
import { CardPage } from './CardPage';

const saveProfile = vi.fn();
const saveSection = vi.fn();
let profile: Profile;
let sections: CardSection[];

vi.mock('../../family/FamilyDataProvider', () => ({
  useFamilyData: () => ({ profile, sections, cues: [], saveProfile, saveSection, pendingNotes: 0 }),
}));

const c = copy.card;

function renderPage() {
  render(
    <MemoryRouter>
      <CardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  profile = makeProfile();
  sections = [makeSection('toileting', { signs: 'Taps the door twice.' })];
  saveProfile.mockReset().mockResolvedValue(undefined);
  saveSection.mockReset().mockResolvedValue(undefined);
});

describe('card page', () => {
  it('is one sheet in the worker’s order, with gaps said plainly and a quiet control for each part', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: c.heading('Ari'), level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Taps the door twice.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.changeLabel(c.sections.toileting) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.addLabel(c.sections.food_drink) })).toBeInTheDocument();
    expect(screen.getByText(c.emptyWho)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: c.addLabel(c.sections.cues) })).toHaveAttribute('href', '/cues');
    expect(screen.getByRole('link', { name: c.printLink })).toHaveAttribute('href', '/card/print');
  });

  it('changes a part in place, then returns focus to its control', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: c.changeLabel(c.sections.toileting) }));
    const box = screen.getByLabelText(copy.sectionFields.toileting.signs.ask('Ari'));
    expect(box).toHaveFocus();
    await user.clear(box);
    await user.type(box, 'Stands by the door.');
    await user.click(screen.getByRole('button', { name: c.doneLabel(c.sections.toileting) }));
    await waitFor(() => expect(saveSection).toHaveBeenCalledWith('toileting', expect.objectContaining({ details: { signs: 'Stands by the door.' } })));
    await waitFor(() => expect(screen.getByRole('button', { name: c.changeLabel(c.sections.toileting) })).toHaveFocus());
  });
});
