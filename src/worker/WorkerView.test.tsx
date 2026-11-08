import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../copy/en-AU';
import { ARI_CUES, ARI_PROFILE, ARI_SECTIONS } from '../demo/ari';
import type { SearchHit, WorkerCardData, WorkerSource } from './types';
import { takeToken } from './WorkerPage';
import { WorkerView } from './WorkerView';

const w = copy.worker;

function cardData(overrides: Partial<WorkerCardData> = {}): WorkerCardData {
  return {
    status: 'ok',
    scope: 'card_search_log',
    expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
    profile: { ...ARI_PROFILE },
    sections: ARI_SECTIONS,
    cues: ARI_CUES.filter((c) => c.pinned).map((c) => ({ ...c })),
    ...overrides,
  };
}

const cookieHit: SearchHit = {
  id: 'demo-cookie',
  label: 'Cookie time',
  cue_type: 'phrase',
  category: 'food_drink',
  match: 'label',
  meanings: [
    {
      context_tags: ['school'],
      context_text: '',
      meaning: 'I need a break',
      what_to_do: 'Walk with him to the quiet corner.',
      what_to_avoid: 'Don’t offer food.',
      confidence: 'usually',
      in_context: true,
    },
    {
      context_tags: ['home', 'mealtime'],
      context_text: '',
      meaning: 'I’m hungry',
      what_to_do: 'Offer a snack.',
      what_to_avoid: '',
      confidence: 'usually',
      in_context: false,
    },
  ],
};

function source(overrides: Partial<WorkerSource> = {}): WorkerSource & { search: ReturnType<typeof vi.fn> } {
  return {
    getCard: vi.fn().mockResolvedValue(cardData()),
    search: vi.fn().mockResolvedValue({ status: 'ok', results: [cookieHit] }),
    ...overrides,
  } as WorkerSource & { search: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('worker view', () => {
  it('leads with who shared it, when the link closes, and the search', async () => {
    render(<WorkerView source={source()} />);
    expect(await screen.findByText(w.sharedBy('Ari'))).toBeInTheDocument();
    expect(screen.getByText(/^Link open until /)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: w.searchLabel })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: w.cardHeading })).toBeInTheDocument();
    expect(screen.getByText(w.privacy('Ari'))).toBeInTheDocument();
    expect(screen.getAllByText(copy.layout.emergency)).toHaveLength(1);
  });

  it('searches as the worker types, with their place, and shows that meaning first', async () => {
    const user = userEvent.setup();
    const src = source();
    render(<WorkerView source={src} />);
    await user.click(await screen.findByRole('button', { name: copy.labels.context.school }));
    await user.type(screen.getByRole('searchbox'), 'cookie time');

    const result = await screen.findByRole('heading', { name: 'Cookie time', level: 3 });
    expect(src.search).toHaveBeenLastCalledWith('cookie time', 'school');
    expect(src.search).toHaveBeenCalledTimes(1);
    const item = result.closest('li')!;
    const lines = within(item).getAllByText(/I need a break|I’m hungry/);
    expect(lines[0]).toHaveTextContent('I need a break');
    expect(within(item).getByText('Don’t offer food.')).toBeInTheDocument();
    expect(screen.getByText(w.resultCount(1))).toBeInTheDocument();
    expect(sessionStorage.getItem('porto.context')).toBe('school');
  });

  it('says plainly when nothing matches and offers the family’s calming advice, never a guess', async () => {
    const user = userEvent.setup();
    render(<WorkerView source={source({ search: vi.fn().mockResolvedValue({ status: 'ok', results: [] }) })} />);
    await user.type(await screen.findByRole('searchbox'), 'giraffe');
    expect(await screen.findByText(w.noMatch('Ari'))).toBeInTheDocument();
    const advice = screen.getByText(w.noMatchCalm).parentElement!;
    expect(within(advice).getByText(ARI_SECTIONS.find((s) => s.section === 'calms')!.body)).toBeInTheDocument();
  });

  it('opens a result larger', async () => {
    const user = userEvent.setup();
    render(<WorkerView source={source()} />);
    await user.type(await screen.findByRole('searchbox'), 'cookie');
    await user.click(await screen.findByRole('button', { name: w.biggerLabel('Cookie time') }));
    expect(screen.getByRole('dialog', { name: 'Cookie time' })).toBeInTheDocument();
  });

  it('hides search on a card-only link', async () => {
    render(<WorkerView source={source({ getCard: vi.fn().mockResolvedValue(cardData({ scope: 'card' })) })} />);
    expect(await screen.findByRole('heading', { name: w.cardHeading })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows only the calm closed message for a closed link', async () => {
    render(<WorkerView source={source({ getCard: vi.fn().mockResolvedValue({ status: 'closed' }) })} />);
    expect(await screen.findByRole('heading', { name: w.closedHeading })).toBeInTheDocument();
    expect(screen.getByText(w.closedBodyNoName)).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ari/)).not.toBeInTheDocument();
  });

  it('switches to the closed message if the link closes mid-shift', async () => {
    const user = userEvent.setup();
    render(<WorkerView source={source({ search: vi.fn().mockResolvedValue({ status: 'closed' }) })} />);
    await user.type(await screen.findByRole('searchbox'), 'cookie');
    expect(await screen.findByText(w.closedBody('Ari'))).toBeInTheDocument();
    expect(screen.queryByText('Taps the bathroom door twice.')).not.toBeInTheDocument();
  });

  it('asks the worker to try again in a moment when busy', async () => {
    render(<WorkerView source={source({ getCard: vi.fn().mockResolvedValue({ status: 'busy' }) })} />);
    expect(await screen.findByText(copy.common.tryAgainSoon)).toBeInTheDocument();
  });

  it('does not search again when the words are the same after tidying', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const src = source();
    render(<WorkerView source={src} />);
    await user.type(await screen.findByRole('searchbox'), 'cookie');
    await act(() => vi.advanceTimersByTimeAsync(500));
    await user.type(screen.getByRole('searchbox'), '!');
    await act(() => vi.advanceTimersByTimeAsync(500));
    await waitFor(() => expect(src.search).toHaveBeenCalledTimes(1));
  });
});

describe('share token in the address', () => {
  it('keeps the token for this tab and takes it out of the address', async () => {
    window.history.replaceState(null, '', '/s/TOKEN123');
    expect(takeToken('TOKEN123')).toBe('TOKEN123');
    expect(takeToken('open')).toBe('TOKEN123');

    const { default: WorkerPage } = await import('./WorkerPage');
    render(
      <MemoryRouter initialEntries={['/s/TOKEN123']}>
        <Routes>
          <Route path="/s/:token" element={<WorkerPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(window.location.pathname).toBe('/s/open'));
  });

  it('shows the closed message when there is no token to use', () => {
    expect(takeToken('open')).toBeNull();
  });
});
