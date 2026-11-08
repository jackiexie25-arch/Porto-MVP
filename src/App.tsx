import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { FamilyGate } from './auth/FamilyGate';
import { AuthCallback } from './routes/auth/AuthCallback';
import { CheckEmail } from './routes/auth/CheckEmail';
import { Consent } from './routes/auth/Consent';
import { SignIn } from './routes/auth/SignIn';
import { SignUp } from './routes/auth/SignUp';
import { Start } from './routes/auth/Start';
import { FamilyHome } from './routes/family/FamilyHome';
import { NotFound } from './routes/NotFound';
import { Privacy } from './routes/Privacy';
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
          <Route
            path="/home"
            element={
              <FamilyGate need="profile">
                <FamilyHome />
              </FamilyGate>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
