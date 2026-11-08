import { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { FamilyGate } from '../../auth/FamilyGate';
import { Loading } from '../../components/Loading';
import { FamilyDataProvider, useFamilyData } from '../../family/FamilyDataProvider';

/** Every signed-in family page: consented, has a profile, and has its data loaded. */
export function FamilyArea() {
  return (
    <FamilyGate need="profile">
      <FamilyDataProvider>
        <Outlet />
      </FamilyDataProvider>
    </FamilyGate>
  );
}

/** /home: back to setup until it's done, then the card. */
export function FamilyHome() {
  const { profile } = useFamilyData();
  return <Navigate to={profile.setup_completed_at ? '/card' : '/setup'} replace />;
}

export function SignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    void signOut().finally(() => navigate('/', { replace: true }));
  }, [signOut, navigate]);
  return <Loading />;
}
