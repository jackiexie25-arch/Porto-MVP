import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { meetsNeed, nextFamilyStep, type FamilyNeed } from '../lib/family';
import { useAuth } from './AuthProvider';

/**
 * Shows its children only once the family has reached the stage the page needs
 * (signed in → consented → has a profile). Otherwise sends them to their next step.
 */
export function FamilyGate({ need, children }: { need: FamilyNeed; children: ReactNode }) {
  const { loading, status } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!meetsNeed(status, need)) {
    return <Navigate to={nextFamilyStep(status)} replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Signed in, nothing more (used by /team, whose own check decides what to show). */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { loading, status } = useAuth();
  if (loading) return <Loading />;
  if (!status.signedIn) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}
