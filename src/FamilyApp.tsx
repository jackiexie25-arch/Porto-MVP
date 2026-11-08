import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { FamilyGate } from './auth/FamilyGate';
import { AuthCallback } from './routes/auth/AuthCallback';
import { CheckEmail } from './routes/auth/CheckEmail';
import { Consent } from './routes/auth/Consent';
import { SignIn } from './routes/auth/SignIn';
import { SignUp } from './routes/auth/SignUp';
import { Start } from './routes/auth/Start';
import { CueEditorPage } from './routes/cues/CueEditor';
import { CueLibrary } from './routes/cues/CueLibrary';
import { CardPage } from './routes/family/CardPage';
import { CardPrint } from './routes/family/CardPrint';
import { FamilyArea, FamilyHome, SignOut } from './routes/family/FamilyRoutes';
import { InboxPage } from './routes/inbox/InboxPage';
import { NotFound } from './routes/NotFound';
import { Privacy } from './routes/Privacy';
import { Setup, SetupResume } from './routes/setup/Setup';
import { SharePage } from './routes/share/SharePage';
import { Styleguide } from './routes/Styleguide';
import { Welcome } from './routes/Welcome';

/** Everything except the worker view: welcome, sign-in, and the signed-in family pages. */
export default function FamilyApp() {
  return (
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
          <Route path="/cues" element={<CueLibrary />} />
          <Route path="/cues/new" element={<CueEditorPage />} />
          <Route path="/cues/:id" element={<CueEditorPage />} />
          <Route path="/card" element={<CardPage />} />
          <Route path="/card/print" element={<CardPrint />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/inbox" element={<InboxPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
