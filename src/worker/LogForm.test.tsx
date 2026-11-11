import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../copy/en-AU';
import { ARI_CUES, ARI_PROFILE, ARI_SECTIONS } from '../demo/ari';
import type { WorkerCardData, WorkerSource } from './types';
import { WorkerView } from './WorkerView';

const w = copy.worker;
const l = w.log;

function cardData(scope: WorkerCardData['scope'] = 'card_search_log'): WorkerCardData {
  return {
    status: 'ok',
    scope,
    expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
    profile: { ...ARI_PROFILE },
    sections: ARI_SECTIONS,
    cues: [],
    cue_options: scope === 'card_search_log' ? ARI_CUES.map((c) => ({ id: c.id, label: c.label })) : [],
  };
}

let source: WorkerSource & {
  search: ReturnType<typeof vi.fn>;
  logNote: ReturnType<typeof vi.fn>;
  feedback: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  sessionStorage.clear();
  source = {
    getCard: vi.fn().mockResolvedValue(cardData()),
    search: vi.fn().mockResolvedValue({
      status: 'ok',
      results: [
        {
          id: 'demo-cookie',
          label: 'Cookie time',
          cue_type: 'phrase',
          category: 'food_drink',
          match: 'label',
          meanings: [
            {
              context_tags: [],
              context_text: '',
              meaning: 'I’m hungry',
              what_to_do: '',
              what_to_avoid: '',
              confidence: 'usually',
              in_context: false,
            },
          ],
        },
      ],
    }),
    logNote: vi.fn().mockResolvedValue({ status: 'ok' }),
    feedback: vi.fn().mockResolvedValue({ status: 'ok' }),
  };
});

describe('log what happened', () => {
  it('sends a note in one screen and thanks the worker without claiming it was added', async () => {
    const user = userEvent.setup();
    render(<WorkerView source={source} />);
    await user.click(await screen.findByRole('button', { name: w.tellFamily('Ari') }));
    const dialog = screen.getByRole('dialog', { name: l.title('Ari') });

    // Nothing to prefill: one text field, not the cue list.
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(l.cueLabel), 'Asked for a cookie');
    await user.click(within(dialog).getByText(l.more));
    await user.type(within(dialog).getByLabelText(new RegExp(`^${l.neededLabel}`)), 'A snack');
    await user.click(within(dialog).getByRole('button', { name: copy.labels.context.school }));
    await user.type(within(dialog).getByLabelText(new RegExp(`^${l.triedLabel}`)), 'Offered an apple');
    await user.click(within(dialog).getByRole('button', { name: l.outcomes.partly }));
    await user.type(within(dialog).getByLabelText(new RegExp(`^${l.nameLabel}`)), 'Jo');
    await user.click(within(dialog).getByRole('button', { name: l.submit('Ari') }));

    await waitFor(() =>
      expect(source.logNote).toHaveBeenCalledWith({
        cue_id: null,
        cue_text: 'Asked for a cookie',
        context_tags: ['school'],
        context_text: '',
        tried: 'Offered an apple',
        seemed_to_need: 'A snack',
        outcome: 'partly',
        worker_name: 'Jo',
      }),
    );
    expect(await within(dialog).findByText(l.sent('Ari'))).toBeInTheDocument();
    expect(within(dialog).queryByText(/added to the profile/i)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // never auto-dismisses
  });

  it('says what is missing and sends nothing', async () => {
    const user = userEvent.setup();
    render(<WorkerView source={source} />);
    await user.click(await screen.findByRole('button', { name: w.tellFamily('Ari') }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: l.submit('Ari') }));
    expect(within(dialog).getByText(l.missingCue)).toBeInTheDocument();
    expect(within(dialog).getByText(l.missingOutcome)).toBeInTheDocument();
    expect(source.logNote).not.toHaveBeenCalled();
  });

  it('opens from a search with no match, with what they typed already filled in', async () => {
    const user = userEvent.setup();
    source.search.mockResolvedValue({ status: 'ok', results: [] });
    render(<WorkerView source={source} />);
    await user.type(await screen.findByRole('searchbox'), 'flaps hands');
    await screen.findByText(w.noMatch('Ari'));
    await user.click(await screen.findByRole('button', { name: w.tellFamily('Ari') }));
    expect(within(screen.getByRole('dialog')).getByLabelText(l.cueLabel)).toHaveValue('flaps hands');
  });

  it('is not offered on links without notes', async () => {
    source.getCard = vi.fn().mockResolvedValue(cardData('card_search'));
    render(<WorkerView source={source} />);
    await screen.findByRole('searchbox');
    expect(screen.queryByRole('button', { name: w.tellFamily('Ari') })).not.toBeInTheDocument();
  });
});

describe('did this help', () => {
  it('records yes or not really for a result and thanks the worker', async () => {
    const user = userEvent.setup();
    render(<WorkerView source={source} />);
    await user.type(await screen.findByRole('searchbox'), 'cookie');
    await user.click(await screen.findByRole('button', { name: w.feedbackNoLabel('Cookie time') }));
    expect(source.feedback).toHaveBeenCalledWith('demo-cookie', false);
    expect(await screen.findByText(w.feedbackThanks)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: w.feedbackYesLabel('Cookie time') })).not.toBeInTheDocument();
  });

  it('offers a note about that cue, with the cue and the answer filled in', async () => {
    const user = userEvent.setup();
    render(<WorkerView source={source} />);
    await user.type(await screen.findByRole('searchbox'), 'cookie');
    await user.click(await screen.findByRole('button', { name: w.feedbackYesLabel('Cookie time') }));
    await user.click(await screen.findByRole('button', { name: w.feedbackNoteLabel('Cookie time') }));
    const dialog = screen.getByRole('dialog', { name: l.title('Ari') });
    expect(within(dialog).getByLabelText(l.cueLabel)).toHaveValue('demo-cookie');
    expect(within(dialog).getByRole('button', { name: l.outcomes.worked })).toHaveAttribute('aria-pressed', 'true');
  });
});
