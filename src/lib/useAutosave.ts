import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Saves `value` a short pause after it stops changing. Saves run one at a time, in order.
 * `flush()` saves straight away (for "Save and continue"); unmounting also flushes, so leaving
 * a step never loses what was typed.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delay = 800) {
  const [state, setState] = useState<AutosaveState>('idle');
  const latest = useRef(value);
  const saveRef = useRef(save);
  const savedJson = useRef(JSON.stringify(value));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const mounted = useRef(true);

  latest.current = value;
  saveRef.current = save;

  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      const snapshot = latest.current;
      const json = JSON.stringify(snapshot);
      if (json === savedJson.current) return true;
      if (mounted.current) setState('saving');
      try {
        await saveRef.current(snapshot);
        savedJson.current = json;
        if (mounted.current) setState('saved');
        return true;
      } catch {
        if (mounted.current) setState('error');
        return false;
      }
    });
    return chain.current;
  }, []);

  const json = JSON.stringify(value);
  useEffect(() => {
    if (json === savedJson.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
    return () => clearTimeout(timer.current);
  }, [json, delay, flush]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void flush();
    };
  }, [flush]);

  return { state, flush };
}
