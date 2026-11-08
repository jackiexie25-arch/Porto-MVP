import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { FamilyGate } from './auth/FamilyGate';
import { AuthCallback } from './routes/auth/AuthCallback';
import { CheckEmail } from './routes/auth/CheckEmail';
import { Consent } from './routes/auth/Consent';
import { SignIn } from './routes/auth/SignIn';
import { SignUp } from './routes/auth/SignUp';
import { Start } from './routes/auth/Start';
import { CardPage } from './routes/family/CardPage';
import { CardPrint } from './routes/family/CardPrint';
import { FamilyArea, FamilyHome, SignOut } from './routes/family/FamilyRoutes';
import { NotFound } from './routes/NotFound';
import { Privacy } from './routes/Privacy';
import { Setup, SetupResume } from './routes/setup/Setup';
import { Styleguide } from './routes/Styleguide';
import { Welcome } from './routes/Welcome';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signout" element={<SignOut />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/styleguide" element={<Styleguide />} />

          <Route
            path="/consent"
            element={
              <FamilyGate need="session">
                <Consent />
              </FamilyGate>
            }
          />
          <Route
            path="/start"
            element={
              <FamilyGate need="consent">
                <Start />
              </FamilyGate>
            }
          />

          <Route element={<FamilyArea />}>
            <Route path="/home" element={<FamilyHome />} />
            <Route path="/setup" element={<SetupResume />} />
            <Route path="/setup/:step" element={<Setup />} />
            <Route path="/card" element={<CardPage />} />
            <Route path="/card/print" element={<CardPrint />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
