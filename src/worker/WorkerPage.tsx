import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { shareSource } from './api';
import { ClosedView, WorkerView } from './WorkerView';

const TOKEN_KEY = 'porto.share';
/** The address shown after the token is taken out of it. Still under /s/ for the no-index, no-store headers. */
export const OPEN_PATH = '/s/open';

/**
 * Reads the share token from the link, then takes it out of the address bar (so it isn't in
 * screenshots or history). It's kept for this tab only, so a refresh still works. If this browser
 * won't keep it, the token stays in the address so refresh still works.
 */
export function takeToken(param: string | undefined): string | null {
  if (param && param !== 'open') {
    try {
      sessionStorage.setItem(TOKEN_KEY, param);
      return param;
    } catch {
      return param;
    }
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function canRemember(token: string): boolean {
  try {
    return sessionStorage.getItem(TOKEN_KEY) === token;
  } catch {
    return false;
  }
}

export default function WorkerPage() {
  const { token: param } = useParams();
  const [token] = useState(() => takeToken(param));
  const source = useMemo(() => (token ? shareSource(token) : null), [token]);

  useEffect(() => {
    if (token && param !== 'open' && canRemember(token)) {
      window.history.replaceState(window.history.state, '', OPEN_PATH);
    }
  }, [token, param]);

  if (!source) return <ClosedView />;
  return <WorkerView source={source} />;
}
