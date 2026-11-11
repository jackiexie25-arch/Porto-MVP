import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextTag } from '../data/types';
import type { SearchHit, WorkerSource } from './types';
import { SEARCH_DELAY, useWorkerSearch } from './useWorkerSearch';

const hit = (label: string): SearchHit => ({ id: label, label, cue_type: 'phrase', category: 'other', match: 'label', meanings: [] });

function source(search: WorkerSource['search']): WorkerSource {
  return { getCard: vi.fn(), search, logNote: vi.fn(), feedback: vi.fn() };
}

type Props = { query: string; place: ContextTag | null; enabled: boolean };

function setup(search: WorkerSource['search'], onClosed = vi.fn()) {
  const src = source(search);
  return renderHook((props: Props) => useWorkerSearch({ source: src, onClosed, ...props }), {
    initialProps: { query: '', place: null, enabled: true } as Props,
  });
}

const wait = () => act(() => vi.advanceTimersByTimeAsync(SEARCH_DELAY + 10));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWorkerSearch', () => {
  it('stays idle until there are words to look up', () => {
    const search = vi.fn();
    const { result } = setup(search);
    expect(result.current).toEqual({ search: { kind: 'idle' }, pending: false, hasQuery: false });
    expect(search).not.toHaveBeenCalled();
  });

  it('searches with the place once the worker pauses, then shows the family’s results', async () => {
    const search = vi.fn().mockResolvedValue({ status: 'ok', results: [hit('Cookie time')] });
    const { result, rerender } = setup(search);
    rerender({ query: 'cookie', place: 'school', enabled: true });
    expect(result.current.search).toEqual({ kind: 'loading' });
    expect(result.current.pending).toBe(true);
    await wait();
    expect(search).toHaveBeenCalledWith('cookie', 'school');
    expect(result.current.search).toEqual({ kind: 'results', hits: [hit('Cookie time')] });
    expect(result.current.pending).toBe(false);
  });

  it('keeps the last results on screen while the worker refines the search', async () => {
    const search = vi.fn().mockResolvedValue({ status: 'ok', results: [hit('Cookie time')] });
    const { result, rerender } = setup(search);
    rerender({ query: 'cookie', place: null, enabled: true });
    await wait();
    rerender({ query: 'cookie t', place: null, enabled: true });
    expect(result.current.search.kind).toBe('results');
    expect(result.current.pending).toBe(true);
  });

  it('does not search again when the words are the same after tidying', async () => {
    const search = vi.fn().mockResolvedValue({ status: 'ok', results: [] });
    const { rerender } = setup(search);
    rerender({ query: 'cookie', place: null, enabled: true });
    await wait();
    rerender({ query: 'Cookie!', place: null, enabled: true });
    await wait();
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('shows only the latest answer when an earlier one arrives late', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const search = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue({ status: 'ok', results: [hit('Second')] });
    const { result, rerender } = setup(search);
    rerender({ query: 'first', place: null, enabled: true });
    await wait();
    rerender({ query: 'second', place: null, enabled: true });
    await wait();
    await act(async () => resolveFirst({ status: 'ok', results: [hit('First')] }));
    expect(result.current.search).toEqual({ kind: 'results', hits: [hit('Second')] });
  });

  it('says to try again in a moment when busy, and reports a closed link', async () => {
    const onClosed = vi.fn();
    const search = vi.fn().mockResolvedValueOnce({ status: 'busy' }).mockResolvedValueOnce({ status: 'closed' });
    const { result, rerender } = setup(search, onClosed);
    rerender({ query: 'cookie', place: null, enabled: true });
    await wait();
    expect(result.current.search.kind).toBe('error');
    rerender({ query: 'door', place: null, enabled: true });
    await wait();
    expect(onClosed).toHaveBeenCalled();
  });

  it('never searches on a card-only link', async () => {
    const search = vi.fn();
    const { rerender } = setup(search);
    rerender({ query: 'cookie', place: null, enabled: false });
    await wait();
    expect(search).not.toHaveBeenCalled();
  });
});
