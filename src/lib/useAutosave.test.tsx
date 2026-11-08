import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from './useAutosave';

let api: { setValue: (v: string) => void; flush: () => Promise<boolean> };

function Harness({ save }: { save: (v: string) => Promise<void> }) {
  const [value, setValue] = useState('start');
  const { state, flush } = useAutosave(value, save, 800);
  api = { setValue, flush };
  return <p data-testid="state">{state}</p>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('saves once, a pause after typing stops', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    act(() => api.setValue('a'));
    act(() => api.setValue('ab'));
    await act(() => vi.advanceTimersByTimeAsync(799));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('ab');
    expect(screen.getByTestId('state')).toHaveTextContent('saved');
  });

  it('does not save when nothing changed', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await act(async () => {
      await api.flush();
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('flush saves straight away and reports success', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    act(() => api.setValue('typed'));
    let ok = false;
    await act(async () => {
      ok = await api.flush();
    });
    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledWith('typed');
  });

  it('reports a failed save and keeps the value to try again', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    render(<Harness save={save} />);
    act(() => api.setValue('typed'));
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(screen.getByTestId('state')).toHaveTextContent('error');
    await act(async () => {
      await api.flush();
    });
    expect(save).toHaveBeenLastCalledWith('typed');
    expect(screen.getByTestId('state')).toHaveTextContent('saved');
  });

  it('saves what was typed when the step is left', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<Harness save={save} />);
    act(() => api.setValue('left mid-sentence'));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(save).toHaveBeenCalledWith('left mid-sentence');
  });
});
