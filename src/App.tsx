import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

// Two separate bundles: a worker opening a share link on their phone never downloads the family app.
const WorkerPage = lazy(() => import('./worker/WorkerPage'));
const FamilyApp = lazy(() => import('./FamilyApp'));
const DemoPage = lazy(() => import('./demo/DemoPage'));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/s/:token" element={<WorkerPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="*" element={<FamilyApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
