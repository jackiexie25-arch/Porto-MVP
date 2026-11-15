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
    // Gaps are stated in place, with their size, and the card never offers to fold.
    expect(screen.getByText(c.gap.who)).toBeInTheDocument();
    expect(screen.getByText(c.gap.food_drink())).toBeInTheDocument();
    expect(screen.getAllByText(c.size(3, 1)).length).toBeGreaterThan(0);
    expect(screen.queryByText(c.hide)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: c.addLabel(c.sections.cues) })).toHaveAttribute('href', '/cues');
    expect(screen.getByRole('link', { name: c.printLink })).toHaveAttribute('href', '/card/print');
  });

  it('changes a part in place, then returns focus to its control', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: c.changeLabel(c.sections.toileting) }));
    const box = screen.getByLabelText(copy.sectionFields.toileting.signs.ask('Ari'));
    expect(box).toHaveFocus();
    expect(screen.getByText(c.editorKicker('Ari', c.size(3, 1)))).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'Stands by the door.');
    await user.click(screen.getByRole('button', { name: c.doneLabel(c.sections.toileting) }));
    await waitFor(() => expect(saveSection).toHaveBeenCalledWith('toileting', expect.objectContaining({ details: { signs: 'Stands by the door.' } })));
    await waitFor(() => expect(screen.getByRole('button', { name: c.changeLabel(c.sections.toileting) })).toHaveFocus());
  });

  it('won’t close Who to call on a number that can’t be right', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: c.addLabel(c.sections.who) }));
    await user.type(screen.getByLabelText(c.who.phoneLabel), '0412');
    await user.click(screen.getByRole('button', { name: c.doneLabel(c.sections.who) }));
    expect(screen.getByText(c.who.phoneInvalid)).toBeInTheDocument();
    expect(screen.getByLabelText(c.who.phoneLabel)).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalledWith(expect.objectContaining({ who_to_call_phone: '0412' }));
  });
});
